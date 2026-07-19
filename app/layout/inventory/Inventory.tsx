import React, { useState } from "react";
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

/* ─────────────────────────────────────────────────────────────
   Tipos y datos de muestra
──────────────────────────────────────────────────────────────── */
type AlertLevel = "green" | "yellow" | "red" | "black" | "none";

interface MockProducto {
    id: string;
    descripcion: string;
    codigoInterno: string;
    familia: string;
    codigoFamilia: string;
    iva: number;
    precio: number;
    stock: number;
    proximaCaducidad: string | null;
    estado: boolean;
    alertLevel: AlertLevel;
    unidad: string;
}

const MOCK_PRODUCTOS: MockProducto[] = [
    {
        id: "1",
        descripcion: "Aceite Vegetal La Gloria 1L",
        codigoInterno: "ACE-001",
        familia: "Aceites y Grasas",
        codigoFamilia: "AG",
        iva: 16,
        precio: 42.5,
        stock: 320,
        proximaCaducidad: "2026-09-15",
        estado: true,
        alertLevel: "green",
        unidad: "PZA",
    },
    {
        id: "2",
        descripcion: "Frijol Bayo Granel 1kg",
        codigoInterno: "FRJ-002",
        familia: "Granos y Semillas",
        codigoFamilia: "GS",
        iva: 0,
        precio: 28.0,
        stock: 85,
        proximaCaducidad: "2026-10-01",
        estado: true,
        alertLevel: "green",
        unidad: "KG",
    },
    {
        id: "3",
        descripcion: "Leche Entera Lala 1L",
        codigoInterno: "LCH-014",
        familia: "Lácteos",
        codigoFamilia: "LAC",
        iva: 0,
        precio: 24.5,
        stock: 48,
        proximaCaducidad: "2026-08-05",
        estado: true,
        alertLevel: "yellow",
        unidad: "PZA",
    },
    {
        id: "4",
        descripcion: "Harina Selecta 1kg",
        codigoInterno: "HAR-007",
        familia: "Harinas y Masas",
        codigoFamilia: "HM",
        iva: 0,
        precio: 18.9,
        stock: 12,
        proximaCaducidad: "2026-07-28",
        estado: true,
        alertLevel: "red",
        unidad: "KG",
    },
    {
        id: "5",
        descripcion: "Sardina Coppelia 425g",
        codigoInterno: "LAT-003",
        familia: "Latas y Conservas",
        codigoFamilia: "LC",
        iva: 16,
        precio: 35.0,
        stock: 6,
        proximaCaducidad: "2026-07-10",
        estado: true,
        alertLevel: "black",
        unidad: "PZA",
    },
    {
        id: "6",
        descripcion: "Azúcar Morena 1kg",
        codigoInterno: "AZU-005",
        familia: "Endulzantes",
        codigoFamilia: "END",
        iva: 0,
        precio: 22.0,
        stock: 0,
        proximaCaducidad: null,
        estado: false,
        alertLevel: "none",
        unidad: "KG",
    },
    {
        id: "7",
        descripcion: "Atún Van Camps 140g",
        codigoInterno: "LAT-009",
        familia: "Latas y Conservas",
        codigoFamilia: "LC",
        iva: 16,
        precio: 19.5,
        stock: 200,
        proximaCaducidad: "2027-01-20",
        estado: true,
        alertLevel: "green",
        unidad: "PZA",
    },
    {
        id: "8",
        descripcion: "Detergente Roma 500g",
        codigoInterno: "LIM-011",
        familia: "Limpieza",
        codigoFamilia: "LIM",
        iva: 16,
        precio: 16.0,
        stock: 54,
        proximaCaducidad: null,
        estado: true,
        alertLevel: "none",
        unidad: "PZA",
    },
];

const MOCK_FAMILIAS = [
    { id: "1", nombre: "Aceites y Grasas", codigoFamilia: "AG" },
    { id: "2", nombre: "Granos y Semillas", codigoFamilia: "GS" },
    { id: "3", nombre: "Lácteos", codigoFamilia: "LAC" },
    { id: "4", nombre: "Harinas y Masas", codigoFamilia: "HM" },
    { id: "5", nombre: "Latas y Conservas", codigoFamilia: "LC" },
    { id: "6", nombre: "Endulzantes", codigoFamilia: "END" },
    { id: "7", nombre: "Limpieza", codigoFamilia: "LIM" },
];

// TODO: reemplazar por los márgenes e impuestos reales (tablas Margenes / Impuestos)
const MOCK_MARGENES: MargenRow[] = [
    { id_margenes: "1", nombre: "Estándar", porcentaje: 30 },
    { id_margenes: "2", nombre: "Perecederos", porcentaje: 20 },
    { id_margenes: "3", nombre: "Alta rotación", porcentaje: 15 },
];

