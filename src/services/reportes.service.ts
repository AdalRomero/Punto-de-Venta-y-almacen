/* ============================================================
   reportes.service.ts
   Capa de datos para el módulo de Reportes (Reportes.tsx). Dos
   pestañas, dos responsabilidades separadas:
     - Estadísticas: cómo va el negocio en un rango de fechas
       (totales, ganancia, top productos, ventas por día).
     - Historial: el detalle venta por venta, para poder consultar
       o justificar un registro puntual.

   IMPORTANTE — de dónde sale cada número:
     - Venta NO guarda un total: se arma sumando Venta_Detalle.subtotal
       (cantidad × precio_unitario, ya congelado) + Venta_Detalle_
       Impuesto.monto_aplicado (impuesto ya congelado por línea).
     - "Ganancia" = subtotal - (costo_referencia_usado × cantidad).
       costo_referencia_usado es el costo que tenía el producto AL
       MOMENTO de la venta (congelado, igual que el margen/impuesto),
       así que la ganancia de ventas viejas no cambia aunque hoy el
       costo del producto sea otro.
     - "Valor de inventario" (v_valor_inventario) es una foto de HOY,
       no depende del rango de fechas — no tiene sentido "el valor de
       inventario de hace un mes" sin un histórico de costos por lote
       que este esquema no lleva.
     - No existe una columna Venta.metodo_pago — solo un `snapshot`
       JSON de la venta completa. Si tu snapshot guarda el método de
       pago bajo otra llave, avísame el nombre exacto y lo agrego.

   Todo el rango de fechas se maneja como [desde, hasta) — desde
   inclusive, hasta EXCLUSIVE (el día siguiente a las 00:00) — para
   no perder ventas que ocurrieron después de medianoche del último
   día por comparar con un DATE en vez de un TIMESTAMP.
   ============================================================ */

import { SESSION_KEY } from "../context/AuthContext";

/* ─── Helpers internos (mismo patrón que inventory.service.ts) ── */

function limpiarMensajeIpc(err: unknown): string {
    let msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/Error:\s*(.+)$/);
    if (match) msg = match[1];
    return msg || "Ocurrió un error inesperado. Intenta de nuevo.";
}

function obtenerNombrePerfil(): { id_perfil_info: string | null } {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return { id_perfil_info: null };
        const sesion = JSON.parse(raw) as { id_perfil_info?: string };
        return { id_perfil_info: sesion.id_perfil_info ?? null };
    } catch {
        return { id_perfil_info: null };
    }
}
void obtenerNombrePerfil; // reservado por si se agrega un filtro "solo mis ventas"

/* ─── Rango de fechas ──────────────────────────────────────── */

