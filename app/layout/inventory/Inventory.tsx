import React, { useCallback, useEffect, useState } from "react";
import {
    AlertTriangle,
    ChevronDown,
    Clock,
    DollarSign,
    Download,
    Package,
    Plus,
    Search,
    Edit2,
    Trash2,
    Eye,
} from "lucide-react";
import "../../css/inventario.css";
import FormInput from "../../components/FormInput";
import type { FamiliaRow, ImpuestoRow, MargenRow, ProductoPayload, ProductoRow } from "../../components/add/addproducto";
import type { CodigoAlternoExistente, EntradaPayload } from "../../components/add/addentrada";
import AddProducto from "../../components/add/addproducto";
import AddEntrada from "../../components/add/addentrada";
import {
    listarProductosInventario,
    listarProductosParaModal,
    listarMargenesVigentes,
    listarImpuestosVigentes,
    listarCodigosAlternosExistentes,
    obtenerProducto,
    crearProducto,
    actualizarProducto,
    cambiarEstadoProducto,
    crearEntrada,
    type ProductoListado,
    type AlertLevel,
} from "../../../src/services/inventory.service";
import { listarFamilias } from "../../../src/services/catalogos.service";

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

function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
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
}: {
    producto: ProductoListado;
    onOpenMenu: (id: string | null) => void;
    openMenuId: string | null;
    onEdit: (producto: ProductoListado) => void;
    onEliminar: (producto: ProductoListado) => void;
}) {

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

            {/* Existencia y Cad */}
            <td style={{ padding: "14px 24px" }}>
                <div className="inv-cell-stock">
                    <div className={`inv-stock-dot ${alertDotClass[producto.alertLevel]}`} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <span className="inv-cell-stock-qty">
                            {producto.cantidad_total} {UNIDAD_LABEL[producto.unidad]}
                        </span>
                        <span className="inv-cell-stock-date">
                            Cad: {formatDate(producto.proxima_caducidad)}
                        </span>
                    </div>
                </div>
            </td>



            {/* Acciones */}
            <td style={{ padding: "14px 24px" }}>
                <div className="inv-row-actions">
                    {/* Ver lotes */}
                    <button
                        title="Ver lotes"
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
                            (e.currentTarget as HTMLButtonElement).style.background = "var(--cuh-danger-50)";
                            (e.currentTarget as HTMLButtonElement).style.color = "var(--cuh-danger)";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "none";
                            (e.currentTarget as HTMLButtonElement).style.color = "var(--cuh-text-muted)";
                        }}
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </td>
        </tr>
    );
}

