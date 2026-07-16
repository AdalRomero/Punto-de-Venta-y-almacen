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
        "--port=3307",
        "--bind-address=127.0.0.1",
    ]);

    mysqlProcess.stdout?.on("data", (d) => console.log(`[mysqld] ${d}`));
    mysqlProcess.stderr?.on("data", (d) => console.log(`[mysqld] ${d}`));

    mysqlProcess.on("error", (err) => {
        console.error("Error al arrancar MySQL:", err);
    });

    await waitUntilReady();
    console.log("MySQL listo.");
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
                port: 3307,
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