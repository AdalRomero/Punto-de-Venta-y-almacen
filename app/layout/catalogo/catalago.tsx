import React, { useEffect, useState } from "react";
import {
    Layers,
    Receipt,
    DollarSign,
    Plus,
    Edit2,
    Trash2,
    Check,
    X,
    ChevronUp,
    History,
    Search,
    CheckCircle2,
    XCircle,
    Loader2,
} from "lucide-react";
// Ajusta esta ruta a donde vivan tus componentes de formulario en el proyecto.
import FormInput from "../../components/FormInput";
import "../../css/catalogo.css";
import { useAuth } from "../../../src/context/AuthContext";
import * as catalogosService from "../../../src/services/catalogos.service";

/* ═══════════════════════════════════════════════════════════
   TIPOS
   Reflejan el esquema `la_cuchilla` (ver esquema_la_cuchilla_final.sql):
   - Familia: sin campo `activo` (nunca se desactiva, solo se edita).
   - Impuestos / Margenes: el % NO vive en la tabla del catálogo,
     vive en su tabla de historial (Impuesto_Tasa_Historial /
     Margen_Tasa_Historial). La fila vigente es la que tiene
     vigente_hasta = NULL. Cambiar la tasa nunca es un UPDATE:
     siempre abre una fila nueva y cierra la anterior
     (sp_actualizar_tasa_impuesto / sp_actualizar_tasa_margen).
   ═══════════════════════════════════════════════════════════ */

interface Familia {
    id_familia: string;
    nombre: string;
    /** Código que identifica a esta familia (ej. Harinas = 1, Pan = 2, Sabritas = 3).
     *  Se usa como prefijo al generar el código de los productos de esa familia.
     *  No es una cantidad de dígitos: empieza en 01, 02... y crece sin límite
     *  si hace falta (100, 111, etc.). */
    digitos: number;
    created: string;
}

interface TasaHistorial {
    id_tasa: string;
    porcentaje: number;
    vigente_desde: string;
    vigente_hasta: string | null;
}

/** Forma común de Impuestos y Márgenes: mismo patrón de catálogo
 *  con historial de tasas. Al conectar la API real, `id` se mapea
 *  a id_impuestos o id_margenes según corresponda. */
interface TasaCatalogItem {
    id: string;
    nombre: string;
    activo: boolean;
    created: string;
    historial: TasaHistorial[];
}

type ActiveTab = "familias" | "impuestos" | "margenes";
type ToastState = { type: "success" | "error"; message: string } | null;

/* ─── Helpers ──────────────────────────────────────────────── */
const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });

const tasaVigente = (historial: TasaHistorial[]): TasaHistorial | undefined =>
    historial.find((h) => h.vigente_hasta === null) ?? historial[historial.length - 1];

/** Deja solo dígitos — usado en vez de type="number" para no mostrar
 *  las flechitas nativas del navegador. Sin límite de longitud: el
 *  código puede crecer más allá de 2 cifras si hace falta. */
const sanitizeDigits = (raw: string) => raw.replace(/\D/g, "");

/** Deja solo dígitos y un único punto decimal — usado en vez de
 *  type="number" para no mostrar las flechitas nativas del navegador
 *  al editar un porcentaje. */
const sanitizePercentage = (raw: string) => {
    const cleaned = raw.replace(/[^\d.]/g, "");
    const firstDot = cleaned.indexOf(".");
    if (firstDot === -1) return cleaned;
    return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
};

/** Código de familia mostrado con cero a la izquierda cuando aplica
 *  (1 -> "01", 100 -> "100", nunca se trunca). */
const formatFamiliaCode = (n: number) => String(n).padStart(2, "0");

/* ─── Estilos de tabla (mismo diseño que Inventory.tsx) ──────
   Inventario no usa la clase .data-table: arma la tabla con
   estilos en línea (thead gris, celdas 14px/24px, fila con
   borde inferior sutil y hover). Se replica aquí tal cual para
   que Familias / Impuestos / Márgenes luzcan igual. ─────────── */
