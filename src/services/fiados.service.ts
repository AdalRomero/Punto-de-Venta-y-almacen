/* ============================================================
   fiados.service.ts
   Capa de datos para el módulo de Fiados (fiados.tsx). Es un módulo
   independiente de Ventas/Inventario a propósito: no hay tabla de
   Clientes, así que un fiado no es más que un apunte propio del
   dueño/cajero — nombre o apodo, señas para reconocer a la persona,
   teléfono opcional, qué se llevó (texto libre) y cuánto quedó a
   deber. Se puede ir abonando de a poco hasta saldarlo.

   Requiere las tablas Fiado / Fiado_Abono — ver fiados_schema.sql.

   Mismo patrón que inventory.service.ts: uid() para IDs, ENTITY para
   window.api.execute/onChange, logActividad() para Bitácora, y
   crearNotificacion() de notificaciones.service.ts para que el
   recordatorio salga en la misma campanita de notificaciones que ya
   usa el resto de la app (no se inventó un mecanismo aparte).
   ============================================================ */

import { SESSION_KEY } from '../context/AuthContext';
import { crearNotificacion } from './notificaciones.service';

const ENTITY = 'fiados';

const uid = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Mismo criterio que inventory.service.ts/user.service.ts: limpia el
 *  prefijo que Electron le pega a errores que cruzan IPC. */
function limpiarMensajeIpc(err: unknown, contexto?: string): string {
    let msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/Error:\s*(.+)$/);
    if (match) msg = match[1];

    if (/foreign key|fk_|constraint/i.test(msg)) {
        return contexto
            ? `No se puede completar la acción: "${contexto}" está en uso por otros registros.`
            : 'No se puede completar la acción porque el registro está en uso por otros datos.';
    }
    return msg || 'Ocurrió un error inesperado. Intenta de nuevo.';
}

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

async function logActividad(accion: string, descripcion: string) {
    const actorId = obtenerActorId();
    if (!actorId) return;
    try {
        await window.api.execute(
            `INSERT INTO Bitacora (id_perfil_info, id_actor, accion, entidad, descripcion) VALUES (?, ?, ?, ?, ?)`,
            [actorId, actorId, accion, 'fiados', descripcion],
            ENTITY
        );
    } catch { }
}

/* ─── Tipos ───────────────────────────────────────────────── */

export interface Fiado {
    id_fiado: string;
    nombre: string;
    telefono: string | null;
    caracteristicas: string | null;
    articulos: string;
    monto_total: number;
    saldo_pendiente: number;
    estado: 'pendiente' | 'pagado';
    created: string;
    pagado_en: string | null;
}

interface FiadoRow {
    id_fiado: string;
    nombre: string;
    telefono: string | null;
    caracteristicas: string | null;
    articulos: string;
    monto_total: number | string;
    saldo_pendiente: number | string;
    estado: 'pendiente' | 'pagado';
    created: string;
    pagado_en: string | null;
}

export interface FiadoPayload {
    nombre: string;
    telefono?: string | null;
    caracteristicas?: string | null;
    articulos: string;
    monto_total: number;
}

function mapRow(row: FiadoRow): Fiado {
    return {
        ...row,
        monto_total: Number(row.monto_total),
        saldo_pendiente: Number(row.saldo_pendiente),
    };
}

/* ─── Lecturas ────────────────────────────────────────────── */

/** Todos los fiados, pendientes primero (del más viejo al más
 *  nuevo — el que lleva más tiempo esperando aparece arriba) y
 *  luego el historial de pagados. */
export async function listarFiados(): Promise<Fiado[]> {
    const rows: FiadoRow[] = await window.api.query(
        `SELECT id_fiado, nombre, telefono, caracteristicas, articulos,
                monto_total, saldo_pendiente, estado, created, pagado_en
           FROM Fiado
          ORDER BY (estado = 'pagado'), created ASC`
    );
    return rows.map(mapRow);
}

/* ─── Escrituras ──────────────────────────────────────────── */

/** Registra un fiado nuevo. Dispara una notificación de inmediato
 *  (mismo canal que "Estantería resurtida" en inventory.service.ts)
 *  para que quede como recordatorio en la campanita desde el
 *  momento en que se anota. */
