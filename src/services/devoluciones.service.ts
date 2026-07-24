/* ============================================================
   devoluciones.service.ts
   Capa de datos para el modal de Devoluciones (devoluciones.tsx).

   A propósito NO depende de Venta / Venta_Detalle: en un abarrotes
   nadie trae ticket, folio ni sabe cuándo compró algo — solo sabe
   qué producto está regresando. Por eso la devolución se registra
   directo contra el producto, igual de "informal" que Ajuste_Inventario.

   El producto se elige de la misma lista de Producto ya cargada
   por el padre (prop `productos: ProductoRow[]`, igual que
   AddEntrada) — este archivo ya NO busca productos por IPC, solo
   persiste la devolución.

   registrarDevolucion() inserta Devolucion y, si restock = true,
   además un Ajuste_Inventario positivo (mismo mecanismo que ya usa
   inventory.service.ts en actualizarLote/reponerEstanteria) ligado
   vía id_ajuste — así el stock del producto sube solo, sin tocar
   Inventario a mano.

   IMPORTANTE — dos entities distintas para el broadcast de window.api
   (ver window.api.onChange en Inventory.tsx / catalogos.service.ts):
     - El INSERT en Ajuste_Inventario (el que de verdad mueve
       Inventario.cantidad_total vía tr_ajuste) se manda con la MISMA
       entity 'productos' que usa inventory.service.ts. Si esto se manda
       como 'devoluciones', Inventory.tsx nunca se entera del cambio —
       su listener solo hace cargarDatos() cuando entity === 'productos'
       — y con restock = true el producto sube en la base de datos pero
       la tabla de Inventario se queda mostrando el número viejo hasta
       que alguien la recargue a mano. Este era justo el bug: "no se
       carga al inventario cuando está activo Regresar a Inventario".
     - El INSERT en Devolucion sí usa 'devoluciones' (su propia entity),
       para el día que exista una pantalla de historial de devoluciones
       que necesite refrescarse sola.

   Requiere la tabla Devolucion sugerida en esquema_la_cuchilla_final.sql
   (sección "DEVOLUCIONES", después de Ajuste_Inventario).
   ============================================================ */

import type { DevolucionPayload } from "../../app/components/add/devoluciones";
import { SESSION_KEY } from "../context/AuthContext";

/* ─── Helpers internos (mismo patrón que catalogos.service.ts /
   inventory.service.ts) ──────────────────────────────────── */

/** Entity propia de este módulo — para el INSERT en Devolucion. */
const ENTITY = "devoluciones";

/** Misma entity que usa inventory.service.ts (ver su constante ENTITY
 *  ahí) — se usa SOLO para el INSERT en Ajuste_Inventario, porque ese
 *  es el que de verdad cambia Inventario.cantidad_total. Debe coincidir
 *  con el string que escucha Inventory.tsx en su window.api.onChange. */
const ENTITY_INVENTARIO = "productos";

const uid = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

function limpiarMensajeIpc(err: unknown, contexto?: string): string {
    let msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/Error:\s*(.+)$/);
    if (match) msg = match[1];

    if (/foreign key|fk_|constraint/i.test(msg)) {
        return contexto
            ? `No se puede completar la acción: "${contexto}" está en uso por otros registros.`
            : "No se puede completar la acción porque el registro está en uso por otros datos.";
    }
    if (/chk_dev_cantidad/i.test(msg)) {
        return "La cantidad a devolver debe ser mayor a 0.";
    }
    return msg || "Ocurrió un error inesperado. Intenta de nuevo.";
}

/** Quién está logueado ahora, leído de sessionStorage (mismo patrón
 *  que inventory.service.ts) — para Devolucion.registrado_por y
 *  Ajuste_Inventario.autorizado_por. */
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

/** Texto legible del motivo, para el campo libre Ajuste_Inventario.motivo
 *  (esa tabla no tiene ENUM, es VARCHAR). Mismos valores que MOTIVOS en
 *  devoluciones.tsx — si agregas un motivo ahí, agrégalo aquí también. */
const MOTIVO_LABEL: Record<DevolucionPayload["motivo"], string> = {
    producto_danado: "Producto dañado",
    producto_caducado: "Producto caducado",
    error_cobro: "Error al cobrar / producto equivocado",
    cliente_insatisfecho: "Cliente no quedó satisfecho",
    otro: "Otro motivo",
};

async function logActividad(accion: string, entidad: string, descripcion: string, entityChannel: string) {
    const actorId = obtenerActorId();
    if (!actorId) return;
    try {
        await window.api.execute(
            `INSERT INTO Bitacora (id_perfil_info, id_actor, accion, entidad, descripcion) VALUES (?, ?, ?, ?, ?)`,
            [actorId, actorId, accion, entidad, descripcion],
            entityChannel
        );
    } catch {}
}

async function getProductName(id: string): Promise<string> {
    try {
        const rows = await window.api.query(`SELECT nombre FROM Producto WHERE id_producto = ?`, [id]);
        return rows[0]?.nombre || `ID: ${id.substring(0, 8)}`;
    } catch {
        return `ID: ${id.substring(0, 8)}`;
    }
}

/* ─── Impacto de negocio de la devolución ─────────────────────
   Cada devolución combina DOS decisiones independientes:
     - accion:  cómo se resuelve con el cliente (reembolso saca
                efectivo de caja YA; nota_credito no saca nada ahora
                pero es un pasivo pendiente; cambio no saca dinero,
                se resuelve con otro producto que no pasa por aquí).
     - restock: si el producto regresa a Inventario (se puede volver
                a vender) o se pierde (dañado/caducado).
   Ninguna tabla del esquema registra pérdidas en dinero (no hay
   Caja/Gastos), así que esto NO escribe nada nuevo en la base — es
   puramente para que la UI (y cualquier reporte futuro) explique la
   consecuencia real de la combinación elegida antes de guardar. */
