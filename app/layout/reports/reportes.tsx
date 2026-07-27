import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ArrowDownRight,
    ArrowUpRight,
    AlertTriangle,
    BarChart3,
    Calendar,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Download,
    Flame,
    FileText,
    History,
    Lightbulb,
    Minus,
    PackageX,
    Percent,
    Printer,
    Receipt,
    RotateCcw,
    Search,
    Table2,
    Tags,
    Trophy,
    TrendingUp,
    Users,
} from "lucide-react";
import "../../css/reportes.css";
import Pagination from "../../components/pagination.tsx";
import Toast, { useToast } from "../../components/Toast .tsx";
import {
    type RangoFecha,
    type EstadisticasReporte,
    type DesgloseImpuesto,
    type VentaHistorial,
    type VentaDetalleLinea,
    type ModoComparativo,
    type ComparativoPeriodo,
    type RentabilidadReporte,
    type DescomposicionReporte,
    type VentaAgrupada,
    type VendedorRanking,
    type CategoriaReporte,
    type MermasReporte,
    type DevolucionesReporte,
    rangoPreset,
    obtenerEstadisticas,
    obtenerDesgloseImpuestos,
    obtenerComparativoPeriodo,
    obtenerRentabilidadProductos,
    obtenerDescomposicionPrecioVolumen,
    obtenerVentasPorDiaSemana,
    obtenerVentasPorMes,
    obtenerVentasPorHora,
    obtenerRankingVendedores,
    obtenerGananciaPorCategoria,
    obtenerMermas,
    obtenerDevoluciones,
    listarHistorialVentas,
    obtenerDetalleVenta,
    descargarCSV,
} from "../../../src/services/reportes.service";

type Tab = "estadisticas" | "historial";
type Preset = "hoy" | "7dias" | "mes" | "anio" | "personalizado";

/** El historial es una tabla densa de renglones, no tarjetas — el
 *  PAGE_SIZE=6 compartido con Inventario/Catálogos se siente corto
 *  aquí. Se deja aparte para no afectar esas otras pantallas. */
const HISTORIAL_PAGE_SIZE = 10;


const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const fmtMoney = (n: number) => money.format(n || 0);
/** Versión corta para poner encima de cada barra sin que se amontone
 *  ("$1.2k" en vez de "$1,200.00") — vacío si es 0 para no ensuciar
 *  las horas/días sin ninguna venta. */
const moneyCorto = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", notation: "compact", maximumFractionDigits: 1 });
const fmtMoneyCorto = (n: number) => (n > 0 ? moneyCorto.format(n) : "");
const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
const fmtFechaHora = (iso: string) =>
    new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
const fmtMes = (aaaaMM: string) =>
    new Date(aaaaMM + "-01T00:00:00").toLocaleDateString("es-MX", { month: "short", year: "numeric" });

/** Pastilla de cambio porcentual — verde si sube, rojo si baja, gris si no cambió. */
function DeltaBadge({ valor }: { valor: number }) {
    const tono = valor > 0.001 ? "up" : valor < -0.001 ? "down" : "flat";
    const Icono = tono === "up" ? ArrowUpRight : tono === "down" ? ArrowDownRight : Minus;
    return (
        <span className={`rep-delta rep-delta-${tono}`}>
            <Icono size={13} />
            {fmtPct(valor)}
        </span>
    );
}

/** Fila de barra divergente: verde hacia la derecha si el efecto ayudó
 *  a ganar más, rojo hacia la izquierda si restó — para comparar
 *  "efecto volumen" contra "efecto precio" de un vistazo. */
function EfectoBarRow({ etiqueta, valor, max }: { etiqueta: string; valor: number; max: number }) {
    const pct = max > 0 ? Math.min(100, (Math.abs(valor) / max) * 100) : 0;
    const positivo = valor >= 0;
    return (
        <div className="rep-efecto-row">
            <div className="rep-efecto-cabecera">
                <span className="rep-efecto-etiqueta">{etiqueta}</span>
                <span className={positivo ? "tone-green" : "tone-red"}>{fmtMoney(valor)}</span>
            </div>
            <div className="rep-efecto-track">
                <div
                    className={`rep-efecto-fill ${positivo ? "rep-efecto-fill-up" : "rep-efecto-fill-down"}`}
                    style={{ width: `${Math.max(valor === 0 ? 0 : 3, pct)}%` }}
                />
            </div>
        </div>
    );
}