export async function crearFiado(payload: FiadoPayload): Promise<string> {
    const nombre = payload.nombre.trim();
    const articulos = payload.articulos.trim();
    const monto = Number(payload.monto_total);

    if (!nombre) throw new Error('El nombre o apodo es obligatorio.');
    if (!articulos) throw new Error('Anota qué se llevó, aunque sea breve.');
    if (!Number.isFinite(monto) || monto <= 0) throw new Error('El monto debe ser mayor a 0.');

    const idFiado = uid();
    try {
        await window.api.execute(
            `INSERT INTO Fiado
                (id_fiado, nombre, telefono, caracteristicas, articulos, monto_total, saldo_pendiente, estado, registrado_por)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
            [
                idFiado,
                nombre,
                payload.telefono?.trim() || null,
                payload.caracteristicas?.trim() || null,
                articulos,
                monto,
                monto,
                obtenerActorId(),
            ],
            ENTITY
        );

        await logActividad('crear_fiado', `Nuevo fiado de ${nombre} por $${monto.toFixed(2)}`);
        await crearNotificacion({
            titulo: 'Nuevo fiado registrado',
            descripcion: `${nombre} se llevó "${articulos}" — debe $${monto.toFixed(2)}.`,
            tipo: 'warning',
        });

        return idFiado;
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err, 'este fiado'));
    }
}

/** Registra un abono (pago parcial o total) y recalcula el saldo.
 *  Si el abono es mayor al saldo pendiente, se recorta al saldo
 *  (nunca deja un saldo negativo) y el fiado queda saldado. */
export async function registrarAbono(fiado: Fiado, montoIngresado: number): Promise<void> {
    if (fiado.estado === 'pagado') throw new Error('Este fiado ya está saldado.');
    if (!Number.isFinite(montoIngresado) || montoIngresado <= 0) {
        throw new Error('El abono debe ser mayor a 0.');
    }

    const montoAplicado = Math.min(montoIngresado, fiado.saldo_pendiente);
    const nuevoSaldo = Math.max(0, fiado.saldo_pendiente - montoAplicado);
    const quedaSaldado = nuevoSaldo <= 0;

    try {
        await window.api.execute(
            `INSERT INTO Fiado_Abono (id_abono, id_fiado, monto, registrado_por) VALUES (?, ?, ?, ?)`,
            [uid(), fiado.id_fiado, montoAplicado, obtenerActorId()],
            ENTITY
        );
        await window.api.execute(
            `UPDATE Fiado
                SET saldo_pendiente = ?,
                    estado = ?,
                    pagado_en = ${quedaSaldado ? 'NOW()' : 'NULL'}
              WHERE id_fiado = ?`,
            [nuevoSaldo, quedaSaldado ? 'pagado' : 'pendiente', fiado.id_fiado],
            ENTITY
        );

        await logActividad('abono_fiado', `Abono de $${montoAplicado.toFixed(2)} de ${fiado.nombre}`);

        if (quedaSaldado) {
            await crearNotificacion({
                titulo: 'Fiado saldado',
                descripcion: `${fiado.nombre} ya terminó de pagar lo que debía.`,
                tipo: 'success',
            });
        }
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err, 'este abono'));
    }
}

/** Botón "Recordar": vuelve a mandar el aviso a la campanita de
 *  notificaciones sin tocar ningún dato — para cuando el dueño
 *  quiere que le salga el pendiente de nuevo (ej. antes de cerrar). */
export async function recordarFiado(fiado: Fiado): Promise<void> {
    await crearNotificacion({
        titulo: 'Recordatorio de fiado',
        descripcion: `${fiado.nombre} todavía debe $${fiado.saldo_pendiente.toFixed(2)} (${fiado.articulos}).`,
        tipo: 'warning',
    });
}

/** Por si se anotó un fiado por error. Borra también sus abonos
 *  (ON DELETE CASCADE en Fiado_Abono). */
export async function eliminarFiado(fiado: Fiado): Promise<void> {
    try {
        await window.api.execute(`DELETE FROM Fiado WHERE id_fiado = ?`, [fiado.id_fiado], ENTITY);
        await logActividad('eliminar_fiado', `Eliminó el fiado de ${fiado.nombre}`);
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err, 'este fiado'));
    }
}