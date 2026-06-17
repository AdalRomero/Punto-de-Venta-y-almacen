import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Home from './home/Home';

/* Page registry — agrega aquí tus páginas futuras */
const pages: Record<string, React.ReactNode> = {
  home: <Home />,
  inventory: <Placeholder title="Inventario" />,
  orders: <Placeholder title="Pedidos" />,
  products: <Placeholder title="Productos" />,
  suppliers: <Placeholder title="Proveedores" />,
  customers: <Placeholder title="Clientes" />,
  reports: <Placeholder title="Reportes" />,
  settings: <Placeholder title="Configuración" />,
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

export default function AppLayout() {
  const [activePage, setActivePage] = useState('home');

  const pageTitles: Record<string, string> = {
    home: 'Inicio',
    inventory: 'Inventario',
    orders: 'Pedidos',
    products: 'Productos',
    suppliers: 'Proveedores',
    customers: 'Clientes',
    reports: 'Reportes',
    settings: 'Configuración',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--cuh-text-muted)' }}>La Cuchilla</span>
            <span style={{ fontSize: 13, color: 'var(--cuh-text-light)' }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cuh-text-dark)' }}>
              {pageTitles[activePage] ?? activePage}
            </span>
          </div>

          {/* Header right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Notifications */}
            <button className="btn-icon" aria-label="Notificaciones" style={{ position: 'relative' }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span style={{
                position: 'absolute', top: 4, right: 4,
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--cuh-primary)', border: '2px solid white'
              }} />
            </button>

            {/* Avatar */}
            <div
              className="avatar-initials sm"
              role="button"
              tabIndex={0}
              aria-label="Perfil"
              style={{ cursor: 'pointer' }}
            >
              AD
            </div>
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
