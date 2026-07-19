import { useMemo, useState } from "react";
import FormInput from "../../components/FormInput";
import FormSelect from "../../components/FormSelect";
import {
    Search,
    ShoppingCart,
    Plus,
    Minus,
    X,
    PackageX,
    Undo2,
} from "lucide-react";
import "../../css/ventas.css";

/* ─────────────────────────────────────────────────────────────
   Tipos y datos de muestra
──────────────────────────────────────────────────────────────── */
interface MockProductoVenta {
    id: string;
    nombre: string;
    codigoInterno: string;
    codigoAlterno: string | null;
    familia: string;
    precio: number;
    stock: number;
}

const MOCK_PRODUCTOS: MockProductoVenta[] = [
    { id: "1", nombre: "Aceite Vegetal La Gloria 1L", codigoInterno: "ACE-001", codigoAlterno: "7501234567890", familia: "Aceites y Grasas", precio: 42.5, stock: 320 },
    { id: "2", nombre: "Frijol Bayo Granel 1kg", codigoInterno: "FRJ-002", codigoAlterno: null, familia: "Granos y Semillas", precio: 28.0, stock: 85 },
    { id: "3", nombre: "Leche Entera Lala 1L", codigoInterno: "LCH-014", codigoAlterno: "7501055310018", familia: "Lácteos", precio: 24.5, stock: 48 },
    { id: "4", nombre: "Harina Selecta 1kg", codigoInterno: "HAR-007", codigoAlterno: "7501020514029", familia: "Harinas y Masas", precio: 18.9, stock: 12 },
    { id: "5", nombre: "Sardina Coppelia 425g", codigoInterno: "LAT-003", codigoAlterno: "7501008803109", familia: "Latas y Conservas", precio: 35.0, stock: 6 },
    { id: "6", nombre: "Azúcar Morena 1kg", codigoInterno: "AZU-005", codigoAlterno: null, familia: "Endulzantes", precio: 22.0, stock: 0 },
    { id: "7", nombre: "Atún Van Camps 140g", codigoInterno: "LAT-009", codigoAlterno: "7501008805103", familia: "Latas y Conservas", precio: 19.5, stock: 200 },
    { id: "8", nombre: "Detergente Roma 500g", codigoInterno: "LIM-011", codigoAlterno: "7501013310027", familia: "Limpieza", precio: 16.0, stock: 54 },
    { id: "9", nombre: "Jabón Zote Rosa 400g", codigoInterno: "LIM-014", codigoAlterno: "7501006508101", familia: "Limpieza", precio: 14.5, stock: 40 },
    { id: "10", nombre: "Arroz Morelos 1kg", codigoInterno: "GRS-003", codigoAlterno: "7501234500012", familia: "Granos y Semillas", precio: 21.0, stock: 95 },
    { id: "11", nombre: "Mayonesa McCormick 390g", codigoInterno: "SAL-002", codigoAlterno: "7501008501104", familia: "Salsas y Aderezos", precio: 38.0, stock: 30 },
    { id: "12", nombre: "Refresco Cola 600ml", codigoInterno: "BEB-021", codigoAlterno: "7501055363014", familia: "Bebidas", precio: 15.0, stock: 3 },
];

const FAMILIAS = Array.from(new Set(MOCK_PRODUCTOS.map((p) => p.familia))).map(
    (nombre, idx) => ({
        nombre,
        codigo: String(idx + 1).padStart(2, "0"),
    })
);

interface CartItem {
    producto: MockProductoVenta;
    cantidad: number;
}

/* ─────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────────── */
function formatMoney(n: number): string {
    return `$${n.toFixed(2)}`;
}

