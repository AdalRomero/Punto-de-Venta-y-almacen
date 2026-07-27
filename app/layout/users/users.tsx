import { useEffect, useMemo, useRef, useState } from 'react';
import FormInput from '../../components/FormInput';
import FormSelect from '../../components/FormSelect';
import { UserPlus, Search, ShieldCheck, ShieldAlert } from 'lucide-react';
import UserCard from '../../components/UserCard';
import ErrorModal from '../../components/modals/ErrorModal';
import WarningModal from '../../components/modals/WarningModal';
import NuevoUsuario from './newusers';
import DetalleUsuario from './detailsuser';
import AsignarCredenciales from '../auth/credentials.tsx';
import { listarUsuarios, revocarCredenciales, type Usuario } from '../../../src/services/user.service.ts';
import { useAuth } from '../../../src/context/AuthContext';
import { esDev, esSoloLectura } from '../../../src/utils/permisos';
import Toast, { useToast } from '../../components/Toast .tsx';
import '../../css/user.css';

/* ─────────────────────────────────────────────────────────────
   Componente principal — sólo visual, sin lógica real de datos
──────────────────────────────────────────────────────────────── */
export default function Usuarios() {
    const { usuario: miUsuario } = useAuth();
    const soyDev = esDev(miUsuario?.rol);
    // Contador: ve el personal pero no puede crear, editar, revocar
    // accesos ni asignar credenciales — mismo "Solo lectura" que ya
    // se mostraba en la tabla de detailsuser.tsx para el módulo
    // Personal.
    const soloLecturaPersonal = esSoloLectura(miUsuario?.rol, 'personal');
    const [showNewUser, setShowNewUser] = useState(false);
    const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null);
    // Usuario "Sin Acceso" al que se le está por asignar correo + password
    // desde el menú de la tarjeta (atajo directo, sin pasar por el detalle).
    const [usuarioParaCredenciales, setUsuarioParaCredenciales] = useState<Usuario | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const [filtroRol, setFiltroRol] = useState('');
    const [filtroCredenciales, setFiltroCredenciales] = useState('');
    const [usuarioAEliminar, setUsuarioAEliminar] = useState<Usuario | null>(null);
    const [listaUsuarios, setListaUsuarios] = useState<Usuario[]>([]);
    const [cargando, setCargando] = useState(true);

    // Estado para mostrar errores
    const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' });
    const showError = (title: string, message: string) => setErrorModal({ isOpen: true, title, message });

    // Paginación por scroll: se muestran de 9 en 9 y se van revelando
    // más conforme el usuario llega al final de la lista.
    const PAGE_SIZE = 9;
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    const { toast, showToast } = useToast();

    const cargarUsuarios = async () => {
        try {
            const rows = await listarUsuarios();
            setListaUsuarios(rows);
        } catch (err) {
            showToast("error", err instanceof Error ? err.message : 'No se pudo cargar la lista de usuarios.');
        } finally {
            setCargando(false);
        }
    };

    // Carga inicial + suscripción en tiempo real: cualquier alta,
    // edición o revocación de credenciales (aquí o en otra pantalla
    // que también toque "usuarios") refresca la lista sola, sin
    // recargar la página ni hacer polling.
    useEffect(() => {
        cargarUsuarios();
        const unsubscribe = window.api.onChange((entity) => {
            if (entity === 'usuarios') cargarUsuarios();
        });
        return unsubscribe;
    }, []);

    const filteredUsuarios = useMemo(() => {
        const term = busqueda.trim().toLowerCase();
        return listaUsuarios.filter((u) => {
            // Los Dev son invisibles para cualquiera que no sea Dev: ni
            // cuentan en los totales, ni aparecen en la búsqueda ni en
            // el filtro por rol.
            if (u.rol === 'Dev' && !soyDev) return false;

            const matchesTerm =
                !term ||
                `${u.nombres} ${u.apellido_paterno}`.toLowerCase().includes(term) ||
                u.usuario.toLowerCase().includes(term) ||
                (u.contacto?.correo_personal?.toLowerCase().includes(term) ?? false);

            const matchesRol = !filtroRol || u.rol === filtroRol;

            const matchesCredenciales =
                !filtroCredenciales ||
                (filtroCredenciales === 'activo' ? u.auth_usuario !== null : u.auth_usuario === null);

            return matchesTerm && matchesRol && matchesCredenciales;
        });
    }, [listaUsuarios, busqueda, filtroRol, filtroCredenciales, soyDev]);

    // Un solo arreglo ordenado (activos primero, luego historial) para
    // que la paginación avance de corrido sobre los dos grupos, en vez
    // de paginar cada grupo por separado.
    const usuariosOrdenados = useMemo(() => {
        const activos = filteredUsuarios.filter((u) => u.auth_usuario !== null);
        const inactivos = filteredUsuarios.filter((u) => u.auth_usuario === null);
        return [...activos, ...inactivos];
    }, [filteredUsuarios]);

    // Cada vez que cambian los filtros o la búsqueda, la paginación
    // vuelve a arrancar desde la primera página (9 resultados).
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [busqueda, filtroRol, filtroCredenciales]);

    const usuariosVisibles = usuariosOrdenados.slice(0, visibleCount);
    const hayMasPorCargar = visibleCount < usuariosOrdenados.length;

    // Scroll infinito: revisa "a mano" qué tan cerca del sentinel está
    // el usuario y revela 9 más cuando se acerca al fondo.
    //
    // Antes usaba IntersectionObserver, pero dentro de Electron el
    // scroll real casi siempre ocurre en un <div> interno (el que se ve
    // con su propia barra de scroll en la ventana), no en la ventana/
    // documento completo, y el observer se quedaba pegado sin disparar.
    // Por eso aquí:
    //   1. Escucha "scroll" con `capture: true` en window, lo que SÍ
    //      recoge el scroll de cualquier contenedor interno (los
    //      eventos de scroll no burbujean, pero sí se capturan).
    //   2. También revisa una vez al montar/cuando cambian los
    //      resultados, por si ya caben varias páginas sin que el
    //      usuario mueva el mouse (pantallas grandes).
    useEffect(() => {
        if (!hayMasPorCargar) return;

        const revisarPosicion = () => {
            const nodo = sentinelRef.current;
            if (!nodo) return;
            const rect = nodo.getBoundingClientRect();
            const cercaDelFondo = rect.top <= window.innerHeight + 200; // dispara un poco antes de tocar fondo
            if (cercaDelFondo) {
                setVisibleCount((prev) => {
                    const siguiente = prev + PAGE_SIZE;
                    // DEBUG TEMPORAL: quitar esta línea cuando ya confirmes
                    // que la paginación avanza de PAGE_SIZE en PAGE_SIZE.
                    console.log(`[paginación] cargando más: ${prev} → ${siguiente} (total filtrado: ${usuariosOrdenados.length})`);
                    return siguiente;
                });
            }
        };

        revisarPosicion();

        window.addEventListener('scroll', revisarPosicion, true);
        window.addEventListener('resize', revisarPosicion);
        return () => {
            window.removeEventListener('scroll', revisarPosicion, true);
            window.removeEventListener('resize', revisarPosicion);
        };
    }, [hayMasPorCargar, usuariosVisibles.length]);

    const usuariosActivos = usuariosVisibles.filter((u) => u.auth_usuario !== null);
    const usuariosInactivos = usuariosVisibles.filter((u) => u.auth_usuario === null);

    // Totales reales (sobre todo lo filtrado, no solo lo ya revelado)
    // para que el número entre paréntesis del encabezado no baile con
    // la paginación.
    const totalActivos = filteredUsuarios.filter((u) => u.auth_usuario !== null).length;
    const totalInactivos = filteredUsuarios.filter((u) => u.auth_usuario === null).length;

    const handleConfirmDelete = async () => {
        if (!usuarioAEliminar) return;
        const usuario = usuarioAEliminar;
        setUsuarioAEliminar(null);

        // Resguardo: si el perfil ya está en "Sin Acceso" (no tiene
        // auth_usuario), no hay credenciales que revocar. En teoría
        // handleSolicitarEliminar ya filtra esto antes de abrir el
        // modal, pero se valida aquí también por si acaso.
        if (!usuario.auth_usuario) {
            showError("Error", 'Este perfil no tiene credenciales activas; no hay nada que eliminar.');
            return;
        }

        try {
            await revocarCredenciales(usuario.id_perfil_info);
            showToast("success", 'Acceso revocado y credenciales eliminadas exitosamente del servidor.');
            // No hace falta actualizar listaUsuarios a mano: revocarCredenciales
            // dispara "db:changed" y la suscripción de arriba refresca sola.
        } catch (err) {
            showError("Error al Revocar", err instanceof Error ? err.message : 'No se pudo revocar el acceso.');
        }
    };

    // Filtra antes de abrir el modal de confirmación: si el perfil ya
    // no tiene credenciales, no tiene caso preguntar "¿revocar acceso?".
    const handleSolicitarEliminar = (usuario: Usuario) => {
        if (soloLecturaPersonal) {
            showError("Sin permiso", "Tu rol solo tiene acceso de lectura a Personal.");
            return;
        }
        if (!usuario.auth_usuario) {
            showError("Error", 'Este perfil no tiene credenciales activas; no hay nada que eliminar.');
            return;
        }
        setUsuarioAEliminar(usuario);
    };

    const handleAgregarCredenciales = (usuario: Usuario) => {
        if (soloLecturaPersonal) {
            showError("Sin permiso", "Tu rol solo tiene acceso de lectura a Personal.");
            return;
        }
        // Atajo desde el menú de la tarjeta: va directo a la pantalla de
        // AsignarCredenciales, sin pasar primero por el detalle completo.
        setUsuarioParaCredenciales(usuario);
    };

    if (showNewUser) {
        return (
            <>
                <NuevoUsuario onBack={() => setShowNewUser(false)} showToast={showToast} showError={showError} />
                <Toast toast={toast} />
                <ErrorModal isOpen={errorModal.isOpen} onClose={() => setErrorModal({ ...errorModal, isOpen: false })} title={errorModal.title} message={errorModal.message} />
            </>
        );
    }

    if (usuarioParaCredenciales) {
        return (
            <>
                <AsignarCredenciales
                    usuario={usuarioParaCredenciales}
                    onBack={() => setUsuarioParaCredenciales(null)}
                    onSuccess={() => {
                        setUsuarioParaCredenciales(null);
                        showToast("success", "Credenciales asignadas correctamente.");
                        // No hace falta recargar la lista a mano: asignarCredenciales
                        // dispara "db:changed" y la suscripción de arriba refresca sola.
                    }}
                    showError={showError}
                />
                <Toast toast={toast} />
                <ErrorModal isOpen={errorModal.isOpen} onClose={() => setErrorModal({ ...errorModal, isOpen: false })} title={errorModal.title} message={errorModal.message} />
            </>
        );
    }

    if (usuarioSeleccionado) {
        return (
            <>
                <DetalleUsuario
                    usuario={usuarioSeleccionado}
                    onBack={() => setUsuarioSeleccionado(null)}
                    showToast={showToast}
                    showError={showError}
                    soloLectura={soloLecturaPersonal}
                />
                <Toast toast={toast} />
                <ErrorModal isOpen={errorModal.isOpen} onClose={() => setErrorModal({ ...errorModal, isOpen: false })} title={errorModal.title} message={errorModal.message} />
            </>
        );
    }

    return (
        <>
            <div className="app-content">
                <div className="usr-page-heading">
                    <div>
                        <h1>Personal del Sistema</h1>
                        <p>Gestiona usuarios y sus permisos según el rol asignado.</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowNewUser(true)} style={soloLecturaPersonal ? { display: 'none' } : undefined}>
                        <UserPlus size={18} />
                        Agregar nuevo usuario
                    </button>
                </div>

                {/* Filtros */}
                <div className="card card-context context-info usr-filters-card">
                    <div className="usr-filters-grid">
                        <FormInput
                            label="Búsqueda"
                            placeholder="Nombre, usuario o correo"
                            value={busqueda}
                            onChange={(val) => setBusqueda(val)}
                            className="form-input usr-search-input"
                            wrapperClassName="usr-search-wrap"
                            iconLeft={<Search size={14} className="usr-search-icon" />}
                        />

                        <FormSelect
                            label="Rol"
                            value={filtroRol}
                            onChange={(val) => setFiltroRol(val)}
                            placeholder="Todos los roles"
                            options={[
                                { value: '', label: 'Todos los Roles' },
                                ...(soyDev ? [{ value: 'Dev', label: 'Dev' }] : []),
                                { value: 'administrador', label: 'Administrador' },
                                { value: 'cajero', label: 'Cajero' },
                                { value: 'contador', label: 'Contador' },
                            ]}
                        />

                        <FormSelect
                            label="Credenciales"
                            value={filtroCredenciales}
                            onChange={(val) => setFiltroCredenciales(val)}
                            placeholder="Todos los estados"
                            options={[
                                { value: '', label: 'Todos los Estados' },
                                { value: 'activo', label: 'Acceso Activo' },
                                { value: 'inactivo', label: 'Sin Acceso (Historial)' },
                            ]}
                        />
                    </div>
                </div>

                {/* Contenedor Principal de Listados */}
                {cargando ? (
                    <div className="usr-state-message">Cargando personal...</div>
                ) : filteredUsuarios.length === 0 ? (
                    <div className="usr-state-message">No se encontraron usuarios.</div>
                ) : (
                    <div className="usr-groups">

                        {/* GRUPO 1: CON CREDENCIALES ACTIVAS */}
                        {usuariosActivos.length > 0 && (
                            <div>
                                <div className="usr-group-title">
                                    <ShieldCheck size={18} />
                                    <h2>Personal con Acceso Activo ({totalActivos})</h2>
                                </div>
                                <div className="usr-grid">
                                    {usuariosActivos.map((u) => (
                                        <UserCard
                                            key={u.id_perfil_info}
                                            usuario={u}
                                            onDelete={(u) => handleSolicitarEliminar(u)}
                                            onAddCredentials={(u) => handleAgregarCredenciales(u)}
                                            onClick={(u) => setUsuarioSeleccionado(u)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* GRUPO 2: HISTORIAL O INACTIVOS (MANDADOS AL FINAL) */}
                        {usuariosInactivos.length > 0 && (
                            <div className="usr-group-historial">
                                <div className="usr-group-title">
                                    <ShieldAlert size={18} />
                                    <h2>Historial de Personal / Sin Acceso ({totalInactivos})</h2>
                                </div>
                                <div className="usr-grid is-inactive">
                                    {usuariosInactivos.map((u) => (
                                        <UserCard
                                            key={u.id_perfil_info}
                                            usuario={u}
                                            onDelete={(u) => handleSolicitarEliminar(u)}
                                            onAddCredentials={(u) => handleAgregarCredenciales(u)}
                                            onClick={(u) => setUsuarioSeleccionado(u)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Sentinel de scroll infinito: invisible, solo dispara la
                            siguiente página cuando entra en el viewport. */}
                        {hayMasPorCargar && (
                            <div
                                ref={sentinelRef}
                                className="usr-load-more-sentinel"
                                style={{ textAlign: 'center', padding: '24px 0', opacity: 0.6, fontSize: 14 }}
                            >
                                <span className="usr-load-more-text">Cargando más personal...</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <WarningModal
                isOpen={usuarioAEliminar !== null}
                onClose={() => setUsuarioAEliminar(null)}
                onConfirm={handleConfirmDelete}
                title="Revocar Acceso por Completo"
                message={`¿Estás seguro de que deseas eliminar permanentemente las credenciales de ${usuarioAEliminar?.nombres} ${usuarioAEliminar?.apellido_paterno}? Las credenciales de acceso se borrarán del servidor de autenticación de inmediato. El perfil se mandará al fondo de la lista para conservar su historial.`}
            />
            <ErrorModal
                isOpen={errorModal.isOpen}
                onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
                title={errorModal.title}
                message={errorModal.message}
            />
            <Toast toast={toast} />
        </>
    );
}