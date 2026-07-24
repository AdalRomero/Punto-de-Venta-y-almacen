import { useEffect, useState, useCallback } from 'react';
import '../../css/home.css';

import type { FamiliaRow, ImpuestoRow, MargenRow, ProductoRow, ProductoPayload } from '../../components/add/addproducto';
import type { EntradaPayload } from '../../components/add/addentrada';
import type { ProductoListado } from '../../../src/services/inventory.service';

import AddProducto from '../../components/add/addproducto';
import AddEntrada from '../../components/add/addentrada';
import Devoluciones, { type DevolucionPayload } from '../../components/add/devoluciones';
import Toast, { useToast } from '../../components/Toast ';

import {
  listarProductosInventario,
  listarMargenesVigentes,
  listarImpuestosVigentes,
  listarProductosParaModal,
  crearProducto,
  crearEntrada
} from '../../../src/services/inventory.service';
import { listarFamilias } from '../../../src/services/catalogos.service';
import { registrarDevolucion } from '../../../src/services/devoluciones.service';
import { listarActividadReciente, obtenerEstadisticasInicio, type ActividadRow, type EstadisticasInicio } from '../../../src/services/ventas.service';

function buildAreaChart(
  data: { h: string; v: number }[],
  width = 700,
  height = 130,
  padTop = 10,
  padBottom = 6,
) {
  if (!data || data.length === 0) return { points: [], linePath: '', areaPath: '', width, height };
  const max = Math.max(...data.map((d) => d.v));
  const safeMax = max === 0 ? 1 : max;
  const stepX = width / (data.length - 1);
  const points = data.map((d, i) => ({
    x: i * stepX,
    y: padTop + (1 - d.v / safeMax) * (height - padTop - padBottom),
    ...d,
  }));
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)},${height} L ${points[0].x.toFixed(1)},${height} Z`;
  return { points, linePath, areaPath, width, height };
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

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `hace ${diffMins} min`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `hace ${diffHrs} h`;
  return `hace ${Math.floor(diffHrs / 24)} días`;
}

type AlertType = 'out' | 'expired' | 'shelf_out' | 'low' | 'expiring' | 'shelf_low';

function stockAlertIcon(type: AlertType) {
  // Ícono X para agotado total / estantería vacía
  if (type === 'out' || type === 'shelf_out') {
    return (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  // Ícono reloj para fechas de caducidad
  if (type === 'expired' || type === 'expiring') {
    return (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  // Ícono triángulo de advertencia para stock bajo / estantería baja
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function stockAlertLabel(type: AlertType) {
  if (type === 'out')      return 'Agotado';
  if (type === 'expired')  return 'Caducado';
  if (type === 'shelf_out') return 'Sin estantería';
  if (type === 'low')      return 'Stock bajo';
  if (type === 'expiring') return 'Por caducar';
  return 'Estantería baja';
}

// Qué clase CSS de badge y de ícono corresponde a cada tipo
function alertBadgeClass(type: AlertType): string {
  if (type === 'out' || type === 'expired' || type === 'shelf_out') return 'is-black';
  return 'is-danger'; // low, expiring, shelf_low → rojo
}

function alertIconClass(type: AlertType): string {
  if (type === 'out' || type === 'expired' || type === 'shelf_out') return 'out'; // CSS negro
  if (type === 'expiring') return 'expiring'; // CSS amarillo (riesgo)
  return 'low'; // low, shelf_low → CSS rojo
}

/* ─── Component ──────────────────────────────────── */
export default function Home() {
  const greeting = getGreeting();
  const dateStr = getFormattedDate();
  const { toast, showToast } = useToast();

  /* ─── State for Modals & Data ────────────────────── */
  const [productosInventario, setProductosInventario] = useState<ProductoListado[]>([]);
  const [productosModal, setProductosModal] = useState<ProductoRow[]>([]);
  const [familias, setFamilias] = useState<FamiliaRow[]>([]);
  const [margenes, setMargenes] = useState<MargenRow[]>([]);
  const [impuestos, setImpuestos] = useState<ImpuestoRow[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActividadRow[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasInicio | null>(null);
  
  const [isAddProductoOpen, setIsAddProductoOpen] = useState(false);
  const [isAddEntradaOpen, setIsAddEntradaOpen] = useState(false);
  const [isDevolucionesOpen, setIsDevolucionesOpen] = useState(false);

  /* ─── Fetch Data ─────────────────────────────────── */
  const cargarDatos = useCallback(async () => {
      try {
          const [
              productosListado,
              familiasRows,
              margenesRows,
              impuestosRows,
              productosModalList,
              actividad,
              stats,
          ] = await Promise.all([
              listarProductosInventario(),
              listarFamilias(),
              listarMargenesVigentes(),
              listarImpuestosVigentes(),
              listarProductosParaModal(),
              listarActividadReciente(10),
              obtenerEstadisticasInicio(),
          ]);
          setProductosInventario(productosListado);
          setFamilias(familiasRows);
          setMargenes(margenesRows);
          setImpuestos(impuestosRows);
          setProductosModal(productosModalList);
          setRecentActivity(actividad);
          setEstadisticas(stats);
      } catch (err) {
          console.error("Error al cargar inventario:", err);
      }
  }, []);

  useEffect(() => {
      cargarDatos();
      const unsubscribe = window.api.onChange((entity) => {
          if (entity === "productos" || entity === "familias" || entity === "ventas") cargarDatos();
      });
      return unsubscribe;
  }, [cargarDatos]);

  /* ─── Handlers ───────────────────────────────────── */
  const handleGuardarProducto = async (payload: ProductoPayload) => {
      try {
          await crearProducto(payload);
          setIsAddProductoOpen(false);
          showToast("success", "Producto guardado exitosamente.");
      } catch (err) {
          showToast("error", err instanceof Error ? err.message : "No se pudo guardar el producto.");
      }
  };

  const handleGuardarEntrada = async (payload: EntradaPayload) => {
      try {
          await crearEntrada(payload);
          setIsAddEntradaOpen(false);
          showToast("success", "Entrada registrada exitosamente.");
      } catch (err) {
          showToast("error", err instanceof Error ? err.message : "No se pudo registrar la entrada.");
      }
  };

  const handleGuardarDevolucion = async (payload: DevolucionPayload) => {
      try {
          await registrarDevolucion(payload);
          setIsDevolucionesOpen(false);
          showToast("success", "Devolución registrada exitosamente.");
      } catch (err) {
          showToast("error", err instanceof Error ? err.message : "No se pudo registrar la devolución.");
      }
  };

  /* ─── Compute Alerts (sólo rojo y negro) ─────────────── */
  // Regla de prioridad para clasificar:
  //   NEGRO: sin existencias totales > caducado > sin existencias en estantería
  //   ROJO : stock bajo > próximo a caducar > estantería baja
  const rawAlerts = productosInventario.filter(p => p.alertLevel === 'black' || p.alertLevel === 'red');
  const stockAlerts = rawAlerts.map(p => {
    let type: 'out' | 'expired' | 'shelf_out' | 'low' | 'expiring' | 'shelf_low' = 'low';
    let meta = '';

    if (p.alertLevel === 'black') {
      if      (p.alertLevelStock === 'black')      type = 'out';
      else if (p.alertLevelCaducidad === 'black')  type = 'expired';
      else if (p.alertLevelEstanteria === 'black') type = 'shelf_out';
      else                                          type = 'out'; // fallback
    } else { // red
      if      (p.alertLevelStock === 'red')        type = 'low';
      else if (p.alertLevelCaducidad === 'red')    type = 'expiring';
      else if (p.alertLevelEstanteria === 'red')   type = 'shelf_low';
      else                                          type = 'low'; // fallback
    }

    if      (type === 'out')       meta = 'Sin existencias';
    else if (type === 'expired')   meta = 'Producto caducado';
    else if (type === 'shelf_out') meta = 'Estantería vacía (hay en almacén)';
    else if (type === 'low')       meta = `Quedan ${p.cantidad_total} unidades`;
    else if (type === 'expiring')  meta = p.proxima_caducidad ? `Caduca el ${new Date(p.proxima_caducidad).toLocaleDateString('es-MX', {day: 'numeric', month: 'short'})}` : 'Por caducar pronto';
    else if (type === 'shelf_low') meta = `Estantería: ${p.cantidad_estanteria} / ${p.meta_estanteria} uds`;

    return { id: p.id_producto, name: p.nombre, meta, type };
  }).slice(0, 8);


  /* ─── Quick Actions ──────────────────────────────── */
  const quickActions = [
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
      action: () => setIsAddProductoOpen(true)
    },
    {
      id: 'add-entrada',
      label: 'Lotes / Entradas',
      desc: 'Registrar entrada de mercancía',
      variant: 'primary',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      ),
      action: () => setIsAddEntradaOpen(true)
    },
    {
      id: 'devoluciones',
      label: 'Devoluciones',
      desc: 'Registrar devolución',
      variant: 'info',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
        </svg>
      ),
      action: () => setIsDevolucionesOpen(true)
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
      action: () => {} // Inactive for now
    },
  ];

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
              <div className="home-hero-card__value">
                {estadisticas ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(estadisticas.ventasHoy) : '$0'}
              </div>
              <div className="home-hero-card__trend">
                {estadisticas && estadisticas.tendenciaPorcentaje >= 0 ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 9l7 7 7-7" />
                  </svg>
                )}
                <span className={estadisticas && estadisticas.tendenciaPorcentaje < 0 ? 'text-danger' : ''}>
                  {estadisticas ? (estadisticas.tendenciaPorcentaje > 0 ? '+' : '') + estadisticas.tendenciaPorcentaje.toFixed(1) + '%' : '0%'}
                </span>
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

          {(() => {
            if (!estadisticas || estadisticas.ventasPorHora.length === 0) return null;
            const hourlySales = estadisticas.ventasPorHora;
            const hourlyPeak = hourlySales.reduce((a, b) => (b.v > a.v ? b : a), hourlySales[0] || {h: '', v: 0});
            const hourlyChart = buildAreaChart(hourlySales);
            
            return (
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
                  {hourlyChart.points.map((p) => {
                    const hasSales = p.v > 0;
                    const isPeak = p.h === hourlyPeak.h && hasSales;
                    return (
                      <g key={p.h}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={hasSales ? (isPeak ? 5.5 : 4.5) : 2}
                          fill={hasSales ? 'var(--cuh-primary)' : 'rgba(246,242,233,0.3)'}
                          stroke={hasSales ? '#fff' : 'none'}
                          strokeWidth={hasSales ? 2 : 0}
                          style={{ cursor: hasSales ? 'pointer' : 'default', transition: 'all 0.2s ease' }}
                        >
                          {hasSales && <title>{p.h} - ${p.v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</title>}
                        </circle>
                        {hasSales && (
                          <text
                            x={p.x}
                            y={p.y - 12}
                            textAnchor="middle"
                            fill="var(--cuh-text-dark)"
                            fontSize={isPeak ? "12" : "10"}
                            fontWeight={isPeak ? "bold" : "500"}
                            pointerEvents="none"
                          >
                            ${p.v.toLocaleString('es-MX')}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
                <div className="home-hero-card__chart-axis">
                  {['0h', '6h', '12h', '18h', '23h'].map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </div>
            );
          })()}

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
              <button 
                key={action.id} 
                className={`home-quick-btn home-quick-btn--${action.variant}`} 
                onClick={action.action}
                style={{ opacity: action.id === 'generate-report' ? 0.6 : 1, cursor: action.id === 'generate-report' ? 'not-allowed' : 'pointer' }}
              >
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
          <div className="home-section-title">Resumen Financiero</div>
          <div className="home-finance-card__total">
            <div className="home-finance-card__icon">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="home-finance-card__value">
                {estadisticas ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(estadisticas.ventasMesActual) : '$0'}
              </div>
              <div className="home-finance-card__label">Dinero Ganado este Mes</div>
            </div>
          </div>
          <div className="home-finance-bars">
            {estadisticas && estadisticas.ventasPorMes.map((m, i, arr) => {
              const max = Math.max(...arr.map(x => x.value)) || 1;
              const currentMonthName = new Date().toLocaleDateString('es-MX', { month: 'short' });
              const capitalizedCurrentMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);
              const isPeak = m.label === capitalizedCurrentMonth || i === arr.length - 1;
              const formatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(m.value);
              return (
                <div key={m.label} className="home-finance-bar" title={`${m.label}: ${formatted}`}>
                  <div className="home-finance-bar__track">
                    <div
                      className={`home-finance-bar__fill${isPeak ? ' is-peak' : ''}`}
                      style={{ height: `${(m.value / max) * 100}%` }}
                    />
                  </div>
                  <span className="home-finance-bar__label">{m.label}</span>
                  <span className="home-finance-bar__amount">{formatted}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alertas de inventario */}
        <div className="home-alerts-card">
          <div className="home-section-title">
            Alertas de Inventario
            <button>Ver todo →</button>
          </div>
          <div className="home-alerts-card__list">
            {stockAlerts.length === 0 ? (
              <div style={{ color: 'var(--cuh-text-muted)', fontSize: 13, padding: '10px 0' }}>Todo en orden. No hay alertas críticas.</div>
            ) : (
              stockAlerts.map((a) => (
                <div key={a.id} className="stock-alert-row">
                  <div className={`stock-alert-row__icon ${alertIconClass(a.type)}`}>
                    {stockAlertIcon(a.type)}
                  </div>
                  <div className="stock-alert-row__info">
                    <div className="stock-alert-row__name">{a.name}</div>
                    <div className="stock-alert-row__meta">{a.meta}</div>
                  </div>
                  <span className={`home-status-badge ${alertBadgeClass(a.type)}`}>
                    {stockAlertLabel(a.type)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actividad reciente */}
        <div className="home-activity-card">
          <div className="home-section-title">
            Actividad Reciente
            <button>Ver todos →</button>
          </div>
          <div className="home-activity-card__list">
            {recentActivity.length === 0 ? (
              <div className="home-activity-empty">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>Sin actividad reciente</span>
              </div>
            ) : (
              recentActivity.map((a) => {
                const tipoMeta: Record<ActividadRow['tipo'], { label: string; cls: string; icon: React.ReactNode }> = {
                  venta: {
                    label: 'Venta',
                    cls: 'act-badge--venta',
                    icon: (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    ),
                  },
                  producto: {
                    label: 'Producto',
                    cls: 'act-badge--producto',
                    icon: (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    ),
                  },
                  entrada: {
                    label: 'Entrada',
                    cls: 'act-badge--entrada',
                    icon: (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    ),
                  },
                  devolucion: {
                    label: 'Devolución',
                    cls: 'act-badge--devolucion',
                    icon: (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                      </svg>
                    ),
                  },
                  usuario: {
                    label: 'Usuario',
                    cls: 'act-badge--usuario',
                    icon: (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    ),
                  },
                  otro: {
                    label: 'Sistema',
                    cls: 'act-badge--otro',
                    icon: (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ),
                  },
                };
                const meta = tipoMeta[a.tipo];
                return (
                  <div key={a.id} className="home-act-item">
                    <div className={`home-act-item__icon ${meta.cls}`}>
                      {meta.icon}
                    </div>
                    <div className="home-act-item__body">
                      <div className="home-act-item__title">{a.titulo}</div>
                      <div className="home-act-item__desc">{a.descripcion}</div>
                      <div className="home-act-item__foot">
                        <span className={`home-act-badge ${meta.cls}`}>{meta.label}</span>
                        <span className="home-act-item__time">{timeAgo(a.creado_en)}</span>
                        {a.actor && <span className="home-act-item__actor">· {a.actor}</span>}
                      </div>
                    </div>
                    {a.monto !== undefined && (
                      <div className="home-act-item__amount">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(a.monto)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ── Modals ─────────────────────────────────────── */}
      <AddProducto
          isOpen={isAddProductoOpen}
          onClose={() => setIsAddProductoOpen(false)}
          editProduct={null}
          familias={familias}
          margenes={margenes}
          impuestos={impuestos}
          onSave={handleGuardarProducto}
      />

      <AddEntrada
          isOpen={isAddEntradaOpen}
          onClose={() => setIsAddEntradaOpen(false)}
          productos={productosModal}
          margenes={margenes}
          impuestos={impuestos}
          onSave={handleGuardarEntrada}
      />

      <Devoluciones
          isOpen={isDevolucionesOpen}
          onClose={() => setIsDevolucionesOpen(false)}
          productos={productosModal}
          onSave={handleGuardarDevolucion}
      />
      
      {toast && <Toast toast={toast} />}
    </div>
  );
}