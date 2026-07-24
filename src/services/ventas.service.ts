/* ─────────────────────────────────────────────────────────────
   ventas.service.ts
   Servicio de ventas — capa de datos para el Punto de Venta
   (ventas.tsx). Mismo patrón que devoluciones.service.ts: INSERT
   directo vía window.api.execute, actor leído de sessionStorage.

   numero_venta y Venta_Detalle.subtotal los resuelve la BD sola
   (AUTO_INCREMENT / columna generada) — este archivo no los toca.

   PENDIENTE (mismo espíritu que el TODO de desglose_costos en
   inventory.service.ts): Venta_Detalle también tiene columnas para
   guardar el margen e impuesto vigentes al momento de la venta
   (id_margenes, margen_nombre, margen_porcentaje_aplicado) y existe
   Venta_Detalle_Impuesto para el desglose de impuestos. Por ahora
   se guarda solo producto/cantidad/precio_unitario/costo_referencia_usado;
   cuando se conecte el cálculo de margen/impuesto vigente, agrégalo
   aquí, en un solo lugar.
──────────────────────────────────────────────────────────────── */

import { SESSION_KEY } from "../context/AuthContext";

export type MetodoPago = "efectivo" | "tarjeta" | "transferencia";

export interface VentaDetallePayload {
    id_producto: string;
    cantidad: number;
    precio_unitario: number;
    /** Opcional: si ya lo tienes a la mano (ProductoRow.costo_referencia),
     *  se guarda como snapshot en Venta_Detalle.costo_referencia_usado. */
    costo_referencia?: number | null;
}

export interface VentaPayload {
    metodo_pago: MetodoPago;
    total: number;
    /** Solo para efectivo: cuánto entregó el cliente. */
    monto_recibido?: number;
    /** Cargo adicional por uso de terminal (0 si no aplica). */
    cargo_terminal: number;
    detalles: VentaDetallePayload[];
}

export interface VentaResult {
    id_venta: string;
    cambio: number;
}

export interface VentaRecienteRow {
    id: string;
    numero_venta: number;
    nombre_cajero: string;
    total: number;
    creado_en: string;
}

const ENTITY = "ventas";

const uid = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

function limpiarMensajeIpc(err: unknown): string {
    let msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/Error:\s*(.+)$/);
    if (match) msg = match[1];

    if (/foreign key|fk_|constraint/i.test(msg)) {
        return "No se puede completar la venta: uno de los productos ya no está disponible.";
    }
    return msg || "Ocurrió un error inesperado. Intenta de nuevo.";
}

/** Quién está logueado ahora (mismo patrón que inventory.service.ts /
 *  devoluciones.service.ts) — para Venta.registrado_por. */
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

/**
 * Registra una venta completa: inserta Venta y un Venta_Detalle por
 * cada línea del carrito. El cambio se calcula aquí mismo para
 * mostrárselo al cajero; no se persiste como tal (metodo_pago,
 * monto_recibido y cargo_terminal quedan en el snapshot de Venta
 * por si se necesitan después).
 */
