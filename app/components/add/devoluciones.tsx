import {
    AlertTriangle,
    ArrowLeftRight,
    Ban,
    CheckCircle2,
    CircleDollarSign,
    HelpCircle,
    Package,
    Receipt,
    RotateCcw,
    X,
    XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "../../css/components/devoluciones.css";
import type { ProductoRow } from "../add/addproducto";
import FormInput from "../FormInput";
import FormSelect from "../FormSelect";
import { calcularImpactoDevolucion, type ImpactoTono } from "../../../src/services/devoluciones.service";

/* ─────────────────────────────────────────────────────────────
   Tipos
   No dependemos de Venta / Venta_Detalle: en un abarrotes nadie
   trae ticket ni sabe un folio, solo sabe qué producto regresó.
   La devolución se registra directo contra el producto, igual
   de "informal" que Ajuste_Inventario.

   El producto se elige de un <select> con la lista ya cargada
   (misma idea que AddEntrada: `productos: ProductoRow[]` viene
   del padre, no se busca por IPC en cada tecla).
──────────────────────────────────────────────────────────────── */
export type MotivoDevolucion =
    | "producto_danado"
    | "producto_caducado"
    | "error_cobro"
    | "cliente_insatisfecho"
    | "otro";

export type AccionDevolucion = "reembolso" | "nota_credito" | "cambio";

const MOTIVOS: { value: MotivoDevolucion; label: string; bloqueaRestock?: boolean }[] = [
    { value: "error_cobro", label: "Error al cobrar / producto equivocado" },
    { value: "cliente_insatisfecho", label: "Cliente no quedó satisfecho" },
    { value: "producto_danado", label: "Producto dañado", bloqueaRestock: true },
    { value: "producto_caducado", label: "Producto caducado", bloqueaRestock: true },
    { value: "otro", label: "Otro motivo" },
];

/* Payload que se envía al confirmar. El guardado real (INSERT en
   Devolucion + Ajuste_Inventario si restock=true) lo hace el
   componente padre a través de onSave. */
export interface DevolucionPayload {
    id_producto: string;
    producto_nombre: string;
    cantidad_devuelta: number;
    precio_unitario: number;
    monto_devuelto: number;
    motivo: MotivoDevolucion;
    observaciones: string | null;
    accion: AccionDevolucion;
    /** Si true, las unidades regresan a Inventario.cantidad_total. */
    restock: boolean;
}

interface DevolucionesProps {
    isOpen: boolean;
    onClose: () => void;
    /** Catálogo ya cargado por el padre (mismo prop que recibe
     *  AddEntrada) — aquí solo se filtran los activos. Opcional
     *  porque el padre puede montar el modal antes de que termine
     *  de cargar el catálogo (ej. primer render / fetch en curso). */
    productos?: ProductoRow[];
    onSave: (payload: DevolucionPayload) => Promise<void> | void;
}

/* ─────────────────────────────────────────────────────────────
   Toasts — notificación flotante para el resultado final
   (éxito/error) de la devolución. Self-contained: este modal no
   depende de ningún ToastProvider global, así que vive y se
   destruye junto con él (no hace falta montarlo en otro lado).
──────────────────────────────────────────────────────────────── */
type ToastTipo = "success" | "error";
interface ToastItem {
    id: number;
    tipo: ToastTipo;
    mensaje: string;
}

const IMPACTO_ESTILOS: Record<ImpactoTono, { background: string; border: string; color: string }> = {
    danger: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", color: "#b91c1c" },
    warning: { background: "rgba(234,179,8,0.10)", border: "1px solid rgba(234,179,8,0.35)", color: "#a16207" },
    success: { background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.35)", color: "#15803d" },
};

/* ─────────────────────────────────────────────────────────────
   Componente
──────────────────────────────────────────────────────────────── */
export default function Devoluciones({ isOpen, onClose, productos = [], onSave }: DevolucionesProps) {
    const [productoId, setProductoId] = useState("");

    const [cantidad, setCantidad] = useState("1");
    const [precioUnitario, setPrecioUnitario] = useState("");
    const [motivo, setMotivo] = useState<MotivoDevolucion | "">("");
    const [accion, setAccion] = useState<AccionDevolucion>("reembolso");
    const [restock, setRestock] = useState(true);
    const [observaciones, setObservaciones] = useState("");

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const toastTimers = useRef<Map<number, number>>(new Map());

    // String(...) en ambos lados: si id_producto llega en un tipo distinto
    // a como quedó productoId (ej. viene de un <select> del DOM, que
    // siempre entrega string), la comparación estricta nunca hacía match
    // y el panel derecho se quedaba en "Aún no hay producto seleccionado"
    // aunque sí hubiera un producto elegido.
    const producto = productos.find((p) => String(p.id_producto) === String(productoId));

    // Al elegir (o cambiar) producto, precarga el precio actual como
    // punto de partida y reinicia la cantidad — igual que AddEntrada
    // reinicia el escaneo cuando cambia productoId.
    useEffect(() => {
        if (!productoId) return;
        const p = productos.find((x) => String(x.id_producto) === String(productoId));
        setPrecioUnitario(p?.costo_final ? p.costo_final.toFixed(2) : "");
        setCantidad("1");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productoId]);

    // Limpia los timers de los toasts pendientes al desmontar el modal.
    useEffect(() => {
        return () => {
            toastTimers.current.forEach((t) => window.clearTimeout(t));
            toastTimers.current.clear();
        };
    }, []);

    useEffect(() => {
        if (!isOpen) resetForm();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // No podemos cortar en seco con "if (!isOpen) return null" como antes:
    // handleSave llama mostrarToast() y onClose() en la misma función, uno
    // justo después del otro, así que para cuando el toast fuera a
    // mostrarse isOpen ya es false y el componente entero desaparecía —
    // el toast de éxito/error nunca llegaba a verse a menos que el modal
    // siguiera abierto. Mientras haya toasts pendientes, seguimos
    // renderizando (ver el JSX de abajo: el overlay/modal sí respeta
    // isOpen, pero el contenedor de toasts vive fuera de esa condición).
    if (!isOpen && toasts.length === 0) return null;

    function resetForm() {
        setProductoId("");
        setCantidad("1");
        setPrecioUnitario("");
        setMotivo("");
        setAccion("reembolso");
        setRestock(true);
        setObservaciones("");
        setError(null);
    }

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const mostrarToast = (tipo: ToastTipo, mensaje: string) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, tipo, mensaje }]);
        const timer = window.setTimeout(() => cerrarToast(id), 4000);
        toastTimers.current.set(id, timer);
    };

    const cerrarToast = (id: number) => {
        setToasts((t) => t.filter((x) => x.id !== id));
        const timer = toastTimers.current.get(id);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            toastTimers.current.delete(id);
        }
    };

    /* ── Motivo bloquea/desbloquea el regreso a inventario ── */
    const handleMotivoChange = (value: string) => {
        const m = value as MotivoDevolucion;
        setMotivo(m);
        const info = MOTIVOS.find((x) => x.value === m);
        if (info?.bloqueaRestock) setRestock(false);
    };

    const motivoInfo = MOTIVOS.find((m) => m.value === motivo);
    const restockBloqueado = !!motivoInfo?.bloqueaRestock;

    /* ── Cálculo del monto a devolver ── */
    const cantidadNum = parseInt(cantidad) || 0;
    const precioNum = parseFloat(precioUnitario) || 0;
    const montoDevuelto = cantidadNum * precioNum;

    // Consecuencia real de la combinación accion + restock elegida —
    // se recalcula en vivo con cada cambio para que quien registra la
    // devolución vea, ANTES de guardar, si se pierde dinero, producto,
    // o ninguno de los dos (ej. cambio + restock = neutro).
    const impacto = calcularImpactoDevolucion(accion, restock, montoDevuelto);

    const IMPACTO_ICONO: Record<ImpactoTono, typeof AlertTriangle> = {
        danger: XCircle,
        warning: AlertTriangle,
        success: CheckCircle2,
    };
    const ImpactoIcono = IMPACTO_ICONO[impacto.tono];

    const handleSave = async () => {
        try {
            setError(null);

            if (!producto) {
                setError("Selecciona el producto que se va a devolver.");
                return;
            }
            if (cantidadNum <= 0) {
                setError("La cantidad a devolver debe ser mayor a 0.");
                return;
            }
            if (precioNum <= 0) {
                setError("Define el precio unitario a devolver.");
                return;
            }
            if (!motivo) {
                setError("Selecciona el motivo de la devolución.");
                return;
            }

            setIsSaving(true);

            const payload: DevolucionPayload = {
                id_producto: producto.id_producto,
                producto_nombre: producto.nombre,
                cantidad_devuelta: cantidadNum,
                precio_unitario: precioNum,
                monto_devuelto: montoDevuelto,
                motivo,
                observaciones: observaciones.trim() || null,
                accion,
                restock,
            };

            // Aquí se conecta con el backend real (INSERT Devolucion +,
            // si restock=true, Ajuste_Inventario positivo). El padre
            // decide cómo persistirlo.
            await onSave(payload);

            setIsSaving(false);
            mostrarToast(
                "success",
                `Devolución de "${producto.nombre}" registrada. ${impacto.saleDineroAhora ? `Salieron $${montoDevuelto.toFixed(2)} de caja.` : ""} ${restock ? "El producto ya está de vuelta en inventario." : "El producto quedó dado de baja."}`.trim()
            );
            resetForm();
            onClose();
        } catch (err: any) {
            console.error("Error al registrar devolución:", err);
            const mensaje = err?.message || "intenta de nuevo";
            setError("Error al guardar: " + mensaje);
            mostrarToast("error", "No se pudo registrar la devolución: " + mensaje);
            setIsSaving(false);
        }
    };

    return (
        <>
            {isOpen && (
                <div className="dev-overlay">
                    <div className="dev-overlay-backdrop" onClick={handleClose} />
                    <div className="dev-modal">
                        {/* Header */}
                        <div className="dev-header">
                            <div>
                                <h2 className="dev-header-title">Registrar Devolución</h2>
                                <p className="dev-header-subtitle">Elige el producto que el cliente está regresando</p>
                            </div>
                            <button className="dev-close-btn" onClick={handleClose} disabled={isSaving}>
                                <X size={20} />
                            </button>
                        </div>

                        {error && <div className="dev-error">⚠️ {error}</div>}

                        {/* Body — dos columnas: identificación (izq) y dinero (der) */}
                        <div className="dev-body">
                            <div className="dev-grid-2">
                                {/* ── Columna izquierda: Identificación ── */}
                                <div className="dev-section">
                                    <h3 className="dev-section-title">
                                        <Package size={17} />
                                        Identificación
                                    </h3>

                                    <div className="dev-field">
                                        <label className="dev-label">Producto *</label>
                                        <FormSelect
                                            className="dev-select"
                                            value={productoId}
                                            onChange={setProductoId}
                                            options={[
                                                { value: "", label: "Selecciona producto..." },
                                                ...productos
                                                    .filter((p) => p.activo)
                                                    .map((p) => ({
                                                        value: p.id_producto,
                                                        label: `${p.codigo_interno} - ${p.nombre}`,
                                                    })),
                                            ]}
                                        />
                                        {producto && (
                                            <p className="dev-hint">
                                                {producto.codigo_interno || "s/código"} · precio actual $
                                                {(producto.costo_final ?? 0).toFixed(2)}
                                            </p>
                                        )}
                                    </div>

                                    <div className={`dev-field${!producto ? " is-locked" : ""}`}>
                                        <label className="dev-label">Motivo *</label>
                                        <FormSelect
                                            className="dev-select"
                                            value={motivo}
                                            onChange={handleMotivoChange}
                                            options={[
                                                { value: "", label: "Selecciona..." },
                                                ...MOTIVOS.map((m) => ({ value: m.value, label: m.label })),
                                            ]}
                                        />
                                        {!producto && <p className="dev-hint">Elige primero un producto.</p>}
                                    </div>

                                    <div className={`dev-field${!producto ? " is-locked" : ""}`}>
                                        <label className="dev-label">Observaciones</label>
                                        <FormInput
                                            type="textarea"
                                            className="dev-textarea"
                                            placeholder="Notas adicionales sobre la devolución (opcional)"
                                            value={observaciones}
                                            onChange={setObservaciones}
                                            rows={3}
                                        />
                                    </div>

                                    {restockBloqueado && (
                                        <div className="dev-warning-note">
                                            <AlertTriangle size={13} />
                                            Este producto no volverá a estar disponible para la venta.
                                        </div>
                                    )}
                                </div>

                                {/* ── Columna derecha: Datos y Monto ── */}
                                <div className="dev-section">
                                    <h3 className="dev-section-title">
                                        <CircleDollarSign size={17} />
                                        Datos de la Devolución
                                        <span
                                            className="dev-title-help"
                                            title="Cantidad, precio y cómo se resuelve la devolución con el cliente."
                                        >
                                            <HelpCircle size={13} />
                                        </span>
                                    </h3>

                                    {!producto ? (
                                        <div className="dev-empty-state">
                                            <div className="dev-empty-state-icon">
                                                <CircleDollarSign size={22} />
                                            </div>
                                            <p className="dev-empty-state-title">Aún no hay producto seleccionado</p>
                                            <p className="dev-empty-state-text">
                                                Elige un producto del lado izquierdo para capturar cantidad, precio y el resto
                                                de los datos de la devolución.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="dev-row-2">
                                                <div className="dev-field">
                                                    <label className="dev-label">Cantidad *</label>
                                                    <FormInput
                                                        type="number"
                                                        min="1"
                                                        className="dev-input"
                                                        value={cantidad}
                                                        onChange={setCantidad}
                                                    />
                                                </div>
                                                <div className="dev-field">
                                                    <label className="dev-label">Precio Unitario *</label>
                                                    <FormInput
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        placeholder="0.00"
                                                        className="dev-input"
                                                        wrapperClassName="dev-input-money-wrap"
                                                        iconLeft={<span className="dev-currency">$</span>}
                                                        value={precioUnitario}
                                                        onChange={setPrecioUnitario}
                                                    />
                                                </div>
                                            </div>

                                            <div className="dev-resumen-box">
                                                <div className="dev-resumen-grid">
                                                    <div className="dev-resumen-cell">
                                                        <p className="dev-resumen-cell-label">Producto</p>
                                                        <p className="dev-resumen-cell-value dev-resumen-cell-value--text">
                                                            {producto.nombre}
                                                        </p>
                                                    </div>
                                                    <div className="dev-resumen-cell">
                                                        <p className="dev-resumen-cell-label">Cantidad</p>
                                                        <p className="dev-resumen-cell-value">{cantidadNum || 0}</p>
                                                    </div>
                                                    <div className="dev-resumen-cell">
                                                        <p className="dev-resumen-cell-label">Precio Unitario</p>
                                                        <p className="dev-resumen-cell-value">${precioNum.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                                <div className="dev-resumen-total">
                                                    <span>Total a Devolver</span>
                                                    <span className="dev-resumen-total-value">${montoDevuelto.toFixed(2)}</span>
                                                </div>
                                            </div>

                                            <div className="dev-field">
                                                <label className="dev-label">¿Cómo se resuelve con el cliente?</label>
                                                <div className="dev-segmented">
                                                    <button
                                                        type="button"
                                                        className={`dev-segmented-btn${accion === "reembolso" ? " is-active" : ""}`}
                                                        onClick={() => setAccion("reembolso")}
                                                    >
                                                        <CircleDollarSign size={14} />
                                                        Reembolso
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`dev-segmented-btn${accion === "nota_credito" ? " is-active" : ""}`}
                                                        onClick={() => setAccion("nota_credito")}
                                                    >
                                                        <Receipt size={14} />
                                                        Nota de crédito
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`dev-segmented-btn${accion === "cambio" ? " is-active" : ""}`}
                                                        onClick={() => setAccion("cambio")}
                                                    >
                                                        <ArrowLeftRight size={14} />
                                                        Cambio
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="dev-active-toggle">
                                                <div>
                                                    <p className="dev-active-toggle-label">
                                                        <RotateCcw size={13} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
                                                        Regresar a Inventario
                                                    </p>
                                                    <p className="dev-active-toggle-sub">
                                                        {restockBloqueado
                                                            ? "Bloqueado: el motivo indica que el producto ya no es vendible."
                                                            : "Suma las unidades devueltas de vuelta al stock."}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className={`dev-switch${restock ? " is-on" : ""}`}
                                                    onClick={() => !restockBloqueado && setRestock((v) => !v)}
                                                    disabled={restockBloqueado}
                                                >
                                                    <span className="dev-switch-knob" />
                                                </button>
                                            </div>

                                            {!restock && (
                                                <div className="dev-subhelp">
                                                    <p className="dev-subhelp-title">
                                                        <Ban size={13} />
                                                        Sin regreso a inventario
                                                    </p>
                                                    <p className="dev-subhelp-text">
                                                        El stock del producto no cambiará. Úsalo cuando la mercancía ya no se
                                                        pueda volver a vender.
                                                    </p>
                                                </div>
                                            )}

                                            {/* ── Impacto de negocio: qué pasa realmente al confirmar,
                                         según la combinación de accion + restock elegida. No es
                                         un campo más del formulario, es un resumen para decidir
                                         con los ojos abiertos ANTES de guardar. Se recalcula en
                                         vivo — cambiar "Reembolso" por "Cambio", o prender/apagar
                                         el switch de arriba, actualiza esto al instante. ── */}
                                            <div
                                                className={`dev-impacto-box tone-${impacto.tono}`}
                                                style={{
                                                    marginTop: 4,
                                                    padding: "10px 12px",
                                                    borderRadius: 8,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 4,
                                                    ...IMPACTO_ESTILOS[impacto.tono],
                                                }}
                                            >
                                                <p
                                                    className="dev-impacto-title"
                                                    style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12, margin: 0 }}
                                                >
                                                    <ImpactoIcono size={14} />
                                                    {impacto.tono === "danger"
                                                        ? "Pérdida total"
                                                        : impacto.tono === "success"
                                                            ? "Sin pérdida"
                                                            : "Pérdida parcial"}
                                                </p>
                                                <p
                                                    className="dev-impacto-linea"
                                                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, margin: 0, opacity: 0.9 }}
                                                >
                                                    <CircleDollarSign size={12} />
                                                    {impacto.dineroTexto}
                                                </p>
                                                <p
                                                    className="dev-impacto-linea"
                                                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, margin: 0, opacity: 0.9 }}
                                                >
                                                    <Package size={12} />
                                                    {impacto.productoTexto}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="dev-footer">
                            <button className="btn btn-ghost" onClick={handleClose} disabled={isSaving}>
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={isSaving || !producto}
                                style={{ display: "flex", alignItems: "center", gap: 8 }}
                            >
                                <RotateCcw size={16} />
                                {isSaving ? "Guardando..." : "Registrar Devolución"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toasts — a propósito FUERA del "isOpen &&" de arriba:
                 así el de éxito/error de handleSave sigue visible aunque
                 el modal ya se haya cerrado. ── */}
            <div className="dev-toast-container">
                {toasts.map((t) => (
                    <div key={t.id} className={`dev-toast tone-${t.tipo}`}>
                        {t.tipo === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        <p className="dev-toast-text">{t.mensaje}</p>
                        <button type="button" className="dev-toast-close" onClick={() => cerrarToast(t.id)}>
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </>
    );
}