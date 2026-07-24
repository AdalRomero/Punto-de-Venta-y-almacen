/* ============================================================
   notificaciones.service.ts
   CRUD para la tabla Notificacion del esquema la_cuchilla_final.sql
   — Campana de notificaciones (eventos efímeros: resurtidos, alertas
   de stock amarillo, devoluciones, etc.).

   La tabla Notificacion es un feed de propósito general; no tiene
   UNIQUE por (id_producto, tipo) como Aviso — puede acumular varias
   filas para el mismo evento con el tiempo.

   id_perfil_info NULL → notificación global (todos los perfiles la ven).
   id_perfil_info = id_perfil_info → sólo ese usuario la ve.
   ============================================================ */

import { SESSION_KEY } from '../context/AuthContext';
import type { Notificacion } from '../helpers/vite-env.d';

const ENTITY = 'notificaciones';

/* ─── Helper interno ─────────────────────────────────────── */

function limpiarMensajeIpc(err: unknown, contexto?: string): string {
    let msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/Error:\s*(.+)$/);
    if (match) msg = match[1];
    if (/foreign key|fk_|constraint/i.test(msg)) {
        return contexto
            ? `No se puede completar la acción: "${contexto}" está en uso por otros registros.`
            : 'No se puede completar la acción porque el registro está en uso por otros datos.';
    }
    if (/duplicate|unique/i.test(msg)) return 'Ya existe un registro con ese valor.';
    return msg || 'Ocurrió un error inesperado. Intenta de nuevo.';
}

/** ID del usuario logueado, leído de sessionStorage. */
function obtenerActorId(): string | null {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const sesion = JSON.parse(raw) as { id_perfil_info?: string };
        return sesion.id_perfil_info ?? null;
    } catch {
        return null;
    }
}

/* ─── Escrituras ─────────────────────────────────────────── */

export type NuevaNotificacion = Pick<Notificacion, 'titulo' | 'descripcion' | 'tipo'> &
    Partial<Pick<Notificacion, 'prioridad' | 'id_referencia' | 'tabla_referencia' | 'id_perfil_info'>>;

/**
 * Inserta una nueva notificación.
 * Si no se especifica `id_perfil_info`, se asigna al usuario actual
 * (leído de sessionStorage). Pasa NULL para hacerla global.
 */
export async function crearNotificacion(payload: NuevaNotificacion): Promise<void> {
    try {
        // Si el caller no especificó a quién va, usamos el actor actual
        const idPerfil = 'id_perfil_info' in payload
            ? payload.id_perfil_info ?? null
            : obtenerActorId();

        await window.api.execute(
            `INSERT INTO Notificacion
               (id_perfil_info, titulo, descripcion, tipo, prioridad, id_referencia, tabla_referencia)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                idPerfil,
                payload.titulo,
                payload.descripcion,
                payload.tipo,
                payload.prioridad  ?? null,
                payload.id_referencia     ?? null,
                payload.tabla_referencia  ?? null,
            ],
            ENTITY
        );
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err, 'esta notificación'));
    }
}

/**
 * Marca una notificación como leída.
 */
export async function marcarLeida(id: string): Promise<void> {
    try {
        await window.api.execute(
            `UPDATE Notificacion SET is_read = TRUE WHERE id_notificacion = ?`,
            [id],
            ENTITY
        );
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/**
 * Marca una notificación como completada (y también leída).
 */
export async function marcarCompletada(id: string): Promise<void> {
    try {
        await window.api.execute(
            `UPDATE Notificacion SET is_completed = TRUE, is_read = TRUE WHERE id_notificacion = ?`,
            [id],
            ENTITY
        );
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/**
 * Marca como leídas TODAS las notificaciones de un perfil (y las globales).
 */
export async function marcarTodasLeidas(id_perfil_info?: string | null): Promise<void> {
    try {
        if (id_perfil_info) {
            await window.api.execute(
                `UPDATE Notificacion
                    SET is_read = TRUE
                  WHERE (id_perfil_info = ? OR id_perfil_info IS NULL)
                    AND is_read = FALSE`,
                [id_perfil_info],
                ENTITY
            );
        } else {
            await window.api.execute(
                `UPDATE Notificacion
                    SET is_read = TRUE
                  WHERE id_perfil_info IS NULL AND is_read = FALSE`,
                [],
                ENTITY
            );
        }
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/**
 * Elimina una notificación por ID.
 */
export async function eliminarNotificacion(id: string): Promise<void> {
    try {
        await window.api.execute(
            `DELETE FROM Notificacion WHERE id_notificacion = ?`,
            [id],
            ENTITY
        );
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/* ─── Lecturas ───────────────────────────────────────────── */

/**
 * Lista las últimas 50 notificaciones: las propias del perfil
 * más las globales (id_perfil_info IS NULL), más recientes primero.
 */
export async function listarNotificaciones(id_perfil_info?: string | null): Promise<Notificacion[]> {
    try {
        let rows: Notificacion[];
        if (id_perfil_info) {
            rows = await window.api.query(
                `SELECT * FROM Notificacion
                  WHERE id_perfil_info = ? OR id_perfil_info IS NULL
                  ORDER BY created DESC
                  LIMIT 50`,
                [id_perfil_info]
            );
        } else {
            rows = await window.api.query(
                `SELECT * FROM Notificacion
                  WHERE id_perfil_info IS NULL
                  ORDER BY created DESC
                  LIMIT 50`,
                []
            );
        }
        // MySQL devuelve BOOLEAN como 0/1 — normalizamos a true/false
        return rows.map(r => ({
            ...r,
            is_read:      Boolean(r.is_read),
            is_completed: Boolean(r.is_completed),
        }));
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err, 'las notificaciones'));
    }
}
