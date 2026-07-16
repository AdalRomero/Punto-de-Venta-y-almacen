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

const topPerformers = [
  { id: 1, name: 'Fernanda Ruiz', status: 'En línea', online: true, rating: 4.8 },
  { id: 2, name: 'Roberto Sánchez', status: 'En línea', online: true, rating: 4.6 },
  { id: 3, name: 'Diana Cruz', status: 'hace 12 min', online: false, rating: 4.4 },
];

const zones = [
  { id: 1, name: 'Centro', pct: 42, trend: '+6.1%', color: 'var(--cuh-primary)' },
  { id: 2, name: 'Norte', pct: 33, trend: '+3.4%', color: 'var(--cuh-secondary)' },
  { id: 3, name: 'Sur', pct: 25, trend: '+1.2%', color: 'var(--cuh-info)' },
];

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

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
async function probarConexion() {
  const rows = await window.api.query("SELECT 1 + 1 AS resultado");
  console.log(rows); // [{ resultado: 2 }]
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

      {/* ── Top: Hero + Rate ──────────────────────── */}
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

              <div className="home-hero-card__mini-stats">
                <div className="home-hero-mini-stat">
                  <span className="home-hero-mini-stat__label">Pedidos Activos</span>
                  <span className="home-hero-mini-stat__value">38</span>
                </div>
                <div className="home-hero-mini-stat__divider" />
                <div className="home-hero-mini-stat">
                  <span className="home-hero-mini-stat__label">Clientes Hoy</span>
                  <span className="home-hero-mini-stat__value">124</span>
                </div>
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

          <button className="btn home-hero-card__cta" onClick={probarConexion}>
            Ver estadística completa
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Rate / performance card */}
        <div className="home-rate-card">
          <div className="home-rate-card__header">
            <span>Índice de Desempeño</span>
            <span className="home-rate-card__delta">+2</span>
          </div>

          <div className="home-rate-card__gauge-wrap">
            <div className="gauge" style={{ ['--gauge-pct' as string]: 87 }}>
              <div className="gauge__inner">
                <span className="gauge__value">87</span>
              </div>
            </div>
            <p className="home-rate-card__desc">
              Tu índice subió gracias a tu actividad reciente.
              <strong> ¡Sigue así y consigue más puntos!</strong>
            </p>
          </div>

          <div className="home-rate-card__tip">
            <button className="home-rate-card__tip-play" aria-label="Ver consejo">
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <span>Aprende cómo gestionar todos los aspectos de tu tienda.</span>
          </div>
        </div>
      </div>

      {/* ── Low stock alert strip ─────────────────── */}
      <div className="home-alert-strip">
        <div className="home-alert-strip__icon">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <span><strong>7 productos</strong> tienen bajo stock — 2 menos que ayer.</span>
        <button className="home-alert-strip__action">Ver inventario →</button>
      </div>

      {/* ── Bottom: Finance / Performers / Zones ──── */}
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
              <div className="home-finance-card__label">Ingreso Mensual</div>
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

        {/* Top performers */}
        <div className="home-performers-card">
          <div className="home-section-title">
            Top Vendedores
            <button>Ver todos →</button>
          </div>
          {topPerformers.map((p) => (
            <div key={p.id} className="performer-row">
              <div className="avatar-initials sm performer-row__avatar">{initials(p.name)}</div>
              <div className="performer-row__info">
                <div className="performer-row__name">{p.name}</div>
                <div className={`performer-row__status${p.online ? ' is-online' : ''}`}>
                  {p.online && <span className="performer-row__dot" />}
                  {p.status}
                </div>
              </div>
              <div className="performer-row__rating">
                <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z" />
                </svg>
                {p.rating}
              </div>
            </div>
          ))}
        </div>

        {/* Zones */}
        <div className="home-zones-card">
          <div className="home-section-title">Ventas por Zona</div>
          {zones.map((z) => (
            <div key={z.id} className="zone-row">
              <span className="zone-row__dot" style={{ background: z.color }} />
              <div className="zone-row__info">
                <div className="zone-row__top">
                  <span className="zone-row__name">{z.name}</span>
                  <span className="zone-row__trend">{z.trend}</span>
                </div>
                <div className="zone-row__bar">
                  <div className="zone-row__bar-fill" style={{ width: `${z.pct}%`, background: z.color }} />
                </div>
              </div>
              <span className="zone-row__pct">{z.pct}%</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
