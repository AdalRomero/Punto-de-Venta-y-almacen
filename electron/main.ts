import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { startMySQL, stopMySQL } from "./mysqlManager";

// Equivalente a __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let pool: any = null;

// Mismo criterio que mysqlManager.ts para resolver rutas: en dev,
// relativo al proyecto (dist-electron/../assets); ya empaquetado,
// desde process.resourcesPath (requiere declarar "assets" como
// extraResource en electron-builder — ver package.json).
const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "assets", "logo.ico")
    : path.join(__dirname, "..", "assets", "logo.ico");

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, "preload.mjs"), // ojo: tu build genera preload.mjs, no .js
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (app.isPackaged) {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    } else {
        mainWindow.loadURL("http://localhost:5173");
    }
}

app.whenReady().then(async () => {
    try {
        // startMySQL ya deja la base "la_cuchilla" creada y, si estaba
        // vacía, con el esquema cargado (ver ensureSchemaLoaded en
        // mysqlManager.ts). Aquí solo falta abrir el pool normal.
        await startMySQL();

        const mysql = await import("mysql2/promise");

        pool = mysql.createPool({
            host: "127.0.0.1",
            port: 54320,
            user: "root",
            database: "la_cuchilla",
        });
    } catch (err) {
        console.error("Fallo iniciando MySQL:", err);
    }

    createWindow();
});

// Lecturas puras (SELECT). No dispara eventos de cambio.
ipcMain.handle("db:query", async (_event, sql: string, params: any[] = []) => {
    if (!pool) throw new Error("La base de datos no está lista todavía");
    const [rows] = await pool.query(sql, params);
    return rows;
});

// Escrituras (INSERT / UPDATE / DELETE / CALL a un procedimiento).
// `entity` es un string libre que tú eliges desde el renderer para
// identificar qué se modificó (ej. "productos", "inventario",
// "familias"). Después de ejecutar, se lo avisa a la ventana vía
// el evento "db:changed" para que el UI se refresque sin recargar
// ni hacer polling.
ipcMain.handle(
    "db:execute",
    async (_event, sql: string, params: any[] = [], entity?: string) => {
        if (!pool) throw new Error("La base de datos no está lista todavía");
        const [result] = await pool.query(sql, params);
        if (entity) {
            mainWindow?.webContents.send("db:changed", entity);
        }
        return result;
    }
);

/* ============================================================
   DOMINIO: AUTH (login)
   El renderer manda texto plano por IPC (misma ruta de confianza
   que ya usa users:crear para el alta); el hash NUNCA sale de acá.
   Acepta indistintamente el correo de acceso (Credenciales.correo_acceso)
   o el username interno (Perfil_Info.usuario) como identificador,
   así el usuario entra con lo que le sea más cómodo.
   ============================================================ */

interface LoginPayload {
    identifier: string;
    password: string;
}

ipcMain.handle("auth:login", async (_event, payload: LoginPayload) => {
    if (!pool) throw new Error("La base de datos no está lista todavía");

    const identifier = (payload.identifier ?? "").trim();
    const password = payload.password ?? "";

    if (!identifier || !password) {
        throw new Error("Correo/usuario y contraseña son obligatorios.");
    }

    // Un solo mensaje genérico para "no existe" y "contraseña mala":
    // no hay que darle pistas a quien intenta adivinar si el
    // correo/usuario existe o no.
    const CREDENCIALES_INVALIDAS = "Correo/usuario o contraseña incorrectos.";

    const [credRows]: any = await pool.query(
        `SELECT c.password_hash, p.id_perfil_info
         FROM Credenciales c
         JOIN Perfil_Info p ON p.id_perfil_info = c.id_perfil_info
         WHERE c.correo_acceso = ? OR p.usuario = ?
         LIMIT 1`,
        [identifier, identifier]
    );

    if (credRows.length === 0) {
        throw new Error(CREDENCIALES_INVALIDAS);
    }

    const passwordOk = await bcrypt.compare(password, credRows[0].password_hash);
    if (!passwordOk) {
        throw new Error(CREDENCIALES_INVALIDAS);
    }

    // Ya autenticado: arma el mismo shape que usan users.tsx/
    // detailsuser.tsx (v_usuarios), para que el renderer no tenga
    // que pedirlo aparte justo después de iniciar sesión.
    const [rows]: any = await pool.query(
        "SELECT * FROM v_usuarios WHERE id_perfil_info = ?",
        [credRows[0].id_perfil_info]
    );
    return rows[0];
});

