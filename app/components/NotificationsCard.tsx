import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCircle, Trash2, Eye, Info, AlertTriangle, Check } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import { useNotificaciones } from '../../src/hooks/useNotificaciones';
import { formatTiempoRelativo } from '../../src/utils/dateFormatter';
import type { Notificacion } from '../../src/helpers/vite-env.d';

// Color de acento según urgencia. `prioridad` (cuando existe) manda sobre
// `tipo` porque viene directo de la orden relacionada (baja/media/alto/urgente);
// si no hay prioridad, el `tipo` de la notificación decide el color.
const colorPorUrgencia = (notif: Notificacion): string => {
    if (notif.prioridad === 'urgente') return 'var(--cuh-danger)';
    if (notif.prioridad === 'alto') return 'var(--cuh-warning)';
    if (notif.prioridad === 'media') return 'var(--cuh-warning)';
    if (notif.prioridad === 'baja') return 'var(--cuh-success)';
    switch (notif.tipo) {
        case 'alert': return 'var(--cuh-danger)';
        case 'warning': return 'var(--cuh-warning)';
        case 'success': return 'var(--cuh-success)';
        default: return 'var(--cuh-primary)';
    }
};

const getIcon = (tipo: Notificacion['tipo']) => {
    switch (tipo) {
        case 'warning': return <AlertTriangle size={18} style={{ color: 'var(--cuh-warning)' }} />;
        case 'alert': return <AlertTriangle size={18} style={{ color: 'var(--cuh-danger)' }} />;
        case 'success': return <CheckCircle size={18} style={{ color: 'var(--cuh-success)' }} />;
        default: return <Info size={18} style={{ color: 'var(--cuh-primary)' }} />;
    }
};

// Solo navegamos si sabemos construir una ruta para esa referencia.
const rutaParaReferencia = (notif: Notificacion): string | null => {
    if (!notif.id_referencia) return null;
    if (notif.tabla_referencia === 'orden_servicio') return 'sales';
    if (notif.tabla_referencia === 'perfil_info' || notif.tabla_referencia === 'contacto') return 'users';
    return null;
};

interface NotificationsCardProps {
    onNavigate?: (page: string) => void;
}