export default function Reportes() {
    const { toast, showToast } = useToast();

    const [tab, setTab] = useState<Tab>("estadisticas");

    /* ── Rango de fechas: compartido entre las dos pestañas ── */
    const [preset, setPreset] = useState<Preset>("mes");
    const [rango, setRango] = useState<RangoFecha>(() => rangoPreset("mes"));

    const aplicarPreset = (p: Exclude<Preset, "personalizado">) => {
        setPreset(p);
        setRango(rangoPreset(p));
    };

    /* ── Estadísticas ── */
    const [estadisticas, setEstadisticas] = useState<EstadisticasReporte | null>(null);
    const [desgloseImpuestos, setDesgloseImpuestos] = useState<DesgloseImpuesto[]>([]);
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    // Modo del comparativo: contra el periodo inmediato anterior, o
    // contra las mismas fechas hace un año (mejor para estacionalidad).
    const [modoComparativo, setModoComparativo] = useState<ModoComparativo>("periodo_anterior");
    const [comparativo, setComparativo] = useState<ComparativoPeriodo | null>(null);
    const [rentabilidad, setRentabilidad] = useState<RentabilidadReporte | null>(null);
    const [descomposicion, setDescomposicion] = useState<DescomposicionReporte | null>(null);
    const [ventasPorDiaSemana, setVentasPorDiaSemana] = useState<VentaAgrupada[]>([]);
    const [ventasPorMes, setVentasPorMes] = useState<VentaAgrupada[]>([]);
    const [ventasPorHora, setVentasPorHora] = useState<VentaAgrupada[]>([]);
    const [rankingVendedores, setRankingVendedores] = useState<VendedorRanking[]>([]);
    const [gananciaPorCategoria, setGananciaPorCategoria] = useState<CategoriaReporte[]>([]);
    const [mermas, setMermas] = useState<MermasReporte | null>(null);
    const [devoluciones, setDevoluciones] = useState<DevolucionesReporte | null>(null);

    /* ── Estado solo de UI del bento: qué lista de rentabilidad se ve
       y si la tabla completa de precio-vs-volumen está expandida. ── */
    const [vistaRentabilidad, setVistaRentabilidad] = useState<"top" | "bottom">("top");
    const [detalleAbierto, setDetalleAbierto] = useState(false);

    const cargarEstadisticas = useCallback(async () => {
        try {
            setIsLoadingStats(true);
            const [stats, desglose, comp, rent, descomp, porDiaSemana, porMes, porHora, vendedores, porCategoria, mermasData, devolucionesData] = await Promise.all([
                obtenerEstadisticas(rango),
                obtenerDesgloseImpuestos(rango),
                obtenerComparativoPeriodo(rango, modoComparativo),
                obtenerRentabilidadProductos(rango),
                obtenerDescomposicionPrecioVolumen(rango, modoComparativo),
                obtenerVentasPorDiaSemana(rango),
                obtenerVentasPorMes(rango),
                obtenerVentasPorHora(rango),
                obtenerRankingVendedores(rango),
                obtenerGananciaPorCategoria(rango),
                obtenerMermas(rango),
                obtenerDevoluciones(rango),
            ]);
            setEstadisticas(stats);
            setDesgloseImpuestos(desglose);
            setComparativo(comp);
            setRentabilidad(rent);
            setDescomposicion(descomp);
            setVentasPorDiaSemana(porDiaSemana);
            setVentasPorMes(porMes);
            setVentasPorHora(porHora);
            setRankingVendedores(vendedores);
            setGananciaPorCategoria(porCategoria);
            setMermas(mermasData);
            setDevoluciones(devolucionesData);
        } catch (err: any) {
            showToast("error", err?.message ?? "No se pudieron cargar las estadísticas.");
        } finally {
            setIsLoadingStats(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rango.desde, rango.hasta, modoComparativo]);

    /* ── Historial ── */
    const [historial, setHistorial] = useState<VentaHistorial[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [isLoadingHistorial, setIsLoadingHistorial] = useState(true);
    const [historialPage, setHistorialPage] = useState(1);
    const [expandidaId, setExpandidaId] = useState<string | null>(null);
    const [detalleCache, setDetalleCache] = useState<Record<string, VentaDetalleLinea[]>>({});
    const [cargandoDetalleId, setCargandoDetalleId] = useState<string | null>(null);

    const cargarHistorial = useCallback(async () => {
        try {
            setIsLoadingHistorial(true);
            const rows = await listarHistorialVentas(rango, busqueda);
            setHistorial(rows);
            setHistorialPage(1);
        } catch (err: any) {
            showToast("error", err?.message ?? "No se pudo cargar el historial de ventas.");
        } finally {
            setIsLoadingHistorial(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rango.desde, rango.hasta, busqueda]);

    useEffect(() => {
        cargarEstadisticas();
    }, [cargarEstadisticas]);

    useEffect(() => {
        cargarHistorial();
    }, [cargarHistorial]);

    // Refresco en vivo: cualquier venta nueva que entre mientras esta
    // pantalla está abierta se refleja sola, mismo patrón que Inventory.tsx.
    useEffect(() => {
        const unsubscribe = window.api.onChange((entity) => {
            if (entity === "ventas") {
                cargarEstadisticas();
                cargarHistorial();
            }
        });
        return unsubscribe;
    }, [cargarEstadisticas, cargarHistorial]);

    // Al imprimir, la tabla de detalle precio-vs-volumen se fuerza
    // abierta aunque el usuario la tenga colapsada — en papel no hay
    // botón para expandirla, y es justo el dato que le sirve a un
    // contador. Se regresa a como estaba después de imprimir.
    useEffect(() => {
        let estabaAbierto = detalleAbierto;
        const alAntesDeImprimir = () => {
            estabaAbierto = detalleAbierto;
            setDetalleAbierto(true);
        };
        const alDespuesDeImprimir = () => setDetalleAbierto(estabaAbierto);
        window.addEventListener("beforeprint", alAntesDeImprimir);
        window.addEventListener("afterprint", alDespuesDeImprimir);
        return () => {
            window.removeEventListener("beforeprint", alAntesDeImprimir);
            window.removeEventListener("afterprint", alDespuesDeImprimir);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [detalleAbierto]);

    const toggleFila = async (idVenta: string) => {
        if (expandidaId === idVenta) {
            setExpandidaId(null);
            return;
        }
        setExpandidaId(idVenta);
        if (!detalleCache[idVenta]) {
            try {
                setCargandoDetalleId(idVenta);
                const lineas = await obtenerDetalleVenta(idVenta);
                setDetalleCache((prev) => ({ ...prev, [idVenta]: lineas }));
            } catch (err: any) {
                showToast("error", err?.message ?? "No se pudo cargar el detalle de la venta.");
                setExpandidaId(null);
            } finally {
                setCargandoDetalleId(null);
            }
        }
    };

    const historialPagina = historial.slice((historialPage - 1) * HISTORIAL_PAGE_SIZE, historialPage * HISTORIAL_PAGE_SIZE);

    /* ── Gráfica de ventas por día: barras en CSS puro, sin
       librería — el valor más alto del rango define el 100% de alto. ── */
    const maxVentaDia = useMemo(
        () => Math.max(1, ...(estadisticas?.ventasPorDia.map((d) => d.total) ?? [0])),
        [estadisticas]
    );
    const maxVentaDiaSemana = useMemo(
        () => Math.max(1, ...ventasPorDiaSemana.map((d) => d.total)),
        [ventasPorDiaSemana]
    );
    const maxVentaMes = useMemo(() => Math.max(1, ...ventasPorMes.map((d) => d.total)), [ventasPorMes]);
    const maxVentaHora = useMemo(() => Math.max(1, ...ventasPorHora.map((d) => d.total)), [ventasPorHora]);

    /* ── Margen %: no lo regresa el servicio, pero sale directo de lo
       que ya tenemos (ganancia / subtotal) — sin pedir nada nuevo. ── */
    const margenPct = useMemo(() => {
        if (!estadisticas || estadisticas.subtotalTotal <= 0) return 0;
        return estadisticas.gananciaBruta / estadisticas.subtotalTotal;
    }, [estadisticas]);

    const etiquetaPeriodoComparado = modoComparativo === "periodo_anterior" ? "el periodo anterior" : "el mismo periodo, hace un año";

    /* ── La frase del "¿por qué cambió tu ganancia?": traduce
       efectoVolumen/efectoPrecio (ya calculados en el servicio a
       partir de precio_unitario CONGELADO por venta) a una oración,
       para no obligar a nadie a leer una tabla para entenderlo. ── */
    const fraseInsight = useMemo(() => {
        if (!descomposicion || descomposicion.productos.length === 0) return null;
        const { efectoVolumen, efectoPrecio, diferenciaTotal } = descomposicion.totales;
        if (Math.abs(diferenciaTotal) < 1) return `Tu ingreso se mantuvo prácticamente igual que ${etiquetaPeriodoComparado}.`;

        const cambio = diferenciaTotal > 0 ? "más" : "menos";
        const partes: string[] = [];
        if (Math.abs(efectoVolumen) >= 1) {
            partes.push(`${fmtMoney(Math.abs(efectoVolumen))} por vender ${efectoVolumen >= 0 ? "más" : "menos"} piezas`);
        }
        if (Math.abs(efectoPrecio) >= 1) {
            partes.push(`${fmtMoney(Math.abs(efectoPrecio))} por cambios de precio`);
        }
        const explicacion = partes.length > 0 ? partes.join(" y ") : "cambios menores";
        return `Vendiste ${fmtMoney(Math.abs(diferenciaTotal))} ${cambio} que ${etiquetaPeriodoComparado}: ${explicacion}.`;
    }, [descomposicion, etiquetaPeriodoComparado]);

    const maxEfecto = useMemo(() => {
        if (!descomposicion) return 1;
        return Math.max(1, Math.abs(descomposicion.totales.efectoVolumen), Math.abs(descomposicion.totales.efectoPrecio));
    }, [descomposicion]);

    /** Producto con mayor variación (en valor absoluto) — se muestra
     *  como avance de la tabla completa antes de expandirla. */
    const productoMayorCambio = useMemo(() => {
        if (!descomposicion || descomposicion.productos.length === 0) return null;
        return descomposicion.productos[0]; // ya viene ordenado por |diferenciaTotal| desc
    }, [descomposicion]);

    /* ── Exportar / imprimir ── */
    const handleImprimir = () => window.print();

    const filasHistorialCSV = (rows: VentaHistorial[]): (string | number)[][] =>
        rows.map((v) => [
            v.numero_venta,
            fmtFechaHora(v.fecha),
            v.registrado_por_nombre ?? "—",
            v.unidades,
            v.subtotal.toFixed(2),
            v.impuestos.toFixed(2),
            v.total.toFixed(2),
            v.ganancia.toFixed(2),
        ]);
    const ENCABEZADOS_HISTORIAL = ["Folio", "Fecha", "Vendedor", "Piezas", "Subtotal", "Impuestos", "Total", "Ganancia"];

    const filasEstadisticas = (): (string | number)[][] => {
        if (!estadisticas) return [];
        return [
            ["Rango", `${rango.desde} a ${rango.hasta}`],
            ["Número de ventas", estadisticas.numeroVentas],
            ["Unidades vendidas", estadisticas.unidadesVendidas],
            ["Subtotal", estadisticas.subtotalTotal.toFixed(2)],
            ["Impuestos cobrados", estadisticas.impuestosTotal.toFixed(2)],
            ["Total vendido", estadisticas.totalVendido.toFixed(2)],
            ["Ganancia bruta", estadisticas.gananciaBruta.toFixed(2)],
            ["Ticket promedio", estadisticas.ticketPromedio.toFixed(2)],
            ["Valor de inventario actual", estadisticas.valorInventarioActual.toFixed(2)],
        ];
    };

    const handleDescargarCSV = () => {
        if (tab === "historial") {
            descargarCSV(`historial-ventas_${rango.desde}_a_${rango.hasta}`, ENCABEZADOS_HISTORIAL, filasHistorialCSV(historial));
            showToast("success", "Historial descargado como CSV.");
            return;
        }
        if (!estadisticas) return;
        descargarCSV(`estadisticas_${rango.desde}_a_${rango.hasta}`, ["Métrica", "Valor"], filasEstadisticas());
        showToast("success", "Estadísticas descargadas como CSV.");
    };

    // Para evaluar un rango específico (ej. "del 8 al 10 de abril") en
    // UN solo documento: resumen de estadísticas arriba, historial
    // completo de esos días abajo (sin el tope de 300 filas que usa
    // la tabla en pantalla), no dos archivos sueltos.
    const [descargandoTodo, setDescargandoTodo] = useState(false);
    const handleDescargarTodo = async () => {
        if (!estadisticas) return;
        try {
            setDescargandoTodo(true);
            const historialCompleto = await listarHistorialVentas(rango, "", 100000);
            const filas: (string | number)[][] = [
                ["REPORTE DE VENTAS — LA CUCHILLA"],
                ["Periodo", `${rango.desde} a ${rango.hasta}`],
                ["Generado", new Date().toLocaleString("es-MX")],
                [],
                ["1. RESUMEN DEL PERIODO"],
                ["Métrica", "Valor"],
                ...filasEstadisticas(),
                [],
                [`2. HISTORIAL DE VENTAS (${historialCompleto.length})`],
                ENCABEZADOS_HISTORIAL,
                ...filasHistorialCSV(historialCompleto),
            ];
            descargarCSV(`reporte-ventas_${rango.desde}_a_${rango.hasta}`, [], filas);
            showToast(
                "success",
                `Documento descargado: ${historialCompleto.length} venta${historialCompleto.length === 1 ? "" : "s"} del ${rango.desde} al ${rango.hasta}.`
            );
        } catch (err: any) {
            showToast("error", err?.message ?? "No se pudo descargar el rango completo.");
        } finally {
            setDescargandoTodo(false);
        }
    };

    // Documento pensado para entregarle a un contador: no solo los
    // totales, sino un estado de resultados simplificado (ventas -
    // costo de ventas = utilidad), el desglose de impuestos por tasa,
    // utilidad por categoría, y los ajustes/pérdidas del periodo
    // (mermas y devoluciones) para que el neto cuadre.
    const handleDescargarReporteFiscal = () => {
        if (!estadisticas) return;
        const costoVentas = estadisticas.subtotalTotal - estadisticas.gananciaBruta;
        const margenBrutoPct = estadisticas.subtotalTotal > 0 ? estadisticas.gananciaBruta / estadisticas.subtotalTotal : 0;

        const filas: (string | number)[][] = [
            ["REPORTE FISCAL — LA CUCHILLA"],
            ["Periodo", `${rango.desde} a ${rango.hasta}`],
            ["Generado", new Date().toLocaleString("es-MX")],
            [],
            ["1. RESUMEN DE VENTAS"],
            ["Concepto", "Monto"],
            ["Número de tickets", estadisticas.numeroVentas],
            ["Unidades vendidas", estadisticas.unidadesVendidas],
            ["Ventas netas (base gravable)", estadisticas.subtotalTotal.toFixed(2)],
            ["Impuestos trasladados", estadisticas.impuestosTotal.toFixed(2)],
            ["Total facturado", estadisticas.totalVendido.toFixed(2)],
            ["Ticket promedio", estadisticas.ticketPromedio.toFixed(2)],
            [],
            ["2. ESTADO DE RESULTADOS SIMPLIFICADO"],
            ["Concepto", "Monto"],
            ["Ventas netas", estadisticas.subtotalTotal.toFixed(2)],
            ["(-) Costo de ventas", costoVentas.toFixed(2)],
            ["= Utilidad bruta", estadisticas.gananciaBruta.toFixed(2)],
            ["Margen bruto", `${(margenBrutoPct * 100).toFixed(1)}%`],
            [],
            ["3. IMPUESTOS TRASLADADOS POR TASA"],
            ["Impuesto", "Tasa aplicada", "# Ventas", "Monto cobrado"],
            ...desgloseImpuestos.map((d) => [
                d.impuesto_nombre,
                `${(d.porcentaje_aplicado * 100).toFixed(2)}%`,
                d.numero_ventas,
                d.monto_total.toFixed(2),
            ]),
            [],
            ["4. VENTAS Y UTILIDAD POR CATEGORÍA"],
            ["Categoría", "Unidades", "Ventas", "Utilidad", "Margen"],
            ...gananciaPorCategoria.map((c) => [
                c.familia_nombre,
                c.unidades,
                c.subtotal.toFixed(2),
                c.ganancia.toFixed(2),
                `${(c.margen * 100).toFixed(1)}%`,
            ]),
            [],
            ["5. AJUSTES Y PÉRDIDAS DEL PERIODO"],
            ["Concepto", "Cantidad", "Monto"],
            ["Mermas de inventario", mermas?.unidadesPerdidas ?? 0, (mermas?.valorEstimado ?? 0).toFixed(2)],
            ["Devoluciones", devoluciones?.numeroDevoluciones ?? 0, (devoluciones?.montoTotal ?? 0).toFixed(2)],
            [],
            ["Nota: la utilidad bruta usa el costo de compra vigente al momento de cada venta. Las mermas se valúan al costo actual del producto (un ajuste de inventario no conserva un costo histórico como sí lo hace una venta)."],
        ];
        descargarCSV(`reporte-fiscal_${rango.desde}_a_${rango.hasta}`, [], filas);
        showToast("success", "Reporte fiscal descargado.");
    };

    return (
        <div className="rep-page">
            <div className="rep-container">
                {/* ── Header ── */}
                <div className="rep-header">
                    <div>
                        <h1 className="rep-header-title">Reportes</h1>
                        <p className="rep-header-subtitle">Cómo va tu negocio y el historial de cada venta</p>
                    </div>
                    <div className="rep-header-actions">
                        <button className="btn btn-ghost" onClick={handleDescargarReporteFiscal} title="Estado de resultados, impuestos por tasa y utilidad por categoría — listo para tu contador">
                            <FileText size={16} />
                            <span>Reporte Fiscal</span>
                        </button>
                        <button className="btn btn-ghost" onClick={handleDescargarCSV}>
                            <Download size={16} />
                            <span>Descargar CSV</span>
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={handleDescargarTodo}
                            disabled={descargandoTodo}
                            title="Un solo documento con el resumen y el historial completo del rango de fechas que elijas abajo"
                        >
                            <Download size={16} />
                            <span>{descargandoTodo ? "Descargando…" : "Descargar todo (rango)"}</span>
                        </button>
                        <button className="btn btn-primary" onClick={handleImprimir}>
                            <Printer size={16} />
                            <span>Imprimir</span>
                        </button>
                    </div>
                </div>

                {/* ── Tabs ── */}
                <div className="rep-tabs">
                    <button
                        className={`rep-tab${tab === "estadisticas" ? " active" : ""}`}
                        onClick={() => setTab("estadisticas")}
                    >
                        <BarChart3 size={16} />
                        Estadísticas
                    </button>
                    <button
                        className={`rep-tab${tab === "historial" ? " active" : ""}`}
                        onClick={() => setTab("historial")}
                    >
                        <History size={16} />
                        Historial
                    </button>
                </div>

                {/* ── Filtro de rango de fechas: compartido por ambas pestañas ── */}
                <div className="rep-filtros">
                    <div className="rep-preset-group">
                        {(["hoy", "7dias", "mes", "anio"] as const).map((p) => (
                            <button
                                key={p}
                                className={`rep-preset-btn${preset === p ? " active" : ""}`}
                                onClick={() => aplicarPreset(p)}
                            >
                                {p === "hoy" ? "Hoy" : p === "7dias" ? "Últimos 7 días" : p === "mes" ? "Este mes" : "Este año"}
                            </button>
                        ))}
                    </div>
                    <div className="rep-rango-personalizado">
                        <Calendar size={14} />
                        <input
                            type="date"
                            value={rango.desde}
                            max={rango.hasta}
                            onChange={(e) => {
                                setPreset("personalizado");
                                setRango((r) => ({ ...r, desde: e.target.value }));
                            }}
                        />
                        <span>a</span>
                        <input
                            type="date"
                            value={rango.hasta}
                            min={rango.desde}
                            max={hoyISOLocal()}
                            onChange={(e) => {
                                setPreset("personalizado");
                                setRango((r) => ({ ...r, hasta: e.target.value }));
                            }}
                        />
                    </div>
                </div>

                {/* Encabezado visible SOLO al imprimir — para que el papel diga
                    de qué periodo es el reporte aunque los filtros de arriba
                    no salgan impresos (ver @media print en reportes.css). */}
                <div className="rep-print-header">
                    <h2>Reporte de {tab === "estadisticas" ? "Estadísticas" : "Historial de Ventas"} — La Cuchilla</h2>
                    <p>
                        Periodo: {fmtFecha(rango.desde + "T00:00:00")} — {fmtFecha(rango.hasta + "T00:00:00")}
                        &nbsp;·&nbsp;Generado el {new Date().toLocaleString("es-MX")}
                    </p>
                </div>

                {/* ══════════════════ ESTADÍSTICAS ══════════════════ */}
                {tab === "estadisticas" && (
                    <>
                        {isLoadingStats || !estadisticas ? (
                            <p className="rep-loading">Cargando estadísticas...</p>
                        ) : (
                            <>
                                {/* ── Fila 1 (lo más importante): resumen del periodo
                                    + por qué cambió tu ganancia, lado a lado ── */}
                                <div className="rep-bento">
                                    <div className="rep-bento-cell rep-bento-hero span-5">
                                        <div className="rep-hero-top">
                                            <p className="rep-panel-title">Resumen del periodo</p>
                                            <div className="rep-modo-toggle">
                                                <button
                                                    className={`rep-modo-btn${modoComparativo === "periodo_anterior" ? " active" : ""}`}
                                                    onClick={() => setModoComparativo("periodo_anterior")}
                                                >
                                                    Vs. periodo anterior
                                                </button>
                                                <button
                                                    className={`rep-modo-btn${modoComparativo === "mismo_periodo_año_pasado" ? " active" : ""}`}
                                                    onClick={() => setModoComparativo("mismo_periodo_año_pasado")}
                                                >
                                                    Vs. año pasado
                                                </button>
                                            </div>
                                        </div>

                                        <div className="rep-hero-main">
                                            <p className="rep-kpi-label">Total vendido</p>
                                            <p className="rep-hero-value">{fmtMoney(estadisticas.totalVendido)}</p>
                                            {comparativo && <DeltaBadge valor={comparativo.cambioPorcentual.totalVendido} />}
                                        </div>

                                        <div className="rep-hero-stats">
                                            <div className="rep-hero-stat">
                                                <span className="rep-hero-stat-icon tone-green"><TrendingUp size={15} /></span>
                                                <div className="rep-hero-stat-texto">
                                                    <p className="rep-kpi-label">Ganancia</p>
                                                    <p className="rep-hero-stat-value">{fmtMoney(estadisticas.gananciaBruta)}</p>
                                                </div>
                                                {comparativo && <DeltaBadge valor={comparativo.cambioPorcentual.gananciaBruta} />}
                                            </div>
                                            <div className="rep-hero-stat">
                                                <span className="rep-hero-stat-icon tone-yellow"><Percent size={15} /></span>
                                                <div className="rep-hero-stat-texto">
                                                    <p className="rep-kpi-label">Margen</p>
                                                    <p className="rep-hero-stat-value">{(margenPct * 100).toFixed(1)}%</p>
                                                </div>
                                            </div>
                                            <div className="rep-hero-stat">
                                                <span className="rep-hero-stat-icon"><Receipt size={15} /></span>
                                                <div className="rep-hero-stat-texto">
                                                    <p className="rep-kpi-label">Ticket prom.</p>
                                                    <p className="rep-hero-stat-value">{fmtMoney(estadisticas.ticketPromedio)}</p>
                                                </div>
                                                {comparativo && <DeltaBadge valor={comparativo.cambioPorcentual.ticketPromedio} />}
                                            </div>
                                        </div>

                                        <p className="rep-hero-footer">
                                            {estadisticas.numeroVentas} ventas · {estadisticas.unidadesVendidas} piezas · {fmtMoney(estadisticas.impuestosTotal)} en impuestos
                                        </p>
                                    </div>

                                    <div className="rep-bento-cell rep-bento-highlight span-7">
                                        <p className="rep-panel-title">
                                            <Lightbulb size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                                            ¿Por qué cambió tu ganancia?
                                        </p>
                                        {!comparativo || !descomposicion ? (
                                            <p className="rep-loading">Calculando...</p>
                                        ) : !fraseInsight ? (
                                            <p className="rep-empty">No hay suficientes ventas para comparar contra {etiquetaPeriodoComparado}.</p>
                                        ) : (
                                            <>
                                                <p className="rep-insight-frase">{fraseInsight}</p>
                                                <div className="rep-efecto-bars">
                                                    <EfectoBarRow
                                                        etiqueta="Por vender más / menos piezas"
                                                        valor={descomposicion.totales.efectoVolumen}
                                                        max={maxEfecto}
                                                    />
                                                    <EfectoBarRow
                                                        etiqueta="Por cambios de precio"
                                                        valor={descomposicion.totales.efectoPrecio}
                                                        max={maxEfecto}
                                                    />
                                                </div>
                                                <p className="rep-panel-note">
                                                    Usa el precio real de cada venta, ya congelado en el momento en que ocurrió — así que si tu costo de
                                                    compra sube y por eso subes tus precios, eso se ve aquí como "efecto precio", no se disfraza de "vender más".
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* ── Fila 2: patrones — cuándo vendes y qué se mueve ── */}
                                <div className="rep-bento">
                                    <div className="rep-bento-cell span-6">
                                        <p className="rep-panel-title">Ventas por día</p>
                                        {estadisticas.ventasPorDia.length === 0 ? (
                                            <p className="rep-empty">No hubo ventas en este periodo.</p>
                                        ) : (
                                            <div className="rep-bar-chart">
                                                {estadisticas.ventasPorDia.map((d) => (
                                                    <div key={d.fecha} className="rep-bar-col" title={`${fmtFecha(d.fecha + "T00:00:00")}: ${fmtMoney(d.total)}`}>
                                                        <span className="rep-bar-valor">{fmtMoneyCorto(d.total)}</span>
                                                        <div className="rep-bar-track">
                                                            <div
                                                                className="rep-bar-fill"
                                                                style={{ height: `${Math.max(4, (d.total / maxVentaDia) * 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="rep-bar-label">
                                                            {new Date(d.fecha + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" })}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="rep-bento-cell span-3">
                                        <p className="rep-panel-title">
                                            <Flame size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                                            Picos por día
                                        </p>
                                        {ventasPorDiaSemana.every((d) => d.total === 0) ? (
                                            <p className="rep-empty">Sin datos.</p>
                                        ) : (
                                            <div className="rep-bar-chart rep-bar-chart-compacto">
                                                {ventasPorDiaSemana.map((d) => (
                                                    <div key={d.etiqueta} className="rep-bar-col" title={`${d.etiqueta}: ${fmtMoney(d.total)}`}>
                                                        <span className="rep-bar-valor">{fmtMoneyCorto(d.total)}</span>
                                                        <div className="rep-bar-track">
                                                            <div
                                                                className="rep-bar-fill"
                                                                style={{ height: `${Math.max(4, (d.total / maxVentaDiaSemana) * 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="rep-bar-label">{d.etiqueta.slice(0, 1)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="rep-bento-cell span-3">
                                        <p className="rep-panel-title">Top productos</p>
                                        {estadisticas.topProductos.length === 0 ? (
                                            <p className="rep-empty">Sin ventas.</p>
                                        ) : (
                                            <ol className="rep-top-list">
                                                {estadisticas.topProductos.map((p, i) => (
                                                    <li key={p.producto_nombre} className="rep-top-item">
                                                        <span className="rep-top-rank">{i + 1}</span>
                                                        <span className="rep-top-nombre">{p.producto_nombre}</span>
                                                        <span className="rep-top-unidades">{p.unidades} pza.</span>
                                                    </li>
                                                ))}
                                            </ol>
                                        )}
                                    </div>
                                </div>

                                {/* ── Fila 2b: a qué hora vendes más — útil para saber
                                    cuándo poner más gente en el mostrador ── */}
                                <div className="rep-bento">
                                    <div className="rep-bento-cell span-12">
                                        <p className="rep-panel-title">
                                            <Flame size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                                            Picos por hora del día
                                        </p>
                                        {ventasPorHora.every((d) => d.total === 0) ? (
                                            <p className="rep-empty">Sin datos suficientes en este periodo.</p>
                                        ) : (
                                            <div className="rep-bar-chart rep-bar-chart-compacto">
                                                {ventasPorHora.map((d) => (
                                                    <div key={d.etiqueta} className="rep-bar-col" title={`${d.etiqueta}: ${fmtMoney(d.total)}`}>
                                                        <span className="rep-bar-valor">{fmtMoneyCorto(d.total)}</span>
                                                        <div className="rep-bar-track">
                                                            <div
                                                                className="rep-bar-fill"
                                                                style={{ height: `${Math.max(4, (d.total / maxVentaHora) * 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="rep-bar-label">{d.etiqueta}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Fila 3: rentabilidad real por producto — qué deja
                                    dinero de verdad, no solo qué se mueve mucho ── */}
                                <div className="rep-bento">
                                    <div className="rep-bento-cell span-8">
                                        <div className="rep-panel-header">
                                            <p className="rep-panel-title">
                                                <Trophy size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                                                Rentabilidad por producto
                                            </p>
                                            <div className="rep-modo-toggle">
                                                <button
                                                    className={`rep-modo-btn${vistaRentabilidad === "top" ? " active" : ""}`}
                                                    onClick={() => setVistaRentabilidad("top")}
                                                >
                                                    Las que más dejan
                                                </button>
                                                <button
                                                    className={`rep-modo-btn${vistaRentabilidad === "bottom" ? " active" : ""}`}
                                                    onClick={() => setVistaRentabilidad("bottom")}
                                                >
                                                    Las que menos dejan
                                                </button>
                                            </div>
                                        </div>
                                        {!rentabilidad || (vistaRentabilidad === "top" ? rentabilidad.masRentables : rentabilidad.menosRentables).length === 0 ? (
                                            <p className="rep-empty">No hubo ventas en este periodo.</p>
                                        ) : (
                                            <ol className="rep-top-list rep-top-list-grid">
                                                {(vistaRentabilidad === "top" ? rentabilidad.masRentables : rentabilidad.menosRentables).map((p, i) => (
                                                    <li key={`${vistaRentabilidad}-${p.producto_nombre}`} className="rep-top-item">
                                                        <span className="rep-top-rank">{i + 1}</span>
                                                        <span className="rep-top-nombre">{p.producto_nombre}</span>
                                                        <span className="rep-top-unidades">margen {(p.margen * 100).toFixed(0)}%</span>
                                                        <span className={`rep-top-total${p.ganancia < 0 ? " tone-red" : " tone-green"}`}>{fmtMoney(p.ganancia)}</span>
                                                    </li>
                                                ))}
                                            </ol>
                                        )}
                                    </div>

                                    <div className="rep-bento-cell span-4">
                                        <p className="rep-panel-title">
                                            <PackageX size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                                            Sin movimiento
                                        </p>
                                        {!rentabilidad || rentabilidad.sinMovimiento.length === 0 ? (
                                            <p className="rep-empty">Todos tus productos tuvieron al menos una venta en este periodo.</p>
                                        ) : (
                                            <>
                                                <p className="rep-panel-note" style={{ marginBottom: 10 }}>
                                                    Candidatos a promoción o a revisar si siguen en catálogo.
                                                </p>
                                                <div className="rep-sinmovimiento-list">
                                                    {rentabilidad.sinMovimiento.map((p) => (
                                                        <span key={p.producto_nombre} className="rep-chip">
                                                            {p.producto_nombre}
                                                        </span>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* ── Fila 3b: ganancia por categoría — qué tipo de
                                    producto deja más dinero, no solo cuál producto ── */}
                                <div className="rep-bento">
                                    <div className="rep-bento-cell span-12">
                                        <p className="rep-panel-title">
                                            <Tags size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                                            Ganancia por categoría
                                        </p>
                                        {gananciaPorCategoria.length === 0 ? (
                                            <p className="rep-empty">No hubo ventas en este periodo.</p>
                                        ) : (
                                            <div className="rep-detalle-tabla-wrap">
                                                <table className="rep-table rep-table-simple">
                                                    <thead>
                                                        <tr>
                                                            <th>Categoría</th>
                                                            <th>Unidades</th>
                                                            <th>Vendido</th>
                                                            <th>Ganancia</th>
                                                            <th>Margen</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {gananciaPorCategoria.map((c) => (
                                                            <tr key={c.familia_nombre}>
                                                                <td>{c.familia_nombre}</td>
                                                                <td>{c.unidades}</td>
                                                                <td>{fmtMoney(c.subtotal)}</td>
                                                                <td className={`rep-col-total ${c.ganancia >= 0 ? "tone-green" : "tone-red"}`}>{fmtMoney(c.ganancia)}</td>
                                                                <td>{(c.margen * 100).toFixed(0)}%</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Fila 3c: control de pérdidas — mermas de inventario
                                    y devoluciones, cada una con sus productos más frecuentes ── */}
                                <div className="rep-bento">
                                    <div className="rep-bento-cell span-6">
                                        <p className="rep-panel-title">
                                            <AlertTriangle size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                                            Mermas de inventario
                                        </p>
                                        {!mermas || mermas.numeroAjustes === 0 ? (
                                            <p className="rep-empty">Sin ajustes de baja registrados en este periodo.</p>
                                        ) : (
                                            <>
                                                <div className="rep-mini-stats">
                                                    <div>
                                                        <p className="rep-kpi-label">Unidades perdidas</p>
                                                        <p className="rep-panel-highlight rep-panel-highlight-sm">{mermas.unidadesPerdidas}</p>
                                                    </div>
                                                    <div>
                                                        <p className="rep-kpi-label">Valor estimado</p>
                                                        <p className="rep-panel-highlight rep-panel-highlight-sm tone-red">{fmtMoney(mermas.valorEstimado)}</p>
                                                    </div>
                                                </div>
                                                <p className="rep-panel-note" style={{ margin: "6px 0 10px" }}>
                                                    Al costo de hoy de cada producto (los ajustes no congelan el costo como sí lo hace una venta).
                                                </p>
                                                <ol className="rep-top-list">
                                                    {mermas.topProductos.map((p, i) => (
                                                        <li key={p.producto_nombre} className="rep-top-item">
                                                            <span className="rep-top-rank">{i + 1}</span>
                                                            <span className="rep-top-nombre">{p.producto_nombre}</span>
                                                            <span className="rep-top-unidades">{p.unidades} pza.</span>
                                                            <span className="rep-top-total tone-red">{fmtMoney(p.valorEstimado)}</span>
                                                        </li>
                                                    ))}
                                                </ol>
                                            </>
                                        )}
                                    </div>

                                    <div className="rep-bento-cell span-6">
                                        <p className="rep-panel-title">
                                            <RotateCcw size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                                            Devoluciones
                                        </p>
                                        {!devoluciones || devoluciones.numeroDevoluciones === 0 ? (
                                            <p className="rep-empty">Sin devoluciones registradas en este periodo.</p>
                                        ) : (
                                            <>
                                                <div className="rep-mini-stats">
                                                    <div>
                                                        <p className="rep-kpi-label">Devoluciones</p>
                                                        <p className="rep-panel-highlight rep-panel-highlight-sm">{devoluciones.numeroDevoluciones}</p>
                                                    </div>
                                                    <div>
                                                        <p className="rep-kpi-label">Monto devuelto</p>
                                                        <p className="rep-panel-highlight rep-panel-highlight-sm tone-red">{fmtMoney(devoluciones.montoTotal)}</p>
                                                    </div>
                                                </div>
                                                {devoluciones.porMotivo.length > 0 && (
                                                    <p className="rep-panel-note" style={{ margin: "6px 0 10px" }}>
                                                        Principal motivo:{" "}
                                                        <strong>
                                                            {devoluciones.porMotivo[0].etiqueta} ({devoluciones.porMotivo[0].numero})
                                                        </strong>
                                                    </p>
                                                )}
                                                <ol className="rep-top-list">
                                                    {devoluciones.topProductos.map((p, i) => (
                                                        <li key={p.producto_nombre} className="rep-top-item">
                                                            <span className="rep-top-rank">{i + 1}</span>
                                                            <span className="rep-top-nombre">{p.producto_nombre}</span>
                                                            <span className="rep-top-unidades">{p.unidades} pza.</span>
                                                            <span className="rep-top-total tone-red">{fmtMoney(p.monto)}</span>
                                                        </li>
                                                    ))}
                                                </ol>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* ── Fila 4 (secundaria, tono más discreto): tendencia
                                    mensual, equipo, inventario ── */}
                                <div className="rep-bento">
                                    <div className="rep-bento-cell rep-bento-quiet span-4">
                                        <p className="rep-panel-title">Ventas por mes</p>
                                        {ventasPorMes.length > 1 ? (
                                            <div className="rep-bar-chart rep-bar-chart-compacto">
                                                {ventasPorMes.map((d) => (
                                                    <div key={d.etiqueta} className="rep-bar-col" title={`${fmtMes(d.etiqueta)}: ${fmtMoney(d.total)}`}>
                                                        <span className="rep-bar-valor">{fmtMoneyCorto(d.total)}</span>
                                                        <div className="rep-bar-track">
                                                            <div
                                                                className="rep-bar-fill"
                                                                style={{ height: `${Math.max(4, (d.total / maxVentaMes) * 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="rep-bar-label">{fmtMes(d.etiqueta).replace(/\s\d+$/, "")}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="rep-empty">Elige un rango de más de un mes para ver la tendencia.</p>
                                        )}
                                    </div>

                                    <div className="rep-bento-cell rep-bento-quiet span-4">
                                        <p className="rep-panel-title">
                                            <Users size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                                            Ranking de vendedores
                                        </p>
                                        {rankingVendedores.length === 0 ? (
                                            <p className="rep-empty">Sin ventas registradas.</p>
                                        ) : (
                                            <table className="rep-table rep-table-simple">
                                                <thead>
                                                    <tr>
                                                        <th>Vendedor</th>
                                                        <th>Ventas</th>
                                                        <th>Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rankingVendedores.slice(0, 5).map((v) => (
                                                        <tr key={v.vendedor_nombre}>
                                                            <td>{v.vendedor_nombre}</td>
                                                            <td>{v.numeroVentas}</td>
                                                            <td className="rep-col-total">{fmtMoney(v.totalVendido)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>

                                    <div className="rep-bento-cell rep-bento-quiet span-4">
                                        <p className="rep-panel-title">Valor de inventario (hoy)</p>
                                        <p className="rep-panel-highlight">{fmtMoney(estadisticas.valorInventarioActual)}</p>
                                        <p className="rep-panel-note">
                                            No depende del rango de fechas — es tu mercancía disponible hoy, al costo con el que entró.
                                        </p>
                                    </div>
                                </div>

                                {/* ── Fila 5 (lo más profundo, colapsado por defecto): el
                                    desglose fiscal y la tabla completa precio-vs-volumen ── */}
                                <div className="rep-bento">
                                    {desgloseImpuestos.length > 0 && (
                                        <div className="rep-bento-cell rep-bento-quiet span-6">
                                            <p className="rep-panel-title">Impuestos cobrados por tasa</p>
                                            <table className="rep-table rep-table-simple">
                                                <thead>
                                                    <tr>
                                                        <th>Impuesto</th>
                                                        <th>Tasa</th>
                                                        <th>Monto cobrado</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {desgloseImpuestos.map((d) => (
                                                        <tr key={`${d.impuesto_nombre}-${d.porcentaje_aplicado}`}>
                                                            <td>{d.impuesto_nombre}</td>
                                                            <td>{(d.porcentaje_aplicado * 100).toFixed(2)}%</td>
                                                            <td>{fmtMoney(d.monto_total)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    <div className={`rep-bento-cell rep-bento-quiet ${desgloseImpuestos.length > 0 ? "span-6" : "span-12"}`}>
                                        <button className="rep-toggle-switch" onClick={() => setDetalleAbierto((v) => !v)}>
                                            <span>
                                                <Table2 size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                                                Detalle completo: precio vs. volumen por producto
                                            </span>
                                            {detalleAbierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                        {!detalleAbierto ? (
                                            productoMayorCambio && (
                                                <p className="rep-panel-note" style={{ marginTop: 10 }}>
                                                    El producto con mayor variación fue <strong>{productoMayorCambio.producto_nombre}</strong>{" "}
                                                    ({fmtMoney(productoMayorCambio.diferenciaTotal)}). Abre el detalle para ver los demás.
                                                </p>
                                            )
                                        ) : !descomposicion || descomposicion.productos.length === 0 ? (
                                            <p className="rep-empty">No hay datos suficientes para comparar.</p>
                                        ) : (
                                            <div className="rep-detalle-tabla-wrap">
                                                <table className="rep-table rep-table-simple">
                                                    <thead>
                                                        <tr>
                                                            <th>Producto</th>
                                                            <th>Unidades</th>
                                                            <th>Precio prom.</th>
                                                            <th>Efecto volumen</th>
                                                            <th>Efecto precio</th>
                                                            <th>Diferencia</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {descomposicion.productos.map((p) => (
                                                            <tr key={p.producto_nombre}>
                                                                <td>{p.producto_nombre}</td>
                                                                <td>{p.unidadesAnterior} → {p.unidadesActual}</td>
                                                                <td>{fmtMoney(p.precioPromedioAnterior)} → {fmtMoney(p.precioPromedioActual)}</td>
                                                                <td className={p.efectoVolumen >= 0 ? "tone-green" : "tone-red"}>{fmtMoney(p.efectoVolumen)}</td>
                                                                <td className={p.efectoPrecio >= 0 ? "tone-green" : "tone-red"}>{fmtMoney(p.efectoPrecio)}</td>
                                                                <td className={`rep-col-total ${p.diferenciaTotal >= 0 ? "tone-green" : "tone-red"}`}>{fmtMoney(p.diferenciaTotal)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr>
                                                            <td colSpan={3} className="rep-col-total">Total</td>
                                                            <td className={`rep-col-total ${descomposicion.totales.efectoVolumen >= 0 ? "tone-green" : "tone-red"}`}>
                                                                {fmtMoney(descomposicion.totales.efectoVolumen)}
                                                            </td>
                                                            <td className={`rep-col-total ${descomposicion.totales.efectoPrecio >= 0 ? "tone-green" : "tone-red"}`}>
                                                                {fmtMoney(descomposicion.totales.efectoPrecio)}
                                                            </td>
                                                            <td className={`rep-col-total ${descomposicion.totales.diferenciaTotal >= 0 ? "tone-green" : "tone-red"}`}>
                                                                {fmtMoney(descomposicion.totales.diferenciaTotal)}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}

                {/* ══════════════════ HISTORIAL ══════════════════ */}
                {tab === "historial" && (
                    <>
                        <div className="rep-busqueda">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Buscar por folio o vendedor..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>

                        <div className="rep-panel rep-panel-tabla">
                            {isLoadingHistorial ? (
                                <p className="rep-loading">Cargando historial...</p>
                            ) : historial.length === 0 ? (
                                <p className="rep-empty">No hay ventas registradas en este periodo.</p>
                            ) : (
                                <table className="rep-table">
                                    <thead>
                                        <tr>
                                            <th className="rep-col-expand" />
                                            <th>Folio</th>
                                            <th>Fecha</th>
                                            <th>Vendedor</th>
                                            <th>Piezas</th>
                                            <th>Subtotal</th>
                                            <th>Impuestos</th>
                                            <th>Total</th>
                                            <th>Ganancia</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historialPagina.map((v) => (
                                            <React.Fragment key={v.id_venta}>
                                                <tr className="rep-row-clickable" onClick={() => toggleFila(v.id_venta)}>
                                                    <td className="rep-col-expand">
                                                        {expandidaId === v.id_venta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    </td>
                                                    <td>#{v.numero_venta}</td>
                                                    <td>{fmtFechaHora(v.fecha)}</td>
                                                    <td>{v.registrado_por_nombre ?? "—"}</td>
                                                    <td>{v.unidades}</td>
                                                    <td>{fmtMoney(v.subtotal)}</td>
                                                    <td>{fmtMoney(v.impuestos)}</td>
                                                    <td className="rep-col-total">{fmtMoney(v.total)}</td>
                                                    <td className="tone-green">{fmtMoney(v.ganancia)}</td>
                                                </tr>
                                                {expandidaId === v.id_venta && (
                                                    <tr className="rep-row-detalle">
                                                        <td colSpan={9}>
                                                            {cargandoDetalleId === v.id_venta ? (
                                                                <p className="rep-loading">Cargando detalle...</p>
                                                            ) : (
                                                                <table className="rep-table-detalle">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Producto</th>
                                                                            <th>Código</th>
                                                                            <th>Cant.</th>
                                                                            <th>Precio unit.</th>
                                                                            <th>Subtotal</th>
                                                                            <th>Impuesto</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {(detalleCache[v.id_venta] ?? []).map((l) => (
                                                                            <tr key={l.id_vd}>
                                                                                <td>{l.producto_nombre}</td>
                                                                                <td>{l.codigo_interno ?? "—"}</td>
                                                                                <td>{l.cantidad}</td>
                                                                                <td>{fmtMoney(l.precio_unitario)}</td>
                                                                                <td>{fmtMoney(l.subtotal)}</td>
                                                                                <td>
                                                                                    {l.impuesto_nombre
                                                                                        ? `${l.impuesto_nombre} (${fmtMoney(l.impuesto_monto ?? 0)})`
                                                                                        : "—"}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="rep-pagination-bar">
                            <p className="rep-pagination-info">
                                {historial.length === 0
                                    ? "Sin resultados"
                                    : `Mostrando ${(historialPage - 1) * HISTORIAL_PAGE_SIZE + 1}–${Math.min(historialPage * HISTORIAL_PAGE_SIZE, historial.length)} de ${historial.length} ventas`}
                            </p>
                            <Pagination page={historialPage} totalItems={historial.length} pageSize={HISTORIAL_PAGE_SIZE} onPageChange={setHistorialPage} />
                        </div>
                    </>
                )}
            </div>

            <Toast toast={toast} />
        </div>
    );
}

function hoyISOLocal(): string {
    return new Date().toISOString().slice(0, 10);
}