const MOCK_IMPUESTOS: ImpuestoRow[] = [
    { id_impuestos: "1", nombre: "IVA", porcentaje: 16 },
    { id_impuestos: "2", nombre: "Exento", porcentaje: 0 },
];

// El modal espera familias con { id_familia, nombre, digitos } (esquema real).
// Mientras el inventario siga usando el mock con codigoFamilia, las convertimos aquí.
const FAMILIAS_PARA_MODAL: FamiliaRow[] = MOCK_FAMILIAS.map((f) => ({
    id_familia: f.id,
    nombre: f.nombre,
    digitos: 2,
}));

// AddEntrada necesita los productos en formato ProductoRow (esquema real) para
// poder mostrar el selector, el último costo y el margen/impuesto asignado.
// TODO: cuando conectes datos reales, esto ya vendrá así desde tu backend.
const PRODUCTOS_PARA_MODAL: ProductoRow[] = MOCK_PRODUCTOS.map((p) => ({
    id_producto: p.id,
    id_familia: MOCK_FAMILIAS.find((f) => f.codigoFamilia === p.codigoFamilia)?.id || null,
    codigo_interno: p.codigoInterno,
    nombre: p.descripcion,
    descripcion: null,
    costo_referencia: p.precio,
    id_margenes: null,
    id_impuestos: p.iva > 0 ? "1" : "2", // "1"=IVA 16%, "2"=Exento (ver MOCK_IMPUESTOS)
    costo_final: p.precio,
    umbral_rojo_dias: 7,
    umbral_amarillo_dias: 15,
    activo: p.estado,
    codigos_alternos: [],
}));

// TODO: reemplazar por los códigos alternos reales (tabla Codigos_Alternos)
const MOCK_CODIGOS_ALTERNOS: CodigoAlternoExistente[] = [];

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

function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}


