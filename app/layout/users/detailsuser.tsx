import { useState, useEffect } from 'react';
import {
    ArrowLeft, Edit3, Save, X, Mail, Phone,
    ShieldCheck, UserCheck, Clock, MapPin, Lock,
    ChevronLeft, ChevronRight,
} from 'lucide-react';
import FormInput from '../../components/FormInput';
import FormSelect from '../../components/FormSelect';
// Modals removidos a favor de Toast
import {
    type Usuario,
    type ActividadItem,
    actualizarPerfil,
    actualizarContacto,
    usuarioDisponible,
    obtenerActividadUsuario,
} from '../../../src/services/user.service.ts';
import AsignarCredenciales from '../auth/credentials.tsx';
import CambiarCorreo from '../auth/email.tsx';
import CambiarPassword from '../auth/password.tsx';
import '../../css/detailsuser.css';

/* ─────────────────────────────────────────────────────────────
   Tipos
──────────────────────────────────────────────────────────────── */
// ActividadItem se importa de user.service.ts (calca 1:1 una fila
// de Bitacora); aquí solo quedan los helpers de presentación.

const ACTIVIDAD_POR_PAGINA = 3;

// Traduce `entidad` al nombre del apartado tal como aparece en el
// sidebar/AppLayout, para dar contexto de "en qué módulo" pasó cada
// evento cuando la bitácora empiece a recibir más que solo Personal.
const entidadLabels: Record<string, string> = {
    usuario: 'Personal',
    producto: 'Inventario',
    venta: 'Ventas',
    cliente: 'Clientes',
    catalogo: 'Catálogos',
    devolucion: 'Devoluciones',
    inventario: 'Inventario',
};

function formatearFechaHora(iso: string): { fecha: string; hora: string } {
    const d = new Date(iso);
    const fecha = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    const hora = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true });
    return { fecha, hora };
}

// Arma la lista de números de página a mostrar, con "..." cuando hay
// muchas páginas (1 2 3 ... 8 9 en vez de listarlas todas).
function construirPaginas(total: number, actual: number): (number | '...')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const paginas: (number | '...')[] = [1];
    if (actual > 3) paginas.push('...');

    const inicio = Math.max(2, actual - 1);
    const fin = Math.min(total - 1, actual + 1);
    for (let i = inicio; i <= fin; i++) paginas.push(i);

    if (actual < total - 2) paginas.push('...');
    paginas.push(total);
    return paginas;
}

interface DetalleUsuarioProps {
    usuario: Usuario;
    onBack: () => void;
    showToast?: (type: 'success' | 'error', msg: string) => void;
    showError?: (title: string, msg: string) => void;
}

/* ─────────────────────────────────────────────────────────────
   Datos de muestra — sólo para maquetar la pantalla
──────────────────────────────────────────────────────────────── */
const rolLabels: Record<string, string> = {
    Dev: 'Dev',
    administrador: 'Administrador',
    cajero: 'Cajero',
    contador: 'Contador',
};

const rolPermisos: Record<string, { modulo: string; nivel: string; color: string }[]> = {
    // Dev — acceso total a todo, incluido el sistema
    Dev: [
        { modulo: 'Inventario', nivel: 'Acceso total', color: 'var(--cuh-success)' },
        { modulo: 'Ventas', nivel: 'Acceso total', color: 'var(--cuh-success)' },
        { modulo: 'Reportes', nivel: 'Acceso total', color: 'var(--cuh-success)' },
        { modulo: 'Personal', nivel: 'Acceso total', color: 'var(--cuh-success)' },
        { modulo: 'Sistema', nivel: 'Acceso total', color: 'var(--cuh-success)' },
    ],
    // Administrador — acceso completo; en Sistema solo puede configurar
    administrador: [
        { modulo: 'Inventario', nivel: 'Acceso completo', color: 'var(--cuh-success)' },
        { modulo: 'Ventas', nivel: 'Acceso completo', color: 'var(--cuh-success)' },
        { modulo: 'Reportes', nivel: 'Acceso completo', color: 'var(--cuh-success)' },
        { modulo: 'Personal', nivel: 'Acceso completo', color: 'var(--cuh-success)' },
        { modulo: 'Sistema', nivel: 'Puede configurar', color: 'var(--cuh-info)' },
    ],
    // Cajero — solo stock (inventario) y ventas
    cajero: [
        { modulo: 'Inventario', nivel: 'Acceso completo', color: 'var(--cuh-success)' },
        { modulo: 'Ventas', nivel: 'Acceso completo', color: 'var(--cuh-success)' },
        { modulo: 'Reportes', nivel: 'Sin acceso', color: 'var(--cuh-text-light)' },
        { modulo: 'Personal', nivel: 'Sin acceso', color: 'var(--cuh-text-light)' },
        { modulo: 'Sistema', nivel: 'Sin acceso', color: 'var(--cuh-text-light)' },
    ],
    // Contador — reportes/stats completo; solo lectura en ventas, stock y personal
    contador: [
        { modulo: 'Inventario', nivel: 'Solo lectura', color: 'var(--cuh-warning)' },
        { modulo: 'Ventas', nivel: 'Solo lectura', color: 'var(--cuh-warning)' },
        { modulo: 'Reportes', nivel: 'Acceso completo', color: 'var(--cuh-success)' },
        { modulo: 'Personal', nivel: 'Solo lectura', color: 'var(--cuh-warning)' },
        { modulo: 'Sistema', nivel: 'Sin acceso', color: 'var(--cuh-text-light)' },
    ],
};

