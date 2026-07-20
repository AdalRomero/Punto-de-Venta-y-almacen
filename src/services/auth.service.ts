/* ============================================================
   auth.service.ts
   Capa de datos para el login (login.tsx). Permite iniciar sesión
   indistintamente con:
     - el correo de acceso (Credenciales.correo_acceso), o
     - el username interno (Perfil_Info.usuario)
   el que sea más cómodo para quien está entrando.

   La comparación del password (bcrypt.compare) pasa por el canal
   auth:login en main.ts: el hash NUNCA sale del proceso principal,
   aquí solo se manda texto plano por IPC (misma ruta de confianza
   que ya usa users.crear) y se recibe el perfil ya armado o un
   error con mensaje listo para mostrar.

   Reusa el tipo `Usuario` y el mapeo de fila de user.service.ts
   para no duplicarlo: login y "ver detalle de usuario" arman el
   mismo objeto a partir de la misma vista (v_usuarios).
   ============================================================ */

import { type Usuario, type UsuarioRow, mapRow } from "./user.service";

/** Quita el prefijo que Electron le pega a los errores que cruzan
 *  IPC (ej. "Error invoking remote method 'auth:login': Error: ...")
 *  para que el toast del login muestre el mensaje limpio que ya
 *  armamos en main.ts. */
function limpiarMensajeIpc(err: unknown): string {
    if (err instanceof Error) {
        const match = err.message.match(/Error:\s*(.+)$/);
        return match ? match[1] : err.message;
    }
    return "No se pudo iniciar sesión. Intenta de nuevo.";
}

/**
 * Inicia sesión con correo de acceso o username + contraseña.
 * Devuelve el mismo shape `Usuario` que usan users.tsx/detailsuser.tsx.
 * Lanza un Error con mensaje ya listo para mostrar (ej. en un toast)
 * si las credenciales no coinciden o el perfil no tiene acceso.
 */
export async function iniciarSesion(identificador: string, password: string): Promise<Usuario> {
    try {
        const row: UsuarioRow = await window.api.auth.login(identificador.trim(), password);
        return mapRow(row);
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}