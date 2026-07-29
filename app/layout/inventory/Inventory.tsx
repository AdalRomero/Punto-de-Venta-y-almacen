import React, { useCallback, useEffect, useState } from "react";
import {
    AlertTriangle,
    ChevronDown,
    Clock,
    Download,
    Package,
    Plus,
    Search,
    Edit2,
    Trash2,
    RotateCcw,
    Eye,
    EyeOff,
    ArrowLeft,
    Check,
    X,
    Boxes,
    PackageCheck,
    PackageX,
    CalendarOff,
    Loader2,
} from "lucide-react";
import "../../css/inventario.css";
import FormInput from "../../components/FormInput";
import Pagination, { PAGE_SIZE } from "../../components/pagination.tsx";
import Toast, { useToast } from "../../components/Toast .tsx";
import type { FamiliaRow, ImpuestoRow, MargenRow, ProductoPayload, ProductoRow } from "../../components/add/addproducto";
import type { CodigoAlternoExistente, EntradaPayload } from "../../components/add/addentrada";
import AddProducto from "../../components/add/addproducto";
import AddEntrada from "../../components/add/addentrada";
import ErrorModal from "../../components/modals/ErrorModal";
import WarningModal from "../../components/modals/WarningModal";
import {
    listarProductosInventario,
    listarProductosParaModal,
    listarMargenesVigentes,
    listarImpuestosVigentes,
    listarCodigosAlternosExistentes,
    listarLotesPorProducto,
    listarTodosLosLotes,
    marcarLoteEnterado,
    actualizarLote,
    obtenerProducto,
    crearProducto,
    actualizarProducto,
    cambiarEstadoProducto,
    crearEntrada,
    reponerEstanteria,
    reponerEstanteriaAMeta,
    type ProductoListado,
    type LoteListado,
    type LoteEditPayload,
    type LoteExportRow,
    type AlertLevel,
} from "../../../src/services/inventory.service";
import { listarFamilias } from "../../../src/services/catalogos.service";
import { exportarProductos, exportarLotes, exportarInventarioCompleto } from "../../../src/services/export.service";

/* ─────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────────── */
const alertDotClass: Record<AlertLevel, string> = {
    green: "tone-green",
    yellow: "tone-yellow",
    red: "tone-red",
    black: "tone-black",
    none: "tone-none",
};

const UNIDAD_LABEL: Record<ProductoListado["unidad"], string> = {
    piezas: "PZA",
    kilos: "KG",
};

const ALERT_LABEL: Record<AlertLevel, string> = {
    green: "SEGURO",
    yellow: "PRECAUCIÓN",
    red: "RIESGO",
    black: "VENCIDO",
    none: "SIN FECHA",
};

/** Las 3 categorías de semáforo que ya calcula el service (estantería,
 *  existencia total y caducidad). El filtro nuevo trabaja a nivel
 *  (categoria, nivel) en vez de agrupar todo un color de una — así se
 *  puede distinguir, por ejemplo, "existencia baja" (amarillo/rojo,
 *  un aviso) de "agotado" (negro, ya es crítico), o "estantería sin
 *  existencias" (negro) de "estantería crítica" (rojo, ≤20% de la
 *  meta) y "estantería por completar" (amarillo, entre 20% y 40%). */
type Categoria = "estanteria" | "stock" | "caducidad";

interface FiltroEstado {
    categoria: Categoria;
    nivel: AlertLevel;
}

function nivelDeCategoria(p: ProductoListado, categoria: Categoria): AlertLevel {
    switch (categoria) {
        case "estanteria":
            return p.alertLevelEstanteria;
        case "stock":
            return p.alertLevelStock;
        case "caducidad":
            return p.alertLevelCaducidad;
    }
}

function mismoFiltro(a: FiltroEstado, b: FiltroEstado): boolean {
    return a.categoria === b.categoria && a.nivel === b.nivel;
}

/** Config del dropdown "Filtrar por estado": un grupo por categoría,
 *  con todos sus niveles de semáforo posibles y su color, del más
 *  crítico al más tranquilo. Esto es lo que hace al filtro versátil —
 *  ya no agrupa colores a la fuerza, el usuario elige exactamente
 *  qué estado quiere ver. */
const ESTADO_GRUPOS: { categoria: Categoria; label: string; icon: React.ReactNode; niveles: { nivel: AlertLevel; label: string }[] }[] = [
    {
        categoria: "estanteria",
        label: "Estantería",
        icon: <Boxes size={13} />,
        niveles: [
            { nivel: "black", label: "Sin existencias" },
            { nivel: "red", label: "Crítica (≤20%)" },
            { nivel: "yellow", label: "Por completar (≤40%)" },
            { nivel: "green", label: "Completa (>40%)" },
        ],
    },
    {
        categoria: "stock",
        label: "Existencias",
        icon: <AlertTriangle size={13} />,
        niveles: [
            { nivel: "black", label: "Agotado" },
            { nivel: "red", label: "Crítica" },
            { nivel: "yellow", label: "Baja" },
            { nivel: "green", label: "Suficiente" },
        ],
    },
    {
        categoria: "caducidad",
        label: "Caducidad",
        icon: <Clock size={13} />,
        niveles: [
            { nivel: "black", label: "Vencido" },
            { nivel: "red", label: "Urgente" },
            { nivel: "yellow", label: "Próximo" },
            { nivel: "green", label: "Vigente" },
        ],
    },
];

/** Cada card del bento de KPIs corresponde a un conjunto de filtros
 *  (categoria, nivel) — al hacer click, esos filtros se prenden/apagan
 *  en bloque en el dropdown de estado. Separadas así, "existencia
 *  baja" y "agotado" (o "por caducar" y "vencido") dejan de competir
 *  por la misma card: una es aviso, la otra ya es crítico. */
const CARD_FILTROS = {
    estanteriaVacia: [{ categoria: "estanteria", nivel: "black" }] as FiltroEstado[],
    estanteriaCritica: [{ categoria: "estanteria", nivel: "red" }] as FiltroEstado[],
    estanteriaIncompleta: [{ categoria: "estanteria", nivel: "yellow" }] as FiltroEstado[],
    existenciaBaja: [
        { categoria: "stock", nivel: "yellow" },
        { categoria: "stock", nivel: "red" },
    ] as FiltroEstado[],
    agotado: [{ categoria: "stock", nivel: "black" }] as FiltroEstado[],
    porCaducar: [
        { categoria: "caducidad", nivel: "yellow" },
        { categoria: "caducidad", nivel: "red" },
    ] as FiltroEstado[],
    vencido: [{ categoria: "caducidad", nivel: "black" }] as FiltroEstado[],
};

const ESTADO_LOTE_LABEL: Record<LoteListado["estado_lote"], string> = {
    activo: "Activo",
    parcial: "Parcial",
    agotado: "Agotado",
    caducado: "Caducado",
};

