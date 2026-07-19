import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Mail, Phone, Home, User, Trash2 } from 'lucide-react';

interface Usuario {
    id_perfil_info: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string;
    usuario: string;
    rol: string;
    auth_usuario: string | null;
    contacto: {
        correo_personal: string | null;
        telefono: string | null;
        lada: string | null;
        direccion: string | null;
    } | null;
}

interface UserCardProps {
    usuario: Usuario;
    onDelete: (usuario: Usuario) => void;
    onAddCredentials: (usuario: Usuario) => void;
    onClick?: (usuario: Usuario) => void;
}

// Clase de color por rol (definidas en usuarios.css: .usr-rol-*)
const rolClass: Record<string, string> = {
    'Dev': 'usr-rol-dev',
    'administrador': 'usr-rol-administrador',
    'cajero': 'usr-rol-cajero',
    'contador': 'usr-rol-contador',
};

const rolLabels: Record<string, string> = {
    'Dev': 'Dev',
    'administrador': 'Administrador',
    'cajero': 'Cajero',
    'contador': 'Contador',
};

export default function UserCard({ usuario, onDelete, onAddCredentials, onClick }: UserCardProps) {
    const initials = `${usuario.nombres?.[0] || ''}${usuario.apellido_paterno?.[0] || ''}`.toUpperCase();
    const rolKey = rolClass[usuario.rol] ? usuario.rol : 'cajero';
    const [menuAbierto, setMenuAbierto] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuAbierto(false);
            }
        }
        if (menuAbierto) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuAbierto]);

    return (
        <div
            className={`card card-context context-info usr-card ${rolClass[rolKey]}`}
            onClick={() => onClick && onClick(usuario)}
        >
            {/* Menú contextual */}
            <div ref={menuRef} className="usr-card-menu-wrap" onClick={(e) => e.stopPropagation()}>
                <button
                    className="btn-icon"
                    aria-label="Opciones"
                    onClick={(e) => {
                        e.stopPropagation();
                        setMenuAbierto((v) => !v);
                    }}
                >
                    <MoreVertical size={18} />
                </button>

                {menuAbierto && (
                    <div className="usr-card-menu">
                        {!usuario.auth_usuario && (
                            <button
                                className="usr-card-menu-item is-primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddCredentials(usuario);
                                    setMenuAbierto(false);
                                }}
                            >
                                <User size={16} />
                                Agregar credenciales
                            </button>
                        )}
                        {usuario.auth_usuario && (
                            <button
                                className="usr-card-menu-item is-danger"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(usuario);
                                    setMenuAbierto(false);
                                }}
                            >
                                <Trash2 size={14} />
                                Eliminar
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Avatar e info */}
            <div className="usr-card-header">
                <div className="avatar-initials lg" style={{ background: 'var(--usr-rol-color)' }}>
                    {initials}
                </div>
                <div>
                    <h3 className="usr-card-name">
                        {usuario.nombres} {usuario.apellido_paterno} {usuario.apellido_materno}
                    </h3>
                    <span className="usr-card-username">{usuario.usuario}</span>
                    <div className="usr-card-rol">
                        <span className="usr-badge-rol">{rolLabels[rolKey] || usuario.rol}</span>
                        <span className={`usr-card-status ${usuario.auth_usuario ? 'is-active' : 'is-inactive'}`}>
                            <span className="usr-card-status-dot" />
                            {usuario.auth_usuario ? 'Acceso activo' : 'Sin acceso'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Contacto */}
            <div className="usr-card-contact">
                <div className="usr-card-contact-row">
                    <Mail size={14} />
                    <span>{usuario.contacto?.correo_personal || 'Sin correo'}</span>
                </div>
                <div className="usr-card-contact-row">
                    <Phone size={14} />
                    <span>
                        {usuario.contacto?.telefono
                            ? usuario.contacto.lada
                                ? `+${usuario.contacto.lada} ${usuario.contacto.telefono}`
                                : usuario.contacto.telefono
                            : 'Sin teléfono'}
                    </span>
                </div>
                <div className="usr-card-contact-row">
                    <Home size={14} />
                    <span>{usuario.contacto?.direccion || 'Sin dirección'}</span>
                </div>
            </div>
        </div>
    );
}