/* ─────────────────────────────────────────────────────────────
   Subcomponente — item de información en modo lectura
──────────────────────────────────────────────────────────────── */
const InfoItem = ({ label, value }: { label: string; value: string }) => (
    <div className="dtu-info-item">
        <div className="dtu-info-label">{label}</div>
        <div className="dtu-info-value">{value || '—'}</div>
    </div>
);

/* ─────────────────────────────────────────────────────────────
   Componente principal — sólo visual, sin lógica real de datos
──────────────────────────────────────────────────────────────── */
export default function DetalleUsuario({ usuario, onBack, showToast, showError }: DetalleUsuarioProps) {
    // Copia local: se actualiza tras cada guardado exitoso para que
    // el encabezado y las vistas de solo-lectura reflejen el cambio
    // de inmediato, sin esperar a que el padre vuelva a pasar props.
    const [usuarioActual, setUsuarioActual] = useState<Usuario>(usuario);
    const [editando, setEditando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    // Controla cuál de las 3 pantallas de credenciales está activa
    // (Agregar Credenciales / Cambiar Correo / Nueva Contraseña).
    // 'ninguna' = se muestra el detalle normal del usuario.
    const [vistaCredenciales, setVistaCredenciales] = useState<'ninguna' | 'asignar' | 'correo' | 'password'>('ninguna');
    const [formData, setFormData] = useState({
        nombres: usuarioActual.nombres,
        apellido_paterno: usuarioActual.apellido_paterno,
        apellido_materno: usuarioActual.apellido_materno,
        usuario: usuarioActual.usuario,
        rol: usuarioActual.rol,
        correo_personal: usuarioActual.contacto?.correo_personal ?? '',
        lada: usuarioActual.contacto?.lada ?? '',
        telefono: usuarioActual.contacto?.telefono ?? '',
        direccion: usuarioActual.contacto?.direccion ?? '',
    });



    // Actividad reciente (tabla Bitacora): paginación real de 3 en 3,
    // de la más nueva a la más vieja (así ordena el índice
    // idx_bitacora_perfil del esquema).
    const [actividad, setActividad] = useState<ActividadItem[]>([]);
    const [actividadPagina, setActividadPagina] = useState(1);
    const [actividadTotal, setActividadTotal] = useState(0);
    const [actividadCargando, setActividadCargando] = useState(true);
    const [actividadError, setActividadError] = useState(false);
    // Se incrementa cada vez que window.api.onChange avisa un cambio en
    // "usuarios" (ver useEffect de abajo). Entra al arreglo de deps del
    // efecto que trae la actividad para forzar un refetch sin depender
    // de que cambie la página o el usuario mostrado.
    const [actividadRefreshKey, setActividadRefreshKey] = useState(0);

    // Si el detalle se reutiliza para ver a otro usuario, arranca de nuevo
    // en la página 1 en vez de arrastrar la página del usuario anterior.
    useEffect(() => {
        setActividadPagina(1);
    }, [usuarioActual.id_perfil_info]);

    useEffect(() => {
        let cancelado = false;
        setActividadCargando(true);
        setActividadError(false);

        obtenerActividadUsuario(usuarioActual.id_perfil_info, actividadPagina, ACTIVIDAD_POR_PAGINA)
            .then(({ items, total }) => {
                if (cancelado) return;
                setActividad(items);
                setActividadTotal(total);
            })
            .catch(() => {
                if (cancelado) return;
                setActividad([]);
                setActividadError(true);
            })
            .finally(() => {
                if (!cancelado) setActividadCargando(false);
            });

        return () => { cancelado = true; };
    }, [usuarioActual.id_perfil_info, actividadPagina, actividadRefreshKey]);

    // Actividad en "tiempo real": cada UPDATE/INSERT que pasa por
    // window.api.execute(..., 'usuarios') dispara este evento en el
    // proceso principal (incluyendo el INSERT a Bitacora de
    // registrarBitacora). En vez de refrescar a mano después de cada
    // handleGuardar/handleCambiarX, nos suscribimos una sola vez aquí:
    // así también se refleja un cambio hecho desde otra ventana/sesión.
    useEffect(() => {
        let debounce: ReturnType<typeof setTimeout> | null = null;

        const unsubscribe = window.api.onChange((entity) => {
            const validEntities = ['usuarios', 'productos', 'familias', 'impuestos', 'margenes', 'ventas', 'devoluciones', 'inventario', 'catalogo'];
            if (!validEntities.includes(entity)) return;
            // Un solo guardado puede disparar varios eventos seguidos
            // (UPDATE Perfil_Info + UPDATE Contacto + INSERT Bitacora);
            // se agrupan en un único refetch en vez de tres.
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => {
                setActividadRefreshKey((k) => k + 1);
            }, 200);
        });

        return () => {
            unsubscribe();
            if (debounce) clearTimeout(debounce);
        };
    }, []);

    const actividadTotalPaginas = Math.max(1, Math.ceil(actividadTotal / ACTIVIDAD_POR_PAGINA));

    const rolKey = usuarioActual.rol;
    const initials = `${usuarioActual.nombres[0]}${usuarioActual.apellido_paterno[0]}`;
    const permisos = rolPermisos[rolKey] || [];

    const handleChange = (field: keyof typeof formData) => (value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleGuardar = async () => {
        if (enviando) return;

        if (!formData.nombres.trim() || !formData.apellido_paterno.trim() || !formData.usuario.trim()) {
            showError?.('Campos incompletos', 'Nombres, Apellido Paterno y Usuario son obligatorios.');
            return;
        }

        setEnviando(true);

        try {
            // Solo se verifica disponibilidad si el username realmente
            // cambió: si se guarda con el mismo valor de siempre, la
            // consulta de "disponible" fallaría porque ese usuario ya
            // está tomado... por él mismo.
            if (formData.usuario !== usuarioActual.usuario) {
                const disponible = await usuarioDisponible(formData.usuario);
                if (!disponible) {
                    showError?.('Usuario no disponible', 'Ese nombre de usuario ya está en uso por otro usuario.');
                    return;
                }
            }

            await actualizarPerfil(usuarioActual.id_perfil_info, {
                usuario: formData.usuario,
                nombres: formData.nombres,
                apellido_paterno: formData.apellido_paterno,
                apellido_materno: formData.apellido_materno || null,
                rol: formData.rol,
            });
            await actualizarContacto(usuarioActual.id_perfil_info, {
                correo_personal: formData.correo_personal || null,
                lada: formData.lada || null,
                telefono: formData.telefono || null,
                direccion: formData.direccion || null,
            });

            setUsuarioActual((prev) => ({
                ...prev,
                nombres: formData.nombres,
                apellido_paterno: formData.apellido_paterno,
                apellido_materno: formData.apellido_materno,
                usuario: formData.usuario,
                rol: formData.rol,
                contacto: {
                    correo_personal: formData.correo_personal || null,
                    lada: formData.lada || null,
                    telefono: formData.telefono || null,
                    direccion: formData.direccion || null,
                },
            }));
            setEditando(false);
            showToast?.('success', 'Cambios registrados.');
        } catch (err) {
            // Última línea de defensa por si dos ediciones concurrentes
            // dejan pasar el mismo username (usuario es UNIQUE en la BD).
            const esDuplicado =
                err instanceof Error &&
                (/ER_DUP_ENTRY/i.test(err.message) || /1062/.test(err.message) || /duplicate/i.test(err.message));

            showError?.(esDuplicado ? 'Registro duplicado' : 'Error al guardar', esDuplicado
                ? 'Ese nombre de usuario ya fue tomado por otro registro. Verifica e intenta de nuevo.'
                : err instanceof Error
                    ? err.message
                    : 'No se pudieron guardar los cambios.');
        } finally {
            setEnviando(false);
        }
    };

    const handleCancelar = () => {
        setFormData({
            nombres: usuarioActual.nombres,
            apellido_paterno: usuarioActual.apellido_paterno,
            apellido_materno: usuarioActual.apellido_materno,
            usuario: usuarioActual.usuario,
            rol: usuarioActual.rol,
            correo_personal: usuarioActual.contacto?.correo_personal ?? '',
            lada: usuarioActual.contacto?.lada ?? '',
            telefono: usuarioActual.contacto?.telefono ?? '',
            direccion: usuarioActual.contacto?.direccion ?? '',
        });
        setEditando(false);
    };

    // Los 3 botones de credenciales ya no arman su propio flujo con
    // window.prompt(): solo cambian la vista a la pantalla dedicada
    // (CambiarPassword / CambiarCorreo / AsignarCredenciales). Cada
    // una valida, confirma y llama al servicio por su cuenta; aquí
    // solo reaccionamos a su onSuccess para refrescar el detalle.
    const handleCambiarContrasena = () => {
        if (!usuarioActual.auth_usuario) {
            showError?.('Error', 'Este perfil no tiene un usuario de autenticación asociado en la base de datos.');
            return;
        }
        setVistaCredenciales('password');
    };

    const handleCambiarCorreo = () => {
        if (!usuarioActual.auth_usuario) {
            showError?.('Error', 'Este perfil no tiene un usuario de autenticación asociado en la base de datos.');
            return;
        }
        setVistaCredenciales('correo');
    };

    // "Agregar credenciales" para un perfil que hoy está en "Sin Acceso"
    // (users.tsx también puede ir directo a AsignarCredenciales desde el
    // menú de la tarjeta; este botón cubre el caso de llegar aquí primero,
    // ej. por navegación normal al detalle de un perfil "Sin Acceso").
    const handleAgregarCredenciales = () => {
        if (usuarioActual.auth_usuario) return; // ya tiene acceso, este botón no aplica
        setVistaCredenciales('asignar');
    };

    if (vistaCredenciales === 'asignar') {
        return (
            <AsignarCredenciales
                usuario={usuarioActual}
                onBack={() => setVistaCredenciales('ninguna')}
                onSuccess={(correoAcceso) => {
                    // Optimista: refleja el acceso de inmediato en esta
                    // pantalla sin esperar al refresco vía db:changed.
                    setUsuarioActual((prev) => ({ ...prev, auth_usuario: correoAcceso }));
                    showToast?.('success', 'Credenciales asignadas. El usuario ya tiene acceso al sistema.');
                }}
                showError={showError}
            />
        );
    }

    if (vistaCredenciales === 'correo') {
        return (
            <CambiarCorreo
                usuario={usuarioActual}
                onBack={() => setVistaCredenciales('ninguna')}
                onSuccess={(nuevoCorreoAcceso) => {
                    setUsuarioActual((prev) => ({ ...prev, auth_usuario: nuevoCorreoAcceso }));
                    showToast?.('success', 'Correo de acceso actualizado.');
                }}
                showError={showError}
            />
        );
    }

    if (vistaCredenciales === 'password') {
        return (
            <CambiarPassword
                usuario={usuarioActual}
                onBack={() => setVistaCredenciales('ninguna')}
                onSuccess={() => {
                    showToast?.('success', 'Contraseña actualizada.');
                }}
                showError={showError}
            />
        );
    }

    return (
        <>
            <div className="app-content">
                <div className="dtu-page-heading">
                    <div>
                        <h1>{usuarioActual.nombres} {usuarioActual.apellido_paterno} {usuarioActual.apellido_materno}</h1>
                        <p>Información detallada del usuario seleccionado</p>
                    </div>

                    <div className="dtu-heading-actions">
                        <button className="btn btn-secondary" onClick={onBack}>
                            <ArrowLeft size={16} /> Regresar
                        </button>
                        {editando ? (
                            <>
                                <button className="btn btn-ghost" onClick={handleCancelar}>
                                    <X size={16} /> Cancelar
                                </button>
                                <button className="btn btn-primary" onClick={handleGuardar} disabled={enviando}>
                                    <Save size={16} /> {enviando ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </>
                        ) : (
                            <button className="btn btn-outline-primary" onClick={() => setEditando(true)}>
                                <Edit3 size={16} /> Editar Perfil
                            </button>
                        )}
                    </div>
                </div>

                <div className="dtu-grid">
                    {/* Avatar + Datos personales */}
                    <div className="dtu-col">
                        <div className="dtu-card is-success dtu-profile-card">
                            <div className="dtu-profile-header">
                                <div className={`dtu-avatar usr-rol-${rolKey.toLowerCase()}`}>
                                    {initials}
                                </div>
                                <div>
                                    <h2 className="dtu-profile-name">
                                        {usuarioActual.nombres} {usuarioActual.apellido_paterno} {usuarioActual.apellido_materno}
                                    </h2>
                                    <span className="dtu-profile-username">{usuarioActual.usuario}</span>
                                    <div className="dtu-profile-rol">
                                        <span className={`usr-badge-rol usr-rol-${rolKey.toLowerCase()}`}>
                                            {rolLabels[rolKey] ?? rolKey}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="dtu-profile-body">
                                {editando ? (
                                    <div className="dtu-info-grid">
                                        <FormInput label="Nombres" value={formData.nombres} onChange={handleChange('nombres')} id="du-nombres" />
                                        <FormInput label="Apellido Paterno" value={formData.apellido_paterno} onChange={handleChange('apellido_paterno')} id="du-ap" />
                                        <FormInput label="Apellido Materno" value={formData.apellido_materno} onChange={handleChange('apellido_materno')} id="du-am" />
                                        <FormInput label="Usuario" value={formData.usuario} onChange={handleChange('usuario')} id="du-usuario" />
                                        <div className="dtu-info-span-2">
                                            <FormSelect
                                                label="Rol"
                                                value={formData.rol}
                                                onChange={handleChange('rol')}
                                                id="du-rol"
                                                options={[
                                                    { value: 'Dev', label: 'Dev' },
                                                    { value: 'administrador', label: 'Administrador' },
                                                    { value: 'cajero', label: 'Cajero' },
                                                    { value: 'contador', label: 'Contador' },
                                                ]}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="dtu-card-title" style={{ marginBottom: 12, marginTop: 4 }}>
                                            <UserCheck size={16} />
                                            <h4>Información del Perfil</h4>
                                        </div>
                                        <div className="dtu-info-grid">
                                            <InfoItem label="Nombres" value={usuarioActual.nombres} />
                                            <InfoItem label="Apellido Paterno" value={usuarioActual.apellido_paterno} />
                                            <InfoItem label="Apellido Materno" value={usuarioActual.apellido_materno} />
                                            <InfoItem label="Usuario" value={usuarioActual.usuario} />
                                            <div className="dtu-info-span-2">
                                                <InfoItem label="Rol" value={rolLabels[rolKey] ?? rolKey} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {usuarioActual.auth_usuario ? (
                            <div className="dtu-card is-danger">
                                <div className="dtu-card-title">
                                    <Lock size={16} />
                                    <h4>Credenciales y Acceso</h4>
                                </div>
                                <p className="dtu-credenciales-text">
                                    Los usuarios registrados en el sistema tienen acceso a la aplicación. Puedes gestionar sus credenciales desde aquí.
                                </p>
                                <div className="dtu-credenciales-actions">
                                    <button className="btn btn-outline-primary" onClick={handleCambiarContrasena}>
                                        <Lock size={14} /> Nueva Contraseña
                                    </button>
                                    <button className="btn btn-outline-primary" onClick={handleCambiarCorreo}>
                                        <Mail size={14} /> Cambiar Correo
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="dtu-card is-warning">
                                <div className="dtu-card-title">
                                    <Lock size={16} />
                                    <h4>Sin Acceso al Sistema</h4>
                                </div>
                                <p className="dtu-credenciales-text">
                                    Este perfil todavía no tiene credenciales. Asígnale un correo de acceso y una contraseña para que pueda entrar al sistema.
                                </p>
                                <div className="dtu-credenciales-actions">
                                    <button className="btn btn-outline-primary" onClick={handleAgregarCredenciales}>
                                        <Lock size={14} /> Agregar Credenciales
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Contacto + Permisos */}
                    <div className="dtu-col">
                        <div className="dtu-card is-info">
                            <div className="dtu-card-title">
                                <Mail size={16} />
                                <h4>Datos de Contacto</h4>
                            </div>

                            {editando ? (
                                <div className="dtu-form-stack">
                                    <FormInput label="Correo Personal" value={formData.correo_personal} onChange={handleChange('correo_personal')} type="email" id="du-correo" />
                                    <div className="dtu-lada-row">
                                        <div className="dtu-lada-field">
                                            <FormInput label="Lada" value={formData.lada} onChange={handleChange('lada')} id="du-lada" />
                                        </div>
                                        <div className="dtu-tel-field">
                                            <FormInput label="Teléfono" value={formData.telefono} onChange={handleChange('telefono')} id="du-telefono" />
                                        </div>
                                    </div>
                                    <FormInput label="Dirección" value={formData.direccion} onChange={handleChange('direccion')} id="du-direccion" />
                                </div>
                            ) : (
                                <>
                                    <div className="dtu-contact-row">
                                        <Mail size={16} />
                                        <div>
                                            <div className="dtu-contact-label">Correo personal</div>
                                            <div className="dtu-contact-value">{formData.correo_personal || '—'}</div>
                                        </div>
                                    </div>
                                    <div className="dtu-contact-row">
                                        <Phone size={16} />
                                        <div>
                                            <div className="dtu-contact-label">Teléfono</div>
                                            <div className="dtu-contact-value">
                                                {formData.telefono ? (formData.lada ? `+${formData.lada} ${formData.telefono}` : formData.telefono) : '—'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="dtu-contact-row">
                                        <MapPin size={16} />
                                        <div>
                                            <div className="dtu-contact-label">Dirección</div>
                                            <div className="dtu-contact-value">{formData.direccion || '—'}</div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="dtu-card is-warning">
                            <div className="dtu-card-title">
                                <ShieldCheck size={16} />
                                <h4>Permisos del Perfil — {rolLabels[rolKey] ?? rolKey}</h4>
                            </div>
                            {permisos.map(({ modulo, nivel, color }) => (
                                <div key={modulo} className="dtu-permiso-row">
                                    <span className="dtu-permiso-modulo">{modulo}</span>
                                    <span className="dtu-permiso-nivel" style={{ color }}>{nivel}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actividad Reciente */}
                <div className="dtu-card is-info dtu-activity-card">
                    <div className="dtu-card-title">
                        <Clock size={18} />
                        <h4>Actividad Reciente</h4>
                    </div>
                    <p className="dtu-activity-desc">
                        Todo lo que {usuarioActual.nombres} ha hecho en el sistema: perfiles, clientes, empresas y órdenes que ha creado, modificado o eliminado.
                    </p>

                    {actividadCargando ? (
                        <p className="dtu-activity-empty">Cargando actividad...</p>
                    ) : actividadError ? (
                        <p className="dtu-activity-empty">No se pudo cargar la actividad. Intenta de nuevo más tarde.</p>
                    ) : actividad.length === 0 ? (
                        <p className="dtu-activity-empty">No hay actividad reciente.</p>
                    ) : (
                        <div className="timeline">
                            {actividad.map((item) => {
                                const { fecha, hora } = formatearFechaHora(item.creado_en);
                                return (
                                    <div key={item.id_bitacora} className="timeline-item">
                                        <div className="timeline-dot actualizacion" />
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                                <span className="dtu-activity-date">{fecha}</span>
                                                <span className="dtu-activity-time">{hora}</span>
                                                <span className="dtu-activity-entidad">
                                                    {entidadLabels[item.entidad] ?? item.entidad}
                                                </span>
                                            </div>
                                            <p className="dtu-activity-heading">{item.descripcion}</p>
                                        </div>
                                    </div>
                                );
                            })}

                            {actividadTotalPaginas > 1 && (
                                <div className="dtu-activity-pagination">
                                    <button
                                        className="dtu-pagination-btn"
                                        onClick={() => setActividadPagina((p) => Math.max(1, p - 1))}
                                        disabled={actividadPagina === 1}
                                        aria-label="Página anterior"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>

                                    {construirPaginas(actividadTotalPaginas, actividadPagina).map((pagina, idx) =>
                                        pagina === '...' ? (
                                            <span key={`ellipsis-${idx}`} className="dtu-pagination-ellipsis">…</span>
                                        ) : (
                                            <button
                                                key={pagina}
                                                className={`dtu-pagination-btn${pagina === actividadPagina ? ' active' : ''}`}
                                                onClick={() => setActividadPagina(pagina)}
                                                aria-current={pagina === actividadPagina ? 'page' : undefined}
                                            >
                                                {pagina}
                                            </button>
                                        )
                                    )}

                                    <button
                                        className="dtu-pagination-btn"
                                        onClick={() => setActividadPagina((p) => Math.min(actividadTotalPaginas, p + 1))}
                                        disabled={actividadPagina === actividadTotalPaginas}
                                        aria-label="Página siguiente"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}