function formatDate(dateStr: string | Date | null): string {
    if (!dateStr) return "—";
    // window.api a veces entrega las columnas DATE ya como objeto Date
    // (no como string 'YYYY-MM-DD') — se acepta cualquiera de los dos.
    // Si es string, se fuerza a medianoche LOCAL (no UTC) para que no se
    // corra un día hacia atrás en zonas detrás de UTC (México). Si ya es
    // Date, se usan sus componentes LOCALES tal cual, sin volver a
    // parsear un ISO string (que sí podría traer la trampa de UTC).
    const d =
        dateStr instanceof Date
            ? dateStr
            : new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

/** El esquema real no tiene un "código corto" de familia (solo
 *  id_familia/nombre/digitos) — antes lo traía el mock. Mientras no
 *  exista esa columna, se deriva una etiqueta visual a partir del
 *  nombre para no perder el badge de la tabla. */
function familiaBadge(nombre: string | null): string {
    if (!nombre) return "—";
    return nombre
        .split(/\s+/)
        .map((palabra) => palabra[0])
        .join("")
        .slice(0, 3)
        .toUpperCase();
}


/* ─────────────────────────────────────────────────────────────
   ProductRow
──────────────────────────────────────────────────────────────── */
function ProductRow({
    producto,
    onEdit,
    onEliminar,
    onVerLotes,
    onResurtir,
    isResurtiendo,
    justResurtida,
    showError,
}: {
    producto: ProductoListado;
    onEdit: (producto: ProductoListado) => void;
    onEliminar: (producto: ProductoListado) => void;
    onVerLotes: (producto: ProductoListado) => void;
    onResurtir: (producto: ProductoListado, cantidadFaltante?: number) => void;
    isResurtiendo: boolean;
    justResurtida: boolean;
    showError: (title: string, message: string) => void;
}) {
    const almacenDisponible = producto.cantidad_total - producto.cantidad_estanteria;
    const faltanteMeta = producto.meta_estanteria !== null ? Math.max(0, producto.meta_estanteria - producto.cantidad_estanteria) : 0;

    const [isRestockingInline, setIsRestockingInline] = useState(false);
    const [restockAmount, setRestockAmount] = useState("");

    const handleRestockClick = () => {
        setIsRestockingInline(true);
        // Sugerir la meta final en estantería (o lo máximo que alcance el almacén)
        const sugerenciaFinal = producto.cantidad_estanteria + Math.min(faltanteMeta, Math.max(0, almacenDisponible));
        setRestockAmount(String(sugerenciaFinal));
    };

    const confirmRestock = (targetAmountStr: string) => {
        const targetAmount = Number(targetAmountStr);
        if (isNaN(targetAmount) || targetAmount < 0) {
            showError("Valor inválido", `La cantidad no puede ser menor a 0.`);
            return;
        }
        if (targetAmount > producto.cantidad_total) {
            showError("Stock insuficiente", `La cantidad máxima posible en estantería es el total disponible en tienda (${producto.cantidad_total}).`);
            return;
        }
        setIsRestockingInline(false);
        const amountToAdd = targetAmount - producto.cantidad_estanteria;
        onResurtir(producto, amountToAdd);
    };

    return (
        <tr
            className={`inv-row-clickable${!producto.activo ? " inv-row-inactive" : ""}`}
            style={{ transition: "background 0.15s", borderBottom: "1px solid var(--cuh-border-light)" }}
            onMouseEnter={(e) => {
                if (producto.activo)
                    (e.currentTarget as HTMLTableRowElement).style.background = "var(--cuh-bg)";
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.background = "";
            }}
        >
            {/* Producto */}
            <td style={{ padding: "14px 24px" }}>
                <div className="inv-cell-product">
                    <span className="inv-cell-product-name">{producto.nombre}</span>
                    <span className="inv-cell-product-code">{producto.codigo_interno ?? "—"}</span>
                </div>
            </td>

            {/* Clasificación */}
            <td style={{ padding: "14px 24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "var(--cuh-primary)",
                            background: "var(--cuh-primary-50)",
                            borderRadius: 4,
                            padding: "1px 7px",
                            width: "fit-content",
                        }}
                    >
                        {familiaBadge(producto.familia_nombre)}
                    </span>
                    <span style={{ fontSize: 12.5, color: "var(--cuh-text-muted)", fontWeight: 500 }}>
                        {producto.familia_nombre ?? "Sin familia"}
                    </span>
                </div>
            </td>

            {/* Fiscal y Finanzas */}
            <td style={{ padding: "14px 24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--cuh-text-dark)" }}>
                        ${(producto.costo_final ?? 0).toFixed(2)}
                    </span>
                    <span
                        style={{
                            fontSize: 11,
                            color: "var(--cuh-text-muted)",
                            background: "var(--cuh-border-light)",
                            borderRadius: 4,
                            padding: "1px 6px",
                            width: "fit-content",
                        }}
                    >
                        IVA {producto.impuesto_porcentaje}%
                    </span>
                </div>
            </td>

            {/* Stock */}
            <td style={{ padding: "14px 24px" }}>
                <div className="inv-cell-stock">
                    <div className={`inv-stock-dot ${alertDotClass[producto.alertLevelStock]}`} />
                    <span className="inv-cell-stock-qty">
                        {producto.cantidad_total} {UNIDAD_LABEL[producto.unidad]}
                    </span>
                </div>
            </td>

            {/* Estantería */}
            <td style={{ padding: "14px 24px" }}>
                {producto.meta_estanteria === null ? (
                    <span className="inv-cell-stock-date">Sin meta</span>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div className="inv-cell-stock">
                            <div className={`inv-stock-dot ${alertDotClass[producto.alertLevelEstanteria]}`} />
                            <span className="inv-cell-stock-qty" style={{ fontSize: 13 }}>
                                {producto.cantidad_estanteria}/{producto.meta_estanteria} {UNIDAD_LABEL[producto.unidad]}
                            </span>
                        </div>
                        {justResurtida ? (
                            <span className="inv-restock-confirm">
                                <Check size={11} /> Estantería resurtida
                            </span>
                        ) : isRestockingInline ? (
                            <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 4 }}>
                                <input
                                    type="number"
                                    min={0}
                                    step={producto.unidad === "kilos" ? 0.01 : 1}
                                    max={producto.cantidad_total}
                                    value={restockAmount}
                                    onChange={(e) => setRestockAmount(e.target.value)}
                                    style={{ width: 50, padding: "2px 4px", fontSize: 12, border: "1px solid var(--cuh-border)", borderRadius: 4 }}
                                />
                                <button
                                    onClick={() => confirmRestock(restockAmount)}
                                    disabled={isResurtiendo}
                                    style={{ background: "var(--cuh-primary)", color: "white", border: "none", borderRadius: 4, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                                    title="Confirmar resurtido"
                                >
                                    {isResurtiendo ? <Loader2 size={10} className="inv-spin" /> : <Check size={12} />}
                                </button>
                                <button
                                    onClick={() => {
                                        // La meta es lo que se configuró; si no hay meta, el máximo es cantidad_total
                                        const metaObj = producto.meta_estanteria ?? producto.cantidad_total;
                                        // No puede superar lo que hay disponible en almacén + lo que ya está en anaquel
                                        const targetMax = Math.min(metaObj, producto.cantidad_total);
                                        confirmRestock(String(targetMax));
                                    }}
                                    style={{ background: "var(--cuh-bg)", color: "var(--cuh-text-dark)", border: "1px solid var(--cuh-border-light)", borderRadius: 4, padding: "0 6px", height: 22, fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                                    title="Llenar a la meta configurada"
                                >
                                    META
                                </button>
                                <button
                                    onClick={() => setIsRestockingInline(false)}
                                    style={{ background: "transparent", color: "var(--cuh-text-muted)", border: "none", borderRadius: 4, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                                    title="Cancelar"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (producto.alertLevelEstanteria === "black" || producto.alertLevelEstanteria === "red" || producto.alertLevelEstanteria === "yellow") && producto.activo ? (
                            <button
                                className="inv-restock-btn"
                                disabled={isResurtiendo}
                                onClick={handleRestockClick}
                                title="Resurtir estantería"
                            >
                                <PackageCheck size={11} />
                                Resurtir...
                            </button>
                        ) : null}
                    </div>
                )}
            </td>

            {/* Caducidad */}
            <td style={{ padding: "14px 24px" }}>
                <div className="inv-cell-stock">
                    <div className={`inv-stock-dot ${alertDotClass[producto.alertLevelCaducidad]}`} />
                    <span className="inv-cell-stock-date">
                        {producto.proxima_caducidad ? formatDate(producto.proxima_caducidad) : "Sin lotes"}
                    </span>
                </div>
            </td>



            {/* Acciones */}
            <td style={{ padding: "14px 24px" }}>
                <div className="inv-row-actions">
                    {/* Ver lotes */}
                    <button
                        title="Ver lotes"
                        onClick={() => onVerLotes(producto)}
                        style={{
                            width: 30, height: 30, border: "none", background: "none",
                            cursor: "pointer", borderRadius: 6, display: "flex",
                            alignItems: "center", justifyContent: "center",
                            color: "var(--cuh-text-muted)", transition: "background 0.15s, color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "var(--cuh-primary-50)";
                            (e.currentTarget as HTMLButtonElement).style.color = "var(--cuh-primary)";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "none";
                            (e.currentTarget as HTMLButtonElement).style.color = "var(--cuh-text-muted)";
                        }}
                    >
                        <Eye size={15} />
                    </button>

                    {/* Editar */}
                    <button
                        title="Editar"
                        onClick={() => onEdit(producto)}
                        style={{
                            width: 30, height: 30, border: "none", background: "none",
                            cursor: "pointer", borderRadius: 6, display: "flex",
                            alignItems: "center", justifyContent: "center",
                            color: "var(--cuh-text-muted)", transition: "background 0.15s, color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "var(--cuh-primary-50)";
                            (e.currentTarget as HTMLButtonElement).style.color = "var(--cuh-primary)";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "none";
                            (e.currentTarget as HTMLButtonElement).style.color = "var(--cuh-text-muted)";
                        }}
                    >
                        <Edit2 size={15} />
                    </button>

                    <button
                        title={producto.activo ? "Desactivar" : "Reactivar"}
                        onClick={() => onEliminar(producto)}
                        style={{
                            width: 30, height: 30, border: "none", background: "none",
                            cursor: "pointer", borderRadius: 6, display: "flex",
                            alignItems: "center", justifyContent: "center",
                            color: "var(--cuh-text-muted)", transition: "background 0.15s, color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = producto.activo
                                ? "var(--cuh-danger-50)"
                                : "var(--cuh-success-bg)";
                            (e.currentTarget as HTMLButtonElement).style.color = producto.activo
                                ? "var(--cuh-danger)"
                                : "var(--cuh-success)";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "none";
                            (e.currentTarget as HTMLButtonElement).style.color = "var(--cuh-text-muted)";
                        }}
                    >
                        {producto.activo ? <Trash2 size={15} /> : <RotateCcw size={15} />}
                    </button>
                </div>
            </td>
        </tr>
    );
}

/* ─────────────────────────────────────────────────────────────
   LotesView — reemplaza la tabla de productos cuando se le da al
   ojo de un producto: misma "tarjeta" de tabla, pero con los lotes
   de ese producto. Un lote vencido se puede marcar "Enterado" para
   que deje de forzar el semáforo del producto a negro en la tabla
   principal (el cambio vive en la base, vía marcarLoteEnterado).
──────────────────────────────────────────────────────────────── */
/** 'YYYY-MM-DD' (o vacío) a partir de fecha_caducidad, sin pasar por
 *  UTC — mismo cuidado de zona horaria que diasRestantesHasta() en
 *  inventory.service.ts, para que el <input type="date"> arranque
 *  mostrando el mismo día que ya se ve en la columna Caducidad. */
function toDateInputValue(fecha: string | Date | null): string {
    if (!fecha) return "";
    if (typeof fecha === "string") return fecha.slice(0, 10);
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const d = String(fecha.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

const inlineInputStyle: React.CSSProperties = {
    width: "100%",
    minWidth: 0,
    padding: "6px 8px",
    fontSize: 13,
    border: "1px solid var(--cuh-border)",
    borderRadius: 6,
    background: "var(--cuh-bg-white)",
    color: "var(--cuh-text-dark)",
};

function LotesView({
    producto,
    lotes,
    isLoading,
    error,
    onBack,
    onEditProduct,
    onToggleEnterado,
    onSaveLote,
}: {
    producto: ProductoListado;
    lotes: LoteListado[];
    isLoading: boolean;
    error: string | null;
    onBack: () => void;
    onEditProduct: () => void;
    onToggleEnterado: (lote: LoteListado) => void;
    onSaveLote: (lote: LoteListado, payload: LoteEditPayload) => Promise<void>;
}) {
    const [alertFilters, setAlertFilters] = useState<AlertLevel[]>([]);

    // ── Edición inline de lote (fila -> campos editables) ──
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState({
        cantidad_disponible: "",
        fecha_caducidad: "",
        unidad: "piezas" as LoteListado["unidad"],
        costo_compra: "",
    });
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const startEdit = (lote: LoteListado) => {
        setEditingId(lote.id_lote);
        setSaveError(null);
        setDraft({
            cantidad_disponible: String(lote.cantidad_disponible),
            fecha_caducidad: toDateInputValue(lote.fecha_caducidad),
            unidad: lote.unidad,
            costo_compra: lote.costo_compra != null ? String(lote.costo_compra) : "",
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setSaveError(null);
    };

    const saveEdit = async (lote: LoteListado) => {
        const cantidad = Number(draft.cantidad_disponible);
        if (!Number.isFinite(cantidad) || cantidad < 0) {
            setSaveError("La cantidad disponible debe ser un número válido (0 o más).");
            return;
        }
        const costoTexto = draft.costo_compra.trim();
        const costo = costoTexto === "" ? null : Number(costoTexto);
        if (costo !== null && (!Number.isFinite(costo) || costo < 0)) {
            setSaveError("El costo de compra debe ser un número válido.");
            return;
        }

        setIsSaving(true);
        setSaveError(null);
        try {
            await onSaveLote(lote, {
                cantidad_disponible: cantidad,
                fecha_caducidad: draft.fecha_caducidad || null,
                unidad: draft.unidad,
                costo_compra: costo,
            });
            setEditingId(null);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "No se pudo guardar el lote.");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleFilter = (level: AlertLevel) =>
        setAlertFilters((prev) =>
            prev.includes(level) ? prev.filter((f) => f !== level) : [...prev, level]
        );

    const lotesFiltrados =
        alertFilters.length === 0 ? lotes : lotes.filter((l) => alertFilters.includes(l.alertLevel));

    // ── Paginación (6 en 6) — se reinicia a la página 1 cuando cambia
    // el filtro de alerta o el producto (lotes) para no quedar varado
    // en una página que ya no existe. ──
    const [lotesPage, setLotesPage] = useState(1);
    useEffect(() => {
        setLotesPage(1);
    }, [alertFilters, lotes]);

    const lotesPagina = lotesFiltrados.slice((lotesPage - 1) * PAGE_SIZE, lotesPage * PAGE_SIZE);

    return (
        <>
            {/* ── Encabezado de la vista de lotes (reemplaza el toolbar de búsqueda) ── */}
            <div
                className="card card-context context-info inv-filters-card"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <button
                        onClick={onBack}
                        title="Volver al inventario"
                        style={{
                            width: 34, height: 34, border: "1px solid var(--cuh-border)", background: "var(--cuh-bg-white)",
                            cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                            color: "var(--cuh-text-muted)", flexShrink: 0,
                        }}
                    >
                        <ArrowLeft size={17} />
                    </button>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--cuh-text-dark)" }}>
                            Lotes de {producto.nombre}
                        </h2>
                        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--cuh-text-muted)" }}>
                            {producto.codigo_interno ?? "—"} · Stock vigente: {producto.cantidad_total} {UNIDAD_LABEL[producto.unidad]}
                        </p>
                    </div>
                </div>
                <button className="btn btn-ghost" style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={onEditProduct}>
                    <Edit2 size={15} />
                    <span>Editar Producto</span>
                </button>
            </div>

            {/* ── Filtros de alerta (mismo semáforo, aplicado a los lotes) ── */}
            <div className="inv-alert-filters">
                <span className="inv-alert-filters-label">Filtrar por estado:</span>
                {(
                    [
                        { level: "green" as AlertLevel, label: "SEGURO" },
                        { level: "yellow" as AlertLevel, label: "PRECAUCIÓN" },
                        { level: "red" as AlertLevel, label: "RIESGO" },
                        { level: "black" as AlertLevel, label: "VENCIDO" },
                    ]
                ).map(({ level, label }) => (
                    <button
                        key={level}
                        className={`inv-alert-pill tone-${level}${alertFilters.includes(level) ? " active" : ""}`}
                        onClick={() => toggleFilter(level)}
                    >
                        <span className="inv-alert-dot" />
                        {label}
                    </button>
                ))}
                {alertFilters.length > 0 && (
                    <button className="inv-alert-clear" onClick={() => setAlertFilters([])}>
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* ── Tabla de lotes ── */}
            <div className="inv-table-card">
                <div className="inv-table-scroll">
                    <table style={{ width: "100%", textAlign: "left", fontSize: 14, borderCollapse: "collapse", whiteSpace: "nowrap" }}>
                        <thead style={{ background: "var(--cuh-bg)", color: "var(--cuh-text-muted)", fontWeight: 600, borderBottom: "1px solid var(--cuh-border-light)" }}>
                            <tr>
                                {["Lote", "Cantidad", "Costo de Compra", "Caducidad", "Días / Alerta", "Gestión"].map((col) => (
                                    <th
                                        key={col}
                                        style={{
                                            padding: "13px 24px",
                                            fontSize: 12,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.04em",
                                            textAlign: col === "Gestión" ? "center" : "left",
                                        }}
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6}>
                                        <div className="inv-empty-state">
                                            <Package size={40} />
                                            <p className="inv-empty-state-title">Cargando lotes…</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={6}>
                                        <div className="inv-empty-state">
                                            <AlertTriangle size={40} />
                                            <p className="inv-empty-state-title">No se pudieron cargar los lotes</p>
                                            <p className="inv-empty-state-subtitle">{error}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : lotesFiltrados.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <div className="inv-empty-state">
                                            <Package size={40} />
                                            <p className="inv-empty-state-title">
                                                {lotes.length === 0
                                                    ? "Este producto no tiene lotes registrados"
                                                    : "Ningún lote coincide con el filtro"}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                lotesPagina.map((lote) => {
                                    const enteradoVencido = lote.enterado && lote.alertLevel === "black";
                                    const dotLevel: AlertLevel = enteradoVencido ? "none" : lote.alertLevel;
                                    const diasTexto =
                                        lote.alertLevel === "black"
                                            ? "VENCIDO"
                                            : lote.alertLevel === "none"
                                                ? "Sin fecha"
                                                : ALERT_LABEL[lote.alertLevel];
                                    const isEditing = editingId === lote.id_lote;

                                    return (
                                        <React.Fragment key={lote.id_lote}>
                                            <tr
                                                style={{
                                                    borderBottom: isEditing ? "none" : "1px solid var(--cuh-border-light)",
                                                    opacity: !isEditing && lote.estado_lote === "agotado" ? 0.55 : 1,
                                                    background: isEditing ? "var(--cuh-bg)" : undefined,
                                                }}
                                            >
                                                <td style={{ padding: "14px 24px" }}>
                                                    <div className="inv-cell-product">
                                                        <span className="inv-cell-product-name">
                                                            Entrada {formatDate(lote.created)}
                                                        </span>
                                                        <span className="inv-cell-product-code">
                                                            {lote.id_lote.slice(0, 8)} · {ESTADO_LOTE_LABEL[lote.estado_lote]}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: "14px 24px" }}>
                                                    {isEditing ? (
                                                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                step={lote.unidad === "kilos" ? 0.01 : 1}
                                                                value={draft.cantidad_disponible}
                                                                onChange={(e) =>
                                                                    setDraft((d) => ({ ...d, cantidad_disponible: e.target.value }))
                                                                }
                                                                style={{ ...inlineInputStyle, width: 80 }}
                                                            />
                                                            <span style={{ color: "var(--cuh-text-muted)", fontSize: 12.5 }}>
                                                                / {lote.cantidad}
                                                            </span>
                                                            <select
                                                                value={draft.unidad}
                                                                onChange={(e) =>
                                                                    setDraft((d) => ({
                                                                        ...d,
                                                                        unidad: e.target.value as LoteListado["unidad"],
                                                                    }))
                                                                }
                                                                style={{ ...inlineInputStyle, width: 90 }}
                                                            >
                                                                <option value="piezas">PZA</option>
                                                                <option value="kilos">KG</option>
                                                            </select>
                                                        </div>
                                                    ) : (
                                                        <span className="inv-cell-stock-qty">
                                                            {lote.cantidad_disponible} / {lote.cantidad} {UNIDAD_LABEL[lote.unidad]}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: "14px 24px", color: "var(--cuh-text-muted)" }}>
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step="0.01"
                                                            placeholder="—"
                                                            value={draft.costo_compra}
                                                            onChange={(e) =>
                                                                setDraft((d) => ({ ...d, costo_compra: e.target.value }))
                                                            }
                                                            style={{ ...inlineInputStyle, width: 100 }}
                                                        />
                                                    ) : lote.costo_compra != null ? (
                                                        `$${lote.costo_compra.toFixed(2)}`
                                                    ) : (
                                                        "—"
                                                    )}
                                                </td>
                                                <td style={{ padding: "14px 24px" }}>
                                                    {isEditing ? (
                                                        <input
                                                            type="date"
                                                            value={draft.fecha_caducidad}
                                                            onChange={(e) =>
                                                                setDraft((d) => ({ ...d, fecha_caducidad: e.target.value }))
                                                            }
                                                            style={{ ...inlineInputStyle, width: 150 }}
                                                        />
                                                    ) : (
                                                        <div className="inv-cell-stock">
                                                            <div className={`inv-stock-dot ${alertDotClass[dotLevel]}`} />
                                                            <span className="inv-cell-stock-date">{formatDate(lote.fecha_caducidad)}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: "14px 24px" }}>
                                                    <span
                                                        style={{
                                                            fontSize: 10.5,
                                                            fontWeight: 800,
                                                            letterSpacing: "0.03em",
                                                            color: enteradoVencido ? "var(--cuh-text-muted)" : "var(--cuh-text-dark)",
                                                        }}
                                                    >
                                                        {diasTexto}
                                                    </span>
                                                    {enteradoVencido && (
                                                        <div style={{ fontSize: 10, color: "var(--cuh-text-light)", marginTop: 2 }}>
                                                            Enterado
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: "14px 24px", textAlign: "center" }}>
                                                    <div style={{ display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
                                                        {isEditing ? (
                                                            <>
                                                                <button
                                                                    title="Guardar cambios"
                                                                    disabled={isSaving}
                                                                    onClick={() => saveEdit(lote)}
                                                                    style={{
                                                                        width: 30, height: 30, border: "none", borderRadius: 6,
                                                                        cursor: isSaving ? "default" : "pointer",
                                                                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                                        background: "var(--cuh-success-bg)", color: "var(--cuh-success)",
                                                                        opacity: isSaving ? 0.6 : 1,
                                                                    }}
                                                                >
                                                                    <Check size={15} />
                                                                </button>
                                                                <button
                                                                    title="Cancelar"
                                                                    disabled={isSaving}
                                                                    onClick={cancelEdit}
                                                                    style={{
                                                                        width: 30, height: 30, border: "none", borderRadius: 6, cursor: "pointer",
                                                                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                                        background: "var(--cuh-border-light)", color: "var(--cuh-text-muted)",
                                                                    }}
                                                                >
                                                                    <X size={15} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    title="Editar lote"
                                                                    onClick={() => startEdit(lote)}
                                                                    style={{
                                                                        width: 30, height: 30, border: "none", borderRadius: 6, cursor: "pointer",
                                                                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                                        background: "var(--cuh-border-light)", color: "var(--cuh-text-muted)",
                                                                    }}
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                                {lote.alertLevel === "black" && (
                                                                    <button
                                                                        title={lote.enterado ? "Marcar como no revisado" : "Marcar como enterado"}
                                                                        onClick={() => onToggleEnterado(lote)}
                                                                        style={{
                                                                            width: 30, height: 30, border: "none", borderRadius: 6, cursor: "pointer",
                                                                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                                            background: lote.enterado ? "var(--cuh-success-bg)" : "var(--cuh-border-light)",
                                                                            color: lote.enterado ? "var(--cuh-success)" : "var(--cuh-text-muted)",
                                                                        }}
                                                                    >
                                                                        {lote.enterado ? <EyeOff size={15} /> : <Eye size={15} />}
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {isEditing && saveError && (
                                                <tr style={{ borderBottom: "1px solid var(--cuh-border-light)" }}>
                                                    <td colSpan={6} style={{ padding: "0 24px 12px", background: "var(--cuh-bg)" }}>
                                                        <span style={{ fontSize: 12.5, color: "var(--cuh-danger, #d64545)" }}>
                                                            {saveError}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Pagination page={lotesPage} totalItems={lotesFiltrados.length} onPageChange={setLotesPage} />
        </>
    );
}

/* ─────────────────────────────────────────────────────────────
   EstadoFiltroDropdown — un dropdown de una sola categoría (Estantería
   / Existencias / Caducidad), con el mismo look que el selector de
   Familia del toolbar. Se instancia 3 veces, una por categoría, para
   no meter todos los niveles en un único dropdown largo.
──────────────────────────────────────────────────────────────── */
function EstadoFiltroDropdown({
    grupo,
    seleccionados,
    onToggle,
    onClear,
    isOpen,
    onOpenChange,
}: {
    grupo: (typeof ESTADO_GRUPOS)[number];
    seleccionados: AlertLevel[];
    onToggle: (nivel: AlertLevel) => void;
    onClear: () => void;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const resumen =
        seleccionados.length === 0
            ? "Todos"
            : seleccionados.length === 1
                ? grupo.niveles.find((n) => n.nivel === seleccionados[0])?.label
                : `${seleccionados.length} estados`;

    return (
        <div className="form-group inv-estado-select">
            <label className="form-label">
                {grupo.icon}
                <span>{grupo.label}</span>
            </label>
            <button
                type="button"
                className={`form-select inv-estado-trigger${seleccionados.length > 0 ? " has-active" : ""}`}
                onClick={() => onOpenChange(!isOpen)}
            >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resumen}</span>
                <ChevronDown size={16} className={`chevron${isOpen ? " open" : ""}`} />
            </button>

            {isOpen && (
                <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => onOpenChange(false)} />
                    <div className="inv-estado-menu">
                        <div className="inv-estado-grupo-opciones">
                            {grupo.niveles.map(({ nivel, label }) => {
                                const activo = seleccionados.includes(nivel);
                                return (
                                    <button
                                        key={nivel}
                                        type="button"
                                        className={`inv-estado-opcion tone-${nivel}${activo ? " active" : ""}`}
                                        onClick={() => onToggle(nivel)}
                                    >
                                        <span className={`inv-estado-check${activo ? " checked" : ""}`}>
                                            {activo && <Check size={11} />}
                                        </span>
                                        <span className="inv-alert-dot" />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                        {seleccionados.length > 0 && (
                            <button className="inv-estado-menu-clear" onClick={onClear}>
                                Limpiar
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   Componente principal — sólo visual, sin lógica real
──────────────────────────────────────────────────────────────── */
export default function Inventory() {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterFamilia, setFilterFamilia] = useState(""); // id_familia seleccionado, "" = todas
    const [filtrosEstado, setFiltrosEstado] = useState<FiltroEstado[]>([]);
    const [productosPage, setProductosPage] = useState(1);
    const [openEstadoDropdown, setOpenEstadoDropdown] = useState<Categoria | null>(null);
    const [isFamiliaDropdownOpen, setIsFamiliaDropdownOpen] = useState(false);
    const [familiaSearchTerm, setFamiliaSearchTerm] = useState("");
    const { toast, showToast } = useToast();

    /* Botón "Exportar" del header: menú con las 3 opciones (Productos /
     *  Lotes / Productos y Lotes) e indicador de generación en curso —
     *  "Lotes" y "Productos y Lotes" primero traen listarTodosLosLotes(),
     *  así que no son instantáneos como el resto de los botones. */
    const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Modales de error y advertencia
    const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' });
    const showError = (title: string, message: string) => setErrorModal({ isOpen: true, title, message });
    const [productoAccion, setProductoAccion] = useState<{ producto: ProductoListado; accion: 'desactivar' | 'reactivar' } | null>(null);

    /* Botón "Resurtida" de la columna Estantería: id en proceso (deshabilita
     *  el botón de esa fila) e id que acaba de resurtirse (mensaje de
     *  confirmación temporal junto al aviso, además del punto que ya
     *  cambia de color solo). */
    const [resurtiendoId, setResurtiendoId] = useState<string | null>(null);
    const [resurtidaOkId, setResurtidaOkId] = useState<string | null>(null);

    /* Datos reales — reemplazan a los MOCK_* de antes */
    const [productos, setProductos] = useState<ProductoListado[]>([]);
    const [familias, setFamilias] = useState<FamiliaRow[]>([]);
    const [margenes, setMargenes] = useState<MargenRow[]>([]);
    const [impuestos, setImpuestos] = useState<ImpuestoRow[]>([]);
    const [productosParaModal, setProductosParaModal] = useState<ProductoRow[]>([]);
    const [codigosAlternosExistentes, setCodigosAlternosExistentes] = useState<CodigoAlternoExistente[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const cargarDatos = useCallback(async () => {
        try {
            setLoadError(null);
            const [
                productosListado,
                familiasRows,
                margenesRows,
                impuestosRows,
                productosModal,
                codigosExistentes,
            ] = await Promise.all([
                listarProductosInventario(),
                listarFamilias(),
                listarMargenesVigentes(),
                listarImpuestosVigentes(),
                listarProductosParaModal(),
                listarCodigosAlternosExistentes(),
            ]);
            setProductos(productosListado);
            setFamilias(familiasRows);
            setMargenes(margenesRows);
            setImpuestos(impuestosRows);
            setProductosParaModal(productosModal);
            setCodigosAlternosExistentes(codigosExistentes);
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : "No se pudo cargar el inventario.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Carga inicial + refresco automático cuando otra pantalla (o esta
    // misma) cambia productos/inventario/familias vía IPC (db:changed).
    useEffect(() => {
        cargarDatos();
        const unsubscribe = window.api.onChange((entity) => {
            if (entity === "productos" || entity === "familias") cargarDatos();
        });
        return unsubscribe;
    }, [cargarDatos]);

    /* Modal Agregar / Editar Producto */
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ProductoRow | null>(null);

    const openNuevoProducto = () => {
        setEditingProduct(null);
        setIsAddModalOpen(true);
    };

    const openEditarProducto = async (producto: ProductoListado) => {
        try {
            const completo = await obtenerProducto(producto.id_producto);
            if (!completo) {
                alert("Ese producto ya no existe.");
                return;
            }
            setEditingProduct(completo);
            setIsAddModalOpen(true);
        } catch (err) {
            showError("Error", err instanceof Error ? err.message : "No se pudo abrir el producto para editar.");
        }
    };

    const handleGuardarProducto = async (payload: ProductoPayload) => {
        try {
            if (payload.id_producto) {
                await actualizarProducto(payload.id_producto, payload);
            } else {
                await crearProducto(payload);
            }
            setIsAddModalOpen(false);
            setEditingProduct(null);
            showToast("success", "Producto guardado exitosamente.");
        } catch (err) {
            showError("Error al guardar", err instanceof Error ? err.message : "No se pudo guardar el producto.");
        }
    };

    const handleEliminarProducto = async (producto: ProductoListado) => {
        const accion = producto.activo ? "desactivar" : "reactivar";
        setProductoAccion({ producto, accion });
    };

    const confirmAccionProducto = async () => {
        if (!productoAccion) return;
        const { producto, accion } = productoAccion;
        setProductoAccion(null);
        try {
            await cambiarEstadoProducto(producto.id_producto, !producto.activo);
            showToast("success", `Producto ${accion}do exitosamente.`);
        } catch (err) {
            showError("Error", err instanceof Error ? err.message : "No se pudo actualizar el estado del producto.");
        }
    };

    /* Modal Registrar Entrada */
    const [isEntradaModalOpen, setIsEntradaModalOpen] = useState(false);

    const handleGuardarEntrada = async (payload: EntradaPayload) => {
        try {
            await crearEntrada(payload);
            setIsEntradaModalOpen(false);
            showToast("success", "Entrada registrada exitosamente.");
        } catch (err) {
            showError("Error al registrar", err instanceof Error ? err.message : "No se pudo registrar la entrada.");
        }
    };

    /* Modal Ver Lotes — detalle de cada lote de un producto (para ver
       EXACTAMENTE cuál lote está vencido, no solo un punto resumido). */
    const [loteProducto, setLoteProducto] = useState<ProductoListado | null>(null);
    const [lotesDelProducto, setLotesDelProducto] = useState<LoteListado[]>([]);
    const [isLotesLoading, setIsLotesLoading] = useState(false);
    const [lotesError, setLotesError] = useState<string | null>(null);

    const openVerLotes = async (producto: ProductoListado) => {
        setLoteProducto(producto);
        setLotesDelProducto([]);
        setLotesError(null);
        setIsLotesLoading(true);
        try {
            const lotes = await listarLotesPorProducto(
                producto.id_producto,
                producto.umbral_rojo_dias,
                producto.umbral_amarillo_dias
            );
            setLotesDelProducto(lotes);
        } catch (err) {
            setLotesError(err instanceof Error ? err.message : "No se pudieron cargar los lotes.");
        } finally {
            setIsLotesLoading(false);
        }
    };

    const closeVerLotes = () => {
        setLoteProducto(null);
        setLotesDelProducto([]);
        setLotesError(null);
    };

    /** Marca/desmarca un lote vencido como "enterado". Actualiza la
     *  lista de lotes visible al instante (optimista) y, como
     *  marcarLoteEnterado dispara db:changed("productos"), la tabla
     *  principal de productos se refresca sola (el useEffect de arriba
     *  ya está suscrito) y el semáforo del producto baja de nivel si
     *  ya no queda ningún lote vencido sin enterar. */
    const toggleLoteEnterado = async (lote: LoteListado) => {
        const nuevoValor = !lote.enterado;
        try {
            await marcarLoteEnterado(lote.id_lote, nuevoValor);
            setLotesDelProducto((prev) =>
                prev.map((l) => (l.id_lote === lote.id_lote ? { ...l, enterado: nuevoValor } : l))
            );
        } catch (err) {
            showError("Error", err instanceof Error ? err.message : "No se pudo actualizar el lote.");
        }
    };

    /** Guarda la edición inline de un lote (fila -> campos editables en
     *  LotesView). Tras guardar, vuelve a pedir la lista de lotes del
     *  producto en vez de mezclar el draft a mano: fecha_caducidad puede
     *  cambiar el alertLevel/estado calculado, y la corrección de
     *  cantidad_disponible pasa por Ajuste_Inventario (ver
     *  inventory.service.ts), así que lo más confiable es releer lo que
     *  la base ya recalculó. actualizarLote ya dispara db:changed
     *  ("productos"), así que la tabla principal también se refresca sola. */
    const saveLoteEdit = async (lote: LoteListado, payload: LoteEditPayload) => {
        if (!loteProducto) return;
        await actualizarLote(lote.id_lote, loteProducto.id_producto, lote.cantidad_disponible, payload);
        try {
            const lotesActualizados = await listarLotesPorProducto(
                loteProducto.id_producto,
                loteProducto.umbral_rojo_dias,
                loteProducto.umbral_amarillo_dias
            );
            setLotesDelProducto(lotesActualizados);
        } catch {
            // El UPDATE ya se guardó; si esta relectura falla, la lista
            // se refresca sola en el siguiente db:changed de todas formas.
        }
    };

    /* Filtrado sobre los datos reales */
    const visibleProductos = productos.filter((p) => {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
            p.nombre.toLowerCase().includes(term) ||
            (p.codigo_interno ?? "").toLowerCase().includes(term) ||
            (p.familia_nombre ?? "").toLowerCase().includes(term);
        const matchesFamilia = !filterFamilia || p.id_familia === filterFamilia;
        const matchesEstado =
            filtrosEstado.length === 0 ||
            filtrosEstado.some((f) => nivelDeCategoria(p, f.categoria) === f.nivel);
        return matchesSearch && matchesFamilia && matchesEstado;
    }).sort((a, b) => (a.activo === b.activo ? 0 : a.activo ? -1 : 1));

    // ── Paginación (6 en 6) — se reinicia a la página 1 cada vez que
    // cambia algún filtro, para no quedar en una página vacía. ──
    useEffect(() => {
        setProductosPage(1);
    }, [searchTerm, filterFamilia, filtrosEstado]);

    const productosPagina = visibleProductos.slice(
        (productosPage - 1) * PAGE_SIZE,
        productosPage * PAGE_SIZE
    );

    const selectedFamilia = familias.find((f) => f.id_familia === filterFamilia);
    const filteredFamiliasOptions = familias.filter((f) =>
        f.nombre.toLowerCase().includes(familiaSearchTerm.toLowerCase())
    );

    /** Prende/apaga un único (categoria, nivel) del dropdown de estado. */
    const toggleFiltroEstado = (filtro: FiltroEstado) =>
        setFiltrosEstado((prev) =>
            prev.some((f) => mismoFiltro(f, filtro))
                ? prev.filter((f) => !mismoFiltro(f, filtro))
                : [...prev, filtro]
        );

    /** Niveles activos de una sola categoría — lo que le pinta a cada
     *  uno de los 3 dropdowns del toolbar su propio resumen/checks. */
    const nivelesSeleccionados = (categoria: Categoria) =>
        filtrosEstado.filter((f) => f.categoria === categoria).map((f) => f.nivel);

    const limpiarCategoria = (categoria: Categoria) =>
        setFiltrosEstado((prev) => prev.filter((f) => f.categoria !== categoria));

    /** Prende/apaga en bloque el conjunto de filtros de una card del
     *  bento (p. ej. "existencia baja" = amarillo + rojo de stock).
     *  Si ya estaban todos activos, los quita; si no, los agrega sin
     *  duplicar lo que ya hubiera seleccionado a mano en el dropdown. */
    const toggleCardFiltro = (filtros: FiltroEstado[]) => {
        const yaActivos = filtros.every((f) => filtrosEstado.some((x) => mismoFiltro(x, f)));
        setFiltrosEstado((prev) =>
            yaActivos
                ? prev.filter((f) => !filtros.some((x) => mismoFiltro(x, f)))
                : [...prev.filter((f) => !filtros.some((x) => mismoFiltro(x, f))), ...filtros]
        );
    };

    const cardEstaActiva = (filtros: FiltroEstado[]) =>
        filtros.length > 0 && filtros.every((f) => filtrosEstado.some((x) => mismoFiltro(x, f)));

    /* Marca la estantería de un producto como resurtida parcial o total.
     *  Si se pasa cantidadFaltante, se llama a reponerEstanteria con ese valor.
     *  Si no (o si se hace de otra forma), puede usar reponerEstanteriaAMeta. */
    const handleResurtir = async (producto: ProductoListado, cantidadFaltante?: number) => {
        setResurtiendoId(producto.id_producto);
        try {
            if (cantidadFaltante !== undefined) {
                await reponerEstanteria(producto.id_producto, cantidadFaltante);
            } else {
                await reponerEstanteriaAMeta(producto);
            }
            setResurtidaOkId(producto.id_producto);
            setTimeout(() => {
                setResurtidaOkId((actual) => (actual === producto.id_producto ? null : actual));
            }, 2500);
        } catch (err) {
            setErrorModal({
                isOpen: true,
                title: "Error al resurtir",
                message: err instanceof Error ? err.message : "No se pudo resurtir la estantería."
            });
        } finally {
            setResurtiendoId(null);
        }
    };

    /** Botón "Exportar" del header. 'productos' usa lo que ya está en
     *  memoria (visibleProductos, respeta búsqueda/familia/estado
     *  activos); 'lotes' y 'todo' primero traen TODOS los lotes de
     *  TODOS los productos con listarTodosLosLotes(), porque la tabla
     *  de Inventory.tsx nunca tiene esa lista completa cargada. */
    const handleExportar = async (tipo: "productos" | "lotes" | "todo") => {
        setIsExportDropdownOpen(false);
        setIsExporting(true);
        try {
            if (tipo === "productos") {
                exportarProductos(visibleProductos);
            } else if (tipo === "lotes") {
                const lotes: LoteExportRow[] = await listarTodosLosLotes();
                exportarLotes(lotes);
            } else {
                const lotes: LoteExportRow[] = await listarTodosLosLotes();
                exportarInventarioCompleto(visibleProductos, lotes);
            }
        } catch (err) {
            setErrorModal({
                isOpen: true,
                title: "Error al exportar",
                message: err instanceof Error ? err.message : "No se pudo generar el archivo.",
            });
        } finally {
            setIsExporting(false);
        }
    };

    /* KPIs — cada card cuenta exactamente el mismo conjunto de niveles
     *  que activa al hacer click (ver CARD_FILTROS), así el número que
     *  se ve siempre coincide con lo que trae el filtro. Se separa
     *  aviso (amarillo) de crítico (rojo/negro) en vez de mezclarlos:
     *  "existencia baja" ya no es lo mismo que "agotado", ni "por
     *  completar" en estantería es lo mismo que "sin existencia". */
    const totalActivos = productos.filter((p) => p.activo).length;

    const contar = (categoria: Categoria, niveles: AlertLevel[]) =>
        productos.filter((p) => p.activo && niveles.includes(nivelDeCategoria(p, categoria))).length;

    const estanteriaVacia = contar("estanteria", ["black"]);
    const estanteriaCritica = contar("estanteria", ["red"]);
    const estanteriaIncompleta = contar("estanteria", ["yellow"]);
    const existenciaBaja = contar("stock", ["yellow", "red"]);
    const agotado = contar("stock", ["black"]);
    const porCaducar = contar("caducidad", ["yellow", "red"]);
    const vencido = contar("caducidad", ["black"]);

    return (
        <div className="inv-page">
            <div className="inv-container">

                {/* ── Header ── */}
                <div className="inv-header">
                    <div>
                        <h1 className="inv-header-title">Inventario de Productos</h1>
                        <p className="inv-header-subtitle">
                            Gestiona y consulta tu catálogo de distribución
                        </p>
                    </div>
                    <div className="inv-header-actions">
                        <div style={{ position: "relative" }}>
                            <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ display: "flex", alignItems: "center", gap: 8 }}
                                disabled={isExporting}
                                onClick={() => setIsExportDropdownOpen((o) => !o)}
                            >
                                {isExporting ? <Loader2 size={16} className="inv-spin" /> : <Download size={16} />}
                                <span>{isExporting ? "Generando…" : "Exportar"}</span>
                                <ChevronDown size={16} className={`chevron${isExportDropdownOpen ? " open" : ""}`} />
                            </button>

                            {isExportDropdownOpen && (
                                <>
                                    <div
                                        style={{ position: "fixed", inset: 0, zIndex: 40 }}
                                        onClick={() => setIsExportDropdownOpen(false)}
                                    />
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: "calc(100% + 6px)",
                                            left: 0,
                                            zIndex: 41,
                                            minWidth: 220,
                                            background: "var(--cuh-surface, #fff)",
                                            border: "1px solid var(--cuh-border-light)",
                                            borderRadius: 10,
                                            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                                            padding: 6,
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 2,
                                        }}
                                    >
                                        <button
                                            type="button"
                                            className="inv-familia-option"
                                            style={{ width: "100%", textAlign: "left" }}
                                            onClick={() => handleExportar("productos")}
                                        >
                                            Productos
                                        </button>
                                        <button
                                            type="button"
                                            className="inv-familia-option"
                                            style={{ width: "100%", textAlign: "left" }}
                                            onClick={() => handleExportar("lotes")}
                                        >
                                            Lotes
                                        </button>
                                        <button
                                            type="button"
                                            className="inv-familia-option"
                                            style={{ width: "100%", textAlign: "left" }}
                                            onClick={() => handleExportar("todo")}
                                        >
                                            Productos y Lotes (conjunto)
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <button className="btn btn-ghost" style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={() => setIsEntradaModalOpen(true)}>
                            <Package size={16} />
                            <span>Registrar Entrada</span>
                        </button>
                        <button className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={openNuevoProducto}>
                            <Plus size={16} />
                            <span>Nuevo Producto</span>
                        </button>
                    </div>
                </div>

                {/* ── KPIs ── Bentogrid: "Total" queda como card ancla y
                    el resto son cards pequeñas, una por estado, separando
                    aviso de crítico. Cada una es un atajo de filtro: click
                    para ver solo esos productos, click de nuevo para
                    quitarlo. Se pueden combinar varias a la vez.

                    Total y las 7 minis son dos bloques separados (ver
                    .inv-kpi-grid / .inv-kpi-minis en inventario.css): la
                    colocación de las minis es explícita, 3 arriba y 4
                    abajo, para que nunca quede un hueco en la fila de
                    abajo sin importar cuántas quepan por ancho de pantalla. */}
                <div className="inv-kpi-grid">
                    <div className="inv-kpi-card inv-kpi-card-total">
                        <div className="inv-kpi-icon tone-primary"><Package size={20} /></div>
                        <div>
                            <p className="inv-kpi-label">Total Productos</p>
                            <p className="inv-kpi-value">{totalActivos}</p>
                        </div>
                    </div>

                    <div className="inv-kpi-minis">
                        <div className="inv-kpi-minis-row inv-kpi-minis-row-top">
                            <button
                                type="button"
                                className={`inv-kpi-card inv-kpi-card-mini tone-black${cardEstaActiva(CARD_FILTROS.estanteriaVacia) ? " active" : ""}`}
                                onClick={() => toggleCardFiltro(CARD_FILTROS.estanteriaVacia)}
                                title="Ver productos sin existencias en estantería"
                            >
                                <div className="inv-kpi-icon tone-black"><Boxes size={18} /></div>
                                <div>
                                    <p className="inv-kpi-label">Estantería Vacía</p>
                                    <p className="inv-kpi-value tone-black">{estanteriaVacia}</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                className={`inv-kpi-card inv-kpi-card-mini tone-red${cardEstaActiva(CARD_FILTROS.estanteriaCritica) ? " active" : ""}`}
                                onClick={() => toggleCardFiltro(CARD_FILTROS.estanteriaCritica)}
                                title="Ver productos con estantería crítica (20% o menos de la meta)"
                            >
                                <div className="inv-kpi-icon tone-red"><Boxes size={18} /></div>
                                <div>
                                    <p className="inv-kpi-label">Estantería Crítica</p>
                                    <p className="inv-kpi-value tone-red">{estanteriaCritica}</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                className={`inv-kpi-card inv-kpi-card-mini tone-yellow${cardEstaActiva(CARD_FILTROS.estanteriaIncompleta) ? " active" : ""}`}
                                onClick={() => toggleCardFiltro(CARD_FILTROS.estanteriaIncompleta)}
                                title="Ver productos con estantería por completar (entre 20% y 40% de la meta)"
                            >
                                <div className="inv-kpi-icon tone-yellow"><Boxes size={18} /></div>
                                <div>
                                    <p className="inv-kpi-label">Por Completar</p>
                                    <p className="inv-kpi-value tone-yellow">{estanteriaIncompleta}</p>
                                </div>
                            </button>
                        </div>

                        <div className="inv-kpi-minis-row inv-kpi-minis-row-bottom">
                            <button
                                type="button"
                                className={`inv-kpi-card inv-kpi-card-mini tone-yellow${cardEstaActiva(CARD_FILTROS.existenciaBaja) ? " active" : ""}`}
                                onClick={() => toggleCardFiltro(CARD_FILTROS.existenciaBaja)}
                                title="Ver productos con existencia baja (aviso)"
                            >
                                <div className="inv-kpi-icon tone-yellow"><AlertTriangle size={18} /></div>
                                <div>
                                    <p className="inv-kpi-label">Existencia Baja</p>
                                    <p className="inv-kpi-value tone-yellow">{existenciaBaja}</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                className={`inv-kpi-card inv-kpi-card-mini tone-black${cardEstaActiva(CARD_FILTROS.agotado) ? " active" : ""}`}
                                onClick={() => toggleCardFiltro(CARD_FILTROS.agotado)}
                                title="Ver productos agotados (crítico)"
                            >
                                <div className="inv-kpi-icon tone-black"><PackageX size={18} /></div>
                                <div>
                                    <p className="inv-kpi-label">Agotado</p>
                                    <p className="inv-kpi-value tone-black">{agotado}</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                className={`inv-kpi-card inv-kpi-card-mini tone-yellow${cardEstaActiva(CARD_FILTROS.porCaducar) ? " active" : ""}`}
                                onClick={() => toggleCardFiltro(CARD_FILTROS.porCaducar)}
                                title="Ver productos próximos a caducar (aviso)"
                            >
                                <div className="inv-kpi-icon tone-yellow"><Clock size={18} /></div>
                                <div>
                                    <p className="inv-kpi-label">Por Caducar</p>
                                    <p className="inv-kpi-value tone-yellow">{porCaducar}</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                className={`inv-kpi-card inv-kpi-card-mini tone-black${cardEstaActiva(CARD_FILTROS.vencido) ? " active" : ""}`}
                                onClick={() => toggleCardFiltro(CARD_FILTROS.vencido)}
                                title="Ver productos vencidos (crítico)"
                            >
                                <div className="inv-kpi-icon tone-black"><CalendarOff size={18} /></div>
                                <div>
                                    <p className="inv-kpi-label">Vencido</p>
                                    <p className="inv-kpi-value tone-black">{vencido}</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Si hay un producto con lotes abiertos, la vista de lotes
                     reemplaza toolbar + filtros + tabla de productos ── */}
                {loteProducto ? (
                    <LotesView
                        producto={loteProducto}
                        lotes={lotesDelProducto}
                        isLoading={isLotesLoading}
                        error={lotesError}
                        onBack={closeVerLotes}
                        onEditProduct={() => openEditarProducto(loteProducto)}
                        onToggleEnterado={toggleLoteEnterado}
                        onSaveLote={saveLoteEdit}
                    />
                ) : (
                    <>
                        {/* ── Toolbar ── */}
                        <div className="card card-context context-info inv-filters-card">
                            <div className="inv-filters-grid inv-filters-row">
                                <FormInput
                                    label="Búsqueda"
                                    type="text"
                                    className="form-input inv-search-input"
                                    wrapperClassName="inv-search-wrap"
                                    placeholder="Código, nombre o lote"
                                    value={searchTerm}
                                    onChange={(val) => setSearchTerm(val)}
                                    iconLeft={<Search size={14} className="inv-search-icon" />}
                                />

                                <div className="form-group inv-familia-select">
                                    <label className="form-label">Familia</label>
                                    <button
                                        type="button"
                                        className="form-select inv-familia-trigger"
                                        onClick={() => setIsFamiliaDropdownOpen((o) => !o)}
                                    >
                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {selectedFamilia ? selectedFamilia.nombre : "Todas las Familias"}
                                        </span>
                                        <ChevronDown size={16} className={`chevron${isFamiliaDropdownOpen ? " open" : ""}`} />
                                    </button>

                                    {isFamiliaDropdownOpen && (
                                        <>
                                            <div
                                                style={{ position: "fixed", inset: 0, zIndex: 40 }}
                                                onClick={() => { setIsFamiliaDropdownOpen(false); setFamiliaSearchTerm(""); }}
                                            />
                                            <div className="inv-familia-menu">
                                                <div className="inv-familia-menu-search">
                                                    <div className="inv-familia-menu-search-wrap">
                                                        <Search size={12} />
                                                        <input
                                                            type="text"
                                                            placeholder="Buscar familia..."
                                                            value={familiaSearchTerm}
                                                            onChange={(e) => setFamiliaSearchTerm(e.target.value)}
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>
                                                <div className="inv-familia-menu-list">
                                                    <button
                                                        className={`inv-familia-option${!filterFamilia ? " active" : ""}`}
                                                        onClick={() => { setFilterFamilia(""); setIsFamiliaDropdownOpen(false); setFamiliaSearchTerm(""); }}
                                                    >
                                                        Todas las Familias
                                                    </button>
                                                    <div className="inv-familia-menu-divider" />
                                                    {filteredFamiliasOptions.length === 0 ? (
                                                        <div className="inv-familia-menu-empty">No se encontraron familias</div>
                                                    ) : (
                                                        filteredFamiliasOptions.map((fam) => (
                                                            <button
                                                                key={fam.id_familia}
                                                                className={`inv-familia-option${filterFamilia === fam.id_familia ? " active" : ""}`}
                                                                onClick={() => { setFilterFamilia(fam.id_familia); setIsFamiliaDropdownOpen(false); setFamiliaSearchTerm(""); }}
                                                            >
                                                                <span className="inv-familia-option-code">{familiaBadge(fam.nombre)}</span>
                                                                {fam.nombre}
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="inv-filters-grid inv-filters-row inv-filters-row-estado">
                                {ESTADO_GRUPOS.map((grupo) => (
                                    <EstadoFiltroDropdown
                                        key={grupo.categoria}
                                        grupo={grupo}
                                        seleccionados={nivelesSeleccionados(grupo.categoria)}
                                        onToggle={(nivel) => toggleFiltroEstado({ categoria: grupo.categoria, nivel })}
                                        onClear={() => limpiarCategoria(grupo.categoria)}
                                        isOpen={openEstadoDropdown === grupo.categoria}
                                        onOpenChange={(open) => setOpenEstadoDropdown(open ? grupo.categoria : null)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* ── Chips de filtros de estado activos — resumen de lo que
                             eligieron los 3 dropdowns del toolbar de arriba, con
                             opción de quitar uno por uno o limpiar todo. ── */}
                        {filtrosEstado.length > 0 && (
                            <div className="inv-estado-chips-bar">
                                <div className="inv-estado-chips">
                                    {filtrosEstado.map((f) => {
                                        const grupo = ESTADO_GRUPOS.find((g) => g.categoria === f.categoria)!;
                                        const nivelInfo = grupo.niveles.find((n) => n.nivel === f.nivel)!;
                                        return (
                                            <button
                                                key={`${f.categoria}-${f.nivel}`}
                                                className={`inv-estado-chip tone-${f.nivel}`}
                                                onClick={() => toggleFiltroEstado(f)}
                                            >
                                                <span className="inv-alert-dot" />
                                                {grupo.label}: {nivelInfo.label}
                                                <X size={11} />
                                            </button>
                                        );
                                    })}
                                    <button className="inv-alert-clear" onClick={() => setFiltrosEstado([])}>
                                        Limpiar todo
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Tabla de productos ── */}
                        <div className="inv-table-card">
                            <div className="inv-table-scroll">
                                <table style={{ width: "100%", textAlign: "left", fontSize: 14, borderCollapse: "collapse", whiteSpace: "nowrap" }}>
                                    <thead style={{ background: "var(--cuh-bg)", color: "var(--cuh-text-muted)", fontWeight: 600, borderBottom: "1px solid var(--cuh-border-light)" }}>
                                        <tr>
                                            {["Producto", "Familia", "Precio", "Stock", "Estantería", "Caducidad", "Acciones"].map((col) => (
                                                <th
                                                    key={col}
                                                    style={{
                                                        padding: "13px 24px",
                                                        fontSize: 12,
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.04em",
                                                        textAlign: col === "Acciones" ? "center" : "left",
                                                    }}
                                                >
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadError ? (
                                            <tr>
                                                <td colSpan={7}>
                                                    <div className="inv-empty-state">
                                                        <AlertTriangle size={40} />
                                                        <p className="inv-empty-state-title">No se pudo cargar el inventario</p>
                                                        <p className="inv-empty-state-subtitle">{loadError}</p>
                                                        <button className="btn btn-ghost" onClick={cargarDatos} style={{ marginTop: 12 }}>
                                                            Reintentar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : isLoading ? (
                                            <tr>
                                                <td colSpan={7}>
                                                    <div className="inv-empty-state">
                                                        <Package size={40} />
                                                        <p className="inv-empty-state-title">Cargando inventario…</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : visibleProductos.length === 0 ? (
                                            <tr>
                                                <td colSpan={7}>
                                                    <div className="inv-empty-state">
                                                        <Package size={40} />
                                                        <p className="inv-empty-state-title">No se encontraron productos</p>
                                                        <p className="inv-empty-state-subtitle">Ajusta los filtros o crea uno nuevo</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            productosPagina.map((p, idx) => (
                                                <React.Fragment key={p.id_producto}>
                                                    {idx > 0 && (
                                                        <tr>
                                                            <td colSpan={7} style={{ height: 0, padding: 0, borderTop: "1px solid var(--cuh-border-light)" }} />
                                                        </tr>
                                                    )}
                                                    <ProductRow
                                                        producto={p}
                                                        onEdit={openEditarProducto}
                                                        onEliminar={handleEliminarProducto}
                                                        onVerLotes={openVerLotes}
                                                        onResurtir={handleResurtir}
                                                        isResurtiendo={resurtiendoId === p.id_producto}
                                                        justResurtida={resurtidaOkId === p.id_producto}
                                                        showError={(t, m) => setErrorModal({ isOpen: true, title: t, message: m })}
                                                    />
                                                </React.Fragment>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* ── Pie de página ── */}
                        <div className="inv-infinite-loader" style={{ marginTop: 16 }}>
                            <div className="inv-infinite-loader-inner">
                                <Package size={18} />
                                <span>
                                    {visibleProductos.length === 0
                                        ? "Sin productos"
                                        : `Mostrando ${(productosPage - 1) * PAGE_SIZE + 1}–${Math.min(productosPage * PAGE_SIZE, visibleProductos.length)} de ${visibleProductos.length} productos`}
                                </span>
                            </div>
                            <Pagination page={productosPage} totalItems={visibleProductos.length} onPageChange={setProductosPage} />
                        </div>
                    </>
                )}

            </div>

            <AddProducto
                isOpen={isAddModalOpen}
                onClose={() => { setIsAddModalOpen(false); setEditingProduct(null); }}
                familias={familias}
                margenes={margenes}
                impuestos={impuestos}
                productosExistentes={productosParaModal}
                editProduct={editingProduct}
                onSave={handleGuardarProducto}
            />

            <AddEntrada
                isOpen={isEntradaModalOpen}
                onClose={() => setIsEntradaModalOpen(false)}
                productos={productosParaModal}
                margenes={margenes}
                impuestos={impuestos}
                codigosAlternosExistentes={codigosAlternosExistentes}
                onSave={handleGuardarEntrada}
            />

            <WarningModal
                isOpen={productoAccion !== null}
                onClose={() => setProductoAccion(null)}
                onConfirm={confirmAccionProducto}
                title={productoAccion?.accion === 'desactivar' ? "Desactivar Producto" : "Reactivar Producto"}
                message={`¿Estás seguro de que deseas ${productoAccion?.accion} el producto "${productoAccion?.producto?.nombre}"?`}
            />

            <ErrorModal
                isOpen={errorModal.isOpen}
                onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
                title={errorModal.title}
                message={errorModal.message}
            />

            <Toast toast={toast} />
        </div>
    );
}