/* ─────────────────────────────────────────────────────────────
   Componente principal — sólo visual, sin lógica real de venta
──────────────────────────────────────────────────────────────── */
export default function Ventas() {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterFamilia, setFilterFamilia] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);

    /* Búsqueda: por nombre, código interno, código alterno o familia */
    const filteredProductos = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return MOCK_PRODUCTOS.filter((p) => {
            const matchesSearch =
                !term ||
                p.nombre.toLowerCase().includes(term) ||
                p.codigoInterno.toLowerCase().includes(term) ||
                (p.codigoAlterno?.toLowerCase().includes(term) ?? false) ||
                p.familia.toLowerCase().includes(term);

            const matchesFamilia = !filterFamilia || p.familia === filterFamilia;

            return matchesSearch && matchesFamilia;
        });
    }, [searchTerm, filterFamilia]);

    const addToCart = (producto: MockProductoVenta) => {
        if (producto.stock <= 0) return;
        setCart((prev) => {
            const existing = prev.find((i) => i.producto.id === producto.id);
            if (existing) {
                // No exceder el stock disponible
                if (existing.cantidad >= producto.stock) return prev;
                return prev.map((i) =>
                    i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
                );
            }
            return [...prev, { producto, cantidad: 1 }];
        });
    };

    const changeQty = (id: string, delta: number) => {
        setCart((prev) =>
            prev
                .map((i) => {
                    if (i.producto.id !== id) return i;
                    const next = i.cantidad + delta;
                    if (next <= 0) return { ...i, cantidad: 0 };
                    if (next > i.producto.stock) return i;
                    return { ...i, cantidad: next };
                })
                .filter((i) => i.cantidad > 0)
        );
    };

    const removeFromCart = (id: string) => {
        setCart((prev) => prev.filter((i) => i.producto.id !== id));
    };

    const clearCart = () => setCart([]);

    const totalItems = cart.reduce((sum, i) => sum + i.cantidad, 0);
    const totalVenta = cart.reduce((sum, i) => sum + i.cantidad * i.producto.precio, 0);

    const handleVender = () => {
        // Solo visual por ahora: aquí se conectará sp_registrar_venta vía IPC
        alert(`Venta simulada por ${formatMoney(totalVenta)} (${totalItems} artículos)`);
        clearCart();
    };

    return (
        <div className="pos-page">
            <div className="pos-container">

                {/* ── Header ── */}
                <div className="pos-header">
                    <div>
                        <h1 className="pos-header-title">Punto de Venta</h1>
                        <p className="pos-header-subtitle">
                            Busca productos y arma la venta actual
                        </p>
                    </div>
                    <button className="btn btn-ghost" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Undo2 size={16} />
                        <span>Registrar devolución</span>
                    </button>
                </div>

                <div className="pos-layout">

                    {/* ── Columna izquierda: catálogo ── */}
                    <div className="pos-catalog">
                        <div className="card card-context context-info pos-filters-card">
                            <div className="pos-filters-grid">
                                <FormInput
                                    label="Búsqueda"
                                    type="text"
                                    className="form-input pos-search-input"
                                    wrapperClassName="pos-search-wrap"
                                    placeholder="Nombre, código interno, código alterno o familia"
                                    value={searchTerm}
                                    onChange={(val) => setSearchTerm(val)}
                                    autoFocus
                                    iconLeft={<Search size={14} className="pos-search-icon" />}
                                />

                                <FormSelect
                                    label="Familia"
                                    value={filterFamilia ?? ""}
                                    onChange={(val) => setFilterFamilia(val || null)}
                                    placeholder="Todas las familias"
                                    options={[
                                        { value: '', label: 'Todas las familias' },
                                        ...FAMILIAS.map(fam => ({ value: fam.nombre, label: `${fam.codigo}-${fam.nombre}` }))
                                    ]}
                                />
                            </div>
                        </div>

                        <div className="pos-product-grid">
                            {filteredProductos.length === 0 ? (
                                <div className="pos-empty-catalog">
                                    <PackageX size={36} />
                                    <span>No se encontraron productos con esa búsqueda</span>
                                </div>
                            ) : (
                                filteredProductos.map((p) => {
                                    const isOut = p.stock <= 0;
                                    const isLow = p.stock > 0 && p.stock <= 10;
                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            className={`pos-product-card${isOut ? " is-out" : ""}`}
                                            onClick={() => addToCart(p)}
                                            disabled={isOut}
                                            title={isOut ? "Sin existencia" : "Agregar a la venta"}
                                        >
                                            <span className="pos-product-add-badge">
                                                <Plus size={14} />
                                            </span>
                                            <span className="pos-product-familia-badge">{p.familia}</span>
                                            <span className="pos-product-name">{p.nombre}</span>
                                            <div className="pos-product-footer">
                                                <span className="pos-product-price">{formatMoney(p.precio)}</span>
                                                <span className={`pos-product-stock${isLow ? " tone-low" : ""}`}>
                                                    <span className="pos-product-stock-dot" />
                                                    {isOut ? "Agotado" : `${p.stock} disp.`}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* ── Columna derecha: carrito / venta actual ── */}
                    <div className="pos-cart">
                        <div className="pos-cart-header">
                            <h2 className="pos-cart-title">
                                <ShoppingCart size={18} />
                                Venta actual
                                {totalItems > 0 && <span className="pos-cart-count">{totalItems}</span>}
                            </h2>
                            {cart.length > 0 && (
                                <button className="pos-cart-clear" onClick={clearCart}>
                                    Vaciar
                                </button>
                            )}
                        </div>

                        <div className="pos-cart-list">
                            {cart.length === 0 ? (
                                <div className="pos-cart-empty">
                                    <ShoppingCart size={32} />
                                    <p className="pos-cart-empty-title">Aún no hay productos</p>
                                    <p className="pos-cart-empty-subtitle">
                                        Toca una tarjeta del catálogo para agregarla
                                    </p>
                                </div>
                            ) : (
                                cart.map((item) => (
                                    <div className="pos-cart-item" key={item.producto.id}>
                                        <div className="pos-cart-item-info">
                                            <div className="pos-cart-item-name">{item.producto.nombre}</div>
                                            <div className="pos-cart-item-price">
                                                {formatMoney(item.producto.precio)} c/u
                                            </div>
                                        </div>

                                        <div className="pos-cart-item-qty">
                                            <button
                                                className="pos-qty-btn"
                                                onClick={() => changeQty(item.producto.id, -1)}
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <span className="pos-qty-value">{item.cantidad}</span>
                                            <button
                                                className="pos-qty-btn"
                                                onClick={() => changeQty(item.producto.id, 1)}
                                                disabled={item.cantidad >= item.producto.stock}
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>

                                        <span className="pos-cart-item-subtotal">
                                            {formatMoney(item.cantidad * item.producto.precio)}
                                        </span>

                                        <button
                                            className="pos-cart-item-remove"
                                            onClick={() => removeFromCart(item.producto.id)}
                                            title="Quitar"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pos-cart-footer">
                            <div className="pos-cart-totals-row">
                                <span>Artículos</span>
                                <span>{totalItems}</span>
                            </div>
                            <div className="pos-cart-totals-row is-total">
                                <span>Total</span>
                                <span>{formatMoney(totalVenta)}</span>
                            </div>
                            <button
                                className="pos-btn-sell"
                                disabled={cart.length === 0}
                                onClick={handleVender}
                            >
                                Vender
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}