export type ImpactoTono = "danger" | "warning" | "success";

export interface ImpactoDevolucion {
    /** 'danger' = se pierde dinero Y producto; 'warning' = se pierde
     *  solo uno de los dos; 'success' = no se pierde nada (cambio +
     *  restock, o nota de crédito + restock). */
    tono: ImpactoTono;
    /** true si sale efectivo de caja en este mismo momento. */
    saleDineroAhora: boolean;
    dineroTexto: string;
    productoTexto: string;
}

export function calcularImpactoDevolucion(
    accion: DevolucionPayload["accion"],
    restock: boolean,
    montoDevuelto: number
): ImpactoDevolucion {
    const saleDineroAhora = accion === "reembolso";

    const dineroTexto =
        accion === "reembolso"
            ? `Sale $${montoDevuelto.toFixed(2)} de caja en este momento.`
            : accion === "nota_credito"
                ? `No sale efectivo ahora: queda un crédito de $${montoDevuelto.toFixed(2)} a favor del cliente.`
                : "No sale efectivo: se resuelve entregando otro producto al cliente.";

    const productoTexto = restock
        ? "El producto regresa al inventario y se puede volver a vender."
        : "El producto se da de baja: no vuelve a estar disponible para la venta.";

    const tono: ImpactoTono =
        saleDineroAhora && !restock ? "danger" : saleDineroAhora || !restock ? "warning" : "success";

    return { tono, saleDineroAhora, dineroTexto, productoTexto };
}

/* ─── Registrar devolución ────────────────────────────────── */

/**
 * Inserta la devolución y, si `restock` es true, además un
 * Ajuste_Inventario positivo ligado a ella (el producto regresa a
 * Inventario.cantidad_total solo, vía el mismo mecanismo que ya
 * usa el resto de la app para mover stock). Si restock es false
 * (producto dañado/caducado), no se toca el inventario y
 * Devolucion.id_ajuste queda NULL.
 */
export async function registrarDevolucion(payload: DevolucionPayload): Promise<string> {
    const idDevolucion = uid();
    const actorId = obtenerActorId();

    let idAjuste: string | null = null;
    try {
        if (payload.restock) {
            idAjuste = uid();
            await window.api.execute(
                `INSERT INTO Ajuste_Inventario (id_ajuste, id_producto, id_lote, cantidad_ajuste, motivo, autorizado_por)
                 VALUES (?, ?, NULL, ?, ?, ?)`,
                [
                    idAjuste,
                    payload.id_producto,
                    payload.cantidad_devuelta, // positivo: regresa al stock
                    `Devolución de ${payload.cantidad_devuelta} unidad(es) — ${MOTIVO_LABEL[payload.motivo]}`,
                    actorId,
                ],
                // 'productos', no 'devoluciones': esto es lo que hace que
                // Inventory.tsx (y cualquier otra pantalla que escuche
                // cambios de inventario) se refresque solo al confirmar
                // la devolución con "Regresar a Inventario" activo.
                ENTITY_INVENTARIO
            );
        }

        await window.api.execute(
            `INSERT INTO Devolucion
                (id_devolucion, id_producto, cantidad_devuelta, precio_unitario, motivo,
                 observaciones, accion, restock, id_ajuste, registrado_por)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                idDevolucion,
                payload.id_producto,
                payload.cantidad_devuelta,
                payload.precio_unitario,
                payload.motivo,
                payload.observaciones,
                payload.accion,
                payload.restock,
                idAjuste,
                actorId,
            ],
            ENTITY
        );
        const monto = payload.cantidad_devuelta * payload.precio_unitario;
        const totalFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto);
        const pName = await getProductName(payload.id_producto);
        await logActividad('registrar_devolucion', 'devolucion', `Devolución de ${payload.cantidad_devuelta} pzas de ${pName} por ${totalFmt}`, ENTITY);
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }

    return idDevolucion;
}

/* ─── Historial de devoluciones (para una futura pantalla de
   consulta — lista simple, más reciente primero) ────────────── */

export interface DevolucionListado {
    id_devolucion: string;
    id_producto: string;
    producto_nombre: string;
    codigo_interno: string | null;
    cantidad_devuelta: number;
    precio_unitario: number;
    monto_devuelto: number;
    motivo: DevolucionPayload["motivo"];
    observaciones: string | null;
    accion: DevolucionPayload["accion"];
    restock: boolean;
    created: string;
}

export async function listarDevoluciones(limite: number = 100): Promise<DevolucionListado[]> {
    try {
        const rows = await window.api.query(
            `SELECT
                d.id_devolucion, d.id_producto, p.nombre AS producto_nombre, p.codigo_interno,
                d.cantidad_devuelta, d.precio_unitario, d.monto_devuelto, d.motivo,
                d.observaciones, d.accion, d.restock, d.created
             FROM Devolucion d
             JOIN Producto p ON p.id_producto = d.id_producto
             ORDER BY d.created DESC
             LIMIT ?`,
            [limite]
        );
        return rows.map((r: any) => ({
            ...r,
            precio_unitario: Number(r.precio_unitario),
            monto_devuelto: Number(r.monto_devuelto),
            restock: !!r.restock,
        }));
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}