import { spawn, ChildProcess, execFileSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { app } from "electron";

// Equivalente a __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


let mysqlProcess: ChildProcess | null = null;

// process.resourcesPath solo existe cuando la app YA está empaquetada (.exe)
// en desarrollo (npm run dev) no existe, así que usamos una ruta alterna
const isPackaged = app.isPackaged;

const mysqlRoot = isPackaged
    ? path.join(process.resourcesPath, "mysql-portable")
    : path.join(__dirname, "..", "mysql-portable");

const mysqldPath = path.join(mysqlRoot, "bin", "mysqld.exe");
const dataDir = path.join(app.getPath("userData"), "mysql-data");

// Carpeta con el .sql del esquema, empaquetada aparte de mysql-portable.
// En dev: <proyecto>/db/esquema_la_cuchilla_final.sql
// En .exe empaquetado: hay que declarar esta carpeta como extraResource
// en la config de electron-builder para que exista process.resourcesPath/db.
const dbResourcesDir = isPackaged
    ? path.join(process.resourcesPath, "db")
    : path.join(__dirname, "..", "db");

const schemaSqlPath = path.join(dbResourcesDir, "esquema_la_cuchilla_final.sql");

export async function startMySQL(): Promise<void> {
    const isFirstRun = !fs.existsSync(dataDir);


    if (!fs.existsSync(mysqldPath)) {
        throw new Error(`No se encontró mysqld.exe en: ${mysqldPath}`);
    }

    if (isFirstRun) {
        console.log("Primera vez: inicializando base de datos...");
        fs.mkdirSync(dataDir, { recursive: true });

        execFileSync(mysqldPath, [
            `--datadir=${dataDir}`,
            "--initialize-insecure",
        ]);
    }

    console.log("Arrancando MySQL...");
    mysqlProcess = spawn(mysqldPath, [
        `--datadir=${dataDir}`,
        "--port=54320",
        "--bind-address=127.0.0.1",
    ]);
    mysqlProcess.stdout?.on("data", (d) => console.log(`[mysqld] ${d}`));
    mysqlProcess.stderr?.on("data", (d) => console.log(`[mysqld] ${d}`));

    mysqlProcess.on("error", (err) => {
        console.error("Error al arrancar MySQL:", err);
    });

    await waitUntilReady();
    console.log("MySQL listo.");

    await ensureSchemaLoaded();
    await ensureLoteEnteradoColumns();
}

/** Convierte el .sql pensado para el cliente `mysql` (con bloques
 *  DELIMITER $$ para procedimientos/triggers) en texto que el driver
 *  puede mandar de un jalón: quita las líneas "DELIMITER ..." y
 *  cambia los "$$" de cierre por ";" — el servidor de MySQL sabe
 *  encontrar el END que le corresponde a cada rutina sin necesidad
 *  de un delimitador especial, eso solo lo necesita el cliente CLI. */
function toExecutableSql(rawSqlFile: string): string {
    return rawSqlFile
        .split("\n")
        .filter((line) => !/^\s*DELIMITER\s+/i.test(line))
        .join("\n")
        .replace(/\$\$/g, ";");
}

/** Cuántas tablas define el .sql (cuenta los "CREATE TABLE X (" —
 *  no las vistas, esas no cuentan como "tabla core" para decidir si
 *  el esquema quedó completo). Se calcula del archivo en vez de
 *  hardcodear un número para que nunca se desactualice al agregar
 *  tablas nuevas (ej. Notificacion). */
function contarTablasEsperadas(rawSqlFile: string): number {
    const matches = rawSqlFile.match(/^CREATE TABLE\s+\w+/gim);
    return matches ? matches.length : 0;
}

/** Si `la_cuchilla` está vacía (recién creada por el
 *  CREATE DATABASE IF NOT EXISTS de abajo), carga el esquema
 *  empaquetado automáticamente. Si ya tiene TODAS sus tablas, no
 *  toca nada — así no se pisa nada si la base ya se cargó antes.
 *
 *  Antes esto decidía "ya está instalada" con solo `total > 0`, sin
 *  importar CUÁNTAS tablas hubiera. Eso reventaba feo si la base se
 *  quedaba a medias (ej. mysqld se mató a la fuerza a mitad de la
 *  primera corrida, o el proceso se cerró justo durante el `conn.query`
 *  de más abajo): quedaban 1-2 tablas sueltas, el guardián las veía
 *  como "ya instalada" y se saltaba el resto del esquema para
 *  siempre — y entonces ensureLoteEnteradoColumns (o cualquier otra
 *  cosa que espere una tabla completa) tronaba con
 *  "Table 'la_cuchilla.lote' doesn't exist", con un stack trace que
 *  no explica nada de esto.
 *
 *  Ahora se compara el conteo real contra cuántas tablas define el
 *  .sql: si son menos, la base quedó a medias — no hay nada valioso
 *  que conservar ahí (el propio esquema dice explícitamente que no
 *  está pensado para eso), así que se tira y se recrea sola. */
async function ensureSchemaLoaded(): Promise<void> {
    const mysql = await import("mysql2/promise");

    if (!fs.existsSync(schemaSqlPath)) {
        throw new Error(`No encontré el esquema para cargarlo: ${schemaSqlPath}`);
    }
    const rawSql = fs.readFileSync(schemaSqlPath, "utf8");
    const tablasEsperadas = contarTablasEsperadas(rawSql);

    // 1. Conexión sin base específica, solo para poder crearla si
    //    no existe (antes esto vivía en main.ts; se movió aquí para
    //    que quede en el mismo orden que lo necesita: crear -> probar
    //    si está vacía -> cargar esquema).
    const setupConn = await mysql.createConnection({
        host: "127.0.0.1",
        port: 54320,
        user: "root",
    });
    await setupConn.query("CREATE DATABASE IF NOT EXISTS la_cuchilla");
    await setupConn.end();

    // 2. ¿Cuántas TABLAS (no vistas) tiene ya? Las vistas se excluyen
    //    porque solo se crean hasta el final del .sql — si algo se
    //    cortó a medias nunca llegaron a existir, no sirven para medir.
    const probe = await mysql.createConnection({
        host: "127.0.0.1",
        port: 54320,
        user: "root",
        database: "la_cuchilla",
    });
    const [rows]: any = await probe.query(
        `SELECT COUNT(*) AS total FROM information_schema.tables
         WHERE table_schema = 'la_cuchilla' AND table_type = 'BASE TABLE'`
    );
    await probe.end();

    const tablasActuales = rows[0].total;

    if (tablasActuales >= tablasEsperadas && tablasActuales > 0) {
        console.log(`la_cuchilla ya tiene sus ${tablasActuales} tablas, no se recarga el esquema.`);
        return;
    }

    if (tablasActuales > 0) {
        // A medias: ni vacía ni completa. No es un estado que la app
        // sepa reparar tabla por tabla (no sabemos cuáles faltan ni
        // en qué orden por los FKs), así que se recrea desde cero —
        // exactamente lo mismo que un DROP DATABASE manual, pero sin
        // que el usuario tenga que enterarse de mysql/PowerShell.
        console.warn(
            `la_cuchilla quedó a medias (${tablasActuales}/${tablasEsperadas} tablas) — probablemente una corrida anterior se interrumpió. Recreando desde cero...`
        );
        const dropConn = await mysql.createConnection({
            host: "127.0.0.1",
            port: 54320,
            user: "root",
        });
        await dropConn.query("DROP DATABASE la_cuchilla");
        await dropConn.query("CREATE DATABASE la_cuchilla CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        await dropConn.end();
    }

    console.log("Cargando esquema_la_cuchilla_final.sql...");
    const executableSql = toExecutableSql(rawSql);

    const conn = await mysql.createConnection({
        host: "127.0.0.1",
        port: 54320,
        user: "root",
        database: "la_cuchilla",
        multipleStatements: true, // necesario para correr todo el archivo de un jalón
    });
    try {
        await conn.query(executableSql);
        console.log("Esquema cargado correctamente.");
    } finally {
        await conn.end();
    }
}

/** Migración ligera e idempotente: agrega las columnas `enterado` /
 *  `enterado_por` / `enterado_en` a Lote si todavía no existen. Es
 *  necesaria además de ensureSchemaLoaded() porque esa función SOLO
 *  carga el .sql completo cuando la base está totalmente vacía — si
 *  ya tenías la_cuchilla corriendo de antes (con datos), nunca vuelve
 *  a tocar el esquema y estas columnas nuevas jamás aparecerían solas. */
async function ensureLoteEnteradoColumns(): Promise<void> {
    const mysql = await import("mysql2/promise");
    const conn = await mysql.createConnection({
        host: "127.0.0.1",
        port: 54320,
        user: "root",
        database: "la_cuchilla",
    });
    try {
        // Defensa extra: si por lo que sea Lote no existe todavía
        // (ensureSchemaLoaded debería garantizarlo, pero mejor un
        // mensaje claro que un ER_NO_SUCH_TABLE crudo si algo falla
        // en el paso anterior), no truena la app entera — solo avisa.
        const [tabla]: any = await conn.query(
            `SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'la_cuchilla' AND table_name = 'Lote' LIMIT 1`
        );
        if (tabla.length === 0) {
            console.warn(
                "ensureLoteEnteradoColumns: la tabla Lote no existe todavía, se omite esta migración (revisa ensureSchemaLoaded)."
            );
            return;
        }

        const [rows]: any = await conn.query(
            `SELECT COLUMN_NAME FROM information_schema.columns
             WHERE table_schema = 'la_cuchilla' AND table_name = 'Lote' AND COLUMN_NAME = 'enterado'`
        );
        if (rows.length > 0) return; // ya migrada

        console.log("Migrando tabla Lote: agregando columnas enterado/enterado_por/enterado_en...");
        await conn.query(
            `ALTER TABLE Lote
                ADD COLUMN enterado BOOLEAN DEFAULT FALSE,
                ADD COLUMN enterado_por CHAR(36),
                ADD COLUMN enterado_en TIMESTAMP NULL,
                ADD CONSTRAINT fk_lote_enterado_por FOREIGN KEY (enterado_por) REFERENCES Perfil_Info(id_perfil_info) ON DELETE SET NULL`
        );
        console.log("Migración de Lote completada.");
    } finally {
        await conn.end();
    }
}

export function stopMySQL() {
    if (mysqlProcess) {
        mysqlProcess.kill();
        mysqlProcess = null;
    }
}

async function waitUntilReady(retries = 30): Promise<void> {
    const mysql = await import("mysql2/promise");
    for (let i = 0; i < retries; i++) {
        try {
            const conn = await mysql.createConnection({
                host: "127.0.0.1",
                port: 54320,
                user: "root",
            });
            await conn.end();
            return;
        } catch {
            await new Promise((r) => setTimeout(r, 500));
        }
    }
    throw new Error("MySQL no arrancó a tiempo (timeout).");
}