import { useEffect, useMemo, useState } from "react";
import FormInput from "../../components/FormInput";
import FormSelect from "../../components/FormSelect";
import ErrorModal from "../../components/modals/ErrorModal";
import WarningModal from "../../components/modals/WarningModal";
import Toast, { useToast } from "../../components/Toast .tsx";
import Pagination, { PAGE_SIZE } from "../../components/pagination";
import Devoluciones, { type DevolucionPayload } from "../../components/add/devoluciones";
import CantidadKilosModal from "../../components/CantidadKilosModal.tsx";
import type { ProductoRow } from "../../components/add/addproducto";
import {
    Search,
    ShoppingCart,
    Plus,
    Minus,
    X,
    PackageX,
    Undo2,
    Banknote,
    CreditCard,
    ArrowLeft,
    CheckCircle2,
    Loader2,
    Percent,
    DollarSign,
} from "lucide-react";
import "../../css/ventas.css";
import { registrarVenta } from "../../../src/services/ventas.service";
import { registrarDevolucion } from "../../../src/services/devoluciones.service";
import { listarProductosInventario, listarProductosParaModal } from "../../../src/services/inventory.service";

/* ─────────────────────────────────────────────────────────────
   Tipos
   El catálogo ya NO es mock: sale de listarProductosInventario()
   (mismo servicio que ya usa Inventory.tsx), que trae familia_nombre
   y cantidad_total — justo lo que necesitan las tarjetas de producto
   (nombre de familia + stock disponible), a diferencia de ProductoRow
   (el shape que usan los modales), que no trae ninguno de los dos.
──────────────────────────────────────────────────────────────── */
interface ProductoVenta {
    id: string;
    nombre: string;
    codigoInterno: string;
    codigoAlterno: string;
    familia: string;
    precio: number;
    stock: number;
    alertLevelStock: 'green' | 'yellow' | 'red' | 'black' | 'none';
    unidad: 'piezas' | 'kilos';
}

interface CartItem {
    producto: ProductoVenta;
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
    const [productos, setProductos] = useState<ProductoVenta[]>([]);
    const [loadingProductos, setLoadingProductos] = useState(true);
    const [errorProductos, setErrorProductos] = useState<string | null>(null);