export interface RangoFecha {
    /** 'YYYY-MM-DD', inclusive. */
    desde: string;
    /** 'YYYY-MM-DD', inclusive (se convierte a exclusivo +1 día al consultar). */
    hasta: string;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

function sumarDias(fechaISO: string, dias: number): string {
    const d = new Date(fechaISO + "T00:00:00");
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
}

/** Normaliza a 'YYYY-MM-DD' un valor de fecha que viene de una
 *  columna DATE de MySQL. El driver a veces regresa un objeto Date
 *  de JS y a veces un string — si se hace `String(valorDate)` a lo
 *  que llega como objeto Date, sale algo como "Fri Jul 25 2026
 *  00:00:00 GMT-0700 (...)", no un ISO — y eso rompe cualquier código
 *  que después concatene "T00:00:00" para volver a parsearlo (por
 *  eso salía "Invalid Date" en la gráfica de Ventas por día). Aquí
 *  se arma el ISO a mano con los componentes LOCALES del objeto
 *  (no con toISOString(), que convierte a UTC y puede recorrer un
 *  día si la zona horaria no es UTC+0). */
function fechaSoloISO(valor: unknown): string {
    if (valor instanceof Date) {
        const y = valor.getFullYear();
        const m = String(valor.getMonth() + 1).padStart(2, "0");
        const d = String(valor.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }
    // Ya viene como string (o algo raro): nos quedamos con los
    // primeros 10 caracteres, que es lo que da un DATE en formato ISO.
    return String(valor).slice(0, 10);
}

/** Presets para los botones rápidos del filtro de fechas. */
export function rangoPreset(preset: "hoy" | "7dias" | "mes" | "anio"): RangoFecha {
    const hoy = hoyISO();
    switch (preset) {
        case "hoy":
            return { desde: hoy, hasta: hoy };
        case "7dias":
            return { desde: sumarDias(hoy, -6), hasta: hoy };
        case "mes": {
            const d = new Date();
            const desde = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
            return { desde, hasta: hoy };
        }
        case "anio": {
            const d = new Date();
            const desde = new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
            return { desde, hasta: hoy };
        }
    }
}

/** [desde 00:00:00, hasta+1 00:00:00) listo para "created >= ? AND created < ?". */
function rangoParams(rango: RangoFecha): [string, string] {
    return [`${rango.desde} 00:00:00`, `${sumarDias(rango.hasta, 1)} 00:00:00`];
}

/* ─── Estadísticas ─────────────────────────────────────────── */

export interface EstadisticasReporte {
    numeroVentas: number;
    unidadesVendidas: number;
    subtotalTotal: number;
    impuestosTotal: number;
    totalVendido: number; // subtotalTotal + impuestosTotal
    gananciaBruta: number;
    ticketPromedio: number; // totalVendido / numeroVentas
    valorInventarioActual: number;
    ventasPorDia: { fecha: string; total: number }[];
    topProductos: { producto_nombre: string; unidades: number; total: number }[];
}

export async function obtenerEstadisticas(rango: RangoFecha): Promise<EstadisticasReporte> {
    try {
        const [desde, hasta] = rangoParams(rango);

        const [[resumen], [impuestos], ventasPorDia, topProductos, [valorInv]]: any[] = await Promise.all([
            window.api.query(
                `SELECT
                    COUNT(DISTINCT v.id_venta) AS numero_ventas,
                    COALESCE(SUM(vd.cantidad), 0) AS unidades_vendidas,
                    COALESCE(SUM(vd.subtotal), 0) AS subtotal_total,
                    COALESCE(SUM(vd.subtotal - COALESCE(vd.costo_referencia_usado, 0) * vd.cantidad), 0) AS ganancia_bruta
                 FROM Venta v
                 JOIN Venta_Detalle vd ON vd.id_venta = v.id_venta
                 WHERE v.created >= ? AND v.created < ?`,
                [desde, hasta]
            ),
            window.api.query(
                `SELECT COALESCE(SUM(vdi.monto_aplicado), 0) AS impuestos_total
                 FROM Venta_Detalle_Impuesto vdi
                 JOIN Venta_Detalle vd ON vd.id_vd = vdi.id_vd
                 JOIN Venta v ON v.id_venta = vd.id_venta
                 WHERE v.created >= ? AND v.created < ?`,
                [desde, hasta]
            ),
            window.api.query(
                `SELECT DATE(v.created) AS fecha, COALESCE(SUM(vd.subtotal), 0) AS total
                 FROM Venta v
                 JOIN Venta_Detalle vd ON vd.id_venta = v.id_venta
                 WHERE v.created >= ? AND v.created < ?
                 GROUP BY DATE(v.created)
                 ORDER BY fecha ASC`,
                [desde, hasta]
            ),
            window.api.query(
                `SELECT p.nombre AS producto_nombre, SUM(vd.cantidad) AS unidades, SUM(vd.subtotal) AS total
                 FROM Venta_Detalle vd
                 JOIN Venta v ON v.id_venta = vd.id_venta
                 JOIN Producto p ON p.id_producto = vd.id_producto
                 WHERE v.created >= ? AND v.created < ?
                 GROUP BY p.id_producto, p.nombre
                 ORDER BY unidades DESC
                 LIMIT 5`,
                [desde, hasta]
            ),
            window.api.query(`SELECT valor_total FROM v_valor_inventario`),
        ]);

        const subtotalTotal = Number(resumen?.subtotal_total ?? 0);
        const impuestosTotal = Number(impuestos?.impuestos_total ?? 0);
        const totalVendido = subtotalTotal + impuestosTotal;
        const numeroVentas = Number(resumen?.numero_ventas ?? 0);

        return {
            numeroVentas,
            unidadesVendidas: Number(resumen?.unidades_vendidas ?? 0),
            subtotalTotal,
            impuestosTotal,
            totalVendido,
            gananciaBruta: Number(resumen?.ganancia_bruta ?? 0),
            ticketPromedio: numeroVentas > 0 ? totalVendido / numeroVentas : 0,
            valorInventarioActual: Number(valorInv?.valor_total ?? 0),
            ventasPorDia: (ventasPorDia ?? []).map((r: any) => ({
                fecha: fechaSoloISO(r.fecha),
                total: Number(r.total),
            })),
            topProductos: (topProductos ?? []).map((r: any) => ({
                producto_nombre: r.producto_nombre,
                unidades: Number(r.unidades),
                total: Number(r.total),
            })),
        };
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/* ─── Desglose fiscal (para el reporte de contador/SAT) ───────
   Agrupa lo cobrado por impuesto y tasa — lo que un contador pide
   típicamente para declarar: "cuánto IVA cobraste este periodo". */
export interface DesgloseImpuesto {
    impuesto_nombre: string;
    porcentaje_aplicado: number;
    numero_ventas: number;
    monto_total: number;
}

export async function obtenerDesgloseImpuestos(rango: RangoFecha): Promise<DesgloseImpuesto[]> {
    try {
        const [desde, hasta] = rangoParams(rango);
        const rows: any[] = await window.api.query(
            `SELECT
                vdi.impuesto_nombre, vdi.porcentaje_aplicado,
                COUNT(DISTINCT vd.id_venta) AS numero_ventas,
                SUM(vdi.monto_aplicado) AS monto_total
             FROM Venta_Detalle_Impuesto vdi
             JOIN Venta_Detalle vd ON vd.id_vd = vdi.id_vd
             JOIN Venta v ON v.id_venta = vd.id_venta
             WHERE v.created >= ? AND v.created < ?
             GROUP BY vdi.impuesto_nombre, vdi.porcentaje_aplicado
             ORDER BY monto_total DESC`,
            [desde, hasta]
        );
        return rows.map((r) => ({
            impuesto_nombre: r.impuesto_nombre,
            porcentaje_aplicado: Number(r.porcentaje_aplicado),
            numero_ventas: Number(r.numero_ventas),
            monto_total: Number(r.monto_total),
        }));
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/* ─── Rentabilidad por producto ────────────────────────────────
   El "top productos" de Estadísticas ordena por unidades — útil
   para saber qué se mueve, pero no qué deja dinero. Aquí ordenamos
   por ganancia real (subtotal - costo_referencia_usado × cantidad)
   para detectar productos que venden mucho pero dejan poco margen,
   y viceversa. También se incluyen los productos del catálogo que
   NO tuvieron ni una venta en el rango (candidatos a promoción o a
   sacar del catálogo).
   NOTA: asume que Producto tiene columna `codigo_interno` — ajusta
   si el nombre real es distinto. ──────────────────────────────── */

export interface RentabilidadProducto {
    producto_nombre: string;
    codigo_interno: string | null;
    unidades: number;
    subtotal: number;
    ganancia: number;
    margen: number; // ganancia / subtotal, 0 a 1
}

export interface ProductoSinMovimiento {
    producto_nombre: string;
    codigo_interno: string | null;
}

export interface RentabilidadReporte {
    masRentables: RentabilidadProducto[];
    menosRentables: RentabilidadProducto[];
    sinMovimiento: ProductoSinMovimiento[];
}

export async function obtenerRentabilidadProductos(rango: RangoFecha): Promise<RentabilidadReporte> {
    try {
        const [desde, hasta] = rangoParams(rango);

        const [porProducto, sinMovimiento]: any[] = await Promise.all([
            window.api.query(
                `SELECT p.nombre AS producto_nombre, p.codigo_interno,
                        SUM(vd.cantidad) AS unidades,
                        SUM(vd.subtotal) AS subtotal,
                        SUM(vd.subtotal - COALESCE(vd.costo_referencia_usado, 0) * vd.cantidad) AS ganancia
                 FROM Venta_Detalle vd
                 JOIN Venta v ON v.id_venta = vd.id_venta
                 JOIN Producto p ON p.id_producto = vd.id_producto
                 WHERE v.created >= ? AND v.created < ?
                 GROUP BY p.id_producto, p.nombre, p.codigo_interno`,
                [desde, hasta]
            ),
            window.api.query(
                `SELECT p.nombre AS producto_nombre, p.codigo_interno
                 FROM Producto p
                 WHERE NOT EXISTS (
                     SELECT 1 FROM Venta_Detalle vd
                     JOIN Venta v ON v.id_venta = vd.id_venta
                     WHERE vd.id_producto = p.id_producto
                       AND v.created >= ? AND v.created < ?
                 )
                 ORDER BY p.nombre ASC
                 LIMIT 15`,
                [desde, hasta]
            ),
        ]);

        const conMargen: RentabilidadProducto[] = (porProducto ?? []).map((r: any) => {
            const subtotal = Number(r.subtotal);
            const ganancia = Number(r.ganancia);
            return {
                producto_nombre: r.producto_nombre,
                codigo_interno: r.codigo_interno ?? null,
                unidades: Number(r.unidades),
                subtotal,
                ganancia,
                margen: subtotal > 0 ? ganancia / subtotal : 0,
            };
        });

        const porGananciaDesc = [...conMargen].sort((a, b) => b.ganancia - a.ganancia);
        const porGananciaAsc = [...conMargen].sort((a, b) => a.ganancia - b.ganancia);

        return {
            masRentables: porGananciaDesc.slice(0, 5),
            menosRentables: porGananciaAsc.slice(0, 5),
            sinMovimiento: (sinMovimiento ?? []).map((r: any) => ({
                producto_nombre: r.producto_nombre,
                codigo_interno: r.codigo_interno ?? null,
            })),
        };
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/* ─── Comparativo contra periodo anterior ──────────────────────
   Dos modos:
     - "periodo_anterior": el mismo número de días, justo antes del
       rango elegido (ej. si el rango es de 15 días, compara contra
       los 15 días anteriores).
     - "mismo_periodo_año_pasado": las mismas fechas pero un año
       atrás — mejor para comparar temporadas (ej. diciembre vs
       diciembre del año pasado) sin que la estacionalidad ensucie
       la comparación.
   ──────────────────────────────────────────────────────────────── */

export type ModoComparativo = "periodo_anterior" | "mismo_periodo_año_pasado";

export interface TotalesPeriodo {
    totalVendido: number;
    gananciaBruta: number;
    numeroVentas: number;
    unidadesVendidas: number;
    ticketPromedio: number;
}

export interface ComparativoPeriodo {
    actual: TotalesPeriodo;
    anterior: TotalesPeriodo;
    /** (actual - anterior) / anterior. Si anterior era 0 y actual > 0, se reporta 1 (100%). */
    cambioPorcentual: Record<keyof TotalesPeriodo, number>;
    rangoAnterior: RangoFecha;
}

function calcularRangoAnterior(rango: RangoFecha, modo: ModoComparativo): RangoFecha {
    if (modo === "mismo_periodo_año_pasado") {
        const restarUnAnio = (f: string) => {
            const d = new Date(f + "T00:00:00");
            d.setFullYear(d.getFullYear() - 1);
            return d.toISOString().slice(0, 10);
        };
        return { desde: restarUnAnio(rango.desde), hasta: restarUnAnio(rango.hasta) };
    }
    const msPorDia = 86400000;
    const dias =
        Math.round(
            (new Date(rango.hasta + "T00:00:00").getTime() - new Date(rango.desde + "T00:00:00").getTime()) / msPorDia
        ) + 1;
    const hastaAnterior = sumarDias(rango.desde, -1);
    const desdeAnterior = sumarDias(hastaAnterior, -(dias - 1));
    return { desde: desdeAnterior, hasta: hastaAnterior };
}

async function totalesDeRango(rango: RangoFecha): Promise<TotalesPeriodo> {
    const [desde, hasta] = rangoParams(rango);
    const [[resumen], [impuestos]]: any[] = await Promise.all([
        window.api.query(
            `SELECT
                COUNT(DISTINCT v.id_venta) AS numero_ventas,
                COALESCE(SUM(vd.cantidad), 0) AS unidades_vendidas,
                COALESCE(SUM(vd.subtotal), 0) AS subtotal_total,
                COALESCE(SUM(vd.subtotal - COALESCE(vd.costo_referencia_usado, 0) * vd.cantidad), 0) AS ganancia_bruta
             FROM Venta v
             JOIN Venta_Detalle vd ON vd.id_venta = v.id_venta
             WHERE v.created >= ? AND v.created < ?`,
            [desde, hasta]
        ),
        window.api.query(
            `SELECT COALESCE(SUM(vdi.monto_aplicado), 0) AS impuestos_total
             FROM Venta_Detalle_Impuesto vdi
             JOIN Venta_Detalle vd ON vd.id_vd = vdi.id_vd
             JOIN Venta v ON v.id_venta = vd.id_venta
             WHERE v.created >= ? AND v.created < ?`,
            [desde, hasta]
        ),
    ]);
    const subtotalTotal = Number(resumen?.subtotal_total ?? 0);
    const impuestosTotal = Number(impuestos?.impuestos_total ?? 0);
    const totalVendido = subtotalTotal + impuestosTotal;
    const numeroVentas = Number(resumen?.numero_ventas ?? 0);
    return {
        totalVendido,
        gananciaBruta: Number(resumen?.ganancia_bruta ?? 0),
        numeroVentas,
        unidadesVendidas: Number(resumen?.unidades_vendidas ?? 0),
        ticketPromedio: numeroVentas > 0 ? totalVendido / numeroVentas : 0,
    };
}

function cambioPorcentual(actual: number, anterior: number): number {
    if (anterior === 0) return actual === 0 ? 0 : 1;
    return (actual - anterior) / anterior;
}

export async function obtenerComparativoPeriodo(
    rango: RangoFecha,
    modo: ModoComparativo = "periodo_anterior"
): Promise<ComparativoPeriodo> {
    try {
        const rangoAnterior = calcularRangoAnterior(rango, modo);
        const [actual, anterior] = await Promise.all([totalesDeRango(rango), totalesDeRango(rangoAnterior)]);
        return {
            actual,
            anterior,
            cambioPorcentual: {
                totalVendido: cambioPorcentual(actual.totalVendido, anterior.totalVendido),
                gananciaBruta: cambioPorcentual(actual.gananciaBruta, anterior.gananciaBruta),
                numeroVentas: cambioPorcentual(actual.numeroVentas, anterior.numeroVentas),
                unidadesVendidas: cambioPorcentual(actual.unidadesVendidas, anterior.unidadesVendidas),
                ticketPromedio: cambioPorcentual(actual.ticketPromedio, anterior.ticketPromedio),
            },
            rangoAnterior,
        };
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/* ─── Descomposición precio vs. volumen ────────────────────────
   Responde "¿ganamos más porque vendimos más piezas, o porque
   subimos el precio?". Se puede calcular exacto porque
   Venta_Detalle.precio_unitario queda CONGELADO por línea de venta
   (no cambia si hoy el producto tiene otro precio).

   Para cada producto, comparando el periodo actual contra el
   anterior:
     precio_promedio = subtotal / unidades  (precio ponderado real,
       no el de lista — si hubo descuentos, ya viene reflejado)
     efectoVolumen = (unidades_actual - unidades_anterior) × precio_promedio_anterior
     efectoPrecio  = (precio_promedio_actual - precio_promedio_anterior) × unidades_actual

   efectoVolumen + efectoPrecio == diferenciaTotal (subtotal_actual
   - subtotal_anterior). Si el producto no tuvo ventas en el periodo
   anterior (no hay precio de referencia), toda la diferencia se
   atribuye a volumen — es honesto: no había precio con qué comparar.
   ──────────────────────────────────────────────────────────────── */

export interface DescomposicionProducto {
    producto_nombre: string;
    unidadesActual: number;
    unidadesAnterior: number;
    precioPromedioActual: number;
    precioPromedioAnterior: number;
    efectoVolumen: number;
    efectoPrecio: number;
    diferenciaTotal: number;
}

export interface DescomposicionReporte {
    productos: DescomposicionProducto[];
    totales: { efectoVolumen: number; efectoPrecio: number; diferenciaTotal: number };
    rangoAnterior: RangoFecha;
}

async function subtotalPorProducto(rango: RangoFecha): Promise<Map<string, { unidades: number; subtotal: number }>> {
    const [desde, hasta] = rangoParams(rango);
    const rows: any[] = await window.api.query(
        `SELECT p.nombre AS producto_nombre, SUM(vd.cantidad) AS unidades, SUM(vd.subtotal) AS subtotal
         FROM Venta_Detalle vd
         JOIN Venta v ON v.id_venta = vd.id_venta
         JOIN Producto p ON p.id_producto = vd.id_producto
         WHERE v.created >= ? AND v.created < ?
         GROUP BY p.id_producto, p.nombre`,
        [desde, hasta]
    );
    const mapa = new Map<string, { unidades: number; subtotal: number }>();
    for (const r of rows ?? []) mapa.set(r.producto_nombre, { unidades: Number(r.unidades), subtotal: Number(r.subtotal) });
    return mapa;
}

export async function obtenerDescomposicionPrecioVolumen(
    rango: RangoFecha,
    modo: ModoComparativo = "periodo_anterior"
): Promise<DescomposicionReporte> {
    try {
        const rangoAnterior = calcularRangoAnterior(rango, modo);
        const [actual, anterior] = await Promise.all([subtotalPorProducto(rango), subtotalPorProducto(rangoAnterior)]);

        const nombres = new Set([...actual.keys(), ...anterior.keys()]);
        const productos: DescomposicionProducto[] = [];

        for (const nombre of nombres) {
            const a = actual.get(nombre) ?? { unidades: 0, subtotal: 0 };
            const b = anterior.get(nombre) ?? { unidades: 0, subtotal: 0 };
            if (a.unidades === 0 && b.unidades === 0) continue;

            const precioActual = a.unidades > 0 ? a.subtotal / a.unidades : 0;
            const precioAnterior = b.unidades > 0 ? b.subtotal / b.unidades : 0;
            const diferenciaTotal = a.subtotal - b.subtotal;

            const efectoVolumen = precioAnterior > 0 ? (a.unidades - b.unidades) * precioAnterior : diferenciaTotal;
            const efectoPrecio = precioAnterior > 0 ? (precioActual - precioAnterior) * a.unidades : 0;

            productos.push({
                producto_nombre: nombre,
                unidadesActual: a.unidades,
                unidadesAnterior: b.unidades,
                precioPromedioActual: precioActual,
                precioPromedioAnterior: precioAnterior,
                efectoVolumen,
                efectoPrecio,
                diferenciaTotal,
            });
        }

        productos.sort((x, y) => Math.abs(y.diferenciaTotal) - Math.abs(x.diferenciaTotal));

        const totales = productos.reduce(
            (acc, p) => ({
                efectoVolumen: acc.efectoVolumen + p.efectoVolumen,
                efectoPrecio: acc.efectoPrecio + p.efectoPrecio,
                diferenciaTotal: acc.diferenciaTotal + p.diferenciaTotal,
            }),
            { efectoVolumen: 0, efectoPrecio: 0, diferenciaTotal: 0 }
        );

        return { productos: productos.slice(0, 15), totales, rangoAnterior };
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/* ─── Ventas por día de la semana y por mes ────────────────────
   El "ventas por día" de Estadísticas sirve para rangos cortos,
   pero en "Este año" tendría 365 barras. Por día de la semana
   revela patrones (ej. "los sábados venden el doble"); por mes
   sirve para ver la tendencia del año sin saturar la gráfica. ── */

export interface VentaAgrupada {
    etiqueta: string;
    total: number;
}

export async function obtenerVentasPorDiaSemana(rango: RangoFecha): Promise<VentaAgrupada[]> {
    try {
        const [desde, hasta] = rangoParams(rango);
        const rows: any[] = await window.api.query(
            `SELECT DAYOFWEEK(v.created) AS dia_num, COALESCE(SUM(vd.subtotal), 0) AS total
             FROM Venta v
             JOIN Venta_Detalle vd ON vd.id_venta = v.id_venta
             WHERE v.created >= ? AND v.created < ?
             GROUP BY DAYOFWEEK(v.created)`,
            [desde, hasta]
        );
        const nombres = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const totalesPorDia = new Array(7).fill(0);
        for (const r of rows ?? []) totalesPorDia[Number(r.dia_num) - 1] = Number(r.total);
        // MySQL DAYOFWEEK: 1=domingo..7=sábado. Reordenamos para empezar en lunes.
        const orden = [1, 2, 3, 4, 5, 6, 0];
        return orden.map((i) => ({ etiqueta: nombres[i], total: totalesPorDia[i] }));
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

export async function obtenerVentasPorMes(rango: RangoFecha): Promise<VentaAgrupada[]> {
    try {
        const [desde, hasta] = rangoParams(rango);
        const rows: any[] = await window.api.query(
            `SELECT DATE_FORMAT(v.created, '%Y-%m') AS mes, COALESCE(SUM(vd.subtotal), 0) AS total
             FROM Venta v
             JOIN Venta_Detalle vd ON vd.id_venta = v.id_venta
             WHERE v.created >= ? AND v.created < ?
             GROUP BY DATE_FORMAT(v.created, '%Y-%m')
             ORDER BY mes ASC`,
            [desde, hasta]
        );
        return (rows ?? []).map((r: any) => ({ etiqueta: String(r.mes), total: Number(r.total) }));
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/** Igual que obtenerVentasPorDiaSemana pero por hora del día (0-23) —
 *  para saber a qué hora conviene tener más gente en el mostrador. */
export async function obtenerVentasPorHora(rango: RangoFecha): Promise<VentaAgrupada[]> {
    try {
        const [desde, hasta] = rangoParams(rango);
        const rows: any[] = await window.api.query(
            `SELECT HOUR(v.created) AS hora, COALESCE(SUM(vd.subtotal), 0) AS total
             FROM Venta v
             JOIN Venta_Detalle vd ON vd.id_venta = v.id_venta
             WHERE v.created >= ? AND v.created < ?
             GROUP BY HOUR(v.created)`,
            [desde, hasta]
        );
        const totalesPorHora = new Array(24).fill(0);
        for (const r of rows ?? []) totalesPorHora[Number(r.hora)] = Number(r.total);
        return totalesPorHora.map((total, hora) => ({ etiqueta: `${String(hora).padStart(2, "0")}h`, total }));
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/* ─── Ganancia por categoría (Familia) ────────────────────────
   Mismo cálculo de ganancia que en todos lados: subtotal menos
   costo_referencia_usado (congelado por venta) × cantidad. Los
   productos sin familia asignada se agrupan en "Sin categoría" en
   vez de desaparecer del reporte. ──────────────────────────── */

export interface CategoriaReporte {
    familia_nombre: string;
    unidades: number;
    subtotal: number;
    ganancia: number;
    margen: number; // ganancia / subtotal
}

export async function obtenerGananciaPorCategoria(rango: RangoFecha): Promise<CategoriaReporte[]> {
    try {
        const [desde, hasta] = rangoParams(rango);
        const rows: any[] = await window.api.query(
            `SELECT
                COALESCE(f.nombre, 'Sin categoría') AS familia_nombre,
                SUM(vd.cantidad) AS unidades,
                SUM(vd.subtotal) AS subtotal,
                SUM(vd.subtotal - COALESCE(vd.costo_referencia_usado, 0) * vd.cantidad) AS ganancia
             FROM Venta_Detalle vd
             JOIN Venta v ON v.id_venta = vd.id_venta
             JOIN Producto p ON p.id_producto = vd.id_producto
             LEFT JOIN Familia f ON f.id_familia = p.id_familia
             WHERE v.created >= ? AND v.created < ?
             GROUP BY f.id_familia, familia_nombre
             ORDER BY ganancia DESC`,
            [desde, hasta]
        );
        return (rows ?? []).map((r: any) => {
            const subtotal = Number(r.subtotal);
            const ganancia = Number(r.ganancia);
            return {
                familia_nombre: r.familia_nombre,
                unidades: Number(r.unidades),
                subtotal,
                ganancia,
                margen: subtotal > 0 ? ganancia / subtotal : 0,
            };
        });
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/* ─── Mermas (Ajuste_Inventario negativo) ─────────────────────
   Un ajuste con cantidad_ajuste < 0 es mercancía que salió del
   inventario sin haberse vendido (rotura, caducidad, robo, etc. —
   el motivo es texto libre, así que no filtramos por palabra).
   OJO: a diferencia de una venta, un ajuste NO congela el costo del
   producto al momento de ocurrir — así que el "valor estimado" usa
   el costo_referencia de HOY, no el de cuando pasó el ajuste. Es una
   aproximación, no un número contable exacto. ──────────────────── */

export interface ProductoMerma {
    producto_nombre: string;
    unidades: number;
    valorEstimado: number;
}

export interface MermasReporte {
    unidadesPerdidas: number;
    valorEstimado: number;
    numeroAjustes: number;
    topProductos: ProductoMerma[];
}

export async function obtenerMermas(rango: RangoFecha): Promise<MermasReporte> {
    try {
        const [desde, hasta] = rangoParams(rango);
        const [[totales], topProductos]: any[] = await Promise.all([
            window.api.query(
                `SELECT
                    COALESCE(SUM(-a.cantidad_ajuste), 0) AS unidades_perdidas,
                    COALESCE(SUM(-a.cantidad_ajuste * p.costo_referencia), 0) AS valor_estimado,
                    COUNT(*) AS numero_ajustes
                 FROM Ajuste_Inventario a
                 JOIN Producto p ON p.id_producto = a.id_producto
                 WHERE a.created >= ? AND a.created < ? AND a.cantidad_ajuste < 0`,
                [desde, hasta]
            ),
            window.api.query(
                `SELECT
                    p.nombre AS producto_nombre,
                    SUM(-a.cantidad_ajuste) AS unidades,
                    SUM(-a.cantidad_ajuste * p.costo_referencia) AS valor_estimado
                 FROM Ajuste_Inventario a
                 JOIN Producto p ON p.id_producto = a.id_producto
                 WHERE a.created >= ? AND a.created < ? AND a.cantidad_ajuste < 0
                 GROUP BY p.id_producto, p.nombre
                 ORDER BY valor_estimado DESC
                 LIMIT 5`,
                [desde, hasta]
            ),
        ]);
        return {
            unidadesPerdidas: Number(totales?.unidades_perdidas ?? 0),
            valorEstimado: Number(totales?.valor_estimado ?? 0),
            numeroAjustes: Number(totales?.numero_ajustes ?? 0),
            topProductos: (topProductos ?? []).map((r: any) => ({
                producto_nombre: r.producto_nombre,
                unidades: Number(r.unidades),
                valorEstimado: Number(r.valor_estimado),
            })),
        };
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/* ─── Devoluciones ─────────────────────────────────────────── */

const ETIQUETAS_MOTIVO_DEVOLUCION: Record<string, string> = {
    producto_danado: "Producto dañado",
    producto_caducado: "Producto caducado",
    error_cobro: "Error de cobro",
    cliente_insatisfecho: "Cliente insatisfecho",
    otro: "Otro",
};

export interface ProductoDevuelto {
    producto_nombre: string;
    unidades: number;
    monto: number;
}

export interface DevolucionPorMotivo {
    motivo: string;
    etiqueta: string;
    numero: number;
    monto: number;
}

export interface DevolucionesReporte {
    numeroDevoluciones: number;
    unidades: number;
    montoTotal: number;
    topProductos: ProductoDevuelto[];
    porMotivo: DevolucionPorMotivo[];
}

export async function obtenerDevoluciones(rango: RangoFecha): Promise<DevolucionesReporte> {
    try {
        const [desde, hasta] = rangoParams(rango);
        const [[totales], topProductos, porMotivo]: any[] = await Promise.all([
            window.api.query(
                `SELECT
                    COUNT(*) AS numero_devoluciones,
                    COALESCE(SUM(d.cantidad_devuelta), 0) AS unidades,
                    COALESCE(SUM(d.monto_devuelto), 0) AS monto_total
                 FROM Devolucion d
                 WHERE d.created >= ? AND d.created < ?`,
                [desde, hasta]
            ),
            window.api.query(
                `SELECT p.nombre AS producto_nombre, SUM(d.cantidad_devuelta) AS unidades, SUM(d.monto_devuelto) AS monto
                 FROM Devolucion d
                 JOIN Producto p ON p.id_producto = d.id_producto
                 WHERE d.created >= ? AND d.created < ?
                 GROUP BY p.id_producto, p.nombre
                 ORDER BY monto DESC
                 LIMIT 5`,
                [desde, hasta]
            ),
            window.api.query(
                `SELECT d.motivo, COUNT(*) AS numero, COALESCE(SUM(d.monto_devuelto), 0) AS monto
                 FROM Devolucion d
                 WHERE d.created >= ? AND d.created < ?
                 GROUP BY d.motivo
                 ORDER BY monto DESC`,
                [desde, hasta]
            ),
        ]);
        return {
            numeroDevoluciones: Number(totales?.numero_devoluciones ?? 0),
            unidades: Number(totales?.unidades ?? 0),
            montoTotal: Number(totales?.monto_total ?? 0),
            topProductos: (topProductos ?? []).map((r: any) => ({
                producto_nombre: r.producto_nombre,
                unidades: Number(r.unidades),
                monto: Number(r.monto),
            })),
            porMotivo: (porMotivo ?? []).map((r: any) => ({
                motivo: r.motivo,
                etiqueta: ETIQUETAS_MOTIVO_DEVOLUCION[r.motivo] ?? r.motivo,
                numero: Number(r.numero),
                monto: Number(r.monto),
            })),
        };
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/* ─── Ranking de vendedores ─────────────────────────────────── */

export interface VendedorRanking {
    vendedor_nombre: string;
    numeroVentas: number;
    totalVendido: number;
    unidadesVendidas: number;
    ticketPromedio: number;
}

export async function obtenerRankingVendedores(rango: RangoFecha): Promise<VendedorRanking[]> {
    try {
        const [desde, hasta] = rangoParams(rango);
        const rows: any[] = await window.api.query(
            `SELECT
                COALESCE(CONCAT_WS(' ', pi.nombres, pi.apellido_paterno), 'Sin asignar') AS vendedor_nombre,
                COUNT(DISTINCT v.id_venta) AS numero_ventas,
                COALESCE(SUM(vd.subtotal), 0) AS total_vendido,
                COALESCE(SUM(vd.cantidad), 0) AS unidades
             FROM Venta v
             LEFT JOIN Perfil_Info pi ON pi.id_perfil_info = v.registrado_por
             LEFT JOIN Venta_Detalle vd ON vd.id_venta = v.id_venta
             WHERE v.created >= ? AND v.created < ?
             GROUP BY pi.id_perfil_info, vendedor_nombre
             ORDER BY total_vendido DESC`,
            [desde, hasta]
        );
        return (rows ?? []).map((r: any) => {
            const numeroVentas = Number(r.numero_ventas);
            const totalVendido = Number(r.total_vendido);
            return {
                vendedor_nombre: r.vendedor_nombre,
                numeroVentas,
                totalVendido,
                unidadesVendidas: Number(r.unidades),
                ticketPromedio: numeroVentas > 0 ? totalVendido / numeroVentas : 0,
            };
        });
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/* ─── Historial de ventas ──────────────────────────────────── */

export interface VentaHistorial {
    id_venta: string;
    numero_venta: number;
    fecha: string;
    registrado_por_nombre: string | null;
    cantidad_lineas: number;
    unidades: number;
    subtotal: number;
    impuestos: number;
    total: number;
    ganancia: number;
}

export async function listarHistorialVentas(
    rango: RangoFecha,
    busqueda: string = "",
    limite: number = 300
): Promise<VentaHistorial[]> {
    try {
        const [desde, hasta] = rangoParams(rango);
        const like = `%${busqueda.trim()}%`;
        const rows: any[] = await window.api.query(
            `SELECT
                v.id_venta, v.numero_venta, v.created AS fecha,
                CONCAT_WS(' ', pi.nombres, pi.apellido_paterno) AS registrado_por_nombre,
                COUNT(vd.id_vd) AS cantidad_lineas,
                COALESCE(SUM(vd.cantidad), 0) AS unidades,
                COALESCE(SUM(vd.subtotal), 0) AS subtotal,
                COALESCE((
                    SELECT SUM(vdi.monto_aplicado) FROM Venta_Detalle_Impuesto vdi
                    JOIN Venta_Detalle vd2 ON vd2.id_vd = vdi.id_vd
                    WHERE vd2.id_venta = v.id_venta
                ), 0) AS impuestos,
                COALESCE(SUM(vd.subtotal - COALESCE(vd.costo_referencia_usado, 0) * vd.cantidad), 0) AS ganancia
             FROM Venta v
             LEFT JOIN Perfil_Info pi ON pi.id_perfil_info = v.registrado_por
             LEFT JOIN Venta_Detalle vd ON vd.id_venta = v.id_venta
             WHERE v.created >= ? AND v.created < ?
               AND (? = '' OR CAST(v.numero_venta AS CHAR) LIKE ? OR pi.nombres LIKE ? OR pi.apellido_paterno LIKE ?)
             GROUP BY v.id_venta, v.numero_venta, v.created, pi.nombres, pi.apellido_paterno
             ORDER BY v.created DESC
             LIMIT ?`,
            [desde, hasta, busqueda.trim(), like, like, like, limite]
        );
        return rows.map((r) => {
            const subtotal = Number(r.subtotal);
            const impuestos = Number(r.impuestos);
            return {
                id_venta: r.id_venta,
                numero_venta: Number(r.numero_venta),
                fecha: String(r.fecha),
                registrado_por_nombre: r.registrado_por_nombre?.trim() || null,
                cantidad_lineas: Number(r.cantidad_lineas),
                unidades: Number(r.unidades),
                subtotal,
                impuestos,
                total: subtotal + impuestos,
                ganancia: Number(r.ganancia),
            };
        });
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/** Detalle línea por línea de UNA venta — para el desplegable de la
 *  fila en el historial y para el ticket imprimible individual.
 *  Reusa v_venta_desglose tal cual porque ya trae exactamente esto. */
export interface VentaDetalleLinea {
    id_vd: string;
    producto_nombre: string;
    codigo_interno: string | null;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    impuesto_nombre: string | null;
    impuesto_monto: number | null;
}

export async function obtenerDetalleVenta(idVenta: string): Promise<VentaDetalleLinea[]> {
    try {
        const rows: any[] = await window.api.query(
            `SELECT id_vd, producto_nombre, codigo_interno, cantidad, precio_unitario, subtotal,
                    impuesto_nombre, impuesto_monto
             FROM v_venta_desglose
             WHERE id_venta = ?
             ORDER BY created ASC`,
            [idVenta]
        );
        return rows.map((r) => ({
            id_vd: r.id_vd,
            producto_nombre: r.producto_nombre,
            codigo_interno: r.codigo_interno,
            cantidad: Number(r.cantidad),
            precio_unitario: Number(r.precio_unitario),
            subtotal: Number(r.subtotal),
            impuesto_nombre: r.impuesto_nombre,
            impuesto_monto: r.impuesto_monto !== null ? Number(r.impuesto_monto) : null,
        }));
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/* ─── Exportar a CSV (sin IPC: se arma y se descarga en el
   renderer con un Blob — Excel/Sheets lo abren directo) ────── */

function csvEscape(valor: string | number): string {
    const s = String(valor);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function descargarCSV(nombreArchivo: string, encabezados: string[], filas: (string | number)[][]): void {
    const todasLasFilas = encabezados.length > 0 ? [encabezados, ...filas] : filas;
    const lineas = todasLasFilas.map((fila) => fila.map(csvEscape).join(","));
    // BOM al inicio: sin esto Excel en Windows abre los acentos rotos.
    const contenido = "\uFEFF" + lineas.join("\r\n");
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo.endsWith(".csv") ? nombreArchivo : `${nombreArchivo}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}