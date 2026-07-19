import { AlertTriangle, Archive, DollarSign, HelpCircle, Info, Tag, TrendingUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import "../../css/components/addproducto.css";
import FormInput from "../FormInput";
import FormSelect from "../FormSelect";

/* ─────────────────────────────────────────────────────────────
   Tipos — reflejan directamente las tablas del esquema MySQL
   (Familia, Margenes, Impuestos, Producto, Codigos_Alternos)
──────────────────────────────────────────────────────────────── */
export interface FamiliaRow {
    id_familia: string;
    nombre: string;
    digitos: number; // ancho del folio secuencial dentro de la familia
}

export interface MargenRow {
    id_margenes: string;
    nombre: string;
    porcentaje: number;
}

export interface ImpuestoRow {
    id_impuestos: string;
    nombre: string;
    porcentaje: number;
}

export interface CodigoAlternoRow {
    id_codigo?: string;
    codigo: string;
}

export interface ProductoRow {
    id_producto: string;
    id_familia: string | null;
    codigo_interno: string | null;
    nombre: string;
    descripcion: string | null;
    costo_referencia: number;
    id_margenes: string | null;
    id_impuestos: string | null;
    costo_final: number | null;
    umbral_rojo_dias: number;
    umbral_amarillo_dias: number;
    umbral_rojo_stock: number | null;
    umbral_amarillo_stock: number | null;
    meta_estanteria: number | null;
    activo: boolean;
    codigos_alternos?: CodigoAlternoRow[];
}

/* Payload que se envía al guardar (INSERT/UPDATE de Producto +
   Codigos_Alternos). El guardado real vía IPC/API lo hace el
   componente padre a través de onSave. */
export interface ProductoPayload {
    id_producto?: string;
    id_familia: string | null;
    codigo_interno: string;
    nombre: string;
    descripcion: string | null;
    costo_referencia: number;
    id_margenes: string | null;
    id_impuestos: string | null;
    costo_final: number;
    umbral_rojo_dias: number;
    umbral_amarillo_dias: number;
    umbral_rojo_stock: number | null;
    umbral_amarillo_stock: number | null;
    meta_estanteria: number | null;
    activo: boolean;
    codigos_alternos: string[];
}

interface AddProductoProps {
    isOpen: boolean;
    onClose: () => void;
    familias: FamiliaRow[];
    margenes: MargenRow[];
    impuestos: ImpuestoRow[];
    /* Productos ya existentes: solo se usan para calcular el
       siguiente folio disponible dentro de una familia. */
    productosExistentes?: Pick<ProductoRow, "id_familia" | "codigo_interno">[];
    editProduct?: ProductoRow | null;
    onSave: (payload: ProductoPayload) => Promise<void> | void;
}

/* ─────────────────────────────────────────────────────────────
   Componente
──────────────────────────────────────────────────────────────── */
export default function AddProducto({
    isOpen,
    onClose,
    familias,
    margenes,
    impuestos,
    productosExistentes = [],
    editProduct,
    onSave,
}: AddProductoProps) {
    const [nombre, setNombre] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [familiaId, setFamiliaId] = useState("");
    const [codigoInterno, setCodigoInterno] = useState("");
    const [margenId, setMargenId] = useState("");
    const [impuestoId, setImpuestoId] = useState("");

    const [costoReferencia, setCostoReferencia] = useState("");
    const [ultimoCosto, setUltimoCosto] = useState(0);
    const [costoFinalManual, setCostoFinalManual] = useState("");

    const [codigosAlternos, setCodigosAlternos] = useState<string[]>([]);

    const [umbralRojo, setUmbralRojo] = useState("7");
    const [umbralAmarillo, setUmbralAmarillo] = useState("15");

    const [umbralStockRojo, setUmbralStockRojo] = useState("3");
    const [umbralStockAmarillo, setUmbralStockAmarillo] = useState("8");
    const [metaEstanteria, setMetaEstanteria] = useState("5");

    const [activo, setActivo] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && editProduct) {
            setNombre(editProduct.nombre || "");
            setDescripcion(editProduct.descripcion || "");
            setFamiliaId(editProduct.id_familia || "");
            setCodigoInterno(editProduct.codigo_interno || "");
            setMargenId(editProduct.id_margenes || "");
            setImpuestoId(editProduct.id_impuestos || "");
            setCostoReferencia(String(editProduct.costo_referencia ?? ""));
            setUltimoCosto(editProduct.costo_referencia || 0);
            setCostoFinalManual(
                editProduct.costo_final != null ? String(editProduct.costo_final) : ""
            );
            setCodigosAlternos(
                (editProduct.codigos_alternos || []).map((c) => c.codigo)
            );
            setUmbralRojo(String(editProduct.umbral_rojo_dias ?? 7));
            setUmbralAmarillo(String(editProduct.umbral_amarillo_dias ?? 15));
            setUmbralStockRojo(String(editProduct.umbral_rojo_stock ?? 3));
            setUmbralStockAmarillo(String(editProduct.umbral_amarillo_stock ?? 8));
            setMetaEstanteria(String(editProduct.meta_estanteria ?? 5));
            setActivo(editProduct.activo ?? true);
        } else if (!isOpen) {
            resetForm();
        }
    }, [isOpen, editProduct]);

    if (!isOpen) return null;

    function resetForm() {
        setNombre("");
        setDescripcion("");
        setFamiliaId("");
        setCodigoInterno("");
        setMargenId("");
        setImpuestoId("");
        setCostoReferencia("");
        setUltimoCosto(0);
        setCostoFinalManual("");
        setCodigosAlternos([]);
        setUmbralRojo("7");
        setUmbralAmarillo("15");
        setUmbralStockRojo("3");
        setUmbralStockAmarillo("8");
        setMetaEstanteria("5");
        setActivo(true);
        setError(null);
    }

    /* Autogenera codigo_interno: 2 dígitos de posición de familia +
       folio secuencial con el ancho definido en Familia.digitos.
       Ej. familia #1 con digitos=2 -> "01" + "01" = "0101" */
    const handleFamiliaChange = (selectedFamiliaId: string) => {
        setFamiliaId(selectedFamiliaId);
        if (!selectedFamiliaId) {
            setCodigoInterno("");
            return;
        }

        const idx = familias.findIndex((f) => f.id_familia === selectedFamiliaId);
        if (idx === -1) return;
        const familia = familias[idx];
        const prefijo = String(idx + 1).padStart(2, "0");

        let maxFolio = 0;
        productosExistentes
            .filter((p) => p.id_familia === selectedFamiliaId)
            .forEach((p) => {
                const cod = p.codigo_interno || "";
                if (cod.startsWith(prefijo)) {
                    const folioNum = parseInt(cod.substring(prefijo.length), 10);
                    if (!isNaN(folioNum) && folioNum > maxFolio) maxFolio = folioNum;
                }
            });

        const siguiente = String(maxFolio + 1).padStart(familia.digitos || 2, "0");
        setCodigoInterno(`${prefijo}${siguiente}`);
    };

    /* ── Calculadora fiscal (solo referencia) ── */
    const costoNum = parseFloat(costoReferencia) || 0;
    const margenPct = margenes.find((m) => m.id_margenes === margenId)?.porcentaje || 0;
    const impuestoPct = impuestos.find((i) => i.id_impuestos === impuestoId)?.porcentaje || 0;
    const precioConMargen = costoNum > 0 ? costoNum * (1 + margenPct / 100) : 0;
    const precioSugerido = precioConMargen > 0 ? precioConMargen * (1 + impuestoPct / 100) : 0;
    const utilidadBruta = precioConMargen - costoNum;
    const aplicarPrecioSugerido = () => {
        setCostoFinalManual(precioSugerido.toFixed(2));
    };

    const handleSave = async () => {
        try {
            setError(null);

            if (!nombre.trim() || !codigoInterno.trim()) {
                setError("Por favor llena los campos obligatorios (Nombre y Código Interno).");
                return;
            }

            const costoFinal = parseFloat(costoFinalManual) || 0;
            if (costoFinal <= 0) {
                setError("Define el Precio de Venta.");
                return;
            }

            setIsSaving(true);

            const payload: ProductoPayload = {
                id_producto: editProduct?.id_producto,
                id_familia: familiaId || null,
                codigo_interno: codigoInterno.trim(),
                nombre: nombre.trim(),
                descripcion: descripcion.trim() || null,
                costo_referencia: costoNum,
                id_margenes: margenId || null,
                id_impuestos: impuestoId || null,
                costo_final: costoFinal,
                umbral_rojo_dias: parseInt(umbralRojo) || 7,
                umbral_amarillo_dias: parseInt(umbralAmarillo) || 15,
                umbral_rojo_stock: umbralStockRojo.trim() ? parseInt(umbralStockRojo) : null,
                umbral_amarillo_stock: umbralStockAmarillo.trim() ? parseInt(umbralStockAmarillo) : null,
                meta_estanteria: metaEstanteria.trim() ? parseInt(metaEstanteria) : null,
                activo,
                codigos_alternos: codigosAlternos,
            };

            // Aquí se conecta con el backend real (ej. sp_registrar_producto /
            // sp_actualizar_producto vía IPC). El padre decide cómo persistirlo.
            await onSave(payload);

            setIsSaving(false);
            resetForm();
            onClose();
        } catch (err: any) {
            console.error("Error al guardar producto:", err);
            setError("Error al guardar: " + (err?.message || "intenta de nuevo"));
            setIsSaving(false);
        }
    };

    return (
        <div className="aip-overlay">
            <div className="aip-overlay-backdrop" onClick={onClose} />
            <div className="aip-modal">
                {/* Header */}
                <div className="aip-header">
                    <div>
                        <h2 className="aip-header-title">
                            {editProduct ? "Editar Producto" : "Agregar Nuevo Producto"}
                        </h2>
                        <p className="aip-header-subtitle">
                            Define la identidad del producto en el catálogo
                        </p>
                    </div>
                    <button className="aip-close-btn" onClick={onClose} disabled={isSaving}>
                        <X size={20} />
                    </button>
                </div>

                {error && <div className="aip-error">⚠️ {error}</div>}

                {/* Body */}
                <div className="aip-body">
                    <div className="aip-grid-2">

                        {/* ── Información General ── */}
                        <div className="aip-section">
                            <h3 className="aip-section-title">
                                <Info size={17} />
                                Información General
                            </h3>

                            <div className="aip-field">
                                <label className="aip-label">Nombre del Producto *</label>
                                <FormInput
                                    type="text"
                                    className="aip-input"
                                    placeholder="Ej. Harina Selecta Alta Proteína 25kg"
                                    value={nombre}
                                    onChange={setNombre}
                                />
                            </div>

                            <div className="aip-row-2">
                                <div className="aip-field">
                                    <label className="aip-label">Familia</label>
                                    <FormSelect
                                        className="aip-select"
                                        value={familiaId}
                                        onChange={handleFamiliaChange}
                                        options={[
                                            { value: "", label: "Selecciona..." },
                                            ...familias.map((f, idx) => ({
                                                value: f.id_familia,
                                                label: `${String(idx + 1).padStart(2, "0")}-${f.nombre}`,
                                            })),
                                        ]}
                                    />
                                </div>
                                <div className="aip-field">
                                    <label className="aip-label">Código Interno *</label>
                                    <FormInput
                                        type="text"
                                        className="aip-input"
                                        placeholder="Ej. 0101"
                                        value={codigoInterno}
                                        onChange={setCodigoInterno}
                                    />
                                </div>
                            </div>

                            <div className="aip-field">
                                <label className="aip-label">Descripción</label>
                                <FormInput
                                    type="textarea"
                                    className="aip-textarea"
                                    placeholder="Notas u observaciones del producto (opcional)"
                                    value={descripcion}
                                    onChange={setDescripcion}
                                    rows={2}
                                />
                            </div>


                            <div className="aip-subhelp">
                                <p className="aip-subhelp-title">
                                    <HelpCircle size={13} />
                                    Umbrales de Caducidad
                                </p>
                                <p className="aip-subhelp-text">
                                    Con cuántos días de anticipación quieres que te avisemos que un producto ya casi caduca.
                                </p>
                            </div>

                            <div className="aip-row-2">
                                <div className="aip-field">
                                    <label className="aip-label" title="Días antes de caducar para marcarlo en riesgo (rojo)">
                                        🔴 Umbral Riesgo (días)
                                    </label>
                                    <FormInput
                                        type="number"
                                        min="0"
                                        className="aip-input"
                                        placeholder="7"
                                        value={umbralRojo}
                                        onChange={setUmbralRojo}
                                    />
                                </div>
                                <div className="aip-field">
                                    <label className="aip-label" title="Días antes de caducar para marcarlo en precaución (amarillo)">
                                        🟡 Umbral Precaución (días)
                                    </label>
                                    <FormInput
                                        type="number"
                                        min="0"
                                        className="aip-input"
                                        placeholder="15"
                                        value={umbralAmarillo}
                                        onChange={setUmbralAmarillo}
                                    />
                                </div>
                            </div>

                            <div className="aip-legend">
                                <p className="aip-legend-title">Vista previa de colores en inventario:</p>
                                <div className="aip-legend-row">
                                    <span className="aip-legend-dot tone-green" />
                                    <span>Más de <strong>{umbralAmarillo || "15"}</strong> días (Seguro)</span>
                                </div>
                                <div className="aip-legend-row">
                                    <span className="aip-legend-dot tone-yellow" />
                                    <span>Entre <strong>{umbralRojo || "7"}</strong> y <strong>{umbralAmarillo || "15"}</strong> días (Precaución)</span>
                                </div>
                                <div className="aip-legend-row">
                                    <span className="aip-legend-dot tone-red" />
                                    <span>{umbralRojo || "7"} días o menos (Riesgo)</span>
                                </div>
                                <div className="aip-legend-row">
                                    <span className="aip-legend-dot tone-black" />
                                    <span>Caducado</span>
                                </div>
                            </div>

                            {editProduct && (
                                <div className="aip-active-toggle">
                                    <div>
                                        <div className="aip-active-toggle-label">Producto activo</div>
                                        <p className="aip-active-toggle-sub">
                                            Los productos inactivos no aparecen en Ventas
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className={`aip-switch${activo ? " is-on" : ""}`}
                                        onClick={() => setActivo((a) => !a)}
                                    >
                                        <span className="aip-switch-knob" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── Costos y Precio ── */}
                        <div className="aip-section">
                            <h3 className="aip-section-title">
                                <DollarSign size={17} />
                                Costos y Precio
                            </h3>

                            <div className="aip-row-2">
                                <div className="aip-field">
                                    <label className="aip-label">Costo de Referencia *</label>
                                    <FormInput
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        className="aip-input"
                                        wrapperClassName="aip-input-money-wrap"
                                        iconLeft={<span className="aip-currency">$</span>}
                                        value={costoReferencia}
                                        onChange={setCostoReferencia}
                                    />
                                    <p className="aip-hint">Costo unitario usado para calcular el margen</p>
                                </div>
                                <div className="aip-field">
                                    <label className="aip-label">Categoría de Margen</label>
                                    <FormSelect
                                        className="aip-select"
                                        value={margenId}
                                        onChange={setMargenId}
                                        options={[
                                            { value: "", label: "Sin margen" },
                                            ...margenes.map((m) => ({
                                                value: m.id_margenes,
                                                label: `${m.nombre} (${m.porcentaje}%)`,
                                            })),
                                        ]}
                                    />
                                </div>
                            </div>

                            {ultimoCosto > 0 && (
                                <div className="aip-last-cost">
                                    <div className="aip-last-cost-icon">
                                        <DollarSign size={15} />
                                    </div>
                                    <div>
                                        <p className="aip-last-cost-label">Último Costo Registrado</p>
                                        <p className="aip-last-cost-value">
                                            ${ultimoCosto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="aip-field">
                                <label className="aip-label">Impuesto Aplicable</label>
                                <FormSelect
                                    className="aip-select"
                                    value={impuestoId}
                                    onChange={setImpuestoId}
                                    options={[
                                        { value: "", label: "Sin impuesto (exento)" },
                                        ...impuestos.map((i) => ({
                                            value: i.id_impuestos,
                                            label: `${i.nombre} (${i.porcentaje}%)`,
                                        })),
                                    ]}
                                />
                            </div>



                            <div className="aip-calc-box">
                                <div className="aip-calc-header">
                                    <div className="aip-calc-title">
                                        <TrendingUp size={16} />
                                        Vista Previa de Precio
                                        <span
                                            className="aip-calc-title-help"
                                            title="Aquí te mostramos a cuánto te conviene vender el producto, tomando en cuenta lo que te costó."
                                        >
                                            <HelpCircle size={13} />
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        className="aip-calc-apply"
                                        onClick={aplicarPrecioSugerido}
                                        disabled={costoNum <= 0}
                                        title={costoNum <= 0 ? "Ingresa el Costo de Referencia primero" : undefined}
                                    >
                                        Aplicar como Precio →
                                    </button>
                                </div>
                                <p className="aip-calc-desc">
                                    Te sugerimos un precio de venta justo. Si te gusta, dale a "Aplicar como Precio".
                                </p>

                                <div className="aip-calc-grid">
                                    <div className="aip-calc-cell">
                                        <p className="aip-calc-cell-label">Costo</p>
                                        <p className="aip-calc-cell-value">${costoNum.toFixed(2)}</p>
                                    </div>
                                    <div className="aip-calc-cell">
                                        <p className="aip-calc-cell-label">+ Margen ({margenPct}%)</p>
                                        <p className="aip-calc-cell-value tone-success">
                                            ${utilidadBruta.toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="aip-calc-cell">
                                        <p className="aip-calc-cell-label">+ Impuesto ({impuestoPct}%)</p>
                                        <p className="aip-calc-cell-value tone-warning">
                                            ${(precioSugerido - precioConMargen).toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                                {costoNum <= 0 && (
                                    <p className="aip-calc-hint">Ingresa el Costo de Referencia para calcular el precio sugerido</p>
                                )}
                            </div>

                            <div className="aip-field">
                                <label className="aip-label">Precio de Venta *</label>
                                <FormInput
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    className="aip-input"
                                    wrapperClassName="aip-input-money-wrap"
                                    iconLeft={<span className="aip-currency">$</span>}
                                    value={costoFinalManual}
                                    onChange={setCostoFinalManual}
                                />
                                <p className="aip-hint">Este es el precio que verán los cajeros en Ventas</p>
                            </div>
                        </div>
                    </div>

                    {/* ── Alertas de Stock y Estantería (fuera del grid principal, cards propias) ── */}
                    <div className="aip-grid-2 aip-grid-2--mt">
                        <div className="aip-section">
                            <h3 className="aip-section-title">
                                <AlertTriangle size={17} />
                                Alertas de Inventario
                            </h3>
                            <p className="aip-section-desc">
                                Avísanos cuándo te quedan pocas unidades para que puedas surtir a tiempo.
                            </p>

                            <div className="aip-row-2">
                                <div className="aip-field">
                                    <label className="aip-label" title="Unidades totales (almacén + estantería) o menos para marcarlo en precaución (amarillo)">
                                        🟡 Inventario Bajo
                                    </label>
                                    <FormInput
                                        type="number"
                                        min="0"
                                        className="aip-input"
                                        placeholder="8"
                                        value={umbralStockAmarillo}
                                        onChange={setUmbralStockAmarillo}
                                    />
                                </div>
                                <div className="aip-field">
                                    <label className="aip-label" title="Unidades totales o menos para marcarlo en riesgo (rojo)">
                                        🔴 Inventario Muy Bajo
                                    </label>
                                    <FormInput
                                        type="number"
                                        min="0"
                                        className="aip-input"
                                        placeholder="3"
                                        value={umbralStockRojo}
                                        onChange={setUmbralStockRojo}
                                    />
                                </div>
                            </div>

                            <div className="aip-legend">
                                <p className="aip-legend-title">Vista previa de colores en Inventario:</p>
                                <div className="aip-legend-row">
                                    <span className="aip-legend-dot tone-green" />
                                    <span>Más de <strong>{umbralStockAmarillo || "8"}</strong> unidades (Normal)</span>
                                </div>
                                <div className="aip-legend-row">
                                    <span className="aip-legend-dot tone-yellow" />
                                    <span>Entre <strong>{umbralStockRojo || "3"}</strong> y <strong>{umbralStockAmarillo || "8"}</strong> unidades (Bajo)</span>
                                </div>
                                <div className="aip-legend-row">
                                    <span className="aip-legend-dot tone-red" />
                                    <span>{umbralStockRojo || "3"} unidades o menos (Muy bajo)</span>
                                </div>
                            </div>
                        </div>

                        <div className="aip-section">
                            <h3 className="aip-section-title">
                                <Archive size={17} />
                                Meta de Estantería
                            </h3>
                            <p className="aip-section-desc">
                                Cuántas piezas te gusta ver siempre en el anaquel, aunque tengas más guardado en el almacén.
                            </p>

                            <div className="aip-field">
                                <label className="aip-label" title="Cuántas unidades quieres tener siempre visibles en el anaquel, sin importar cuánto haya en almacén">
                                    🗄️ Meta en Estantería (unidades)
                                </label>
                                <FormInput
                                    type="number"
                                    min="0"
                                    className="aip-input"
                                    placeholder="5"
                                    value={metaEstanteria}
                                    onChange={setMetaEstanteria}
                                />
                                <p className="aip-hint">
                                    Ej. tienes {umbralStockAmarillo || "8"} en almacén pero solo quieres {metaEstanteria || "5"} en estantería —
                                    si baja de eso, avisa "tienes poco"; en 0, "no hay en estantería".
                                </p>
                            </div>

                            <div className="aip-legend">
                                <p className="aip-legend-title">Vista previa — Estantería (meta: {metaEstanteria || "5"}):</p>
                                <div className="aip-legend-row">
                                    <span className="aip-legend-dot tone-green" />
                                    <span>{metaEstanteria || "5"} unidades en anaquel (Completa)</span>
                                </div>
                                <div className="aip-legend-row">
                                    <span className="aip-legend-dot tone-yellow" />
                                    <span>Entre 1 y {metaEstanteria ? Number(metaEstanteria) - 1 : 4} unidades (Tienes poco)</span>
                                </div>
                                <div className="aip-legend-row">
                                    <span className="aip-legend-dot tone-red" />
                                    <span>0 unidades (No hay en estantería)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="aip-footer">
                    <button className="btn btn-ghost" onClick={onClose} disabled={isSaving}>
                        Cancelar
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                        <Tag size={16} />
                        {isSaving ? "Guardando..." : "Guardar Producto"}
                    </button>
                </div>
            </div>
        </div>
    );
}