    // Catálogo aparte, en el shape ProductoRow que pide el modal de
    // Devoluciones (listarProductosInventario trae familia/stock pero
    // no todo lo que ProductoRow exige; listarProductosParaModal sí).
    const [productosDevolucion, setProductosDevolucion] = useState<ProductoRow[]>([]);
    const [devolucionesAbierto, setDevolucionesAbierto] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterFamilia, setFilterFamilia] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [cart, setCart] = useState<CartItem[]>([]);

    // Código alterno escaneado que está registrado en más de un producto:
    // no se puede agregar automáticamente, así que se avisa por modal
    // mientras el catálogo de la izquierda ya quedó filtrado a esos productos.
    const [codigoAlternoDuplicado, setCodigoAlternoDuplicado] = useState<string | null>(null);

    /* ── Carga del catálogo real (conectado a la BD) ── */
    const cargarProductos = async () => {
        setLoadingProductos(true);
        setErrorProductos(null);
        try {
            const rows = await listarProductosInventario();
            setProductos(
                rows
                    .filter((r) => r.activo)
                    .map((r) => ({
                        id: r.id_producto,
                        nombre: r.nombre,
                        codigoInterno: r.codigo_interno ?? "s/código",
                        // Códigos alternos viven en la tabla aparte Codigos_Alternos
                        // (1 producto -> N códigos), no en Producto/ProductoListado.
                        // Se llena por separado más abajo con codigosAlternosPorProducto;
                        // placeholder vacío mientras tanto para no romper el tipo.
                        codigoAlterno: "",
                        familia: r.familia_nombre ?? "Sin familia",
                        precio: r.costo_final ?? 0,
                        stock: r.cantidad_total,
                        alertLevelStock: r.alertLevelStock,
                        unidad: r.unidad,
                    }))
            );
        } catch (err: any) {
            setErrorProductos(err?.message || "No se pudieron cargar los productos.");
        } finally {
            setLoadingProductos(false);
        }
    };

    useEffect(() => {
        cargarProductos();
        listarProductosParaModal().then(setProductosDevolucion).catch(() => { });
    }, []);

    /* Familias reales presentes en el catálogo (ya no inventadas del mock) */
    const FAMILIAS = useMemo(
        () => Array.from(new Set(productos.map((p) => p.familia))).sort((a, b) => a.localeCompare(b)),
        [productos]
    );

    /* Búsqueda: por nombre, código interno o familia */
    const filteredProductos = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return productos.filter((p) => {
            const matchesSearch =
                !term ||
                p.nombre.toLowerCase().includes(term) ||
                p.codigoInterno.toLowerCase().includes(term) ||
                p.codigoAlterno.toLowerCase().includes(term) ||
                p.familia.toLowerCase().includes(term);

            const matchesFamilia = !filterFamilia || p.familia === filterFamilia;

            return matchesSearch && matchesFamilia;
        });
    }, [productos, searchTerm, filterFamilia]);

    // Cambió la búsqueda o el filtro de familia -> regresa a la página 1
    useEffect(() => {
        setPage(1);
    }, [searchTerm, filterFamilia]);

    const productosPagina = useMemo(
        () => filteredProductos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [filteredProductos, page]
    );

    const addToCart = (producto: ProductoVenta) => {
        if (producto.stock <= 0) return;
        setCodigoAlternoDuplicado(null);
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

    // Productos por kilo NO se agregan directo con addToCart (no tiene
    // caso sumar "1 pieza" cuando lo normal es medio kilo, 300g...):
    // se abre el modal para capturar el peso exacto. El clic en la
    // tarjeta del catálogo pasa por aquí en vez de ir directo a
    // addToCart; abrirKilosModal también se reusa para EDITAR una
    // línea ya en el carrito (botón de cantidad en pos-cart-item).
    const [kilosModal, setKilosModal] = useState<{ producto: ProductoVenta; cantidadInicial?: number } | null>(null);

    const handleProductoClick = (producto: ProductoVenta) => {
        if (producto.stock <= 0) return;
        if (producto.unidad === 'kilos') {
            setKilosModal({ producto });
            return;
        }
        addToCart(producto);
    };

    const handleConfirmarKilos = (cantidad: number) => {
        if (!kilosModal) return;
        const { producto } = kilosModal;
        setCodigoAlternoDuplicado(null);
        setCart((prev) => {
            const existing = prev.find((i) => i.producto.id === producto.id);
            if (existing) {
                return prev.map((i) => (i.producto.id === producto.id ? { ...i, cantidad } : i));
            }
            return [...prev, { producto, cantidad }];
        });
        setKilosModal(null);
    };

    /* ── Escaneo por código alterno (pistola de código de barras) ──
       El lector "escribe" el código y termina con Enter, por eso se
       dispara desde el onKeyDown del buscador. Si el código coincide
       con un solo producto, se agrega directo al carrito. Si coincide
       con varios (código alterno duplicado entre productos), no se
       puede saber cuál es el correcto: se deja el catálogo de la
       izquierda filtrado a esos productos y se avisa por modal para
       que el usuario elija manualmente cuál agregar. */
    const handleEscanearCodigo = (codigo: string) => {
        const term = codigo.trim();
        if (!term) return;

        const coincidencias = productos.filter(
            (p) => p.codigoAlterno && p.codigoAlterno.toLowerCase() === term.toLowerCase()
        );

        if (coincidencias.length === 1) {
            handleProductoClick(coincidencias[0]);
            setSearchTerm("");
            setFilterFamilia(null);
            return;
        }

        if (coincidencias.length > 1) {
            setSearchTerm(term);
            setFilterFamilia(null);
            setCodigoAlternoDuplicado(term);
        }
        // Si no hay coincidencia exacta por código alterno, el texto ya
        // quedó en el buscador (onChange) y sigue la búsqueda normal
        // por nombre / código interno / familia.
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

    /* ── Pago ── */
    type PagoStep = "cart" | "checkout" | "done";
    type MetodoPago = "efectivo" | "tarjeta";
    type TipoCargo = "porcentaje" | "fijo";

    const [pagoStep, setPagoStep] = useState<PagoStep>("cart");
    const [metodoPago, setMetodoPago] = useState<MetodoPago | null>(null);
    const [montoPagado, setMontoPagado] = useState("");
    const [isVendiendo, setIsVendiendo] = useState(false);

    // Doble confirmación al cobrar: WarningModal antes de registrar la
    // venta, Toast después de que quedó guardada (mismo patrón que
    // Inventory.tsx: productoAccion/confirmAccionProducto + showToast).
    const [confirmVentaAbierto, setConfirmVentaAbierto] = useState(false);
    const { toast, showToast } = useToast();
    const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
        isOpen: false,
        title: "",
        message: "",
    });
    const showError = (title: string, message: string) => setErrorModal({ isOpen: true, title, message });

    // Cargo por terminal — persistido en localStorage
    const [cargoValor, setCargoValor] = useState<string>(() =>
        localStorage.getItem("pos_cargo_valor") ?? ""
    );
    const [cargoTipo, setCargoTipo] = useState<TipoCargo>(() =>
        (localStorage.getItem("pos_cargo_tipo") as TipoCargo) ?? "porcentaje"
    );

    useEffect(() => {
        localStorage.setItem("pos_cargo_valor", cargoValor);
        localStorage.setItem("pos_cargo_tipo", cargoTipo);
    }, [cargoValor, cargoTipo]);

    // Cálculos de cargo
    const cargoNum = parseFloat(cargoValor) || 0;
    const cargoMonto = metodoPago === "tarjeta" && cargoNum > 0
        ? cargoTipo === "porcentaje"
            ? totalVenta * (cargoNum / 100)
            : cargoNum
        : 0;
    const totalConCargo = totalVenta + cargoMonto;

    // Efectivo: cambio a devolver
    const montoPagadoNum = parseFloat(montoPagado) || 0;
    const cambio = montoPagadoNum - totalConCargo;
    const pagoCubierto = metodoPago === "tarjeta" || montoPagadoNum >= totalConCargo;

    const handleIrACobrar = () => {
        if (cart.length === 0) return;
        setPagoStep("checkout");
        setMetodoPago(null);
        setMontoPagado("");
    };

    const handleVolver = () => {
        setPagoStep("cart");
        setMetodoPago(null);
        setMontoPagado("");
    };

    const handleVender = async () => {
        if (!metodoPago || !pagoCubierto || isVendiendo) return;
        setIsVendiendo(true);
        try {
            await registrarVenta({
                metodo_pago: metodoPago,
                total: totalConCargo,
                monto_recibido: metodoPago === "efectivo" ? montoPagadoNum : undefined,
                cargo_terminal: cargoMonto,
                detalles: cart.map((i) => ({
                    id_producto: i.producto.id,
                    cantidad: i.cantidad,
                    precio_unitario: i.producto.precio,
                })),
            });
            setPagoStep("done");
            cargarProductos(); // refresca stock tras la venta
            showToast("success", "Venta registrada exitosamente.");
        } catch (err) {
            showError("Error al vender", err instanceof Error ? err.message : "No se pudo registrar la venta.");
        } finally {
            setIsVendiendo(false);
        }
    };

    // Primer paso de la doble confirmación: solo abre el aviso.
    // handleVender (el que de verdad cobra) corre hasta que se confirma.
    const handlePedirConfirmacionVenta = () => {
        if (!metodoPago || !pagoCubierto || isVendiendo) return;
        setConfirmVentaAbierto(true);
    };

    const handleNuevaVenta = () => {
        clearCart();
        setPagoStep("cart");
        setMetodoPago(null);
        setMontoPagado("");
    };

    const handleGuardarDevolucion = async (payload: DevolucionPayload) => {
        await registrarDevolucion(payload);
        cargarProductos(); // si hubo restock, el stock cambió
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
                    <button
                        className="btn btn-ghost"
                        style={{ display: "flex", alignItems: "center", gap: 8 }}
                        onClick={() => setDevolucionesAbierto(true)}
                    >
                        <Undo2 size={16} />
                        <span>Registrar devolución</span>
                    </button>
                </div>

                {errorProductos && (
                    <div className="pos-catalog-error">
                        ⚠️ {errorProductos}{" "}
                        <button type="button" className="pos-catalog-error-retry" onClick={cargarProductos}>
                            Reintentar
                        </button>
                    </div>
                )}

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
                                    onChange={setSearchTerm}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleEscanearCodigo(searchTerm);
                                    }}
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
                                        ...FAMILIAS.map(nombre => ({ value: nombre, label: nombre }))
                                    ]}
                                />
                            </div>
                        </div>

                        <div className="pos-product-grid">
                            {loadingProductos ? (
                                <div className="pos-empty-catalog">
                                    <Loader2 size={30} className="pos-spin" />
                                    <span>Cargando productos…</span>
                                </div>
                            ) : filteredProductos.length === 0 ? (
                                <div className="pos-empty-catalog">
                                    <PackageX size={36} />
                                    <span>No se encontraron productos con esa búsqueda</span>
                                </div>
                            ) : (
                                productosPagina.map((p) => {
                                    const isOut = p.stock <= 0 || p.alertLevelStock === 'black';
                                    const isDanger = p.alertLevelStock === 'red';
                                    const isWarning = p.alertLevelStock === 'yellow';

                                    let toneClass = "";
                                    if (isDanger) toneClass = " tone-low";
                                    else if (isWarning) toneClass = " tone-warning";

                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            className={`pos-product-card${isOut ? " is-out" : ""}`}
                                            onClick={() => handleProductoClick(p)}
                                            disabled={isOut}
                                            title={isOut ? "Sin existencia" : p.unidad === "kilos" ? "Elegir cantidad" : "Agregar a la venta"}
                                        >
                                            <span className="pos-product-add-badge">
                                                <Plus size={14} />
                                            </span>
                                            <span className="pos-product-familia-badge">{p.familia}</span>
                                            <span className="pos-product-name">{p.nombre}</span>
                                            <div className="pos-product-footer">
                                                <span className="pos-product-price">
                                                    {formatMoney(p.precio)}{p.unidad === "kilos" ? " / kg" : ""}
                                                </span>
                                                <span className={`pos-product-stock${toneClass}`}>
                                                    <span className="pos-product-stock-dot" />
                                                    {isOut ? "Agotado" : `${p.stock} disp.`}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {!loadingProductos && filteredProductos.length > 0 && (
                            <Pagination page={page} totalItems={filteredProductos.length} onPageChange={setPage} />
                        )}
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
                                                {formatMoney(item.producto.precio)} {item.producto.unidad === "kilos" ? "/ kg" : "c/u"}
                                            </div>
                                        </div>

                                        {item.producto.unidad === "kilos" ? (
                                            <button
                                                className="pos-qty-btn"
                                                style={{ width: "auto", padding: "0 10px", fontSize: 12, fontWeight: 700 }}
                                                onClick={() => setKilosModal({ producto: item.producto, cantidadInicial: item.cantidad })}
                                                title="Editar cantidad"
                                            >
                                                {item.cantidad} kg
                                            </button>
                                        ) : (
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
                                        )}

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
                            {/* ── Estado: venta confirmada ── */}
                            {pagoStep === "done" ? (
                                <div className="pos-checkout-done">
                                    <CheckCircle2 size={40} className="pos-done-icon" />
                                    <p className="pos-done-title">¡Venta registrada!</p>
                                    {metodoPago === "efectivo" && cambio > 0 && (
                                        <div className="pos-done-cambio">
                                            <span>Cambio a entregar</span>
                                            <span className="pos-done-cambio-amount">{formatMoney(cambio)}</span>
                                        </div>
                                    )}
                                    <button className="pos-btn-sell" onClick={handleNuevaVenta}>
                                        Nueva venta
                                    </button>
                                </div>
                            ) : pagoStep === "checkout" ? (
                                /* ── Estado: selección de método de pago ── */
                                <div className="pos-checkout-panel">
                                    <button className="pos-checkout-back" onClick={handleVolver}>
                                        <ArrowLeft size={14} /> Regresar
                                    </button>

                                    {/* Subtotal */}
                                    <div className="pos-cart-totals-row">
                                        <span>Subtotal</span>
                                        <span>{formatMoney(totalVenta)}</span>
                                    </div>

                                    {/* Método de pago */}
                                    <p className="pos-checkout-label">Método de pago</p>
                                    <div className="pos-metodo-btns">
                                        <button
                                            className={`pos-metodo-btn${metodoPago === "efectivo" ? " active" : ""}`}
                                            onClick={() => { setMetodoPago("efectivo"); setMontoPagado(""); }}
                                        >
                                            <Banknote size={18} />
                                            Efectivo
                                        </button>
                                        <button
                                            className={`pos-metodo-btn${metodoPago === "tarjeta" ? " active" : ""}`}
                                            onClick={() => setMetodoPago("tarjeta")}
                                        >
                                            <CreditCard size={18} />
                                            Tarjeta / Trans.
                                        </button>
                                    </div>

                                    {/* Cargo por terminal — solo tarjeta */}
                                    {metodoPago === "tarjeta" && (
                                        <div className="pos-cargo-row">
                                            <span className="pos-checkout-label" style={{ marginBottom: 0 }}>
                                                Cargo terminal (opcional)
                                            </span>
                                            <div className="pos-cargo-inputs">
                                                <button
                                                    className={`pos-cargo-tipo-btn${cargoTipo === "porcentaje" ? " active" : ""}`}
                                                    onClick={() => setCargoTipo("porcentaje")}
                                                    title="Porcentaje"
                                                >
                                                    <Percent size={13} />
                                                </button>
                                                <button
                                                    className={`pos-cargo-tipo-btn${cargoTipo === "fijo" ? " active" : ""}`}
                                                    onClick={() => setCargoTipo("fijo")}
                                                    title="Monto fijo"
                                                >
                                                    <DollarSign size={13} />
                                                </button>
                                                <FormInput
                                                    min={0}
                                                    step={cargoTipo === "porcentaje" ? 0.5 : 1}
                                                    placeholder={cargoTipo === "porcentaje" ? "% cargo" : "$ cargo"}
                                                    value={cargoValor}
                                                    onChange={setCargoValor}
                                                    className="pos-cargo-input"
                                                />
                                            </div>
                                            {cargoMonto > 0 && (
                                                <div className="pos-cart-totals-row pos-cargo-desglose">
                                                    <span>
                                                        Cargo terminal
                                                        {cargoTipo === "porcentaje" ? ` (${cargoNum}%)` : ""}
                                                    </span>
                                                    <span>+{formatMoney(cargoMonto)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Campo de monto — solo efectivo */}
                                    {metodoPago === "efectivo" && (
                                        <div className="pos-efectivo-row">
                                            <label className="pos-checkout-label">
                                                Dinero recibido
                                            </label>
                                            <FormInput
                                                autoFocus
                                                min={0}
                                                step={0.5}
                                                placeholder="$0.00"
                                                value={montoPagado}
                                                onChange={setMontoPagado}
                                                className="pos-monto-input"
                                                onKeyDown={(e) => { if (e.key === "Enter" && pagoCubierto) handlePedirConfirmacionVenta(); }}
                                            />
                                            {montoPagadoNum > 0 && (
                                                <div className={`pos-cambio-row${cambio < 0 ? " insuficiente" : ""}`}>
                                                    <span>{cambio < 0 ? "Falta" : "Cambio"}</span>
                                                    <span className="pos-cambio-amount">
                                                        {formatMoney(Math.abs(cambio))}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Total con cargo */}
                                    <div className="pos-cart-totals-row is-total">
                                        <span>Total a cobrar</span>
                                        <span>{formatMoney(totalConCargo)}</span>
                                    </div>

                                    <button
                                        className="pos-btn-sell"
                                        disabled={!metodoPago || !pagoCubierto || isVendiendo}
                                        onClick={handlePedirConfirmacionVenta}
                                    >
                                        {isVendiendo
                                            ? <><Loader2 size={16} className="pos-spin" /> Procesando…</>
                                            : metodoPago === "efectivo"
                                                ? <><Banknote size={16} /> Confirmar cobro</>
                                                : <><CreditCard size={16} /> Confirmar pago</>
                                        }
                                    </button>
                                </div>
                            ) : (
                                /* ── Estado: carrito normal ── */
                                <>
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
                                        onClick={handleIrACobrar}
                                    >
                                        Cobrar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            <Devoluciones
                isOpen={devolucionesAbierto}
                onClose={() => setDevolucionesAbierto(false)}
                productos={productosDevolucion}
                onSave={handleGuardarDevolucion}
            />

            <CantidadKilosModal
                isOpen={kilosModal !== null}
                onClose={() => setKilosModal(null)}
                onConfirm={handleConfirmarKilos}
                nombreProducto={kilosModal?.producto.nombre ?? ""}
                precioUnitario={kilosModal?.producto.precio ?? 0}
                stockDisponible={kilosModal?.producto.stock ?? 0}
                cantidadInicial={kilosModal?.cantidadInicial}
            />

            <ErrorModal
                isOpen={codigoAlternoDuplicado !== null}
                onClose={() => setCodigoAlternoDuplicado(null)}
                title="Código duplicado"
                message={
                    <>
                        Hay más de un producto registrado con el código alterno{" "}
                        <strong>{codigoAlternoDuplicado}</strong>. Filtré el catálogo
                        de la izquierda a esos productos: elige manualmente cuál
                        agregar a la venta.
                    </>
                }
            />

            <WarningModal
                isOpen={confirmVentaAbierto}
                onClose={() => setConfirmVentaAbierto(false)}
                onConfirm={() => {
                    setConfirmVentaAbierto(false);
                    handleVender();
                }}
                title="Confirmar venta"
                message={`¿Confirmas la venta por ${formatMoney(totalConCargo)}${metodoPago === "efectivo" ? "?" : ` con tarjeta/transferencia?`}`}
            />

            <ErrorModal
                isOpen={errorModal.isOpen}
                onClose={() => setErrorModal((prev) => ({ ...prev, isOpen: false }))}
                title={errorModal.title}
                message={errorModal.message}
            />

            <Toast toast={toast} />
        </div>
    );
}