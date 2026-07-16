import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
    query: (sql: string, params: any[] = []) =>
        ipcRenderer.invoke("db:query", sql, params),
});