import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
    // Lecturas (SELECT / vistas).
    query: (sql: string, params: any[] = []) =>
        ipcRenderer.invoke("db:query", sql, params),

    // Escrituras (INSERT / UPDATE / DELETE / CALL). `entity` es el
    // nombre que usarás en onChange para saber qué refrescar
    // (ej. "productos", "inventario", "familias", "impuestos"...).
    execute: (sql: string, params: any[] = [], entity?: string) =>
        ipcRenderer.invoke("db:execute", sql, params, entity),

    // Suscripción a cambios en tiempo real. Devuelve una función
    // para desuscribirse (úsala en el cleanup de tu useEffect).
    onChange: (callback: (entity: string) => void) => {
        const listener = (_event: unknown, entity: string) => callback(entity);
        ipcRenderer.on("db:changed", listener);
        return () => ipcRenderer.removeListener("db:changed", listener);
    },

    // Dominio Usuarios: acciones que necesitan hashear password o
    // leer un parámetro OUT, por eso no pasan por query/execute.
    users: {
        crear: (input: {
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
        }) => ipcRenderer.invoke("users:crear", input),

        asignarCredenciales: (payload: {
            id_perfil_info: string;
            correo_acceso: string;
            password: string;
        }) => ipcRenderer.invoke("users:asignarCredenciales", payload),

        cambiarPassword: (payload: { id_perfil_info: string; password: string }) =>
            ipcRenderer.invoke("users:cambiarPassword", payload),

        revocarCredenciales: (idPerfilInfo: string) =>
            ipcRenderer.invoke("users:revocarCredenciales", idPerfilInfo),
    },
});