export async function registrarVenta(payload: VentaPayload): Promise<VentaResult> {
    const idVenta = uid();
    const actorId = obtenerActorId();

    try {
        await window.api.execute(
            `INSERT INTO Venta (id_venta, registrado_por, snapshot) VALUES (?, ?, ?)`,
            [idVenta, actorId, JSON.stringify(payload)],
            ENTITY
        );

        for (const detalle of payload.detalles) {
            await window.api.execute(
                `INSERT INTO Venta_Detalle
                    (id_vd, id_venta, id_producto, cantidad, precio_unitario, costo_referencia_usado)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    uid(),
                    idVenta,
                    detalle.id_producto,
                    detalle.cantidad,
                    detalle.precio_unitario,
                    detalle.costo_referencia ?? null,
                ],
                ENTITY
            );
        }

        if (actorId) {
            const totalFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payload.total);
            await window.api.execute(
                `INSERT INTO Bitacora (id_perfil_info, id_actor, accion, entidad, descripcion) VALUES (?, ?, ?, ?, ?)`,
                [actorId, actorId, 'crear_venta', 'venta', `Venta registrada por ${totalFmt}`],
                ENTITY
            );
        }
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }

    const cambio =
        payload.metodo_pago === "efectivo"
            ? Math.max((payload.monto_recibido ?? payload.total) - payload.total, 0)
            : 0;

    return { id_venta: idVenta, cambio };
}

export async function listarVentasRecientes(): Promise<VentaRecienteRow[]> {
    const rows = await window.api.query(
        `SELECT v.id_venta, v.numero_venta, p.nombres as nombre_cajero, v.snapshot, v.created as creado_en
         FROM Venta v
         LEFT JOIN Perfil_Info p ON p.id_perfil_info = v.registrado_por
         ORDER BY v.created DESC
         LIMIT 5`
    );
    return rows.map((r: any) => {
        let total = 0;
        try {
            const snap = typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : r.snapshot;
            total = snap?.total || 0;
        } catch (e) {
            console.error("Error parsing snapshot in recientes:", e);
        }
        return {
            id: r.id_venta,
            numero_venta: r.numero_venta,
            nombre_cajero: r.nombre_cajero || 'Desconocido',
            total,
            creado_en: r.creado_en
        };
    });
}

export interface EstadisticasInicio {
    ventasHoy: number;
    ventasAyer: number;
    tendenciaPorcentaje: number;
    ventasMesActual: number;
    ventasPorHora: { h: string; v: number }[];
    ventasPorMes: { label: string; value: number }[];
}

export async function obtenerEstadisticasInicio(): Promise<EstadisticasInicio> {
    // Traemos las ventas de los últimos 6 meses para poder calcular todo localmente de forma rápida
    // Se usa un simple date logic para evitar problemas de dialecto SQL
    const seisMesesAtras = new Date();
    seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 5);
    seisMesesAtras.setDate(1);
    seisMesesAtras.setHours(0, 0, 0, 0);

    const rows = await window.api.query(
        `SELECT snapshot, created FROM Venta WHERE created >= ?`,
        [seisMesesAtras.toISOString()]
    );

    const now = new Date();
    const hoyInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ayerInicio = new Date(hoyInicio);
    ayerInicio.setDate(ayerInicio.getDate() - 1);

    let ventasHoy = 0;
    let ventasAyer = 0;
    let ventasMesActual = 0;

    // Inicializar ventas por hora (0h a 23h)
    const ventasPorHoraObj: Record<string, number> = {};
    for (let i = 0; i <= 23; i++) {
        ventasPorHoraObj[`${i}h`] = 0;
    }

    // Inicializar ventas por mes (últimos 6 meses)
    const mesesLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const ventasPorMesObj: Record<string, number> = {};
    const mesesKeys: string[] = [];
    
    let tempDate = new Date(seisMesesAtras);
    for (let i = 0; i < 6; i++) {
        const key = `${tempDate.getFullYear()}-${tempDate.getMonth()}`;
        ventasPorMesObj[key] = 0;
        mesesKeys.push(key);
        tempDate.setMonth(tempDate.getMonth() + 1);
    }

    const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

    for (const row of rows) {
        let total = 0;
        try {
            const snap = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
            total = snap?.total || 0;
        } catch (e) {
            console.error("Error parsing snapshot in estadisticas:", e);
        }

        const created = new Date(row.created);
        const monthKey = `${created.getFullYear()}-${created.getMonth()}`;

        // Acumular mes
        if (ventasPorMesObj[monthKey] !== undefined) {
            ventasPorMesObj[monthKey] += total;
        }
        if (monthKey === currentMonthKey) {
            ventasMesActual += total;
        }

        // Acumular hoy y ayer
        if (created >= hoyInicio) {
            ventasHoy += total;
            const hour = created.getHours();
            if (hour >= 0 && hour <= 23) {
                ventasPorHoraObj[`${hour}h`] += total;
            }
        } else if (created >= ayerInicio && created < hoyInicio) {
            ventasAyer += total;
        }
    }

    let tendenciaPorcentaje = 0;
    if (ventasAyer > 0) {
        tendenciaPorcentaje = ((ventasHoy - ventasAyer) / ventasAyer) * 100;
    } else if (ventasHoy > 0) {
        tendenciaPorcentaje = 100; // Si ayer no hubo ventas pero hoy sí, es un incremento "infinito", mostramos 100%
    }

    const ventasPorHora = Object.entries(ventasPorHoraObj).map(([h, v]) => ({ h, v }));
    const ventasPorMes = mesesKeys.map(key => {
        const [, mm] = key.split('-');
        return {
            label: mesesLabels[parseInt(mm, 10)],
            value: ventasPorMesObj[key]
        };
    });

    return {
        ventasHoy,
        ventasAyer,
        tendenciaPorcentaje,
        ventasMesActual,
        ventasPorHora,
        ventasPorMes
    };
}

export interface ActividadRow {

    id: string;
    tipo: 'venta' | 'producto' | 'entrada' | 'devolucion' | 'usuario' | 'otro';
    titulo: string;
    descripcion: string;
    actor: string;
    monto?: number;
    creado_en: string;
}

/** Combina Bitacora (todas las entidades) ordenada por fecha descendente. */
export async function listarActividadReciente(limite = 10): Promise<ActividadRow[]> {
    const rows = await window.api.query(
        `SELECT b.id_bitacora, b.accion, b.entidad, b.descripcion, b.creado_en,
                p.nombres as actor_nombre
         FROM Bitacora b
         LEFT JOIN Perfil_Info p ON p.id_perfil_info = b.id_actor
         ORDER BY b.creado_en DESC
         LIMIT ?`,
        [limite]
    );

    return rows.map((r: any): ActividadRow => {
        const entidad: string = r.entidad ?? 'otro';
        let tipo: ActividadRow['tipo'] = 'otro';
        if (entidad === 'venta') tipo = 'venta';
        else if (entidad === 'entrada') tipo = 'entrada';
        else if (entidad === 'producto') tipo = 'producto';
        else if (entidad === 'devolucion') tipo = 'devolucion';
        else if (entidad === 'usuario') tipo = 'usuario';

        // Para ventas, intenta extraer el monto del texto de descripción
        // Ej: "Venta registrada por $120.00"
        let monto: number | undefined;
        if (tipo === 'venta') {
            const match = String(r.descripcion || '').match(/\$[\d,]+\.?\d*/);
            if (match) {
                const num = parseFloat(match[0].replace('$', '').replace(/,/g, ''));
                if (!isNaN(num)) monto = num;
            }
        }

        // Número de venta desde descripción si aplica
        const ventaNumMatch = String(r.descripcion || '').match(/#(\d+)/);
        const ventaNum = ventaNumMatch ? ventaNumMatch[1] : null;

        // Título amigable según acción
        const accion: string = r.accion ?? '';
        let titulo = r.descripcion || accion;
        if (accion === 'crear_venta') titulo = ventaNum ? `Venta #${ventaNum}` : 'Venta registrada';
        else if (accion === 'crear_producto') titulo = 'Producto añadido';
        else if (accion === 'editar_producto') titulo = 'Producto editado';
        else if (accion === 'eliminar_producto') titulo = 'Producto eliminado';
        else if (accion === 'crear_entrada') titulo = 'Entrada de mercancía';
        else if (accion === 'crear_devolucion') titulo = 'Devolución registrada';
        else if (accion === 'crear') titulo = 'Usuario creado';
        else if (accion === 'editar_perfil') titulo = 'Perfil editado';
        else if (accion === 'cambiar_password') titulo = 'Contraseña cambiada';
        else if (accion === 'revocar_credenciales') titulo = 'Acceso revocado';

        return {
            id: r.id_bitacora,
            tipo,
            titulo,
            descripcion: r.descripcion || '',
            actor: r.actor_nombre || 'Sistema',
            monto,
            creado_en: r.creado_en,
        };
    });
}