/* ─────────────────────────────────────────────────────────────
   ProductRow
──────────────────────────────────────────────────────────────── */
function ProductRow({
    producto,
    onEdit,
}: {
    producto: MockProducto;
    onOpenMenu: (id: string | null) => void;
    openMenuId: string | null;
    onEdit: (producto: MockProducto) => void;
}) {

    return (
        <tr
            className={`inv-row-clickable${!producto.estado ? " inv-row-inactive" : ""}`}
            style={{ transition: "background 0.15s", borderBottom: "1px solid var(--cuh-border-light)" }}
            onMouseEnter={(e) => {
                if (producto.estado)
                    (e.currentTarget as HTMLTableRowElement).style.background = "var(--cuh-bg)";
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.background = "";
            }}
        >
            {/* Producto */}
            <td style={{ padding: "14px 24px" }}>
                <div className="inv-cell-product">
                    <span className="inv-cell-product-name">{producto.descripcion}</span>
                    <span className="inv-cell-product-code">{producto.codigoInterno}</span>
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
                        {producto.codigoFamilia}
                    </span>
                    <span style={{ fontSize: 12.5, color: "var(--cuh-text-muted)", fontWeight: 500 }}>
                        {producto.familia}
                    </span>
                </div>
            </td>

            {/* Fiscal y Finanzas */}
            <td style={{ padding: "14px 24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--cuh-text-dark)" }}>
                        ${producto.precio.toFixed(2)}
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
                        IVA {producto.iva}%
                    </span>
                </div>
            </td>

            {/* Existencia y Cad */}
            <td style={{ padding: "14px 24px" }}>
                <div className="inv-cell-stock">
                    <div className={`inv-stock-dot ${alertDotClass[producto.alertLevel]}`} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <span className="inv-cell-stock-qty">
                            {producto.stock} {producto.unidad}
                        </span>
                        <span className="inv-cell-stock-date">
                            Cad: {formatDate(producto.proximaCaducidad)}
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
                        title="Eliminar"
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
    const [filterFamilia, setFilterFamilia] = useState("");
    const [selectedAlertFilters, setSelectedAlertFilters] = useState<AlertLevel[]>([]);
    const [isFamiliaDropdownOpen, setIsFamiliaDropdownOpen] = useState(false);
    const [familiaSearchTerm, setFamiliaSearchTerm] = useState("");
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    /* Modal Agregar / Editar Producto */
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ProductoRow | null>(null);

    const openNuevoProducto = () => {
        setEditingProduct(null);
        setIsAddModalOpen(true);
    };

    const openEditarProducto = (producto: MockProducto) => {
        // Adaptamos el mock actual al shape ProductoRow que espera el modal.
        // Cuando conectes datos reales, aquí ya vendrá en el formato correcto.
        setEditingProduct({
            id_producto: producto.id,
            id_familia: MOCK_FAMILIAS.find((f) => f.codigoFamilia === producto.codigoFamilia)?.id || null,
            codigo_interno: producto.codigoInterno,
            nombre: producto.descripcion,
            descripcion: null,
            costo_referencia: producto.precio,
            id_margenes: null,
            id_impuestos: null,
            costo_final: producto.precio,
            umbral_rojo_dias: 7,
            umbral_amarillo_dias: 15,
            activo: producto.estado,
            codigos_alternos: [],
        });
        setIsAddModalOpen(true);
    };

    const handleGuardarProducto = async (payload: ProductoPayload) => {
        // Aquí se conecta con tu backend real (ej. sp_registrar_producto /
        // sp_actualizar_producto vía IPC), igual que sp_registrar_venta en Ventas.
        console.log("Guardar producto:", payload);
    };

    /* Modal Registrar Entrada */
    const [isEntradaModalOpen, setIsEntradaModalOpen] = useState(false);

    const handleGuardarEntrada = async (payload: EntradaPayload) => {
        // Aquí se conecta con sp_registrar_entrada vía IPC, más los inserts de
        // Codigos_Alternos para payload.codigos_alternos_nuevos.
        console.log("Guardar entrada:", payload);
    };

    /* Filtrado visual sobre datos de muestra */
    const visibleProductos = MOCK_PRODUCTOS.filter((p) => {
        const matchesSearch =
            p.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.codigoInterno.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFamilia =
            !filterFamilia || p.codigoFamilia === filterFamilia;
        const matchesAlert =
            selectedAlertFilters.length === 0 || selectedAlertFilters.includes(p.alertLevel);
        return matchesSearch && matchesFamilia && matchesAlert;
    }).sort((a, b) => (a.estado === b.estado ? 0 : a.estado ? -1 : 1));

    const selectedFamilia = MOCK_FAMILIAS.find((f) => f.codigoFamilia === filterFamilia);
    const filteredFamiliasOptions = MOCK_FAMILIAS.filter(
        (f) =>
            f.nombre.toLowerCase().includes(familiaSearchTerm.toLowerCase()) ||
            f.codigoFamilia.toLowerCase().includes(familiaSearchTerm.toLowerCase())
    );

    const toggleAlertFilter = (level: AlertLevel) =>
        setSelectedAlertFilters((prev) =>
            prev.includes(level) ? prev.filter((f) => f !== level) : [...prev, level]
        );

    /* KPIs */
    const totalActivos = MOCK_PRODUCTOS.filter((p) => p.estado).length;
    const familiasCount = MOCK_FAMILIAS.length;
    const stockBajo = MOCK_PRODUCTOS.filter(
        (p) => p.estado && (p.alertLevel === "red" || p.alertLevel === "black")
    ).length;
    const proximosCaducar = MOCK_PRODUCTOS.filter(
        (p) => p.estado && p.alertLevel === "yellow"
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
                                    {selectedFamilia
                                        ? `${selectedFamilia.codigoFamilia} — ${selectedFamilia.nombre}`
                                        : "Todas las Familias"}
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
                                                        key={fam.id}
                                                        className={`inv-familia-option${filterFamilia === fam.codigoFamilia ? " active" : ""}`}
                                                        onClick={() => { setFilterFamilia(fam.codigoFamilia); setIsFamiliaDropdownOpen(false); setFamiliaSearchTerm(""); }}
                                                    >
                                                        <span className="inv-familia-option-code">{fam.codigoFamilia}</span>
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
                                {visibleProductos.length === 0 ? (
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
                                        <React.Fragment key={p.id}>
                                            {idx > 0 && (
                                                <tr>
                                                    <td colSpan={6} style={{ height: 0, padding: 0, borderTop: "1px solid var(--cuh-border-light)" }} />
                                                </tr>
                                            )}
                                            <ProductRow producto={p} openMenuId={openMenuId} onOpenMenu={setOpenMenuId} onEdit={openEditarProducto} />
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
                            Mostrando {visibleProductos.length} de {MOCK_PRODUCTOS.length} productos
                        </span>
                    </div>
                </div>

            </div>

            <AddProducto
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                familias={FAMILIAS_PARA_MODAL}
                margenes={MOCK_MARGENES}
                impuestos={MOCK_IMPUESTOS}
                editProduct={editingProduct}
                onSave={handleGuardarProducto}
            />

            <AddEntrada
                isOpen={isEntradaModalOpen}
                onClose={() => setIsEntradaModalOpen(false)}
                productos={PRODUCTOS_PARA_MODAL}
                margenes={MOCK_MARGENES}
                impuestos={MOCK_IMPUESTOS}
                codigosAlternosExistentes={MOCK_CODIGOS_ALTERNOS}
                onSave={handleGuardarEntrada}
            />
        </div>
    );
}