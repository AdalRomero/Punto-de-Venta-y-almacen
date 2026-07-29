import { useEffect, useState } from 'react';
import { X, Scale } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   CantidadKilosModal
   Se abre desde ventas.tsx cuando se toca un producto vendido por
   peso (unidad === 'kilos'): en vez de sumar "1 pieza" como con el
   resto del catálogo, deja capturar el peso exacto (0.5, 1.4, 3.2
   kg...) con atajos para las fracciones más comunes que se piden
   en mostrador.
──────────────────────────────────────────────────────────────── */

interface AtajoCantidad {
    label: string;
    valor: number;
}

const ATAJOS: AtajoCantidad[] = [
    { label: '¼ kg', valor: 0.25 },
    { label: '½ kg', valor: 0.5 },
    { label: '¾ kg', valor: 0.75 },
    { label: '1 kg', valor: 1 },
    { label: '1 ½ kg', valor: 1.5 },
    { label: '2 kg', valor: 2 },
];

export interface CantidadKilosModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (cantidad: number) => void;
    nombreProducto: string;
    /** Precio por kg. */
    precioUnitario: number;
    /** Kilos disponibles — límite superior de lo que se puede pedir. */
    stockDisponible: number;
    /** Si se abre para EDITAR una línea que ya está en el carrito,
     *  precarga el peso que ya tenía en vez de arrancar vacío. */
    cantidadInicial?: number;
}

function formatMoney(n: number): string {
    return `$${n.toFixed(2)}`;
}

export default function CantidadKilosModal({
    isOpen,
    onClose,
    onConfirm,
    nombreProducto,
    precioUnitario,
    stockDisponible,
    cantidadInicial,
}: CantidadKilosModalProps) {
    const [valor, setValor] = useState('');

    // Se resetea cada vez que se abre (o precarga si viene a editar
    // una línea existente) — así no arrastra lo que se haya escrito
    // la vez anterior si se cierra sin confirmar.
    useEffect(() => {
        if (isOpen) {
            setValor(cantidadInicial ? String(cantidadInicial) : '');
        }
    }, [isOpen, cantidadInicial]);

    if (!isOpen) return null;

    const cantidad = parseFloat(valor.replace(',', '.'));
    const cantidadValida = Number.isFinite(cantidad) && cantidad > 0;
    const excedeStock = cantidadValida && cantidad > stockDisponible;
    const puedeConfirmar = cantidadValida && !excedeStock;
    const subtotal = cantidadValida ? cantidad * precioUnitario : 0;

    const handleConfirmar = () => {
        if (!puedeConfirmar) return;
        // Redondeado a gramos (3 decimales) para no arrastrar errores
        // de punto flotante tipo 1.4000000000000001 hacia la venta.
        onConfirm(Math.round(cantidad * 1000) / 1000);
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleConfirmar();
        if (e.key === 'Escape') onClose();
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                background: 'rgba(15, 23, 42, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
            }}
            onClick={onClose}
        >
            <div
                className="card"
                style={{ width: '100%', maxWidth: 360, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div
                            style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: 'var(--cuh-primary-light)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}
                        >
                            <Scale size={18} color="var(--cuh-primary)" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{nombreProducto}</div>
                            <div style={{ fontSize: 12.5, color: 'var(--cuh-text-muted)' }}>
                                {formatMoney(precioUnitario)} / kg · {stockDisponible} kg disp.
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--cuh-text-muted)', padding: 4 }}
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cuh-text-muted)', display: 'block', marginBottom: 6 }}>
                        Cantidad rápida
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {ATAJOS.map((atajo) => (
                            <button
                                key={atajo.label}
                                type="button"
                                className={`btn ${valor === String(atajo.valor) ? 'btn-primary' : 'btn-ghost'}`}
                                disabled={atajo.valor > stockDisponible}
                                onClick={() => setValor(String(atajo.valor))}
                                style={{ padding: '8px 0' }}
                            >
                                {atajo.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cuh-text-muted)', display: 'block', marginBottom: 6 }}>
                        O captura el peso exacto (kg)
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={stockDisponible}
                        autoFocus
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        placeholder="Ej. 1.4"
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: 16,
                            fontWeight: 600,
                            border: `1px solid ${excedeStock ? 'var(--cuh-danger, #dc2626)' : 'var(--cuh-border)'}`,
                            borderRadius: 8,
                            boxSizing: 'border-box',
                        }}
                    />
                    {excedeStock && (
                        <div style={{ fontSize: 12, color: 'var(--cuh-danger, #dc2626)', marginTop: 4 }}>
                            No hay {cantidad} kg disponibles — máximo {stockDisponible} kg.
                        </div>
                    )}
                </div>

                {cantidadValida && !excedeStock && (
                    <div
                        style={{
                            display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700,
                            paddingTop: 12, borderTop: '1px solid var(--cuh-border-light)',
                        }}
                    >
                        <span>Subtotal</span>
                        <span>{formatMoney(subtotal)}</span>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="button" className="btn btn-primary" disabled={!puedeConfirmar} onClick={handleConfirmar}>
                        Agregar
                    </button>
                </div>
            </div>
        </div>
    );
}
