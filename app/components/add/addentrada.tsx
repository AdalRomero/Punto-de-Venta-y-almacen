import { AlertTriangle, Barcode, Calendar, DollarSign, Package, Plus, Trash2, TrendingUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { WheelEvent } from "react";
import "../../css/components/addentrada.css";
import type { ImpuestoRow, MargenRow, ProductoRow } from "../add/addproducto";
import FormInput from "../FormInput";
import FormSelect from "../FormSelect";

/* ─────────────────────────────────────────────────────────────
   Tipos — reflejan Entrada / Entrada_Detalle / Codigos_Alternos
──────────────────────────────────────────────────────────────── */
export interface CodigoAlternoExistente {
    codigo: string;
    id_producto: string;
}

export interface EntradaDetalleInput {
    cantidad: number;
    fecha_caducidad: string | null; // 'YYYY-MM-DD'
    unidad: "piezas" | "kilos";
    costo_compra: number;
}

/* Cuando el usuario captura más de un costo para la misma entrada
   (ej. 30 piezas a $10 + 20 piezas a $10.50), se guarda este desglose
   aparte para poder consultarlo después — el inventario sigue viendo
   un solo Lote con el costo YA promediado. */
export interface DesgloseCostoInput {
    costo_compra: number;
    cantidad: number;
}

/* Payload que se envía a sp_registrar_entrada + inserts de
   Codigos_Alternos. El guardado real vía IPC lo hace el padre. */
export interface EntradaPayload {
    id_producto: string;
    cantidad_total: number;
    costo_compra_promedio: number;
    detalles: EntradaDetalleInput[];
    codigos_alternos_nuevos: string[];
    /* Presente solo si se capturó más de un costo (para consulta/auditoría). */
    desglose_costos?: DesgloseCostoInput[];
}

interface AddEntradaProps {
    isOpen: boolean;
    onClose: () => void;
    productos: ProductoRow[];
    margenes: MargenRow[];
    impuestos: ImpuestoRow[];
    /* Códigos ya existentes en Codigos_Alternos (de cualquier producto),
       usados para no duplicarlos y para detectar si un código escaneado
       ya pertenece a OTRO producto. */
    codigosAlternosExistentes?: CodigoAlternoExistente[];
    onSave: (payload: EntradaPayload) => Promise<void> | void;
}

function nuevoIdLinea(): string {
    return typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `linea-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* Evita que la rueda del mouse cambie el valor de un input numérico
   cuando el cursor pasa por encima con el campo enfocado (comportamiento
   nativo del navegador, molesto en formularios). */
function bloquearScrollNumero(e: WheelEvent<HTMLInputElement>) {
    e.currentTarget.blur();
}

/* ─────────────────────────────────────────────────────────────
   Componente
──────────────────────────────────────────────────────────────── */
export default function AddEntrada({
    isOpen,
    onClose,
    productos,
    margenes,
    impuestos,
    codigosAlternosExistentes = [],
    onSave,
}: AddEntradaProps) {
    const [productoId, setProductoId] = useState("");
    const [cantidad, setCantidad] = useState("");
    const [unidad, setUnidad] = useState<"piezas" | "kilos">("piezas");
    const [caducidad, setCaducidad] = useState("");

    /* Costo de Adquisición Unitario. Empieza como un solo campo; al pulsar
       "+ más" se agregan líneas adicionales para promediar (ej. compraste
       parte del pedido a un precio y parte a otro). Cuando hay más de una
       línea, cada una se desglosa con su propia cantidad. */
    const [costoLineas, setCostoLineas] = useState<
        { id: string; costo: string; cantidad: string }[]
    >(() => [{ id: nuevoIdLinea(), costo: "", cantidad: "" }]);
    const [lineaActivaId, setLineaActivaId] = useState<string>(() => costoLineas[0].id);
    const esDesglose = costoLineas.length > 1;

    /* Escaneo de códigos alternos:
       - codigosContados: cuántas veces se escaneó cada código en esta sesión (para mostrar "×N")
       - codigosNuevos: los que NO existían antes en Codigos_Alternos y hay que insertar al guardar
       Un código ya existente (de este mismo producto) solo suma cantidad, nunca se duplica. */
    const [currentBarcode, setCurrentBarcode] = useState("");
    const [codigosContados, setCodigosContados] = useState<Record<string, number>>({});
    const [codigosNuevos, setCodigosNuevos] = useState<string[]>([]);
    const [scanError, setScanError] = useState<string | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lineaShakeId, setLineaShakeId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) resetForm();
    }, [isOpen]);

    // Si cambia el producto, los códigos escaneados hasta ahora ya no aplican
    useEffect(() => {
        setCodigosContados({});
        setCodigosNuevos([]);
        setScanError(null);
    }, [productoId]);

    if (!isOpen) return null;

    function resetForm() {
        setProductoId("");
        setCantidad("");
        const primeraLinea = { id: nuevoIdLinea(), costo: "", cantidad: "" };
        setCostoLineas([primeraLinea]);
        setLineaActivaId(primeraLinea.id);
        setUnidad("piezas");
        setCaducidad("");
        setCurrentBarcode("");
        setCodigosContados({});
        setCodigosNuevos([]);
        setScanError(null);
        setError(null);
    }

    const productoSeleccionado = productos.find((p) => p.id_producto === productoId);
    // Último costo de ADQUISICIÓN registrado (de Entrada), no costo_referencia
    // (ese es el que se usa para calcular el precio de venta — cosas distintas).
    const ultimoCosto = productoSeleccionado?.ultimo_costo_compra ?? null;

    // Reinicia y vuelve a disparar la clase de "shake" en la línea indicada,
    // aunque ya estuviera activa en el ciclo anterior (para que se note el
    // ajuste cada vez que se intenta pasar del límite).
    const triggerShakeLinea = (id: string) => {
        setLineaShakeId(null);
        requestAnimationFrame(() => {
            setLineaShakeId(id);
            setTimeout(() => {
                setLineaShakeId((cur) => (cur === id ? null : cur));
            }, 400);
        });
    };

    /* ── Líneas de costo ──
       Cantidad Entrante es el límite del lote: ninguna línea puede hacer
       que la suma se pase de ese límite. Si el usuario captura (a mano o
       escaneando) una cantidad que se pasaría, se ajusta sola al máximo
       disponible y se avisa con un pequeño "shake" en el campo. */
    const updateCostoLinea = (id: string, patch: Partial<{ costo: string; cantidad: string }>) => {
        let patchFinal = patch;

        if (patch.cantidad !== undefined && cantidadNum > 0) {
            const solicitada = parseFloat(patch.cantidad) || 0;
            const sumaOtrasLineas = costoLineas.reduce(
                (sum, l) => (l.id === id ? sum : sum + (parseFloat(l.cantidad) || 0)),
                0
            );
            const maxPermitido = Math.max(0, cantidadNum - sumaOtrasLineas);

            if (solicitada > maxPermitido) {
                patchFinal = { ...patch, cantidad: String(maxPermitido) };
                triggerShakeLinea(id);
            }
        }

        setCostoLineas((prev) => prev.map((l) => (l.id === id ? { ...l, ...patchFinal } : l)));
    };

    const addCostoLinea = () => {
        setCostoLineas((prev) => {
            // Al pasar de 1 a 2 líneas, migramos la cantidad ya capturada en el
            // campo global "Cantidad Entrante" a la primera línea, para no perderla.
            const base =
                prev.length === 1 && !prev[0].cantidad
                    ? [{ ...prev[0], cantidad: cantidad }]
                    : prev;
            const linea = { id: nuevoIdLinea(), costo: "", cantidad: "" };
            setLineaActivaId(linea.id); // la nueva línea se vuelve la activa para escanear
            return [...base, linea];
        });
    };

    const removeCostoLinea = (id: string) => {
        setCostoLineas((prev) => {
            const filtradas = prev.filter((l) => l.id !== id);
            const siguientes = filtradas.length > 0 ? filtradas : [{ id: nuevoIdLinea(), costo: "", cantidad: "" }];
            if (lineaActivaId === id) {
                setLineaActivaId(siguientes[0].id);
            }
            return siguientes;
        });
    };

    // Renderiza una fila de línea de costo. Se reutiliza tanto para las 2
    // líneas visibles como para las que caen en el panel anidado (3ra en
    // adelante), así el modal no crece sin límite.
    const renderLineaDesglose = (linea: { id: string; costo: string; cantidad: string }, idx: number) => {
        const cantidadLinea = parseFloat(linea.cantidad) || 0;
        // Aviso inmediato: una sola línea nunca debería superar el límite
        // total del lote (Cantidad Entrante), ej. límite 4 pero capturas 10.
        const excedeLimite = cantidadNum > 0 && cantidadLinea > cantidadNum;

        return (
            <div
                className={`aen-desglose-row${linea.id === lineaActivaId ? " is-active" : ""}`}
                key={linea.id}
                onFocus={() => setLineaActivaId(linea.id)}
            >
                <div className="aen-desglose-fields">
                    <div className="aen-desglose-field">
                        <label className="aen-desglose-field-label">Costo #{idx + 1}</label>
                        <FormInput
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="aen-input"
                            wrapperClassName="aen-input-money-wrap"
                            iconLeft={<span className="aen-currency">$</span>}
                            value={linea.costo}
                            onChange={(v) => updateCostoLinea(linea.id, { costo: v })}
                            onWheel={bloquearScrollNumero}
                        />
                    </div>
                    <div className="aen-desglose-field">
                        <label className="aen-desglose-field-label">Cantidad</label>
                        <FormInput
                            type="number"
                            min="0"
                            step={unidad === "kilos" ? "0.001" : "1"}
                            placeholder="0"
                            className={`aen-input${excedeLimite ? " is-invalid" : ""}${lineaShakeId === linea.id ? " is-shake" : ""}`}
                            value={linea.cantidad}
                            onChange={(v) => updateCostoLinea(linea.id, { cantidad: v })}
                            onWheel={bloquearScrollNumero}
                        />
                        {excedeLimite && (
                            <p className="aen-desglose-field-error">
                                Supera el límite de {cantidadNum} {unidad}
                            </p>
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    className="aen-desglose-remove"
                    title="Quitar línea"
                    onClick={() => removeCostoLinea(linea.id)}
                >
                    <Trash2 size={14} />
                </button>
            </div>
        );
    };


    /* ── Escanear código: suma 1 a la cantidad siempre.
       Solo se agrega a Codigos_Alternos si es la primera vez que se ve. ── */
    const handleScanCode = () => {
        const code = currentBarcode.trim();
        if (!code) return;
        if (unidad === "kilos") return; // el escaneo no aplica para kilos
        setCurrentBarcode("");
        setScanError(null);

        if (!productoId) {
            setScanError("Selecciona primero un producto para poder escanear.");
            return;
        }

        const existente = codigosAlternosExistentes.find((c) => c.codigo === code);

        if (existente && existente.id_producto !== productoId) {
            setScanError(`El código "${code}" ya pertenece a otro producto.`);
            return;
        }

        const yaVisto = !!existente || codigosNuevos.includes(code);
        if (!yaVisto) {
            setCodigosNuevos((prev) => [...prev, code]);
        }

        setCodigosContados((prev) => ({ ...prev, [code]: (prev[code] || 0) + 1 }));

        if (esDesglose) {
            const lineaDestino = costoLineas.find((l) => l.id === lineaActivaId) || costoLineas[costoLineas.length - 1];
            updateCostoLinea(lineaDestino.id, {
                cantidad: String((parseFloat(lineaDestino.cantidad) || 0) + 1),
            });
        } else {
            setCantidad((prev) => String((parseFloat(prev) || 0) + 1));
        }
    };

    const handleRemoveScan = (code: string) => {
        const currentCount = codigosContados[code] || 0;
        const nextCount = currentCount - 1;

        if (nextCount <= 0) {
            setCodigosContados((prev) => {
                const { [code]: _omit, ...rest } = prev;
                return rest;
            });
            setCodigosNuevos((prev) => prev.filter((c) => c !== code));
        } else {
            setCodigosContados((prev) => ({ ...prev, [code]: nextCount }));
        }

        if (esDesglose) {
            const lineaDestino = costoLineas.find((l) => l.id === lineaActivaId) || costoLineas[costoLineas.length - 1];
            if (lineaDestino) {
                updateCostoLinea(lineaDestino.id, {
                    cantidad: String(Math.max(0, (parseFloat(lineaDestino.cantidad) || 0) - 1)),
                });
            }
        } else {
            setCantidad((prev) => String(Math.max(0, (parseFloat(prev) || 0) - 1)));
        }
    };

    /* ── Totales: si hay desglose, se combinan las líneas; si no, se usa
       el campo simple de costo/cantidad. ── */
    const cantidadDesglose = costoLineas.reduce((sum, l) => sum + (parseFloat(l.cantidad) || 0), 0);
    const inversionDesglose = costoLineas.reduce(
        (sum, l) => sum + (parseFloat(l.cantidad) || 0) * (parseFloat(l.costo) || 0),
        0
    );
    const costoPromedioDesglose = cantidadDesglose > 0 ? inversionDesglose / cantidadDesglose : 0;

    const costoNum = esDesglose ? costoPromedioDesglose : parseFloat(costoLineas[0]?.costo) || 0;
    const diffPerc =
        costoNum > 0 && ultimoCosto ? ((costoNum - ultimoCosto) / ultimoCosto) * 100 : null;
    const showCostoAlerta = diffPerc !== null && Math.abs(diffPerc) >= 10;

    /* ── Aviso de caducidad (usa los umbrales reales del producto) ── */
    let avisoCaducidad: { tone: string; texto: string } | null = null;
    if (productoSeleccionado && caducidad) {
        const hoy = new Date();
        const fechaExp = new Date(caducidad);
        const diasRestantes = Math.ceil(
            (fechaExp.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
        );
        const umbralRojo = productoSeleccionado.umbral_rojo_dias ?? 7;
        const umbralAmarillo = productoSeleccionado.umbral_amarillo_dias ?? 15;

        if (diasRestantes <= 0) {
            avisoCaducidad = { tone: "black", texto: "⚡ Este lote ya está VENCIDO" };
        } else if (diasRestantes <= umbralRojo) {
            avisoCaducidad = { tone: "red", texto: `⚡ RIESGO — caduca en ${diasRestantes} días` };
        } else if (diasRestantes <= umbralAmarillo) {
            avisoCaducidad = { tone: "yellow", texto: `⚡ PRECAUCIÓN — caduca en ${diasRestantes} días` };
        } else {
            avisoCaducidad = { tone: "green", texto: `⚡ SEGURO — caduca en ${diasRestantes} días` };
        }
    }

    /* ── Calculadora / proyección del lote. "Cantidad Entrante" es el
       límite fijo del lote; cuando hay desglose, sus líneas deben sumar
       exactamente esa cantidad (nunca al revés). ── */
    const cantidadNum = parseFloat(cantidad) || 0;
    const restanteDesglose = cantidadNum - cantidadDesglose;
    const margenPct = margenes.find((m) => m.id_margenes === productoSeleccionado?.id_margenes)?.porcentaje || 0;
    const impuestoPct = impuestos.find((i) => i.id_impuestos === productoSeleccionado?.id_impuestos)?.porcentaje || 0;

    const precioConMargen = costoNum > 0 ? costoNum * (1 + margenPct / 100) : 0;
    const precioFinalUnitario = precioConMargen > 0 ? precioConMargen * (1 + impuestoPct / 100) : 0;
    const utilidadPorUnidad = precioConMargen - costoNum;
    const utilidadTotalLote = utilidadPorUnidad * cantidadNum;
    const inversionTotalLote = costoNum * cantidadNum;


    const handleSave = async () => {
        try {
            setError(null);

            if (!productoId) {
                setError("Selecciona un producto.");
                return;
            }
            if (esDesglose) {
                const lineasValidas = costoLineas.filter((l) => (parseFloat(l.cantidad) || 0) > 0);
                if (lineasValidas.length === 0) {
                    setError("Agrega al menos una línea de costo con cantidad mayor a 0.");
                    return;
                }
                if (restanteDesglose !== 0) {
                    setError(
                        restanteDesglose > 0
                            ? `Faltan ${restanteDesglose} ${unidad} por repartir para completar la Cantidad Entrante.`
                            : `El desglose excede la Cantidad Entrante por ${Math.abs(restanteDesglose)} ${unidad}.`
                    );
                    return;
                }
            } else if (!cantidad || !costoLineas[0]?.costo) {
                setError("Por favor llena los campos obligatorios.");
                return;
            }
            if (cantidadNum <= 0) {
                setError("La cantidad debe ser mayor a 0.");
                return;
            }

            setIsSaving(true);

            const payload: EntradaPayload = {
                id_producto: productoId,
                cantidad_total: cantidadNum,
                costo_compra_promedio: costoNum,
                detalles: [
                    {
                        cantidad: cantidadNum,
                        fecha_caducidad: caducidad || null,
                        unidad,
                        costo_compra: costoNum,
                    },
                ],
                codigos_alternos_nuevos: codigosNuevos,
                ...(esDesglose && {
                    desglose_costos: costoLineas
                        .filter((l) => (parseFloat(l.cantidad) || 0) > 0)
                        .map((l) => ({
                            costo_compra: parseFloat(l.costo) || 0,
                            cantidad: parseFloat(l.cantidad) || 0,
                        })),
                }),
            };

            // Aquí se conecta con sp_registrar_entrada vía IPC: se manda un solo
            // Lote con el costo YA promediado (costo_compra_promedio), para no
            // complicar el inventario con varios lotes cuando es una sola entrega.
            // Si hubo desglose (más de un costo capturado), payload.desglose_costos
            // debe guardarse aparte (ej. tabla Entrada_Desglose_Costo o una columna
            // JSON en Entrada) solo para poder consultarlo después — no afecta stock.
            // Los códigos en codigos_alternos_nuevos se insertan en Codigos_Alternos
            // apuntando a id_producto; los que ya existían no se vuelven a insertar.
            await onSave(payload);

            setIsSaving(false);
            resetForm();
            onClose();
        } catch (err: any) {
            console.error("Error registrando entrada:", err);
            setError("Error al guardar: " + (err?.message || "intenta de nuevo"));
            setIsSaving(false);
        }
    };

    return (
        <div className="aen-overlay">
            <div className="aen-overlay-backdrop" onClick={onClose} />
            <div className="aen-modal">
                {/* Header */}
                <div className="aen-header">
                    <div>
                        <h2 className="aen-header-title">Registrar Entrada de Mercancía</h2>
                        <p className="aen-header-subtitle">
                            Ingresa un nuevo lote para un producto existente
                        </p>
                    </div>
                    <button className="aen-close-btn" onClick={onClose} disabled={isSaving}>
                        <X size={20} />
                    </button>
                </div>

                {error && <div className="aen-error">⚠️ {error}</div>}

                {/* Body */}
                <div className="aen-body">
                    <div className="aen-grid-2">

                        {/* ── Identificación ── */}
                        <div className="aen-section">
                            <h3 className="aen-section-title">
                                <Package size={17} />
                                Identificación
                            </h3>

                            <div className="aen-field">
                                <label className="aen-label">Producto *</label>
                                <FormSelect
                                    className="aen-select"
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
                            </div>

                            <div className="aen-row-2">
                                <div className="aen-field">
                                    <label className="aen-label">
                                        <Calendar size={13} />
                                        Caducidad
                                    </label>
                                    <FormInput
                                        type="date"
                                        className="aen-input"
                                        value={caducidad}
                                        onChange={setCaducidad}
                                    />
                                </div>
                                <div className="aen-field">
                                    <label className="aen-label">Unidad</label>
                                    <FormSelect
                                        className="aen-select"
                                        value={unidad}
                                        onChange={(v) => setUnidad(v as "piezas" | "kilos")}
                                        options={[
                                            { value: "piezas", label: "Piezas" },
                                            { value: "kilos", label: "Kilos" },
                                        ]}
                                    />
                                </div>
                            </div>

                            {avisoCaducidad && (
                                <div className={`aen-exp-alert tone-${avisoCaducidad.tone}`}>
                                    {avisoCaducidad.texto}
                                </div>
                            )}

                            {/* Códigos Alternos — escaneo suma stock. No aplica en Kilos:
                                cada escaneo sumaría 1 pieza, no 1 kilo, así que no tiene
                                sentido físico; en ese caso se captura la cantidad a mano. */}
                            {unidad === "kilos" ? (
                                <div className="aen-field">
                                    <label className="aen-label">
                                        <Barcode size={13} />
                                        Códigos Alternos
                                    </label>
                                    <p className="aen-hint">
                                        El escaneo no aplica para productos por Kilos (cada escaneo
                                        sumaría 1 pieza, no 1 kilo). Usa la báscula y captura la
                                        cantidad manualmente en el campo "Cantidad Entrante".
                                    </p>
                                </div>
                            ) : (
                                <div className="aen-field">
                                    <label className="aen-label">
                                        <Barcode size={13} />
                                        Códigos Alternos (Escanear + Enter)
                                    </label>
                                    <FormInput
                                        type="text"
                                        className="aen-input"
                                        placeholder="Escanea o escribe y pulsa Enter..."
                                        value={currentBarcode}
                                        onChange={setCurrentBarcode}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleScanCode();
                                            }
                                        }}
                                    />
                                    <p className="aen-hint">
                                        Cada escaneo suma 1 a la cantidad. Un código nuevo se registra al
                                        producto; uno repetido solo suma stock, sin duplicarse.
                                    </p>
                                    {scanError && <p className="aen-scan-error">{scanError}</p>}

                                    <div className="aen-tag-list">
                                        {Object.entries(codigosContados).map(([code, count]) => {
                                            const esNuevo = codigosNuevos.includes(code);
                                            return (
                                                <div className={`aen-tag${esNuevo ? "" : " is-known"}`} key={code}>
                                                    <span>
                                                        {code}
                                                        {count > 1 ? ` ×${count}` : ""}
                                                    </span>
                                                    <span className={`aen-tag-badge${esNuevo ? "" : " is-known"}`}>
                                                        {esNuevo ? "nuevo" : "ya registrado"}
                                                    </span>
                                                    <button type="button" onClick={() => handleRemoveScan(code)}>
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {Object.keys(codigosContados).length === 0 && (
                                            <span className="aen-tag-empty">
                                                No hay códigos escaneados todavía
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Cantidad y Costo ── */}
                        <div className="aen-section">
                            <h3 className="aen-section-title">
                                <DollarSign size={17} />
                                Cantidad y Costo
                            </h3>

                            <div className="aen-field">
                                <label className="aen-label">Cantidad Entrante *</label>
                                <FormInput
                                    type="number"
                                    min="0"
                                    step={unidad === "kilos" ? "0.001" : "1"}
                                    className="aen-input"
                                    placeholder="0"
                                    value={cantidad}
                                    onChange={setCantidad}
                                    onWheel={bloquearScrollNumero}
                                />
                                <p className="aen-hint">
                                    {esDesglose
                                        ? "Esta es la cantidad total del lote. Repártela entre las líneas de costo de abajo hasta completarla."
                                        : "Puedes escribirla directamente o dejar que el escaneo la vaya sumando"}
                                </p>
                            </div>

                            <div className="aen-field">
                                <div className="aen-label-row">
                                    <label className="aen-label">Costo de Adquisición Unitario *</label>
                                    <button
                                        type="button"
                                        className="aen-add-costo-btn"
                                        onClick={addCostoLinea}
                                        title="Agregar otro costo para promediar"
                                    >
                                        <Plus size={12} />
                                        más
                                    </button>
                                </div>

                                {!esDesglose ? (
                                    <>
                                        <FormInput
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            className="aen-input"
                                            wrapperClassName="aen-input-money-wrap"
                                            iconLeft={<span className="aen-currency">$</span>}
                                            value={costoLineas[0].costo}
                                            onChange={(v) => updateCostoLinea(costoLineas[0].id, { costo: v })}
                                            onWheel={bloquearScrollNumero}
                                        />
                                        {ultimoCosto != null && (
                                            <p className="aen-hint">
                                                Último costo registrado:{" "}
                                                <strong>${ultimoCosto.toFixed(2)}</strong>
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <div className="aen-desglose">
                                        <p className="aen-hint">
                                            Da clic en el costo o cantidad de la línea donde quieras escanear
                                            (se marca como activa), o captura la cantidad de cada costo a mano.
                                        </p>

                                        <div className="aen-desglose-panel">
                                            {costoLineas.length > 2 ? (
                                                <div className="aen-desglose-panel-scroll">
                                                    {costoLineas.map((linea, idx) => renderLineaDesglose(linea, idx))}
                                                </div>
                                            ) : (
                                                costoLineas.map((linea, idx) => renderLineaDesglose(linea, idx))
                                            )}
                                        </div>

                                        {restanteDesglose !== 0 && (
                                            <p className="aen-scan-error">
                                                {restanteDesglose > 0
                                                    ? `Faltan ${restanteDesglose} ${unidad} por repartir en las líneas de costo.`
                                                    : `Te pasaste por ${Math.abs(restanteDesglose)} ${unidad}: ajusta las líneas de costo.`}
                                            </p>
                                        )}

                                        <div
                                            className={`aen-desglose-summary${restanteDesglose !== 0 ? " is-off" : ""}`}
                                        >
                                            <span>
                                                Repartido: <strong>{cantidadDesglose} de {cantidadNum} {unidad}</strong>
                                            </span>
                                            <span>
                                                Costo promedio: <strong>${costoPromedioDesglose.toFixed(2)}</strong>
                                            </span>
                                        </div>
                                        {ultimoCosto != null && (
                                            <p className="aen-hint">
                                                Último costo registrado:{" "}
                                                <strong>${ultimoCosto.toFixed(2)}</strong>
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {showCostoAlerta && (
                                <div className="aen-cost-alert">
                                    <AlertTriangle size={18} className="aen-cost-alert-icon" />
                                    <div>
                                        <p className="aen-cost-alert-title">Variación de costo</p>
                                        <p className="aen-cost-alert-body">
                                            El costo {esDesglose ? "promedio" : "ingresado"} (${costoNum.toFixed(2)})
                                            difiere{" "}
                                            <strong>{Math.abs(diffPerc!).toFixed(1)}%</strong> del último
                                            registrado (${ultimoCosto?.toFixed(2)}). Verifica tu información.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {productoSeleccionado && (
                                <div className="aen-info-box">
                                    <span>
                                        Margen asignado:{" "}
                                        <strong>
                                            {margenPct > 0
                                                ? `${margenes.find((m) => m.id_margenes === productoSeleccionado.id_margenes)?.nombre} (${margenPct}%)`
                                                : "Sin margen"}
                                        </strong>
                                    </span>
                                    <span>
                                        Impuesto:{" "}
                                        <strong>
                                            {impuestoPct > 0
                                                ? `${impuestos.find((i) => i.id_impuestos === productoSeleccionado.id_impuestos)?.nombre} (${impuestoPct}%)`
                                                : "Sin impuesto"}
                                        </strong>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Proyección financiera del lote (siempre visible) ── */}
                    <div className="aen-calc-box">
                        <div className="aen-calc-title">
                            <TrendingUp size={16} />
                            Proyección Financiera del Lote
                        </div>
                        <div className="aen-calc-grid">
                            <div className="aen-calc-cell">
                                <p className="aen-calc-cell-label">Inversión Total</p>
                                <p className="aen-calc-cell-value">${inversionTotalLote.toFixed(2)}</p>
                                <p className="aen-calc-cell-sub">
                                    {cantidadNum} × ${costoNum.toFixed(2)}
                                </p>
                            </div>
                            <div className="aen-calc-cell">
                                <p className="aen-calc-cell-label">Utilidad x Unidad</p>
                                <p className="aen-calc-cell-value tone-success">
                                    ${utilidadPorUnidad.toFixed(2)}
                                </p>
                                <p className="aen-calc-cell-sub">Margen {margenPct}%</p>
                            </div>
                            <div className="aen-calc-cell">
                                <p className="aen-calc-cell-label">Precio Público</p>
                                <p className="aen-calc-cell-value">${precioFinalUnitario.toFixed(2)}</p>
                                <p className="aen-calc-cell-sub">c/impuesto ({impuestoPct}%)</p>
                            </div>
                            <div className="aen-calc-cell">
                                <p className="aen-calc-cell-label">Utilidad del Lote</p>
                                <p className="aen-calc-cell-value tone-success">
                                    ${utilidadTotalLote.toFixed(2)}
                                </p>
                                <p className="aen-calc-cell-sub">
                                    {cantidadNum} × ${utilidadPorUnidad.toFixed(2)}
                                </p>
                            </div>
                            <div className="aen-calc-cell is-highlight">
                                <p className="aen-calc-cell-label">Ingreso Esperado</p>
                                <p className="aen-calc-cell-value">
                                    ${(precioFinalUnitario * cantidadNum).toFixed(2)}
                                </p>
                                <p className="aen-calc-cell-sub">Total del lote</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="aen-footer">
                    <button className="btn btn-ghost" onClick={onClose} disabled={isSaving}>
                        Cancelar
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Guardando..." : "Registrar Entrada"}
                    </button>
                </div>
            </div>
        </div>
    );
}