/* ─────────────────────────────────────────────────────────────
   Componente principal — sólo visual, sin lógica real
──────────────────────────────────────────────────────────────── */
export default function Inventory() {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterFamilia, setFilterFamilia] = useState(""); // id_familia seleccionado, "" = todas
    const [selectedAlertFilters, setSelectedAlertFilters] = useState<AlertLevel[]>([]);
    const [isFamiliaDropdownOpen, setIsFamiliaDropdownOpen] = useState(false);
    const [familiaSearchTerm, setFamiliaSearchTerm] = useState("");
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
            alert(err instanceof Error ? err.message : "No se pudo abrir el producto para editar.");
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
        } catch (err) {
            alert(err instanceof Error ? err.message : "No se pudo guardar el producto.");
        }
    };

    const handleEliminarProducto = async (producto: ProductoListado) => {
        const accion = producto.activo ? "desactivar" : "reactivar";
        if (!window.confirm(`¿Seguro que quieres ${accion} "${producto.nombre}"?`)) return;
        try {
            await cambiarEstadoProducto(producto.id_producto, !producto.activo);
        } catch (err) {
            alert(err instanceof Error ? err.message : "No se pudo actualizar el estado del producto.");
        }
    };

    /* Modal Registrar Entrada */
    const [isEntradaModalOpen, setIsEntradaModalOpen] = useState(false);

    const handleGuardarEntrada = async (payload: EntradaPayload) => {
        try {
            await crearEntrada(payload);
            setIsEntradaModalOpen(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : "No se pudo registrar la entrada.");
        }
    };

    /* Filtrado sobre los datos reales */
    const visibleProductos = productos.filter((p) => {
        const matchesSearch =
            p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.codigo_interno ?? "").toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFamilia = !filterFamilia || p.id_familia === filterFamilia;
        const matchesAlert =
            selectedAlertFilters.length === 0 || selectedAlertFilters.includes(p.alertLevel);
        return matchesSearch && matchesFamilia && matchesAlert;
    }).sort((a, b) => (a.activo === b.activo ? 0 : a.activo ? -1 : 1));

    const selectedFamilia = familias.find((f) => f.id_familia === filterFamilia);
    const filteredFamiliasOptions = familias.filter((f) =>
        f.nombre.toLowerCase().includes(familiaSearchTerm.toLowerCase())
    );

    const toggleAlertFilter = (level: AlertLevel) =>
        setSelectedAlertFilters((prev) =>
            prev.includes(level) ? prev.filter((f) => f !== level) : [...prev, level]
        );

    /* KPIs */
    const totalActivos = productos.filter((p) => p.activo).length;
    const familiasCount = familias.length;
    const stockBajo = productos.filter(
        (p) => p.activo && (p.alertLevel === "red" || p.alertLevel === "black")
    ).length;
    const proximosCaducar = productos.filter(
        (p) => p.activo && p.alertLevel === "yellow"
    ).length;

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
                        <button className="btn btn-ghost" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Download size={16} />
                            <span>Exportar</span>
                        </button>
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

                {/* ── KPIs ── */}
                <div className="inv-kpi-grid">
                    <div className="inv-kpi-card">
                        <div className="inv-kpi-icon tone-primary"><Package size={22} /></div>
                        <div>
                            <p className="inv-kpi-label">Total Productos</p>
                            <p className="inv-kpi-value">{totalActivos}</p>
                        </div>
                    </div>
                    <div className="inv-kpi-card">
                        <div className="inv-kpi-icon tone-secondary"><DollarSign size={22} /></div>
                        <div>
                            <p className="inv-kpi-label">Familias Activas</p>
                            <p className="inv-kpi-value">{familiasCount}</p>
                        </div>
                    </div>
                    <div className="inv-kpi-card">
                        <div className="inv-kpi-icon tone-warning"><AlertTriangle size={22} /></div>
                        <div>
                            <p className="inv-kpi-label">Stock Bajo / Vencido</p>
                            <p className="inv-kpi-value tone-warning">{stockBajo} Prods</p>
                        </div>
                    </div>
                    <div className="inv-kpi-card">
                        <div className="inv-kpi-icon tone-danger"><Clock size={22} /></div>
                        <div>
                            <p className="inv-kpi-label">Próximos a Caducar</p>
                            <p className="inv-kpi-value tone-danger">{proximosCaducar} Prods</p>
                        </div>
                    </div>
                </div>

                {/* ── Toolbar ── */}
                <div className="card card-context context-info inv-filters-card">
                    <div className="inv-filters-grid">
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
                </div>

                {/* ── Filtros de Alerta (semáforo) ── */}
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
                            className={`inv-alert-pill tone-${level}${selectedAlertFilters.includes(level) ? " active" : ""}`}
                            onClick={() => toggleAlertFilter(level)}
                        >
                            <span className="inv-alert-dot" />
                            {label}
                        </button>
                    ))}
                    {selectedAlertFilters.length > 0 && (
                        <button className="inv-alert-clear" onClick={() => setSelectedAlertFilters([])}>
                            Limpiar filtros
                        </button>
                    )}
                </div>

                {/* ── Tabla de productos ── */}
                <div className="inv-table-card">
                    <div className="inv-table-scroll">
                        <table style={{ width: "100%", textAlign: "left", fontSize: 14, borderCollapse: "collapse", whiteSpace: "nowrap" }}>
                            <thead style={{ background: "var(--cuh-bg)", color: "var(--cuh-text-muted)", fontWeight: 600, borderBottom: "1px solid var(--cuh-border-light)" }}>
                                <tr>
                                    {["Producto", "Familia", "Precio", "Existencia y Cad", "Acciones"].map((col, i) => (
                                        <th
                                            key={col}
                                            style={{
                                                padding: "13px 24px",
                                                fontSize: 12,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.04em",
                                                textAlign: i >= 4 ? "center" : "left",
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
                                        <td colSpan={6}>
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
                                        <td colSpan={6}>
                                            <div className="inv-empty-state">
                                                <Package size={40} />
                                                <p className="inv-empty-state-title">Cargando inventario…</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : visibleProductos.length === 0 ? (
                                    <tr>
                                        <td colSpan={6}>
                                            <div className="inv-empty-state">
                                                <Package size={40} />
                                                <p className="inv-empty-state-title">No se encontraron productos</p>
                                                <p className="inv-empty-state-subtitle">Ajusta los filtros o crea uno nuevo</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    visibleProductos.map((p, idx) => (
                                        <React.Fragment key={p.id_producto}>
                                            {idx > 0 && (
                                                <tr>
                                                    <td colSpan={6} style={{ height: 0, padding: 0, borderTop: "1px solid var(--cuh-border-light)" }} />
                                                </tr>
                                            )}
                                            <ProductRow
                                                producto={p}
                                                openMenuId={openMenuId}
                                                onOpenMenu={setOpenMenuId}
                                                onEdit={openEditarProducto}
                                                onEliminar={handleEliminarProducto}
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
                            Mostrando {visibleProductos.length} de {productos.length} productos
                        </span>
                    </div>
                </div>

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
        </div>
    );
}