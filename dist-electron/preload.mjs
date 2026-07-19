let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("api", {
	query: (sql, params = []) => electron.ipcRenderer.invoke("db:query", sql, params),
	execute: (sql, params = [], entity) => electron.ipcRenderer.invoke("db:execute", sql, params, entity),
	onChange: (callback) => {
		const listener = (_event, entity) => callback(entity);
		electron.ipcRenderer.on("db:changed", listener);
		return () => electron.ipcRenderer.removeListener("db:changed", listener);
	},
	users: {
		crear: (input) => electron.ipcRenderer.invoke("users:crear", input),
		asignarCredenciales: (payload) => electron.ipcRenderer.invoke("users:asignarCredenciales", payload),
		cambiarPassword: (payload) => electron.ipcRenderer.invoke("users:cambiarPassword", payload),
		revocarCredenciales: (idPerfilInfo) => electron.ipcRenderer.invoke("users:revocarCredenciales", idPerfilInfo)
	}
});
//#endregion
