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

/** Si `la_cuchilla` está vacía (recién creada por el
 *  CREATE DATABASE IF NOT EXISTS de main.ts), carga el esquema
 *  empaquetado automáticamente. Si ya tiene tablas, no toca nada
 *  — así no se pisa nada si la base ya se cargó antes. */
async function ensureSchemaLoaded(): Promise<void> {
    const mysql = await import("mysql2/promise");

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

    // 2. ¿Ya tiene tablas? Si sí, no la tocamos.
    const probe = await mysql.createConnection({
        host: "127.0.0.1",
        port: 54320,
        user: "root",
        database: "la_cuchilla",
    });
    const [rows]: any = await probe.query(
        "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = 'la_cuchilla'"
    );
    await probe.end();

    if (rows[0].total > 0) {
        console.log(`la_cuchilla ya tiene ${rows[0].total} tablas/vistas, no se recarga el esquema.`);
        return;
    }

    if (!fs.existsSync(schemaSqlPath)) {
        throw new Error(
            `la_cuchilla está vacía y no encontré el esquema para cargarlo solo: ${schemaSqlPath}`
        );
    }

    console.log("la_cuchilla está vacía: cargando esquema_la_cuchilla_final.sql...");
    const rawSql = fs.readFileSync(schemaSqlPath, "utf8");
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