/* ============================================================
   DOMINIO: USUARIOS (Perfil_Info + Credenciales + Contacto)
   No se exponen los procedimientos "en crudo" al renderer:
   sp_crear_usuario tiene un parámetro OUT (necesita una conexión
   dedicada, no el pool) y toda contraseña se hashea aquí, nunca
   en el renderer. Por eso cada acción tiene su propio canal IPC.
   ============================================================ */

interface NuevoUsuarioPayload {
    usuario: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    rol: string;
    correo_acceso: string;
    password: string;
    correo_personal: string | null;
    lada: string | null;
    telefono: string | null;
    direccion: string | null;
}

// Alta completa (Perfil_Info + Credenciales + Contacto). Usa
// sp_crear_usuario, que trae un OUT p_id_perfil_info: para leerlo
// hace falta la MISMA conexión en la que se hizo el CALL, por eso
// se saca una conexión del pool en vez de usar pool.query directo.
ipcMain.handle("users:crear", async (_event, input: NuevoUsuarioPayload) => {
    if (!pool) throw new Error("La base de datos no está lista todavía");

    const passwordHash = await bcrypt.hash(input.password, 10);
    const conn = await pool.getConnection();
    try {
        await conn.query(
            `CALL sp_crear_usuario(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @id_perfil_info)`,
            [
                input.usuario,
                input.nombres,
                input.apellido_paterno,
                input.apellido_materno,
                input.rol,
                input.correo_acceso,
                passwordHash,
                input.correo_personal,
                input.lada,
                input.telefono,
                input.direccion,
            ]
        );
        const [[row]]: any = await conn.query("SELECT @id_perfil_info AS id_perfil_info");
        mainWindow?.webContents.send("db:changed", "usuarios");
        return row.id_perfil_info as string;
    } finally {
        conn.release();
    }
});

// Asignar credenciales a un perfil que no tenía acceso
// (sp_asignar_credenciales no trae OUT, sí se puede usar el pool).
ipcMain.handle(
    "users:asignarCredenciales",
    async (
        _event,
        payload: { id_perfil_info: string; correo_acceso: string; password: string }
    ) => {
        if (!pool) throw new Error("La base de datos no está lista todavía");
        const passwordHash = await bcrypt.hash(payload.password, 10);
        await pool.query("CALL sp_asignar_credenciales(?, ?, ?)", [
            payload.id_perfil_info,
            payload.correo_acceso,
            passwordHash,
        ]);
        mainWindow?.webContents.send("db:changed", "usuarios");
    }
);

// Cambiar la contraseña de alguien que YA tiene credenciales
// activas (detailsuser.tsx -> "Cambiar Contraseña"). A diferencia
// de asignarCredenciales, aquí es un UPDATE: la fila en
// Credenciales ya existe y su id_perfil_info es UNIQUE, un INSERT
// tronaría por llave duplicada.
ipcMain.handle(
    "users:cambiarPassword",
    async (_event, payload: { id_perfil_info: string; password: string }) => {
        if (!pool) throw new Error("La base de datos no está lista todavía");
        const passwordHash = await bcrypt.hash(payload.password, 10);
        await pool.query(
            "UPDATE Credenciales SET password_hash = ? WHERE id_perfil_info = ?",
            [passwordHash, payload.id_perfil_info]
        );
        mainWindow?.webContents.send("db:changed", "usuarios");
    }
);

// Revocar acceso ("eliminar" en la UI): borra solo Credenciales,
// Perfil_Info y Contacto quedan como historial.
ipcMain.handle("users:revocarCredenciales", async (_event, idPerfilInfo: string) => {
    if (!pool) throw new Error("La base de datos no está lista todavía");
    await pool.query("CALL sp_revocar_credenciales(?)", [idPerfilInfo]);
    mainWindow?.webContents.send("db:changed", "usuarios");
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
    stopMySQL();
});