import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { startMySQL, stopMySQL } from "./mysqlManager";

// Equivalente a __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let pool: any = null;

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
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
        await startMySQL();

        const mysql = await import("mysql2/promise");

        // 1. Conexión temporal SIN base específica, solo para poder crearla
        const setupConn = await mysql.createConnection({
            host: "127.0.0.1",
            port: 54320,
            user: "root",
        });
        await setupConn.query("CREATE DATABASE IF NOT EXISTS la_cuchilla");
        await setupConn.end();

        // 2. Ahora sí, el pool normal ya con la base seleccionada
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

ipcMain.handle("db:query", async (_event, sql: string, params: any[]) => {
    if (!pool) throw new Error("La base de datos no está lista todavía");
    const [rows] = await pool.query(sql, params);
    return rows;
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
    stopMySQL();
});