let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("api", { query: (sql, params = []) => electron.ipcRenderer.invoke("db:query", sql, params) });
//#endregion
