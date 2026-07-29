import React, { useState } from 'react';
import '../css/sidebar.css';
import { useAuth } from '../../src/context/AuthContext';
import { puedeVerPagina } from '../../src/utils/permisos';
import logo from '../../assets/logo.png';

/* ─── Nav items definition ──────────────────────── */
interface NavItem {
  id: string;
  label: string;
  shortLabel: string;
  badge?: number;
  icon: React.ReactNode;
  groupEnd?: boolean; // renders a divider after this item
}

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const navItems: NavItem[] = [
  // ── Principal ─────────────────────────────
  {
    id: 'home',
    label: 'Inicio',
    shortLabel: 'Inicio',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'inventory',
    label: 'Inventario',
    shortLabel: 'Inventario',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    id: 'sales',
    label: 'Venta',
    shortLabel: 'Venta',
    groupEnd: true,

    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },

  // ── Análisis ──────────────────────────────
  {
    id: 'catalogos',
    label: 'Catalogos',
    shortLabel: 'Catalogos',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },
  {
    id: 'reports',
    label: 'Reportes',
    shortLabel: 'Reportes',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },

  {
    id: 'users',
    label: 'Gestión de usuarios',
    shortLabel: 'Usuarios',
    groupEnd: true,
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  // ── DEV ───────────────────────────────────
  {
    id: 'fiados',
    label: 'Fiados',
    shortLabel: 'Fiados',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8c-1.657 0-3 .672-3 1.5S10.343 11 12 11s3 .672 3 1.5-1.343 1.5-3 1.5m0-6V6m0 1c1.11 0 2.08.402 2.599 1M12 15v1.5m0-1.5c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'dev',
    label: 'DEV',
    shortLabel: 'Dev',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { usuario } = useAuth();

  // Oculta del menú cualquier página que el rol logueado no pueda ver
  // (incluye "dev": solo aparece si usuario.rol === 'Dev') — mismas
  // reglas que ya aplica AppLayout al renderizar el contenido, así el
  // ícono ni siquiera se ofrece si de todos modos no se puede entrar.
  const itemsVisibles = navItems.filter((item) => puedeVerPagina(usuario?.rol, item.id));

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar__overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile toggle button (rendered outside sidebar, picked up by AppLayout) */}
      <button
        id="sidebar-mobile-toggle"
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Abrir menú"
        style={{ display: 'none' /* shown by CSS at ≤768px */ }}
      >
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <aside className={`sidebar${mobileOpen ? ' open' : ''}`} aria-label="Navegación principal">

        {/* ── Brand mark ───────────────────────── */}
        <div className="sidebar__brand">
          <div className="sidebar__brand-mark">
            <img src={logo} alt="LC" />
          </div>
        </div>
        {/* ── Divider ───────────────────────── */}
        <div className="sidebar__divider" />
        {/* ── Navigation ────────────────────────── */}
        <nav className="sidebar__nav" aria-label="Menú principal">
          {itemsVisibles.map((item) => (
            <React.Fragment key={item.id}>
              <button
                id={`nav-${item.id}`}
                className={`sidebar__item${activePage === item.id ? ' active' : ''}`}
                onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
                aria-current={activePage === item.id ? 'page' : undefined}
                title={item.label}
              >
                <span className="sidebar__item-icon">{item.icon}</span>
                <span className="sidebar__item-label">{item.shortLabel}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="sidebar__item-badge">{item.badge}</span>
                )}
              </button>
              {item.groupEnd && <div className="sidebar__divider" />}
            </React.Fragment>
          ))}
        </nav>
      </aside>
    </>
  );
}