export default function NotificationsCard({ onNavigate }: NotificationsCardProps) {
    const { usuario } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const {
        notificaciones,
        isLoading,
        unreadCount,
        marcarLeida,
        marcarCompletada,
        marcarTodasComoLeidas,
        eliminar,
    } = useNotificaciones(usuario?.id_perfil_info);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleClickNotificacion = (notif: Notificacion) => {
        if (!notif.is_read) marcarLeida(notif.id_notificacion);
        const ruta = rutaParaReferencia(notif);
        if (ruta && onNavigate) {
            setIsOpen(false);
            onNavigate(ruta);
        }
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <button
                className="btn-icon"
                aria-label="Notificaciones"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'relative',
                    background: isOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: isOpen ? '#ffffff' : 'rgba(255,255,255,0.7)'
                }}
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        minWidth: 16,
                        height: 16,
                        padding: '0 4px',
                        borderRadius: 8,
                        background: 'var(--cuh-danger)',
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid var(--cuh-sidebar-bg)',
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 8,
                    width: 380,
                    background: 'var(--cuh-bg-white)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                    border: '1px solid var(--cuh-border)',
                    overflow: 'hidden',
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: 450,
                }}>
                    {/* Header del panel */}
                    <div style={{
                        padding: '16px',
                        borderBottom: '1px solid var(--cuh-border-light)',
                        background: 'var(--cuh-bg)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--cuh-text-dark)', fontSize: 16 }}>
                            Notificaciones
                        </h3>
                        {unreadCount > 0 && (
                            <button
                                style={{
                                    fontSize: 12,
                                    color: 'var(--cuh-primary)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                }}
                                onClick={marcarTodasComoLeidas}
                                onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                            >
                                <Check size={14} />
                                Marcar todas leídas
                            </button>
                        )}
                    </div>

                    {/* Lista de Notificaciones */}
                    <div style={{ overflowY: 'auto', flex: 1, backgroundColor: 'var(--cuh-bg-white)' }}>
                        {isLoading ? (
                            <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--cuh-text-muted)' }}>
                                <div style={{
                                    width: 32, height: 32, borderRadius: '50%', margin: '0 auto 12px',
                                    border: '3px solid var(--cuh-border-light)',
                                    borderTopColor: 'var(--cuh-primary)',
                                    animation: 'spin 0.8s linear infinite',
                                }} />
                                <p style={{ margin: 0, fontSize: 13 }}>Cargando notificaciones...</p>
                            </div>
                        ) : notificaciones.length === 0 ? (
                            <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--cuh-text-muted)' }}>
                                <Bell size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>No tienes notificaciones</p>
                                <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.8 }}>Te avisaremos cuando haya novedades.</p>
                            </div>
                        ) : (
                            notificaciones.map((notif) => {
                                const accent = colorPorUrgencia(notif);
                                const clickeable = !!rutaParaReferencia(notif);
                                return (
                                    <div
                                        key={notif.id_notificacion}
                                        onClick={() => handleClickNotificacion(notif)}
                                        style={{
                                            padding: '14px 16px 14px 13px',
                                            borderBottom: '1px solid var(--cuh-border-light)',
                                            borderLeft: `3px solid ${notif.is_read ? 'transparent' : accent}`,
                                            background: notif.is_read ? 'transparent' : 'var(--cuh-primary-50)',
                                            transition: 'background 0.2s',
                                            position: 'relative',
                                            opacity: notif.is_completed ? 0.7 : 1,
                                            cursor: clickeable ? 'pointer' : 'default',
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--cuh-primary-50)'}
                                        onMouseOut={(e) => e.currentTarget.style.background = notif.is_read ? 'transparent' : 'var(--cuh-primary-50)'}
                                    >
                                        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                            <div style={{
                                                marginTop: 2,
                                                background: 'var(--cuh-bg)',
                                                padding: 8,
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {getIcon(notif.tipo)}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    margin: '0 0 6px',
                                                    fontWeight: notif.is_read ? 500 : 600,
                                                    color: 'var(--cuh-text-dark)',
                                                    fontSize: 14,
                                                    textDecoration: notif.is_completed ? 'line-through' : 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 8,
                                                }}>
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {notif.titulo}
                                                    </span>
                                                    {!notif.is_read && (
                                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                                                    )}
                                                </p>
                                                <p style={{
                                                    margin: '0 0 10px',
                                                    color: 'var(--cuh-text-muted)',
                                                    fontSize: 13,
                                                    lineHeight: 1.4,
                                                    textDecoration: notif.is_completed ? 'line-through' : 'none'
                                                }}>
                                                    {notif.descripcion}
                                                </p>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: 11, color: 'var(--cuh-text-muted)', fontWeight: 500 }}>
                                                        {formatTiempoRelativo(notif.created)}
                                                    </span>

                                                    {/* Acciones */}
                                                    <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                                                        {!notif.is_read && (
                                                            <button
                                                                onClick={() => marcarLeida(notif.id_notificacion)}
                                                                title="Marcar como vista"
                                                                style={{
                                                                    background: 'var(--cuh-bg)',
                                                                    border: '1px solid var(--cuh-border-light)',
                                                                    padding: '6px',
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer',
                                                                    color: 'var(--cuh-text-muted)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseOver={(e) => { e.currentTarget.style.color = 'var(--cuh-primary)'; e.currentTarget.style.borderColor = 'var(--cuh-primary)'; }}
                                                                onMouseOut={(e) => { e.currentTarget.style.color = 'var(--cuh-text-muted)'; e.currentTarget.style.borderColor = 'var(--cuh-border-light)'; }}
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                        )}
                                                        {!notif.is_completed && (
                                                            <button
                                                                onClick={() => marcarCompletada(notif.id_notificacion)}
                                                                title="Marcar como cumplida"
                                                                style={{
                                                                    background: 'var(--cuh-bg)',
                                                                    border: '1px solid var(--cuh-border-light)',
                                                                    padding: '6px',
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer',
                                                                    color: 'var(--cuh-text-muted)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseOver={(e) => { e.currentTarget.style.color = 'var(--cuh-success)'; e.currentTarget.style.borderColor = 'var(--cuh-success)'; }}
                                                                onMouseOut={(e) => { e.currentTarget.style.color = 'var(--cuh-text-muted)'; e.currentTarget.style.borderColor = 'var(--cuh-border-light)'; }}
                                                            >
                                                                <CheckCircle size={14} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => eliminar(notif.id_notificacion)}
                                                            title="Eliminar notificación"
                                                            style={{
                                                                background: 'var(--cuh-bg)',
                                                                border: '1px solid var(--cuh-border-light)',
                                                                padding: '6px',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                color: 'var(--cuh-text-muted)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--cuh-danger)'; e.currentTarget.style.borderColor = 'var(--cuh-danger)'; }}
                                                            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--cuh-text-muted)'; e.currentTarget.style.borderColor = 'var(--cuh-border-light)'; }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
