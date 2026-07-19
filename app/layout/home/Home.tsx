import '../../css/home.css';

/* ─── Mock data ─────────────────────────────────── */
const financeMonths = [
  { label: 'Dic', value: 8200 },
  { label: 'Ene', value: 9400 },
  { label: 'Feb', value: 7800 },
  { label: 'Mar', value: 11200 },
  { label: 'Abr', value: 12841 },
  { label: 'May', value: 10500 },
];
const financeMax = Math.max(...financeMonths.map((m) => m.value));

const hourlySales = [
  { h: '8h', v: 120 },
  { h: '9h', v: 340 },
  { h: '10h', v: 560 },
  { h: '11h', v: 480 },
  { h: '12h', v: 710 },
  { h: '13h', v: 890 },
  { h: '14h', v: 640 },
  { h: '15h', v: 520 },
  { h: '16h', v: 610 },
  { h: '17h', v: 780 },
  { h: '18h', v: 950 },
  { h: '19h', v: 1120 },
  { h: '20h', v: 980 },
  { h: '21h', v: 730 },
];
const hourlyPeak = hourlySales.reduce((a, b) => (b.v > a.v ? b : a), hourlySales[0]);

function buildAreaChart(
  data: { h: string; v: number }[],
  width = 700,
  height = 130,
  padTop = 10,
  padBottom = 6,
) {
  const max = Math.max(...data.map((d) => d.v));
  const stepX = width / (data.length - 1);
  const points = data.map((d, i) => ({
    x: i * stepX,
    y: padTop + (1 - d.v / max) * (height - padTop - padBottom),
    ...d,
  }));
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)},${height} L ${points[0].x.toFixed(1)},${height} Z`;
  return { points, linePath, areaPath, width, height };
}

const hourlyChart = buildAreaChart(hourlySales);

const quickActions = [
  {
    id: 'new-order',
    label: 'Nuevo Pedido',
    desc: 'Registrar venta o pedido',
    variant: 'primary',
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
    variant: 'success',
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
    variant: 'info',
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
    variant: 'warning',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

const stockAlerts = [
  { id: 1, name: 'Aceite Nutrioli 1L', meta: 'Quedan 3 unidades', type: 'low' as const },
  { id: 2, name: 'Leche Lala Entera 1L', meta: 'Sin existencias', type: 'out' as const },
  { id: 3, name: 'Yogurt Danone 1kg', meta: 'Caducó el 15 jul', type: 'expired' as const },
  { id: 4, name: 'Papel Higiénico Pétalo', meta: 'Quedan 5 unidades', type: 'low' as const },
  { id: 5, name: 'Jamón Fud 250g', meta: 'Caduca el 20 jul', type: 'expired' as const },
  { id: 6, name: 'Refresco Coca-Cola 600ml', meta: 'Sin existencias', type: 'out' as const },
];

const recentActivity = [
  { id: 1, name: 'Pedido #2041', meta: 'Juan García · hace 8 min', amount: '$320.00', status: 'Entregado' },
  { id: 2, name: 'Pedido #2040', meta: 'María López · hace 22 min', amount: '$95.50', status: 'Entregado' },
  { id: 3, name: 'Pedido #2039', meta: 'Carlos Ruiz · hace 47 min', amount: '$214.00', status: 'En proceso' },
  { id: 4, name: 'Pedido #2038', meta: 'Ana Torres · hace 1 h', amount: '$560.00', status: 'Entregado' },
  { id: 5, name: 'Pedido #2037', meta: 'Luis Morales · hace 2 h', amount: '$128.75', status: 'Cancelado' },
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

function activityStatusClass(status: string) {
  if (status === 'Entregado') return 'is-success';
  if (status === 'Cancelado') return 'is-danger';
  return 'is-warning';
}

function stockAlertIcon(type: 'low' | 'out' | 'expired') {
  if (type === 'out') {
    return (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  if (type === 'expired') {
    return (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function stockAlertLabel(type: 'low' | 'out' | 'expired') {
  if (type === 'out') return 'Agotado';
  if (type === 'expired') return 'Caducado';
  return 'Bajo stock';
}

/* ─── Component ──────────────────────────────────── */
export default function Home() {
  const greeting = getGreeting();
  const dateStr = getFormattedDate();

  return (
    <div className="home-page">

      {/* ── Greeting ─────────────────────────────── */}
      <div className="home-greeting">
        <div>
          <h2 className="home-greeting__title">{greeting}, Administrador 👋</h2>
          <p className="home-greeting__sub">Aquí está el resumen de tu tienda hoy.</p>
        </div>
        <span className="home-greeting__date">{dateStr}</span>
      </div>

      {/* ── Top: Hero + Acciones Rápidas ──────────── */}
      <div className="home-top-grid">

        {/* Hero card */}
        <div className="home-hero-card">
          <div className="home-hero-card__glow home-hero-card__glow--a" />
          <div className="home-hero-card__glow home-hero-card__glow--b" />

          <div className="home-hero-card__row">
            <div className="home-hero-card__stat">
              <span className="home-hero-card__eyebrow">Ventas del día</span>
              <div className="home-hero-card__value">$4,820</div>
              <div className="home-hero-card__trend">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                </svg>
                <span>+12%</span>
                <span className="muted">vs ayer</span>
              </div>
            </div>

            {/* Decorative abstract chart art */}
            <svg className="home-hero-card__art" viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="80" cy="70" r="62" fill="rgba(var(--cuh-primary-rgb), 0.12)" />
              <path d="M18 96 L46 68 L68 84 L100 40 L142 58"
                stroke="var(--cuh-primary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <circle cx="18" cy="96" r="5" fill="var(--cuh-primary)" />
              <circle cx="46" cy="68" r="5" fill="#fff" stroke="var(--cuh-primary)" strokeWidth="3" />
              <circle cx="68" cy="84" r="5" fill="#fff" stroke="var(--cuh-primary)" strokeWidth="3" />
              <circle cx="100" cy="40" r="5" fill="#fff" stroke="var(--cuh-primary)" strokeWidth="3" />
              <circle cx="142" cy="58" r="6" fill="var(--cuh-primary)" />
              <g transform="translate(112,16)">
                <rect x="0" y="0" width="34" height="34" rx="10" fill="var(--cuh-bg-white)" />
                <path d="M9 14h16M9 20h10" stroke="var(--cuh-primary)" strokeWidth="2.4" strokeLinecap="round" />
              </g>
            </svg>
          </div>

          <div className="home-hero-card__chart">
            <div className="home-hero-card__chart-head">
              <span>Ganancias por hora</span>
              <span className="home-hero-card__chart-peak">
                Pico: {hourlyPeak.h} · ${hourlyPeak.v.toLocaleString('es-MX')}
              </span>
            </div>
            <svg
              className="home-hero-card__chart-svg"
              viewBox={`0 0 ${hourlyChart.width} ${hourlyChart.height}`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="heroChartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cuh-primary)" stopOpacity="0.42" />
                  <stop offset="100%" stopColor="var(--cuh-primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={hourlyChart.areaPath} fill="url(#heroChartGradient)" />
              <path
                d={hourlyChart.linePath}
                fill="none"
                stroke="var(--cuh-primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {hourlyChart.points.map((p, i) => (
                <circle
                  key={p.h}
                  cx={p.x}
                  cy={p.y}
                  r={i === hourlyChart.points.length - 1 ? 4.5 : 2.5}
                  fill={i === hourlyChart.points.length - 1 ? 'var(--cuh-primary)' : 'rgba(246,242,233,0.55)'}
                  stroke={i === hourlyChart.points.length - 1 ? '#fff' : 'none'}
                  strokeWidth={i === hourlyChart.points.length - 1 ? 2 : 0}
                />
              ))}
            </svg>
            <div className="home-hero-card__chart-axis">
              {['8h', '12h', '16h', '20h'].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>

          <button className="btn home-hero-card__cta">
            Ver estadística completa
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Acciones rápidas */}
        <div className="home-quick-card home-quick-card--hero">
          <div className="home-section-title">Acciones Rápidas</div>
          <div className="home-quick-actions-grid">
            {quickActions.map((action) => (
              <button key={action.id} className={`home-quick-btn home-quick-btn--${action.variant}`}>
                <div className="home-quick-btn__icon">{action.icon}</div>
                <div className="home-quick-btn__label">{action.label}</div>
                <div className="home-quick-btn__desc">{action.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom: Finance / Alertas de stock / Actividad ── */}
      <div className="home-bottom-grid">

        {/* Finance performance */}
        <div className="home-finance-card">
          <div className="home-section-title">Finance Performance</div>
          <div className="home-finance-card__total">
            <div className="home-finance-card__icon">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="home-finance-card__value">$12,841</div>
              <div className="home-finance-card__label">Dinero Ganado este Mes</div>
            </div>
          </div>
          <div className="home-finance-bars">
            {financeMonths.map((m) => (
              <div key={m.label} className="home-finance-bar">
                <div className="home-finance-bar__track">
                  <div
                    className={`home-finance-bar__fill${m.label === 'Abr' ? ' is-peak' : ''}`}
                    style={{ height: `${(m.value / financeMax) * 100}%` }}
                  />
                </div>
                <span className="home-finance-bar__label">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas de inventario */}
        <div className="home-alerts-card">
          <div className="home-section-title">
            Alertas de Inventario
            <button>Ver todo →</button>
          </div>
          <div className="home-alerts-card__list">
            {stockAlerts.map((a) => (
              <div key={a.id} className="stock-alert-row">
                <div className={`stock-alert-row__icon ${a.type}`}>
                  {stockAlertIcon(a.type)}
                </div>
                <div className="stock-alert-row__info">
                  <div className="stock-alert-row__name">{a.name}</div>
                  <div className="stock-alert-row__meta">{a.meta}</div>
                </div>
                <span className={`home-status-badge ${a.type === 'low' ? 'is-warning' : 'is-danger'}`}>
                  {stockAlertLabel(a.type)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actividad reciente */}
        <div className="home-activity-card">
          <div className="home-section-title">
            Actividad Reciente
            <button>Ver todos →</button>
          </div>
          <div className="home-activity-card__list">
            {recentActivity.map((item) => (
              <div key={item.id} className="home-activity-row">
                <div className="home-activity__icon">
                  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="home-activity__info">
                  <div className="home-activity__name">{item.name}</div>
                  <div className="home-activity__meta">{item.meta}</div>
                </div>
                <span className="home-activity__amount">{item.amount}</span>
                <span className={`home-status-badge ${activityStatusClass(item.status)}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}