import React, { useState, useEffect, useRef } from 'react';
import '../css/sidebar.css';
import Sidebar from '../components/Sidebar';
import Home from '../layout/home/home';
import Inventory from './inventory/Inventory';
import Ventas from './inventory/ventas';
import Users from './users/users';
import Catalogo from './catalogo/catalago';

/* ─── User Profile Dropdown ──────────────────── */
function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        <div className="user-menu__avatar">AD</div>
        <span className="user-menu__trigger-name">Administrador</span>
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
            <div className="user-menu__avatar">AD</div>
            <div className="user-menu__profile-info">
              <span className="user-menu__profile-name">Administrador</span>
              <span className="user-menu__profile-role">Super Admin</span>
              <span className="user-menu__profile-email">admin@cuchilla.com</span>
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
            <button className="user-menu__item" role="menuitem">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configuración
            </button>

            <div className="user-menu__divider" />

            <button className="user-menu__item user-menu__item--danger" role="menuitem">
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
  reports: <Placeholder title="Reportes" />,
  users: <Users />,
  dev: <Placeholder title="DEV" />,
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

/* ─── AppLayout ──────────────────────────────── */
export default function AppLayout() {
  const [activePage, setActivePage] = useState('home');

  const pageTitles: Record<string, string> = {
    home: 'Inicio',
    inventory: 'Inventario',
    sales: 'Venta',
    reports: 'Reportes',
    catalogos: 'Catalogos',
    users: 'Gestión de usuarios',
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
            <button className="btn-icon app-notif-btn" aria-label="Notificaciones">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="app-notif-dot" />
            </button>

            {/* User dropdown */}
            <UserMenu />
          </div>
        </header>

        {/* Page content */}
        <main className="app-content">
          {pages[activePage] ?? <Placeholder title={pageTitles[activePage] ?? activePage} />}
        </main>
      </div>
    </div>
  );
}