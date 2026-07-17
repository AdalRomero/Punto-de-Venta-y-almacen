import { createRequire } from "node:module";
import { BrowserWindow, app, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync, spawn } from "child_process";
import fs from "fs";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esmMin = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __toCommonJS = (mod) => __hasOwnProp.call(mod, "module.exports") ? mod["module.exports"] : __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __require = /* @__PURE__ */ createRequire(import.meta.url);
//#endregion
//#region electron/mysqlManager.ts
var __filename$1 = fileURLToPath(import.meta.url);
var __dirname$1 = path.dirname(__filename$1);
var mysqlProcess = null;
var mysqlRoot = app.isPackaged ? path.join(process.resourcesPath, "mysql-portable") : path.join(__dirname$1, "..", "mysql-portable");
var mysqldPath = path.join(mysqlRoot, "bin", "mysqld.exe");
var dataDir = path.join(app.getPath("userData"), "mysql-data");
async function startMySQL() {
	const isFirstRun = !fs.existsSync(dataDir);
	if (!fs.existsSync(mysqldPath)) throw new Error(`No se encontró mysqld.exe en: ${mysqldPath}`);
	if (isFirstRun) {
		console.log("Primera vez: inicializando base de datos...");
		fs.mkdirSync(dataDir, { recursive: true });
		execFileSync(mysqldPath, [`--datadir=${dataDir}`, "--initialize-insecure"]);
	}
	console.log("Arrancando MySQL...");
	mysqlProcess = spawn(mysqldPath, [
		`--datadir=${dataDir}`,
		"--port=54320",
		"--bind-address=127.0.0.1"
	]);
	mysqlProcess.stdout?.on("data", (d) => console.log(`[mysqld] ${d}`));
	mysqlProcess.stderr?.on("data", (d) => console.log(`[mysqld] ${d}`));
	mysqlProcess.on("error", (err) => {
		console.error("Error al arrancar MySQL:", err);
	});
	await waitUntilReady();
	console.log("MySQL listo.");
}
function stopMySQL() {
	if (mysqlProcess) {
		mysqlProcess.kill();
		mysqlProcess = null;
	}
}
async function waitUntilReady(retries = 30) {
	const mysql = await import("./promise-BcfCyrwl.js").then((m) => /* @__PURE__ */ __toESM(m.default, 1));
	for (let i = 0; i < retries; i++) try {
		await (await mysql.createConnection({
			host: "127.0.0.1",
			port: 54320,
			user: "root"
		})).end();
		return;
	} catch {
		await new Promise((r) => setTimeout(r, 500));
	}
	throw new Error("MySQL no arrancó a tiempo (timeout).");
}
//#endregion
//#region electron/main.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var mainWindow = null;
var pool = null;
async function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (app.isPackaged) mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
	else mainWindow.loadURL("http://localhost:5173");
}
app.whenReady().then(async () => {
	try {
		await startMySQL();
		const mysql = await import("./promise-BcfCyrwl.js").then((m) => /* @__PURE__ */ __toESM(m.default, 1));
		const setupConn = await mysql.createConnection({
			host: "127.0.0.1",
			port: 54320,
			user: "root"
		});
		await setupConn.query("CREATE DATABASE IF NOT EXISTS la_cuchilla");
		await setupConn.end();
		pool = mysql.createPool({
			host: "127.0.0.1",
			port: 54320,
			user: "root",
			database: "la_cuchilla"
		});
	} catch (err) {
		console.error("Fallo iniciando MySQL:", err);
	}
	createWindow();
});
ipcMain.handle("db:query", async (_event, sql, params) => {
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
//#endregion
export { __toCommonJS as a, __require as i, __esmMin as n, __exportAll as r, __commonJSMin as t };
