import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Bell, Check, Trash2, ArrowLeft, HandCoins, ShieldCheck, ShieldAlert } from 'lucide-react';
import FormInput from '../../components/FormInput';
import ErrorModal from '../../components/modals/ErrorModal';
import WarningModal from '../../components/modals/WarningModal';
import Toast, { useToast } from '../../components/Toast .tsx';
import { useAuth } from '../../../src/context/AuthContext';
import { esSoloLectura } from '../../../src/utils/permisos';
import {
    listarFiados,
    crearFiado,
    registrarAbono,
    recordarFiado,
    eliminarFiado,
    type Fiado,
} from '../../../src/services/fiados.service';

/* ─────────────────────────────────────────────────────────────
   Tarjeta de un fiado — muestra el saldo y, si no es de solo
   lectura, los botones de Abonar / Recordar / Eliminar.
──────────────────────────────────────────────────────────────── */
function FiadoCard({
    fiado,
    soloLectura,
    onAbonar,
    onRecordar,
    onEliminar,
}: {
    fiado: Fiado;
    soloLectura: boolean;
    onAbonar: (fiado: Fiado, monto: number) => Promise<void>;
    onRecordar: (fiado: Fiado) => void;
    onEliminar: (fiado: Fiado) => void;
}) {
    const [abonoAbierto, setAbonoAbierto] = useState(false);
    const [montoAbono, setMontoAbono] = useState('');
    const [enviando, setEnviando] = useState(false);

    const fecha = new Date(fiado.created).toLocaleDateString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
    });

    const handleAbonar = async () => {
        const monto = Number(montoAbono);
        if (!Number.isFinite(monto) || monto <= 0 || enviando) return;
        setEnviando(true);
        try {
            await onAbonar(fiado, monto);
            setMontoAbono('');
            setAbonoAbierto(false);
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div
            className="card"
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 16,
                opacity: fiado.estado === 'pagado' ? 0.75 : 1,
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{fiado.nombre}</div>
                    {fiado.telefono && (
                        <div style={{ fontSize: 12.5, color: 'var(--cuh-text-muted)' }}>{fiado.telefono}</div>
                    )}
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--cuh-text-muted)' }}>
                        {fiado.estado === 'pagado' ? 'Saldado' : 'Debe'}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: fiado.estado === 'pagado' ? 'var(--cuh-success)' : 'var(--cuh-danger, #dc2626)' }}>
                        ${fiado.saldo_pendiente.toFixed(2)}
                    </div>
                    {fiado.saldo_pendiente < fiado.monto_total && (
                        <div style={{ fontSize: 11.5, color: 'var(--cuh-text-light)' }}>
                            de ${fiado.monto_total.toFixed(2)}
                        </div>
                    )}
                </div>
            </div>

            {fiado.caracteristicas && (
                <div style={{ fontSize: 12.5, color: 'var(--cuh-text-muted)' }}>
                    <strong>Señas:</strong> {fiado.caracteristicas}
                </div>
            )}
            <div style={{ fontSize: 13 }}>
                <strong>Se llevó:</strong> {fiado.articulos}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--cuh-text-light)' }}>Anotado el {fecha}</div>

            {fiado.estado === 'pendiente' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    {abonoAbierto && !soloLectura && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <FormInput
                                    label="Monto del abono"
                                    type="number"
                                    value={montoAbono}
                                    onChange={setMontoAbono}
                                    placeholder="0.00"
                                    id={`abono-${fiado.id_fiado}`}
                                />
                            </div>
                            <button className="btn btn-primary" onClick={handleAbonar} disabled={enviando} style={{ height: 40 }}>
                                {enviando ? '...' : <Check size={16} />}
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {!soloLectura && (
                            <button className="btn btn-primary" onClick={() => setAbonoAbierto((o) => !o)}>
                                <HandCoins size={14} /> Abonar
                            </button>
                        )}
                        <button className="btn btn-ghost" onClick={() => onRecordar(fiado)}>
                            <Bell size={14} /> Recordar
                        </button>
                        {!soloLectura && (
                            <button className="btn btn-ghost" onClick={() => onEliminar(fiado)} style={{ color: 'var(--cuh-danger, #dc2626)' }}>
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   Formulario de alta — se muestra en vez de la lista (mismo patrón
   que showNewUser en users.tsx).
──────────────────────────────────────────────────────────────── */
function NuevoFiado({
    onBack,
    onGuardado,
    showError,
}: {
    onBack: () => void;
    onGuardado: () => void;
    showError: (title: string, msg: string) => void;
}) {
    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [caracteristicas, setCaracteristicas] = useState('');
    const [articulos, setArticulos] = useState('');
    const [monto, setMonto] = useState('');
    const [enviando, setEnviando] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (enviando) return;
        setEnviando(true);
        try {
            await crearFiado({
                nombre,
                telefono: telefono || null,
                caracteristicas: caracteristicas || null,
                articulos,
                monto_total: Number(monto),
            });
            onGuardado();
        } catch (err) {
            showError('No se pudo registrar', err instanceof Error ? err.message : 'Intenta de nuevo.');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="app-content">
            <div className="nu-page-heading">
                <div>
                    <h1>Registrar Fiado</h1>
                    <p>Anota lo básico para reconocer a la persona y lo que se llevó.</p>
                </div>
                <div className="nu-action-bar">
                    <button className="btn btn-primary" onClick={onBack}>
                        <ArrowLeft size={16} /> Regresar
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="form-section nu-section nu-section-perfil">
                    <h3 className="form-section-title">
                        Información del Fiado
                        <span className="nu-section-tag">Detalles</span>
                    </h3>
                    <div className="form-grid-2">
                        <FormInput label="Nombre o apodo" placeholder="Ej. Doña Chuy, el de la esquina" value={nombre} onChange={setNombre} required id="fd-nombre" />
                        <FormInput label="Teléfono (opcional)" placeholder="55 1234 5678" value={telefono} onChange={setTelefono} id="fd-telefono" />
                    </div>
                    <FormInput
                        label="Características (para reconocerlo)"
                        placeholder="Ej. Camioneta roja, viene los viernes"
                        value={caracteristicas}
                        onChange={setCaracteristicas}
                        id="fd-caracteristicas"
                    />
                </div>

                <div className="form-section nu-section nu-section-contacto" style={{ animationDelay: '0.05s' }}>
                    <h3 className="form-section-title">
                        Compra y Monto
                        <span className="nu-section-tag">Adeudo</span>
                    </h3>
                    <div className="form-grid-2">
                        <FormInput
                            label="¿Qué se llevó?"
                            placeholder="Ej. 2 refrescos, 1 kg de jamón"
                            value={articulos}
                            onChange={setArticulos}
                            required
                            id="fd-articulos"
                        />
                        <FormInput
                            label="Monto a deber"
                            type="number"
                            placeholder="0.00"
                            value={monto}
                            onChange={setMonto}
                            required
                            id="fd-monto"
                        />
                    </div>
                </div>

                <div className="nu-action-bar is-footer">
                    <button type="button" className="btn btn-ghost" onClick={onBack}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={enviando}>
                        <Plus size={16} /> {enviando ? 'Guardando...' : 'Registrar Fiado'}
                    </button>
                </div>
            </form>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   Pantalla principal
──────────────────────────────────────────────────────────────── */
export default function Fiados() {
    const { usuario } = useAuth();
    const soloLectura = esSoloLectura(usuario?.rol, 'fiados');

    const [vista, setVista] = useState<'lista' | 'nuevo'>('lista');
    const [fiados, setFiados] = useState<Fiado[]>([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [fiadoAEliminar, setFiadoAEliminar] = useState<Fiado | null>(null);
    const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' });
    const showError = (title: string, message: string) => setErrorModal({ isOpen: true, title, message });
    const { toast, showToast } = useToast();

    const cargar = async () => {
        try {
            setFiados(await listarFiados());
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'No se pudo cargar la lista de fiados.');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargar();
        const unsubscribe = window.api.onChange((entity) => {
            if (entity === 'fiados') cargar();
        });
        return unsubscribe;
    }, []);

    const filtrados = useMemo(() => {
        const term = busqueda.trim().toLowerCase();
        if (!term) return fiados;
        return fiados.filter((f) =>
            f.nombre.toLowerCase().includes(term) ||
            (f.telefono?.toLowerCase().includes(term) ?? false) ||
            (f.caracteristicas?.toLowerCase().includes(term) ?? false) ||
            f.articulos.toLowerCase().includes(term)
        );
    }, [fiados, busqueda]);

    const pendientes = filtrados.filter((f) => f.estado === 'pendiente');
    const pagados = filtrados.filter((f) => f.estado === 'pagado');
    const totalPorCobrar = pendientes.reduce((acc, f) => acc + f.saldo_pendiente, 0);

    const handleAbonar = async (fiado: Fiado, monto: number) => {
        try {
            await registrarAbono(fiado, monto);
            showToast('success', `Abono de $${monto.toFixed(2)} registrado.`);
        } catch (err) {
            showError('No se pudo registrar el abono', err instanceof Error ? err.message : 'Intenta de nuevo.');
        }
    };

    const handleRecordar = async (fiado: Fiado) => {
        try {
            await recordarFiado(fiado);
            showToast('success', 'Recordatorio enviado a notificaciones.');
        } catch {
            showError('Error', 'No se pudo mandar el recordatorio.');
        }
    };

    const handleConfirmEliminar = async () => {
        if (!fiadoAEliminar) return;
        const fiado = fiadoAEliminar;
        setFiadoAEliminar(null);
        try {
            await eliminarFiado(fiado);
            showToast('success', 'Fiado eliminado.');
        } catch (err) {
            showError('No se pudo eliminar', err instanceof Error ? err.message : 'Intenta de nuevo.');
        }
    };

    if (vista === 'nuevo') {
        return (
            <>
                <NuevoFiado
                    onBack={() => setVista('lista')}
                    onGuardado={() => { setVista('lista'); showToast('success', 'Fiado registrado.'); }}
                    showError={showError}
                />
                <Toast toast={toast} />
                <ErrorModal isOpen={errorModal.isOpen} onClose={() => setErrorModal({ ...errorModal, isOpen: false })} title={errorModal.title} message={errorModal.message} />
            </>
        );
    }

    return (
        <>
            <div className="app-content">
                <div className="dtu-page-heading">
                    <div>
                        <h1>Fiados</h1>
                        <p>Lo que se ha quedado a deber y lo que ya se saldó.</p>
                    </div>
                    {!soloLectura && (
                        <button className="btn btn-primary" onClick={() => setVista('nuevo')}>
                            <Plus size={18} /> Registrar Fiado
                        </button>
                    )}
                </div>

                <div className="card card-context context-info inv-filters-card" style={{ marginBottom: 20 }}>
                    <div className="inv-filters-grid inv-filters-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 16 }}>
                        <FormInput
                            label="Búsqueda"
                            type="text"
                            className="form-input inv-search-input"
                            wrapperClassName="inv-search-wrap"
                            placeholder="Buscar por nombre, teléfono o características"
                            value={busqueda}
                            onChange={setBusqueda}
                            iconLeft={<Search size={14} className="inv-search-icon" />}
                        />
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--cuh-text-muted)' }}>Total por cobrar</div>
                            <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--cuh-danger, #dc2626)' }}>${totalPorCobrar.toFixed(2)}</div>
                        </div>
                    </div>
                </div>

                {cargando ? (
                    <div className="usr-state-message">Cargando fiados...</div>
                ) : filtrados.length === 0 ? (
                    <div className="usr-state-message">No hay fiados{busqueda ? ' que coincidan con la búsqueda' : ' registrados'}.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                        {pendientes.length > 0 && (
                            <div>
                                <div className="usr-group-title">
                                    <ShieldAlert size={18} />
                                    <h2>Pendientes ({pendientes.length})</h2>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginTop: 10 }}>
                                    {pendientes.map((f) => (
                                        <FiadoCard
                                            key={f.id_fiado}
                                            fiado={f}
                                            soloLectura={soloLectura}
                                            onAbonar={handleAbonar}
                                            onRecordar={handleRecordar}
                                            onEliminar={setFiadoAEliminar}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {pagados.length > 0 && (
                            <div>
                                <div className="usr-group-title">
                                    <ShieldCheck size={18} />
                                    <h2>Historial saldado ({pagados.length})</h2>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginTop: 10 }}>
                                    {pagados.map((f) => (
                                        <FiadoCard
                                            key={f.id_fiado}
                                            fiado={f}
                                            soloLectura={soloLectura}
                                            onAbonar={handleAbonar}
                                            onRecordar={handleRecordar}
                                            onEliminar={setFiadoAEliminar}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <WarningModal
                isOpen={fiadoAEliminar !== null}
                onClose={() => setFiadoAEliminar(null)}
                onConfirm={handleConfirmEliminar}
                title="Eliminar Fiado"
                message={`¿Seguro que quieres eliminar el fiado de ${fiadoAEliminar?.nombre}? Esta acción no se puede deshacer.`}
            />
            <ErrorModal isOpen={errorModal.isOpen} onClose={() => setErrorModal({ ...errorModal, isOpen: false })} title={errorModal.title} message={errorModal.message} />
            <Toast toast={toast} />
        </>
    );
}