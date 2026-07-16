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
        pool = mysql.createPool({
            host: "127.0.0.1",
            port: 3307,
            user: "root",
            database: "",
        });

        await pool.query("CREATE DATABASE IF NOT EXISTS cuchilla_db");
        await pool.query("USE cuchilla_db");
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