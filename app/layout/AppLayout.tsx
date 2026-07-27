import React, { useState, useEffect, useRef } from 'react';
import '../css/sidebar.css';
import Sidebar from '../components/Sidebar';
import Home from '../layout/home/home';
import Inventory from './inventory/Inventory';
import Ventas from './inventory/ventas';
import Fiados from './inventory/fiado';
import Users from './users/users';
import Catalogo from './catalogo/catalago';
import { useAuth } from '../../src/context/AuthContext';
import type { Usuario } from '../../src/services/user.service';
import { puedeVerPagina } from '../../src/utils/permisos';
import DevDatabase from './dev/Devdatabase';
import NotificationsCard from '../components/NotificationsCard';
import Reportes from './reports/reportes';

/* ─── Helpers de presentación ────────────────── */

/** "Adal Rome" -> "AR". Cae a "?" si por lo que sea no hay nombre. */
function iniciales(usuario: Usuario | null): string {
  if (!usuario) return '?';
  const a = usuario.nombres?.trim()?.[0] ?? '';
  const b = usuario.apellido_paterno?.trim()?.[0] ?? '';
  const combinado = `${a}${b}`.toUpperCase();
  return combinado || '?';
}

function nombreCompleto(usuario: Usuario | null): string {
  if (!usuario) return 'Invitado';
  return [usuario.nombres, usuario.apellido_paterno].filter(Boolean).join(' ');
}

const ROLE_LABELS: Record<string, string> = {
  Dev: 'Desarrollador',
  administrador: 'Super Admin',
  cajero: 'Cajero',
  contador: 'Contador',
};

function rolLegible(rol: string | undefined): string {
  if (!rol) return '';
  return ROLE_LABELS[rol] ?? rol;
}

/* ─── User Profile Dropdown ──────────────────── */
function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { usuario, cerrarSesion } = useAuth();

  // Cierra al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const inic = iniciales(usuario);
  const nombre = nombreCompleto(usuario);
  const rol = rolLegible(usuario?.rol);
  const correo = usuario?.correo_acceso || 'Sin correo';

  const handleLogout = () => {
    setOpen(false);
    cerrarSesion();
    // Si tu App.tsx maneja la ruta activa aparte del AuthContext
    // (ej. showLogin/showApp), agrega aquí la navegación necesaria.
    // Al quedar `usuario` en null, cualquier pantalla que dependa
    // de isAuthenticated debería regresar sola al login.
  };

  return (
    <div className="user-menu" ref={ref}>
      {/* Trigger: avatar + nombre */}
      <button
        className="user-menu__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Menú de usuario"
        id="user-menu-btn"
      >
        <div className="user-menu__avatar">{inic}</div>
        <span className="user-menu__trigger-name">{nombre}</span>
        <span className={`user-menu__trigger-chevron${open ? ' open' : ''}`}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="user-menu__dropdown" role="menu">
          {/* Perfil */}
          <div className="user-menu__profile">
            <div className="user-menu__avatar">{inic}</div>
            <div className="user-menu__profile-info">
              <span className="user-menu__profile-name">{nombre}</span>
              <span className="user-menu__profile-role">{rol}</span>
              <span className="user-menu__profile-email">{correo}</span>
            </div>
          </div>

          {/* Opciones */}
          <div className="user-menu__items">
            <button className="user-menu__item" role="menuitem">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Mi Perfil
            </button>

            <div className="user-menu__divider" />

            <button className="user-menu__item user-menu__item--danger" role="menuitem" onClick={handleLogout}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Page registry ──────────────────────────── */
const pages: Record<string, React.ReactNode> = {
  home: <Home />,
  inventory: <Inventory />,
  sales: <Ventas />,
  catalogos: <Catalogo />,
  reports: <Reportes />,
  users: <Users />,
  fiados: <Fiados />,

  dev: <DevDatabase />,
};

function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--cuh-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="var(--cuh-primary)">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--cuh-text-dark)', margin: 0 }}>{title}</h2>
      <p style={{ color: 'var(--cuh-text-muted)', margin: 0, fontSize: 14 }}>Esta sección está en construcción.</p>
    </div>
  );
}

/** Se muestra si alguien llega a un pageId que su rol no puede ver
 *  (no debería pasar desde el sidebar, que ya oculta esos íconos —
 *  esto es la segunda línea de defensa por si activePage se mueve
 *  desde otro lado, ej. NotificationsCard.onNavigate). */
function AccesoRestringido() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--cuh-danger-light, #fee2e2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="var(--cuh-danger, #dc2626)">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--cuh-text-dark)', margin: 0 }}>Acceso restringido</h2>
      <p style={{ color: 'var(--cuh-text-muted)', margin: 0, fontSize: 14 }}>Tu rol no tiene permiso para ver esta sección.</p>
    </div>
  );
}

/* ─── AppLayout ──────────────────────────────── */
export default function AppLayout() {
  const [activePage, setActivePage] = useState('home');
  const { usuario } = useAuth();

  // Si el rol cambia (otra sesión) o llegan a activePage por una vía
  // que no pasó por el sidebar (ej. NotificationsCard.onNavigate) y
  // ese rol ya no puede ver esa página, regresa sola a "home" en vez
  // de dejar a alguien parado en una sección que no le corresponde.
  useEffect(() => {
    if (usuario && !puedeVerPagina(usuario.rol, activePage)) {
      setActivePage('home');
    }
  }, [usuario, activePage]);

  const pageTitles: Record<string, string> = {
    home: 'Inicio',
    inventory: 'Inventario',
    sales: 'Venta',
    reports: 'Reportes',
    catalogos: 'Catalogos',
    users: 'Gestión de usuarios',
    fiados: 'Fiados',

    dev: 'DEV',
  };

  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <div className="app-main">
        {/* Top header */}
        <header className="app-header">
          {/* Mobile menu toggle */}
          <button
            className="mobile-menu-btn"
            onClick={() => {
              const btn = document.getElementById('sidebar-mobile-toggle');
              btn?.click();
            }}
            aria-label="Abrir menú"
          >
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Breadcrumb */}
          <div className="app-breadcrumb">
            <span className="app-breadcrumb__root">La Cuchilla</span>
            <span className="app-breadcrumb__sep" />
            <span className="app-breadcrumb__current">
              {pageTitles[activePage] ?? activePage}
            </span>
          </div>

          {/* Header right */}
          <div className="app-header-actions">
            {/* Notifications */}
            <NotificationsCard onNavigate={setActivePage} />

            {/* User dropdown */}
            <UserMenu />
          </div>
        </header>

        {/* Page content */}
        <main className="app-content">
          {usuario && !puedeVerPagina(usuario.rol, activePage)
            ? <AccesoRestringido />
            : (pages[activePage] ?? <Placeholder title={pageTitles[activePage] ?? activePage} />)}
        </main>
      </div>
    </div>
  );
}