const catTableStyle: React.CSSProperties = {
    width: "100%",
    textAlign: "left",
    fontSize: 14,
    borderCollapse: "collapse",
    whiteSpace: "nowrap",
};

const catTheadStyle: React.CSSProperties = {
    background: "var(--cuh-bg)",
    color: "var(--cuh-text-muted)",
    fontWeight: 600,
    borderBottom: "1px solid var(--cuh-border-light)",
};

const catTh = (align: "left" | "center" = "left"): React.CSSProperties => ({
    padding: "13px 24px",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    textAlign: align,
});

const catTd: React.CSSProperties = { padding: "14px 24px" };

const catRowStyle: React.CSSProperties = {
    transition: "background 0.15s",
    borderBottom: "1px solid var(--cuh-border-light)",
};

const catRowHoverProps = {
    onMouseEnter: (e: React.MouseEvent<HTMLTableRowElement>) => {
        (e.currentTarget as HTMLTableRowElement).style.background = "var(--cuh-bg)";
    },
    onMouseLeave: (e: React.MouseEvent<HTMLTableRowElement>) => {
        (e.currentTarget as HTMLTableRowElement).style.background = "";
    },
};

const catActionBtnStyle: React.CSSProperties = {
    width: 30,
    height: 30,
    border: "none",
    background: "none",
    cursor: "pointer",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--cuh-text-muted)",
    transition: "background 0.15s, color 0.15s",
};

const catHoverIn = (bg: string, color: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLButtonElement).style.background = bg;
    (e.currentTarget as HTMLButtonElement).style.color = color;
};

const catHoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLButtonElement).style.background = "none";
    (e.currentTarget as HTMLButtonElement).style.color = "var(--cuh-text-muted)";
};

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════ */
export default function CatalogosPage() {
    const { usuario } = useAuth();
    const registradoPor = usuario?.id_perfil_info ?? null;

    const [tab, setTab] = useState<ActiveTab>("familias");
    const [familias, setFamilias] = useState<Familia[]>([]);
    const [impuestos, setImpuestos] = useState<TasaCatalogItem[]>([]);
    const [margenes, setMargenes] = useState<TasaCatalogItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<ToastState>(null);

    const showToast = (type: "success" | "error", message: string) => {
        setToast({ type, message });
        window.setTimeout(() => setToast(null), 3000);
    };

    // Carga inicial: trae Familias, Impuestos y Márgenes en paralelo.
    useEffect(() => {
        let cancelado = false;

        (async () => {
            setIsLoading(true);
            try {
                const [f, i, m] = await Promise.all([
                    catalogosService.listarFamilias(),
                    catalogosService.listarImpuestos(),
                    catalogosService.listarMargenes(),
                ]);
                if (cancelado) return;
                setFamilias(f);
                setImpuestos(i);
                setMargenes(m);
            } catch (err) {
                if (!cancelado) {
                    showToast("error", err instanceof Error ? err.message : "No se pudieron cargar los catálogos.");
                }
            } finally {
                if (!cancelado) setIsLoading(false);
            }
        })();

        return () => {
            cancelado = true;
        };
    }, []);

    const tabs: { key: ActiveTab; label: string; icon: React.ReactNode; count: number }[] = [
        { key: "familias", label: "Familias", icon: <Layers className="w-6 h-6" />, count: familias.length },
        { key: "impuestos", label: "Impuestos", icon: <Receipt className="w-6 h-6" />, count: impuestos.length },
        { key: "margenes", label: "Márgenes", icon: <DollarSign className="w-6 h-6" />, count: margenes.length },
    ];

    return (
        <div className="cat-page">
            <div className="cat-container">
                <div className="cat-header">
                    <div>
                        <h1 className="cat-header-title">Catálogos</h1>
                        <p className="cat-header-subtitle">
                            Administra las Familias, Impuestos y Márgenes que usan tus productos
                        </p>
                    </div>
                </div>

                <div className="cat-tabs-grid">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`cat-tab-card ${tab === t.key ? "active" : ""}`}
                        >
                            <div className="cat-tab-icon">{t.icon}</div>
                            <div>
                                <p className="cat-tab-label">{t.label}</p>
                                <p className="cat-tab-count">{t.count}</p>
                            </div>
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="cat-table-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 12 }}>
                        <Loader2 className="w-6 h-6" style={{ animation: "spin 1s linear infinite" }} />
                        <p className="cat-empty-state-subtitle">Cargando catálogos...</p>
                    </div>
                ) : (
                    <>
                        {tab === "familias" && (
                            <FamiliasTab familias={familias} setFamilias={setFamilias} showToast={showToast} />
                        )}
                        {tab === "impuestos" && (
                            <TasaCatalogTab
                                items={impuestos}
                                setItems={setImpuestos}
                                showToast={showToast}
                                entityLabel="Impuesto"
                                entityLabelPlural="impuestos"
                                addLabel="Nuevo Impuesto"
                                searchPlaceholder="Buscar impuesto..."
                                icon={<Receipt className="w-4 h-4 text-emerald-600" />}
                                registradoPor={registradoPor}
                                service={{
                                    crear: catalogosService.crearImpuesto,
                                    actualizarNombre: catalogosService.actualizarNombreImpuesto,
                                    actualizarTasa: catalogosService.actualizarTasaImpuesto,
                                    eliminar: catalogosService.eliminarImpuesto,
                                }}
                            />
                        )}
                        {tab === "margenes" && (
                            <TasaCatalogTab
                                items={margenes}
                                setItems={setMargenes}
                                showToast={showToast}
                                entityLabel="Margen"
                                entityLabelPlural="márgenes"
                                addLabel="Nuevo Margen"
                                searchPlaceholder="Buscar margen..."
                                icon={<DollarSign className="w-4 h-4 text-indigo-600" />}
                                registradoPor={registradoPor}
                                service={{
                                    crear: catalogosService.crearMargen,
                                    actualizarNombre: catalogosService.actualizarNombreMargen,
                                    actualizarTasa: catalogosService.actualizarTasaMargen,
                                    eliminar: catalogosService.eliminarMargen,
                                }}
                            />
                        )}
                    </>
                )}
            </div>

            {toast && (
                <div className={`cat-toast tone-${toast.type}`}>
                    {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {toast.message}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   TAB: FAMILIAS
   Sin estado activo/inactivo en el esquema — solo alta, edición
   y borrado de familias (nombre / código propio de la familia,
   usado como prefijo del código de producto).
   ═══════════════════════════════════════════════════════════ */
function FamiliasTab({
    familias,
    setFamilias,
    showToast,
}: {
    familias: Familia[];
    setFamilias: React.Dispatch<React.SetStateAction<Familia[]>>;
    showToast: (type: "success" | "error", message: string) => void;
}) {
    const [showAdd, setShowAdd] = useState(false);
    const [nombre, setNombre] = useState("");
    const [digitos, setDigitos] = useState("");
    const [query, setQuery] = useState("");
    const [editId, setEditId] = useState<string | null>(null);
    const [editNombre, setEditNombre] = useState("");
    const [editDigitos, setEditDigitos] = useState("2");

    const filtered = familias.filter((f) => f.nombre.toLowerCase().includes(query.toLowerCase()));

    const [isSaving, setIsSaving] = useState(false);

    const handleAdd = async () => {
        if (!nombre.trim() || !digitos) {
            showToast("error", "El nombre de la familia es obligatorio.");
            return;
        }
        const duplicada = familias.find((f) => f.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
        if (duplicada) {
            showToast("error", `Ya existe una familia con el nombre "${nombre}".`);
            return;
        }
        setIsSaving(true);
        try {
            const nueva = await catalogosService.crearFamilia(nombre.trim(), Number(digitos));
            setFamilias((prev) => [nueva, ...prev]);
            showToast("success", `Familia "${nueva.nombre}" creada.`);
            setNombre("");
            setDigitos("2");
            setShowAdd(false);
        } catch (err) {
            showToast("error", err instanceof Error ? err.message : "No se pudo crear la familia.");
        } finally {
            setIsSaving(false);
        }
    };

    const startEdit = (f: Familia) => {
        setEditId(f.id_familia);
        setEditNombre(f.nombre);
        setEditDigitos(String(f.digitos));
    };

    const handleSaveEdit = async (f: Familia) => {
        if (!editNombre.trim()) {
            showToast("error", "El nombre no puede estar vacío.");
            return;
        }
        if (!editDigitos) {
            showToast("error", "El código de familia no puede estar vacío.");
            return;
        }
        const duplicada = familias.find(
            (other) => other.id_familia !== f.id_familia && other.nombre.trim().toLowerCase() === editNombre.trim().toLowerCase()
        );
        if (duplicada) {
            showToast("error", `Ya existe otra familia con el nombre "${editNombre}".`);
            return;
        }
        try {
            await catalogosService.actualizarFamilia(f.id_familia, editNombre.trim(), Number(editDigitos));
            setFamilias((prev) =>
                prev.map((item) =>
                    item.id_familia === f.id_familia
                        ? { ...item, nombre: editNombre.trim(), digitos: Number(editDigitos) }
                        : item
                )
            );
            showToast("success", `Familia "${editNombre}" actualizada.`);
            setEditId(null);
        } catch (err) {
            showToast("error", err instanceof Error ? err.message : "No se pudo actualizar la familia.");
        }
    };

    const handleDelete = async (f: Familia) => {
        const confirmado = window.confirm(`¿Eliminar la familia "${f.nombre}"? Esta acción no se puede deshacer.`);
        if (!confirmado) return;
        try {
            await catalogosService.eliminarFamilia(f.id_familia);
            setFamilias((prev) => prev.filter((item) => item.id_familia !== f.id_familia));
            showToast("success", `Familia "${f.nombre}" eliminada.`);
        } catch (err) {
            showToast("error", err instanceof Error ? err.message : "No se pudo eliminar la familia.");
        }
    };

    return (
        <div>
            <div className="card cat-filters-card">
                <FormInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Buscar familia..."
                    iconLeft={<Search className="w-4 h-4 cat-search-icon" />}
                    wrapperClassName="cat-search-wrap"
                    className="form-input cat-search-input"
                />
                <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary btn-sm">
                    <Plus className="w-4 h-4" />
                    Nueva Familia
                </button>
            </div>

            {showAdd && (
                <div className="cat-form-card">
                    <h3 className="cat-form-title">
                        <Plus className="w-4 h-4" />
                        Crear Nueva Familia
                    </h3>
                    <div className="form-grid-2">
                        <FormInput
                            label="Nombre"
                            required
                            placeholder="Ej. Harinas y Cereales"
                            value={nombre}
                            onChange={setNombre}
                        />
                        <FormInput
                            label="Código de familia"
                            required
                            type="text"
                            placeholder="Ej. 01"
                            value={digitos}
                            onChange={(v) => setDigitos(sanitizeDigits(v))}
                        />
                    </div>
                    <p className="cat-form-hint">
                        Es el código propio de esta familia (ej. Harinas = 01, Pan = 02, Sabritas = 03). Se usa como prefijo al
                        generar el código de sus productos y puede crecer más allá de 2 cifras si hace falta (100, 111, etc.).
                    </p>
                    <div className="cat-form-actions">
                        <button onClick={() => setShowAdd(false)} className="btn btn-secondary btn-sm" disabled={isSaving}>
                            Cancelar
                        </button>
                        <button onClick={handleAdd} className="btn btn-primary btn-sm" disabled={isSaving}>
                            {isSaving ? "Guardando..." : "Guardar"}
                        </button>
                    </div>
                </div>
            )}

            <div className="cat-table-card">
                <div className="cat-table-scroll">
                    <table style={catTableStyle}>
                        <thead style={catTheadStyle}>
                            <tr>
                                <th style={catTh()}>Nombre</th>
                                <th style={catTh()}>Código</th>
                                <th style={catTh()}>Creado</th>
                                <th style={catTh("center")}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={4}>
                                        <div className="cat-empty-state">
                                            <Layers className="w-10 h-10" />
                                            <p className="cat-empty-state-title">
                                                {familias.length === 0 ? "No hay familias registradas" : "Sin resultados"}
                                            </p>
                                            <p className="cat-empty-state-subtitle">
                                                {familias.length === 0 ? "Crea una para comenzar a clasificar tus productos." : "Prueba con otro término de búsqueda."}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((f) =>
                                    editId === f.id_familia ? (
                                        <tr key={f.id_familia} style={catRowStyle} {...catRowHoverProps}>
                                            <td style={catTd}>
                                                <FormInput value={editNombre} onChange={setEditNombre} className="form-input cat-input-md" />
                                            </td>
                                            <td style={catTd}>
                                                <FormInput
                                                    value={editDigitos}
                                                    onChange={(v) => setEditDigitos(sanitizeDigits(v))}
                                                    type="text"
                                                    className="form-input cat-input-xs"
                                                />
                                            </td>
                                            <td style={catTd} />
                                            <td style={catTd}>
                                                <div className="cat-row-actions">
                                                    <button
                                                        onClick={() => handleSaveEdit(f)}
                                                        style={catActionBtnStyle}
                                                        onMouseEnter={catHoverIn("var(--cuh-success-bg)", "var(--cuh-success)")}
                                                        onMouseLeave={catHoverOut}
                                                        title="Guardar"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditId(null)}
                                                        style={catActionBtnStyle}
                                                        onMouseEnter={catHoverIn("var(--cuh-border-light)", "var(--cuh-text-dark)")}
                                                        onMouseLeave={catHoverOut}
                                                        title="Cancelar"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        <tr key={f.id_familia} style={catRowStyle} {...catRowHoverProps}>
                                            <td style={catTd}>
                                                <div className="cat-cell-name">{f.nombre}</div>
                                            </td>
                                            <td style={catTd}>
                                                <span className="cat-digits-badge">{formatFamiliaCode(f.digitos)}</span>
                                            </td>
                                            <td style={catTd}>
                                                <span className="cat-cell-sub">{fmtDate(f.created)}</span>
                                            </td>
                                            <td style={catTd}>
                                                <div className="cat-row-actions">
                                                    <button
                                                        onClick={() => startEdit(f)}
                                                        style={catActionBtnStyle}
                                                        onMouseEnter={catHoverIn("var(--cuh-primary-50)", "var(--cuh-primary)")}
                                                        onMouseLeave={catHoverOut}
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(f)}
                                                        style={catActionBtnStyle}
                                                        onMouseEnter={catHoverIn("var(--cuh-danger-50)", "var(--cuh-danger)")}
                                                        onMouseLeave={catHoverOut}
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   TAB GENÉRICO: IMPUESTOS / MÁRGENES
   Mismo patrón de catálogo con historial de tasas — se reutiliza
   para ambos. "Editar tasa" nunca sobrescribe: cierra la vigente
   y abre una nueva (igual que sp_actualizar_tasa_impuesto /
   sp_actualizar_tasa_margen), preservando el historial.
   ═══════════════════════════════════════════════════════════ */
interface TasaCatalogService {
    crear: (nombre: string, porcentajeInicial: number, registradoPor: string | null) => Promise<TasaCatalogItem>;
    actualizarNombre: (id: string, nombre: string) => Promise<void>;
    actualizarTasa: (id: string, nuevoPorcentaje: number, registradoPor: string | null) => Promise<TasaHistorial>;
    eliminar: (id: string) => Promise<void>;
}

function TasaCatalogTab({
    items,
    setItems,
    showToast,
    entityLabel,
    entityLabelPlural,
    addLabel,
    searchPlaceholder,
    icon,
    service,
    registradoPor,
}: {
    items: TasaCatalogItem[];
    setItems: React.Dispatch<React.SetStateAction<TasaCatalogItem[]>>;
    showToast: (type: "success" | "error", message: string) => void;
    entityLabel: string;
    entityLabelPlural: string;
    addLabel: string;
    searchPlaceholder: string;
    icon: React.ReactNode;
    service: TasaCatalogService;
    registradoPor: string | null;
}) {
    const [showAdd, setShowAdd] = useState(false);
    const [nombre, setNombre] = useState("");
    const [porcentaje, setPorcentaje] = useState("");
    const [query, setQuery] = useState("");

    const [editId, setEditId] = useState<string | null>(null);
    const [editNombre, setEditNombre] = useState("");

    const [rateFormId, setRateFormId] = useState<string | null>(null);
    const [newRate, setNewRate] = useState("");

    const [expandedId, setExpandedId] = useState<string | null>(null);

    const filtered = items.filter((i) => i.nombre.toLowerCase().includes(query.toLowerCase()));

    const [isSaving, setIsSaving] = useState(false);

    const handleAdd = async () => {
        if (!nombre.trim() || !porcentaje) {
            showToast("error", `El nombre y el porcentaje son obligatorios para crear un ${entityLabel.toLowerCase()}.`);
            return;
        }
        const valor = parseFloat(porcentaje);
        if (Number.isNaN(valor) || valor < 0) {
            showToast("error", "Ingresa un porcentaje válido.");
            return;
        }
        const duplicado = items.find((i) => i.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
        if (duplicado) {
            showToast("error", `Ya existe un ${entityLabel.toLowerCase()} con el nombre "${nombre}".`);
            return;
        }
        setIsSaving(true);
        try {
            const nuevo = await service.crear(nombre.trim(), valor, registradoPor);
            setItems((prev) => [nuevo, ...prev]);
            showToast("success", `${entityLabel} "${nuevo.nombre}" creado (${porcentaje}%).`);
            setNombre("");
            setPorcentaje("");
            setShowAdd(false);
        } catch (err) {
            showToast("error", err instanceof Error ? err.message : `No se pudo crear el ${entityLabel.toLowerCase()}.`);
        } finally {
            setIsSaving(false);
        }
    };

    const startEdit = (item: TasaCatalogItem) => {
        setEditId(item.id);
        setEditNombre(item.nombre);
    };

    const handleSaveEdit = async (item: TasaCatalogItem) => {
        if (!editNombre.trim()) {
            showToast("error", "El nombre no puede estar vacío.");
            return;
        }
        try {
            await service.actualizarNombre(item.id, editNombre.trim());
            setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, nombre: editNombre.trim() } : i)));
            showToast("success", `${entityLabel} actualizado a "${editNombre}".`);
            setEditId(null);
        } catch (err) {
            showToast("error", err instanceof Error ? err.message : "No se pudo actualizar el nombre.");
        }
    };

    const handleSaveRate = async (item: TasaCatalogItem) => {
        const value = parseFloat(newRate);
        if (Number.isNaN(value) || value < 0) {
            showToast("error", "Ingresa un porcentaje válido.");
            return;
        }
        try {
            const nuevaFila = await service.actualizarTasa(item.id, value, registradoPor);
            const closedAt = nuevaFila.vigente_desde;
            setItems((prev) =>
                prev.map((i) =>
                    i.id === item.id
                        ? {
                            ...i,
                            historial: [
                                ...i.historial.map((h) => (h.vigente_hasta === null ? { ...h, vigente_hasta: closedAt } : h)),
                                nuevaFila,
                            ],
                        }
                        : i
                )
            );
            showToast("success", `Nueva tasa de "${item.nombre}" registrada: ${value}%.`);
            setRateFormId(null);
            setNewRate("");
        } catch (err) {
            showToast("error", err instanceof Error ? err.message : "No se pudo actualizar la tasa.");
        }
    };

    const handleDelete = async (item: TasaCatalogItem) => {
        const confirmado = window.confirm(`¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer.`);
        if (!confirmado) return;
        try {
            await service.eliminar(item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
            showToast("success", `${entityLabel} "${item.nombre}" eliminado.`);
        } catch (err) {
            showToast("error", err instanceof Error ? err.message : "No se pudo eliminar.");
        }
    };

    return (
        <div>
            <div className="card cat-filters-card">
                <FormInput
                    value={query}
                    onChange={setQuery}
                    placeholder={searchPlaceholder}
                    iconLeft={<Search className="w-4 h-4 cat-search-icon" />}
                    wrapperClassName="cat-search-wrap"
                    className="form-input cat-search-input"
                />
                <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary btn-sm">
                    <Plus className="w-4 h-4" />
                    {addLabel}
                </button>
            </div>

            {showAdd && (
                <div className="cat-form-card">
                    <h3 className="cat-form-title">
                        <Plus className="w-4 h-4" />
                        Crear Nuevo {entityLabel}
                    </h3>
                    <div className="form-grid-2">
                        <FormInput
                            label="Nombre"
                            required
                            placeholder={entityLabel === "Impuesto" ? "Ej. IVA" : "Ej. Margen Estándar"}
                            value={nombre}
                            onChange={setNombre}
                        />
                        <FormInput
                            label="Porcentaje inicial (%)"
                            required
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Ej. 16"
                            value={porcentaje}
                            onChange={setPorcentaje}
                        />
                    </div>
                    <div className="cat-form-actions">
                        <button onClick={() => setShowAdd(false)} className="btn btn-secondary btn-sm" disabled={isSaving}>
                            Cancelar
                        </button>
                        <button onClick={handleAdd} className="btn btn-primary btn-sm" disabled={isSaving}>
                            {isSaving ? "Guardando..." : "Guardar"}
                        </button>
                    </div>
                </div>
            )}

            <div className="cat-table-card">
                <div className="cat-table-scroll">
                    <table style={catTableStyle}>
                        <thead style={catTheadStyle}>
                            <tr>
                                <th style={catTh()}>Nombre</th>
                                <th style={catTh()}>Tasa vigente</th>
                                <th style={catTh()}>Última actualización</th>
                                <th style={catTh()}>Creado</th>
                                <th style={catTh("center")}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        <div className="cat-empty-state">
                                            {icon}
                                            <p className="cat-empty-state-title">
                                                {items.length === 0 ? `No hay ${entityLabelPlural} registrados` : "Sin resultados"}
                                            </p>
                                            <p className="cat-empty-state-subtitle">
                                                {items.length === 0 ? `Crea el primero para empezar a usarlo en tus productos.` : "Prueba con otro término de búsqueda."}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((item) => {
                                    const vigente = tasaVigente(item.historial);
                                    const isExpanded = expandedId === item.id;
                                    const isEditingRate = rateFormId === item.id;
                                    const rows = [];

                                    rows.push(
                                        <tr key={item.id} style={catRowStyle} {...catRowHoverProps}>
                                            {editId === item.id ? (
                                                <>
                                                    <td style={catTd}>
                                                        <FormInput value={editNombre} onChange={setEditNombre} className="form-input cat-input-md" />
                                                    </td>
                                                    <td style={catTd} colSpan={3} />
                                                    <td style={catTd}>
                                                        <div className="cat-row-actions">
                                                            <button
                                                                onClick={() => handleSaveEdit(item)}
                                                                style={catActionBtnStyle}
                                                                onMouseEnter={catHoverIn("var(--cuh-success-bg)", "var(--cuh-success)")}
                                                                onMouseLeave={catHoverOut}
                                                                title="Guardar"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditId(null)}
                                                                style={catActionBtnStyle}
                                                                onMouseEnter={catHoverIn("var(--cuh-border-light)", "var(--cuh-text-dark)")}
                                                                onMouseLeave={catHoverOut}
                                                                title="Cancelar"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td style={catTd}>
                                                        <div className="cat-cell-name">{item.nombre}</div>
                                                    </td>
                                                    <td style={catTd}>
                                                        {isEditingRate ? (
                                                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                                <FormInput
                                                                    type="text"
                                                                    autoFocus
                                                                    placeholder="%"
                                                                    value={newRate}
                                                                    onChange={(v) => setNewRate(sanitizePercentage(v))}
                                                                    className="form-input cat-input-xs"
                                                                />
                                                                <button
                                                                    onClick={() => handleSaveRate(item)}
                                                                    style={catActionBtnStyle}
                                                                    onMouseEnter={catHoverIn("var(--cuh-success-bg)", "var(--cuh-success)")}
                                                                    onMouseLeave={catHoverOut}
                                                                    title="Guardar nueva tasa"
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setRateFormId(null);
                                                                        setNewRate("");
                                                                    }}
                                                                    style={catActionBtnStyle}
                                                                    onMouseEnter={catHoverIn("var(--cuh-border-light)", "var(--cuh-text-dark)")}
                                                                    onMouseLeave={catHoverOut}
                                                                    title="Cancelar"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="cat-rate-cell">
                                                                <span className="cat-rate-badge">{vigente ? `${vigente.porcentaje}%` : "—"}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={catTd}>
                                                        <span className="cat-cell-sub">{vigente ? fmtDate(vigente.vigente_desde) : "—"}</span>
                                                    </td>
                                                    <td style={catTd}>
                                                        <span className="cat-cell-sub">{fmtDate(item.created)}</span>
                                                    </td>
                                                    <td style={catTd}>
                                                        <div className="cat-row-actions">
                                                            <button
                                                                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                                                style={catActionBtnStyle}
                                                                onMouseEnter={catHoverIn("var(--cuh-primary-50)", "var(--cuh-primary)")}
                                                                onMouseLeave={catHoverOut}
                                                                title="Ver historial de tasas"
                                                            >
                                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <History className="w-4 h-4" />}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (isEditingRate) {
                                                                        setRateFormId(null);
                                                                        setNewRate("");
                                                                    } else {
                                                                        setRateFormId(item.id);
                                                                        setNewRate(vigente ? String(vigente.porcentaje) : "");
                                                                    }
                                                                }}
                                                                style={catActionBtnStyle}
                                                                onMouseEnter={catHoverIn("var(--cuh-primary-50)", "var(--cuh-primary)")}
                                                                onMouseLeave={catHoverOut}
                                                                title="Ajustar tasa vigente"
                                                            >
                                                                <DollarSign className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => startEdit(item)}
                                                                style={catActionBtnStyle}
                                                                onMouseEnter={catHoverIn("var(--cuh-primary-50)", "var(--cuh-primary)")}
                                                                onMouseLeave={catHoverOut}
                                                                title="Editar nombre"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(item)}
                                                                style={catActionBtnStyle}
                                                                onMouseEnter={catHoverIn("var(--cuh-danger-50)", "var(--cuh-danger)")}
                                                                onMouseLeave={catHoverOut}
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    );

                                    if (isExpanded) {
                                        rows.push(
                                            <tr key={`${item.id}-history`} className="cat-history-row">
                                                <td colSpan={5}>
                                                    <div className="cat-history-wrap">
                                                        <p className="cat-history-title">Historial de tasas</p>
                                                        <div className="cat-history-list">
                                                            {[...item.historial].reverse().map((h) => (
                                                                <div key={h.id_tasa} className={`cat-history-item ${h.vigente_hasta === null ? "is-current" : ""}`}>
                                                                    <span className="cat-history-rate">{h.porcentaje}%</span>
                                                                    <span className="cat-history-range">
                                                                        {fmtDate(h.vigente_desde)} — {h.vigente_hasta ? fmtDate(h.vigente_hasta) : "vigente"}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return rows;
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}