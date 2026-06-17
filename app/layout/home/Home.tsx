import '../../css/home.css';

/* ─── Mock data ─────────────────────────────────── */
const stats = [
  {
    id: 'ventas',
    label: 'Ventas del Día',
    value: '$4,820',
    trend: '+12%',
    trendDir: 'up' as const,
    trendLabel: 'vs ayer',
    variant: 'primary' as const,
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'pedidos',
    label: 'Pedidos Activos',
    value: '38',
    trend: '+5',
    trendDir: 'up' as const,
    trendLabel: 'nuevos hoy',
    variant: 'success' as const,
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    id: 'productos',
    label: 'Bajo Stock',
    value: '7',
    trend: '-2',
    trendDir: 'down' as const,
    trendLabel: 'productos críticos',
    variant: 'warning' as const,
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    id: 'clientes',
    label: 'Clientes Hoy',
    value: '124',
    trend: '+8%',
    trendDir: 'up' as const,
    trendLabel: 'vs semana pasada',
    variant: 'info' as const,
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const recentActivity = [
  { id: 1, name: 'Pedido #2041', meta: 'Juan García · hace 8 min', amount: '$320.00', type: 'order' },
  { id: 2, name: 'Pedido #2040', meta: 'María López · hace 22 min', amount: '$95.50', type: 'order' },
  { id: 3, name: 'Pedido #2039', meta: 'Carlos Ruiz · hace 47 min', amount: '$214.00', type: 'order' },
  { id: 4, name: 'Pedido #2038', meta: 'Ana Torres · hace 1 h', amount: '$560.00', type: 'order' },
  { id: 5, name: 'Pedido #2037', meta: 'Luis Morales · hace 2 h', amount: '$128.75', type: 'order' },
];

const quickActions = [
  {
    id: 'new-order',
    label: 'Nuevo Pedido',
    desc: 'Registrar venta o pedido',
    variant: 'primary' as const,
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    id: 'add-product',
    label: 'Agregar Producto',
    desc: 'Añadir al inventario',
    variant: 'success' as const,
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    id: 'new-supplier',
    label: 'Nuevo Proveedor',
    desc: 'Registrar proveedor',
    variant: 'info' as const,
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'generate-report',
    label: 'Generar Reporte',
    desc: 'Exportar resumen del día',
    variant: 'warning' as const,
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

/* ─── Helpers ────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getFormattedDate() {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

/* ─── Component ──────────────────────────────────── */
export default function Home() {
  const greeting = getGreeting();
  const dateStr = getFormattedDate();

  return (
    <div className="home-page">

      {/* ── Banner ───────────────────────────────── */}
      <div className="home-banner">
        <div className="home-banner__text">
          <p className="home-banner__eyebrow">Panel de control</p>
          <h1 className="home-banner__title">Resumen de Operaciones</h1>
          <p className="home-banner__sub">Todo bajo control — aquí tienes lo más relevante del día.</p>
        </div>
        <div className="home-banner__action">
          <button className="btn btn-primary">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Pedido
          </button>
        </div>
      </div>

      {/* ── Greeting ─────────────────────────────── */}
      <div className="home-greeting">
        <div>
          <h2 className="home-greeting__title">{greeting}, Administrador 👋</h2>
          <p className="home-greeting__sub">Aquí está el resumen de tu tienda hoy.</p>
        </div>
        <span className="home-greeting__date">{dateStr}</span>
      </div>

      {/* ── Stats ────────────────────────────────── */}
      <div className="home-stats">
        {stats.map((stat) => (
          <div
            key={stat.id}
            className={`home-stat-card home-stat-card--${stat.variant}`}
          >
            <div className="home-stat-card__header">
              <span className="home-stat-card__label">{stat.label}</span>
              <div className={`home-stat-card__icon home-stat-card__icon--${stat.variant}`}>
                {stat.icon}
              </div>
            </div>
            <div className="home-stat-card__value">{stat.value}</div>
            <div className={`home-stat-card__trend home-stat-card__trend--${stat.trendDir}`}>
              {stat.trendDir === 'up' ? (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              )}
              <span>{stat.trend}</span>
              <span style={{ fontWeight: 400, color: 'var(--cuh-text-light)' }}>{stat.trendLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-column content ────────────────────── */}
      <div className="home-content-grid">

        {/* Recent activity */}
        <div className="home-activity-card">
          <div className="home-section-title">
            Actividad Reciente
            <button>Ver todos →</button>
          </div>
          {recentActivity.map((item) => (
            <div key={item.id} className="home-activity-row">
              <div className="home-activity__icon">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="home-activity__info">
                <div className="home-activity__name">{item.name}</div>
                <div className="home-activity__meta">{item.meta}</div>
              </div>
              <span className="home-activity__amount">{item.amount}</span>
              <span className="badge badge-entregada">Entregado</span>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="home-quick-card">
          <div className="home-section-title">Acciones Rápidas</div>
          {quickActions.map((action) => (
            <button key={action.id} className={`home-quick-btn home-quick-btn--${action.variant}`}>
              <div className="home-quick-btn__icon">{action.icon}</div>
              <div>
                <div className="home-quick-btn__label">{action.label}</div>
                <div className="home-quick-btn__desc">{action.desc}</div>
              </div>
              <span className="home-quick-btn__arrow">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
