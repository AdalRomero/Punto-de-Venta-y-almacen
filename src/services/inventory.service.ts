/* ============================================================
   inventory.service.ts
   Capa de datos para el módulo de Inventario (Inventory.tsx,
   addproducto.tsx, addentrada.tsx). Envuelve window.api y traduce
   entre Producto / Producto_Impuesto / Codigos_Alternos / Inventario
   / Lote / Entrada / Entrada_Detalle del esquema y los shapes que
   ya usan esas tres pantallas.

   Reusa los tipos que YA exportan los componentes (mismo patrón que
   auth.service.ts reusando `Usuario` de user.service.ts) en vez de
   duplicarlos:
     - FamiliaRow, MargenRow, ImpuestoRow, ProductoRow, ProductoPayload,
       CodigoAlternoRow  -> addproducto.tsx
     - CodigoAlternoExistente, EntradaPayload                -> addentrada.tsx

   Familia ya tiene su CRUD completo en catalogos.service.ts
   (listarFamilias/crearFamilia/actualizarFamilia/eliminarFamilia) y
   su shape ({id_familia, nombre, digitos}) ya calza con FamiliaRow,
   así que aquí NO se duplica — Inventory.tsx debe importar
   listarFamilias desde catalogos.service.ts directo.

   IMPORTANTE — cosas que la base de datos ya resuelve sola, así que
   este archivo NO las duplica:
     - costo_final: lo recalculan tr_costo_final_insert/update en
       cada INSERT/UPDATE de Producto (costo_referencia × margen ×
       impuestos vigentes). Lo que mandes en ese campo se sobreescribe;
       no hace falta ni mandarlo.
     - Inventario / Lote: tr_detalle_entrada los crea/actualiza solos
       al insertar en Entrada_Detalle. No hay que tocarlos a mano.
     - Avisos (Aviso): sp_recalcular_avisos_producto corre solo vía
       trigger cuando cambia Inventario o los umbrales del producto.

   PENDIENTE (fuera del alcance de este archivo): EntradaPayload.
   desglose_costos (el desglose de "30 pzas a $10 + 20 a $10.50" que
   arma el promedio) no tiene tabla en el esquema — Entrada_Detalle_Costo
   es para CONCEPTOS de costo (flete, empaque), no para esto. Por ahora
   NO se persiste; ver el comentario en crearEntrada().
   ============================================================ */

import type {
    MargenRow,
    ImpuestoRow,
    ProductoRow,
    ProductoPayload,
    CodigoAlternoRow,
} from '../../app/components/add/addproducto';
import type {
    CodigoAlternoExistente,
    EntradaPayload,
} from '../../app/components/add/addentrada';
import { SESSION_KEY } from '../context/AuthContext';
import { crearNotificacion } from './notificaciones.service';

/* ─── Tipos propios de este archivo ──────────────────────────── */

export type AlertLevel = 'green' | 'yellow' | 'red' | 'black' | 'none';

/** Fila para la tabla de Inventory.tsx — reemplaza a MockProducto. */
export interface ProductoListado {
    id_producto: string;
    nombre: string;
    codigo_interno: string | null;
    id_familia: string | null;
    familia_nombre: string | null;
    impuesto_porcentaje: number; // 0 si no tiene ningún impuesto activo
    costo_final: number | null;
    cantidad_total: number;
    proxima_caducidad: string | Date | null;
    activo: boolean;
    /** Peor de los tres semáforos (stock total, estantería y caducidad)
     *  — la usan los pills de filtro y los KPIs, que hoy no distinguen
     *  origen. */
    alertLevel: AlertLevel;
    /** Semáforo SOLO de existencia total, para la columna "Stock". */
    alertLevelStock: AlertLevel;
    /** Semáforo SOLO de estantería (cantidad_estanteria vs meta_estanteria),
     *  para la columna "Estantería". 'none' si el producto no tiene meta
     *  configurada (nunca se le da seguimiento a su estantería). */
    alertLevelEstanteria: AlertLevel;
    /** Semáforo SOLO de caducidad, para la columna "Caducidad". */
    alertLevelCaducidad: AlertLevel;
    /** Umbrales de días del producto — se exponen para poder colorear
     *  cada lote individual en el modal "Ver lotes" con la misma regla. */
    umbral_rojo_dias: number | null;
    umbral_amarillo_dias: number | null;
    unidad: 'piezas' | 'kilos';
    /** Unidades puestas en estantería ahora mismo (subconjunto de
     *  cantidad_total — el resto vive en almacén). */
    cantidad_estanteria: number;
    /** Unidades que el producto siempre debería tener en estantería.
     *  null = sin meta configurada, no se le da seguimiento. */
    meta_estanteria: number | null;
}

/* Fila cruda de la consulta principal, antes de calcular alertLevel. */
interface ProductoListadoRow {
    id_producto: string;
    codigo_interno: string | null;
    nombre: string;
    costo_final: number | null;
    activo: number | boolean;
    umbral_rojo_dias: number | null;
    umbral_amarillo_dias: number | null;
    umbral_rojo_stock: number | null;
    umbral_amarillo_stock: number | null;
    meta_estanteria: number | null;
    cantidad_estanteria: number | null;
    id_familia: string | null;
    familia_nombre: string | null;
    cantidad_total: number | null;
    proxima_caducidad: string | Date | null;
    unidad: 'piezas' | 'kilos' | null;
    impuesto_porcentaje: number | null;
}

/* ─── Helpers internos ───────────────────────────────────── */

const ENTITY = 'productos';

const uid = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Quita el prefijo que Electron le pega a errores que cruzan IPC y
 *  traduce violaciones de llave foránea / duplicado a un mensaje
 *  que sí se le puede mostrar a quien usa la app. Mismo patrón que
 *  catalogos.service.ts (no se comparte de ahí porque no lo exporta). */
function limpiarMensajeIpc(err: unknown, contexto?: string): string {
    let msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/Error:\s*(.+)$/);
    if (match) msg = match[1];

    if (/foreign key|fk_|constraint/i.test(msg)) {
        return contexto
            ? `No se puede completar la acción: "${contexto}" está en uso por otros registros.`
            : 'No se puede completar la acción porque el registro está en uso por otros datos.';
    }
    if (/duplicate|unique/i.test(msg)) {
        return 'Ya existe un registro con ese código.';
    }
    return msg || 'Ocurrió un error inesperado. Intenta de nuevo.';
}

/** Quién está logueado ahora, leído de sessionStorage (mismo patrón
 *  que obtenerActorId() en user.service.ts) — para Entrada.registrado_por. */
function obtenerActorId(): string | null {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const sesion = JSON.parse(raw) as { id_perfil_info?: string };
        return sesion.id_perfil_info ?? null;
    } catch {
        return null;
    }
}

async function logActividad(accion: string, entidad: string, descripcion: string, entityChannel: string) {
    const actorId = obtenerActorId();
    if (!actorId) return;
    try {
        await window.api.execute(
            `INSERT INTO Bitacora (id_perfil_info, id_actor, accion, entidad, descripcion) VALUES (?, ?, ?, ?, ?)`,
            [actorId, actorId, accion, entidad, descripcion],
            entityChannel
        );
    } catch { }
}

async function getProductName(id: string): Promise<string> {
    try {
        const rows = await window.api.query(`SELECT nombre FROM Producto WHERE id_producto = ?`, [id]);
        return rows[0]?.nombre || `ID: ${id.substring(0, 8)}`;
    } catch {
        return `ID: ${id.substring(0, 8)}`;
    }
}

/** Núcleo reusable: días restantes (redondeados) desde HOY hasta una
 *  fecha 'YYYY-MM-DD' u objeto Date, comparando medianoche LOCAL contra
 *  medianoche LOCAL — día contra día, no hora contra hora. Ver el
 *  comentario largo en diasRestantesDe() para el porqué de cada paso;
 *  se separó de esa función para poder reusarlo también por lote
 *  individual (listarLotesPorProducto), no solo por producto. */
function diasRestantesHasta(fecha: string | Date | null): number | null {
    if (!fecha) return null;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let fechaStr: string;
    if (typeof fecha === 'string') {
        fechaStr = fecha.slice(0, 10);
    } else {
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const day = String(fecha.getDate()).padStart(2, '0');
        fechaStr = `${y}-${m}-${day}`;
    }
    const fechaExp = new Date(`${fechaStr}T00:00:00`);

    return Math.round((fechaExp.getTime() - hoy.getTime()) / 86_400_000);
}

/** row.proxima_caducidad llega como 'YYYY-MM-DD' O como objeto Date, según
 *  lo serialice window.api (mysql2 puede entregar columnas DATE ya
 *  parseadas a Date). Dos trampas de zona horaria distintas a evitar:
 *    - Si es string: `new Date('YYYY-MM-DD')` a secas se interpreta como
 *      medianoche UTC, no local.
 *    - Si ya es Date: mysql2 lo construye en medianoche LOCAL, así que
 *      volver a pasarlo por `.toISOString()` (que siempre da UTC) también
 *      corre la fecha un día — hay que leer sus componentes locales
 *      (getFullYear/getMonth/getDate) tal cual, sin reconvertir a UTC.
 *  En cualquier zona detrás de UTC (México) el resultado de no hacer esto
 *  es un lote marcado "vencido" (o en rojo/amarillo) un día antes de
 *  tiempo. */
function diasRestantesDe(row: ProductoListadoRow): number | null {
    return diasRestantesHasta(row.proxima_caducidad);
}

/** Semáforo SOLO de existencia (columna "Stock"): 0 o menos es
 *  "black" (agotado), y de ahí para arriba se compara contra los
 *  umbrales rojo/amarillo de stock del producto. Sin umbrales
 *  configurados y con stock > 0, es "green". */
function calcularAlertLevelStock(row: ProductoListadoRow): AlertLevel {
    if (!row.activo) return 'none';

    const stock = row.cantidad_total ?? 0;
    if (stock <= 0) return 'black';

    const stockRojo = row.umbral_rojo_stock;
    const stockAmarillo = row.umbral_amarillo_stock;

    if (stockRojo !== null && stock <= stockRojo) return 'red';
    if (stockAmarillo !== null && stock <= stockAmarillo) return 'yellow';
    return 'green';
}

/** Semáforo SOLO de caducidad (columna "Caducidad"): ya vencido
 *  (dias_restantes <= 0) es "black"; de ahí para arriba se compara
 *  contra los umbrales rojo/amarillo de días del producto. Sin
 *  ningún lote con fecha de caducidad, es "none". */
function calcularAlertLevelCaducidad(row: ProductoListadoRow): AlertLevel {
    if (!row.activo) return 'none';

    const diasRestantes = diasRestantesDe(row);
    if (diasRestantes === null) return 'none';
    if (diasRestantes <= 0) return 'black';

    const diasRojo = row.umbral_rojo_dias;
    const diasAmarillo = row.umbral_amarillo_dias;

    if (diasRojo !== null && diasRestantes <= diasRojo) return 'red';
    if (diasAmarillo !== null && diasRestantes <= diasAmarillo) return 'yellow';
    return 'green';
}

/** Semáforo SOLO de estantería (columna "Estantería"), por PORCENTAJE
 *  de cantidad_estanteria contra meta_estanteria:
 *    - Sin meta_estanteria configurada (o meta 0): "none", no se le
 *      da seguimiento a ese producto.
 *    - 0 unidades en estantería: "black" (sin existencias en estantería).
 *    - Hasta 20% de la meta: "red".
 *    - Más de 20% y hasta 40% de la meta: "yellow".
 *    - Más de 40% de la meta: "green". */
function calcularAlertLevelEstanteria(row: ProductoListadoRow): AlertLevel {
    if (!row.activo) return 'none';

    const meta = row.meta_estanteria;
    if (meta === null || meta <= 0) return 'none';

    const enEstanteria = row.cantidad_estanteria ?? 0;
    if (enEstanteria <= 0) return 'black';

    const porcentaje = enEstanteria / meta;
    if (porcentaje <= 0.2) return 'red';
    if (porcentaje <= 0.4) return 'yellow';
    return 'green';
}

/** Peor de dos semáforos, en el mismo orden de prioridad de siempre:
 *  black > red > yellow > green > none. */
function peorAlertLevel(a: AlertLevel, b: AlertLevel): AlertLevel {
    const prioridad: Record<AlertLevel, number> = { black: 4, red: 3, yellow: 2, green: 1, none: 0 };
    return prioridad[a] >= prioridad[b] ? a : b;
}

/** Peor de los tres semáforos (stock total, estantería, caducidad).
 *  La usan los pills de filtro por color y los KPIs de arriba. */
function peorDeTres(a: AlertLevel, b: AlertLevel, c: AlertLevel): AlertLevel {
    return peorAlertLevel(peorAlertLevel(a, b), c);
}

function mapProductoListado(row: ProductoListadoRow): ProductoListado {
    const alertLevelStock = calcularAlertLevelStock(row);
    const alertLevelEstanteria = calcularAlertLevelEstanteria(row);
    const alertLevelCaducidad = calcularAlertLevelCaducidad(row);
    return {
        id_producto: row.id_producto,
        nombre: row.nombre,
        codigo_interno: row.codigo_interno,
        id_familia: row.id_familia,
        familia_nombre: row.familia_nombre,
        impuesto_porcentaje: Number(row.impuesto_porcentaje ?? 0),
        costo_final: row.costo_final != null ? Number(row.costo_final) : null,
        cantidad_total: Number(row.cantidad_total ?? 0),
        proxima_caducidad: row.proxima_caducidad,
        activo: !!row.activo,
        unidad: row.unidad ?? 'piezas',
        umbral_rojo_dias: row.umbral_rojo_dias,
        umbral_amarillo_dias: row.umbral_amarillo_dias,
        cantidad_estanteria: Number(row.cantidad_estanteria ?? 0),
        meta_estanteria: row.meta_estanteria,
        alertLevelStock,
        alertLevelEstanteria,
        alertLevelCaducidad,
        alertLevel: peorDeTres(alertLevelStock, alertLevelEstanteria, alertLevelCaducidad),
    };
}

/** Junta Producto con sus Codigos_Alternos y el (único) impuesto
 *  activo, en el shape ProductoRow que esperan los modales. */
async function armarProductoRow(
    productos: (Omit<ProductoRow, 'codigos_alternos'> & { id_producto: string })[]
): Promise<ProductoRow[]> {
    if (productos.length === 0) return [];

    const ids = productos.map((p) => p.id_producto);
    const placeholders = ids.map(() => '?').join(',');
    const codigos: (CodigoAlternoRow & { id_producto: string })[] = await window.api.query(
        `SELECT id_codigo, id_producto, codigo FROM Codigos_Alternos WHERE id_producto IN (${placeholders})`,
        ids
    );

    const porProducto = new Map<string, CodigoAlternoRow[]>();
    for (const c of codigos) {
        const list = porProducto.get(c.id_producto) ?? [];
        list.push({ id_codigo: c.id_codigo, codigo: c.codigo });
        porProducto.set(c.id_producto, list);
    }

    return productos.map((p) => ({
        ...p,
        // costo_referencia y costo_final son DECIMAL en el esquema; mysql2
        // los entrega como string, no como number. Los modales (addentrada.tsx,
        // addproducto.tsx) hacen aritmética y .toFixed() sobre estos campos
        // esperando number, así que se convierten aquí, en un solo lugar,
        // en vez de en cada componente que consuma ProductoRow.
        costo_referencia: Number(p.costo_referencia),
        costo_final: p.costo_final != null ? Number(p.costo_final) : null,
        ultimo_costo_compra: p.ultimo_costo_compra != null ? Number(p.ultimo_costo_compra) : null,
        codigos_alternos: porProducto.get(p.id_producto) ?? [],
    }));
}

/* ─── Lecturas: catálogos auxiliares para los modales ────────── */

/** Tasa vigente de cada margen — para el selector de margen en
 *  Agregar/Editar Producto. Ya viene en el shape MargenRow. */
export async function listarMargenesVigentes(): Promise<MargenRow[]> {
    const rows = await window.api.query(
        `SELECT id_margenes, nombre, porcentaje FROM v_margenes_vigentes ORDER BY nombre`
    );
    return rows.map((r: any) => ({ ...r, porcentaje: Number(r.porcentaje) }));
}

/** Tasa vigente de cada impuesto — para el selector de impuesto en
 *  Agregar/Editar Producto. Ya viene en el shape ImpuestoRow. */
export async function listarImpuestosVigentes(): Promise<ImpuestoRow[]> {
    const rows = await window.api.query(
        `SELECT id_impuestos, nombre, porcentaje FROM v_impuestos_vigentes ORDER BY nombre`
    );
    return rows.map((r: any) => ({ ...r, porcentaje: Number(r.porcentaje) }));
}

/** Todos los códigos alternos existentes, de cualquier producto —
 *  para que AddEntrada detecte duplicados al escanear. */
export async function listarCodigosAlternosExistentes(): Promise<CodigoAlternoExistente[]> {
    return window.api.query(`SELECT codigo, id_producto FROM Codigos_Alternos`);
}

/* ─── Lecturas: productos ─────────────────────────────────── */

const SELECT_LISTADO = `
    SELECT
        p.id_producto, p.codigo_interno, p.nombre, p.costo_final, p.activo,
        p.umbral_rojo_dias, p.umbral_amarillo_dias, p.umbral_rojo_stock, p.umbral_amarillo_stock,
        p.meta_estanteria, COALESCE(inv.cantidad_estanteria, 0) AS cantidad_estanteria,
        f.id_familia, f.nombre AS familia_nombre,
        -- Stock VIGENTE: no se usa Inventario.cantidad_total tal cual
        -- porque esa columna no sabe cuándo un lote caducó (no hay
        -- trigger/evento en el esquema que pase estado_lote a
        -- 'caducado' solo). Se suma directo de Lote, excluyendo lotes
        -- ya vencidos, para que un producto podrido no siga contando
        -- como stock sano — MÁS los ajustes de Ajuste_Inventario que
        -- no están ligados a ningún lote (id_lote IS NULL): ahí caen
        -- las devoluciones con restock (nadie sabe de qué lote venía
        -- lo que el cliente regresa) y cualquier corrección manual
        -- genérica. Sin este segundo SUM, esos ajustes se guardan en
        -- Inventario.cantidad_total pero esta columna nunca los lee
        -- — la devolución "se guarda" pero el número en pantalla no
        -- se mueve. Los ajustes CON id_lote (ej. actualizarLote) NO
        -- se vuelven a sumar aquí porque ya están dentro de
        -- Lote.cantidad_disponible (tr_ajuste ya los aplicó ahí).
        COALESCE((
            SELECT SUM(l.cantidad_disponible) FROM Lote l
            WHERE l.id_producto = p.id_producto
              AND l.estado_lote IN ('activo','parcial')
              AND (l.fecha_caducidad IS NULL OR l.fecha_caducidad > CURDATE())
        ), 0)
        + COALESCE((
            SELECT SUM(a.cantidad_ajuste) FROM Ajuste_Inventario a
            WHERE a.id_producto = p.id_producto
              AND a.id_lote IS NULL
        ), 0) AS cantidad_total,
        (SELECT MIN(l.fecha_caducidad) FROM Lote l
          WHERE l.id_producto = p.id_producto
            AND l.estado_lote IN ('activo','parcial')
            -- Un lote ya vencido y "enterado" (ver marcarLoteEnterado) deja
            -- de contar para este mínimo: así el semáforo pasa al siguiente
            -- lote más próximo en vez de quedarse pegado en negro para
            -- siempre. Uno vencido y SIN enterar sigue ganando siempre,
            -- porque su fecha pasada es menor que cualquier fecha futura.
            AND (l.fecha_caducidad > CURDATE() OR l.enterado = FALSE)
          ) AS proxima_caducidad,
        (SELECT l.unidad FROM Lote l
          WHERE l.id_producto = p.id_producto ORDER BY l.created DESC LIMIT 1) AS unidad,
        (SELECT MAX(ith.porcentaje) FROM Producto_Impuesto pi
          JOIN Impuesto_Tasa_Historial ith
            ON ith.id_impuestos = pi.id_impuestos AND ith.vigente_hasta IS NULL
          WHERE pi.id_producto = p.id_producto AND pi.activo = TRUE) AS impuesto_porcentaje
    FROM Producto p
    LEFT JOIN Familia f ON f.id_familia = p.id_familia
    LEFT JOIN Inventario inv ON inv.id_producto = p.id_producto
`;

/** Lista completa para la tabla de Inventory.tsx (reemplaza
 *  MOCK_PRODUCTOS). Incluye activos e inactivos — el componente ya
 *  se encarga de mandar los inactivos al final. */
export async function listarProductosInventario(): Promise<ProductoListado[]> {
    const rows: ProductoListadoRow[] = await window.api.query(
        `${SELECT_LISTADO} ORDER BY p.created DESC`
    );
    return rows.map(mapProductoListado);
}

/* ─── Lecturas: lotes de un producto (modal "Ver lotes") ─────── */

/** Fila para el modal de lotes — un renglón por Lote real, para que se
 *  vea CUÁL lote está vencido/por vencer en vez de un solo punto
 *  resumido a nivel producto. */
export interface LoteListado {
    id_lote: string;
    cantidad: number;
    cantidad_disponible: number;
    fecha_caducidad: string | Date | null;
    estado_lote: 'activo' | 'parcial' | 'agotado' | 'caducado';
    unidad: 'piezas' | 'kilos';
    costo_compra: number | null;
    created: string;
    /** Semáforo de ESTE lote (no del producto completo). 'none' si no
     *  tiene fecha_caducidad capturada. */
    alertLevel: AlertLevel;
    /** true si alguien ya "reconoció" este lote vencido (botón del ojo
     *  en la vista de lotes) — deja de forzar el semáforo del producto
     *  a negro, pero el lote sigue existiendo y se sigue viendo como
     *  vencido en el detalle. */
    enterado: boolean;
    enterado_por: string | null;
    enterado_en: string | null;
}

interface LoteListadoRow {
    id_lote: string;
    cantidad: number;
    cantidad_disponible: number;
    fecha_caducidad: string | Date | null;
    estado_lote: LoteListado['estado_lote'];
    unidad: 'piezas' | 'kilos';
    costo_compra: number | string | null;
    created: string;
    enterado: number | boolean;
    enterado_por: string | null;
    enterado_en: string | null;
}

/** Todos los lotes (vigentes, agotados y caducados) de un producto,
 *  del más próximo a vencer al más lejano — para el botón "Ver lotes"
 *  de Inventory.tsx. A diferencia de listarProductosInventario(), aquí
 *  SÍ se incluyen los caducados/agotados: el punto es precisamente
 *  poder ver cuál lote es el que se echó a perder. */
export async function listarLotesPorProducto(
    id_producto: string,
    umbralRojoDias: number | null,
    umbralAmarilloDias: number | null
): Promise<LoteListado[]> {
    const rows: LoteListadoRow[] = await window.api.query(
        `SELECT id_lote, cantidad, cantidad_disponible, fecha_caducidad,
                estado_lote, unidad, costo_compra, created,
                enterado, enterado_por, enterado_en
         FROM Lote
         WHERE id_producto = ?
         ORDER BY (fecha_caducidad IS NULL), fecha_caducidad ASC, created DESC`,
        [id_producto]
    );

    return rows.map((row) => {
        const diasRestantes = diasRestantesHasta(row.fecha_caducidad);
        let alertLevel: AlertLevel;
        if (row.estado_lote === 'agotado') {
            alertLevel = 'none';
        } else if (diasRestantes === null) {
            alertLevel = 'none';
        } else if (diasRestantes <= 0) {
            alertLevel = 'black';
        } else if (umbralRojoDias !== null && diasRestantes <= umbralRojoDias) {
            alertLevel = 'red';
        } else if (umbralAmarilloDias !== null && diasRestantes <= umbralAmarilloDias) {
            alertLevel = 'yellow';
        } else {
            alertLevel = 'green';
        }

        return {
            id_lote: row.id_lote,
            cantidad: Number(row.cantidad),
            cantidad_disponible: Number(row.cantidad_disponible),
            fecha_caducidad: row.fecha_caducidad,
            estado_lote: row.estado_lote,
            unidad: row.unidad,
            costo_compra: row.costo_compra != null ? Number(row.costo_compra) : null,
            created: row.created,
            alertLevel,
            enterado: !!row.enterado,
            enterado_por: row.enterado_por,
            enterado_en: row.enterado_en,
        };
    });
}

/* ─── Lecturas: todos los lotes de todos los productos (exportar) ─── */

/** Fila para exportar lotes (botón "Exportar" de Inventory.tsx) — mismo
 *  shape que LoteListado, pero con los datos del producto dueño del
 *  lote pegados encima, porque aquí ya no hay un único id_producto de
 *  contexto como en el modal "Ver lotes". */
export interface LoteExportRow extends LoteListado {
    id_producto: string;
    codigo_interno: string | null;
    producto_nombre: string;
    familia_nombre: string | null;
}

interface LoteExportRowRaw {
    id_lote: string;
    id_producto: string;
    codigo_interno: string | null;
    producto_nombre: string;
    familia_nombre: string | null;
    cantidad: number;
    cantidad_disponible: number;
    fecha_caducidad: string | Date | null;
    estado_lote: LoteListado['estado_lote'];
    unidad: 'piezas' | 'kilos';
    costo_compra: number | string | null;
    created: string;
    enterado: number | boolean;
    enterado_por: string | null;
    enterado_en: string | null;
    umbral_rojo_dias: number | null;
    umbral_amarillo_dias: number | null;
}

/** Todos los lotes de TODOS los productos (activos e inactivos),
 *  del más próximo a vencer al más lejano dentro de cada producto —
 *  para la opción "Lotes" / "Productos y Lotes" del botón Exportar.
 *  A diferencia de listarLotesPorProducto(), no recibe id_producto ni
 *  umbrales: cada lote usa los umbrales de SU PROPIO producto, porque
 *  aquí conviven lotes de productos distintos en una sola lista. */
export async function listarTodosLosLotes(): Promise<LoteExportRow[]> {
    const rows: LoteExportRowRaw[] = await window.api.query(
        `SELECT
            l.id_lote, l.id_producto, l.cantidad, l.cantidad_disponible, l.fecha_caducidad,
            l.estado_lote, l.unidad, l.costo_compra, l.created,
            l.enterado, l.enterado_por, l.enterado_en,
            p.codigo_interno, p.nombre AS producto_nombre,
            p.umbral_rojo_dias, p.umbral_amarillo_dias,
            f.nombre AS familia_nombre
         FROM Lote l
         JOIN Producto p ON p.id_producto = l.id_producto
         LEFT JOIN Familia f ON f.id_familia = p.id_familia
         ORDER BY p.nombre ASC, (l.fecha_caducidad IS NULL), l.fecha_caducidad ASC, l.created DESC`
    );

    return rows.map((row) => {
        const diasRestantes = diasRestantesHasta(row.fecha_caducidad);
        let alertLevel: AlertLevel;
        if (row.estado_lote === 'agotado') {
            alertLevel = 'none';
        } else if (diasRestantes === null) {
            alertLevel = 'none';
        } else if (diasRestantes <= 0) {
            alertLevel = 'black';
        } else if (row.umbral_rojo_dias !== null && diasRestantes <= row.umbral_rojo_dias) {
            alertLevel = 'red';
        } else if (row.umbral_amarillo_dias !== null && diasRestantes <= row.umbral_amarillo_dias) {
            alertLevel = 'yellow';
        } else {
            alertLevel = 'green';
        }

        return {
            id_lote: row.id_lote,
            id_producto: row.id_producto,
            codigo_interno: row.codigo_interno,
            producto_nombre: row.producto_nombre,
            familia_nombre: row.familia_nombre,
            cantidad: Number(row.cantidad),
            cantidad_disponible: Number(row.cantidad_disponible),
            fecha_caducidad: row.fecha_caducidad,
            estado_lote: row.estado_lote,
            unidad: row.unidad,
            costo_compra: row.costo_compra != null ? Number(row.costo_compra) : null,
            created: row.created,
            alertLevel,
            enterado: !!row.enterado,
            enterado_por: row.enterado_por,
            enterado_en: row.enterado_en,
        };
    });
}

/** Payload de la edición inline de un lote (fila editable en la
 *  vista "Ver lotes"). Todos los campos son opcionales: solo se
 *  actualiza lo que el usuario realmente tocó en la fila. */
export interface LoteEditPayload {
    cantidad_disponible?: number;
    fecha_caducidad?: string | null;
    unidad?: LoteListado['unidad'];
    costo_compra?: number | null;
}

/** Edición inline de un lote (fila editable en "Ver lotes"): permite
 *  corregir cantidad disponible, fecha de caducidad, unidad y costo
 *  de compra directo sobre un lote ya existente.
 *
 *  cantidad_disponible NO se manda con un UPDATE directo a Lote: se
 *  registra como un Ajuste_Inventario (id_lote apuntando a este lote,
 *  cantidad_ajuste = diferencia contra lo que había). Eso dispara
 *  tr_ajuste, que es quien de verdad sabe mantener sincronizados
 *  Lote.cantidad_disponible, Lote.estado_lote e Inventario.cantidad_total
 *  a la vez (y de ahí sp_recalcular_avisos_producto vía
 *  tr_avisos_inventario_update). Un UPDATE a mano a Lote dejaría el
 *  stock total del producto desincronizado.
 *
 *  fecha_caducidad / unidad / costo_compra sí son UPDATE directo:
 *  no tienen ningún trigger que dependa de ellos. */
export async function actualizarLote(
    idLote: string,
    idProducto: string,
    cantidadDisponibleActual: number,
    payload: LoteEditPayload
): Promise<void> {
    try {
        if (
            payload.cantidad_disponible !== undefined &&
            payload.cantidad_disponible !== cantidadDisponibleActual
        ) {
            const delta = payload.cantidad_disponible - cantidadDisponibleActual;
            await window.api.execute(
                `INSERT INTO Ajuste_Inventario (id_producto, id_lote, cantidad_ajuste, motivo, autorizado_por)
                 VALUES (?, ?, ?, ?, ?)`,
                [idProducto, idLote, delta, 'Corrección manual de stock (edición de lote)', obtenerActorId()],
                ENTITY
            );
        }

        const sets: string[] = [];
        const params: (string | number | null)[] = [];
        if (payload.fecha_caducidad !== undefined) {
            sets.push('fecha_caducidad = ?');
            params.push(payload.fecha_caducidad);
        }
        if (payload.unidad !== undefined) {
            sets.push('unidad = ?');
            params.push(payload.unidad);
        }
        if (payload.costo_compra !== undefined) {
            sets.push('costo_compra = ?');
            params.push(payload.costo_compra);
        }
        if (sets.length > 0) {
            params.push(idLote);
            await window.api.execute(
                `UPDATE Lote SET ${sets.join(', ')} WHERE id_lote = ?`,
                params,
                ENTITY
            );
        }
        const pName = await getProductName(idProducto);
        await logActividad('actualizar_lote', 'lote', `Actualizó el lote ${idLote.substring(0, 8)} de ${pName}`, ENTITY);
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err, 'este lote'));
    }
}

/** Marca (o desmarca) un lote vencido como "enterado": dejas de ver su
 *  VENCIDO forzando el semáforo del producto en la tabla principal a
 *  negro, sin borrar ni desactivar el lote — sigue apareciendo tal cual
 *  en la vista de lotes. Se guarda en la base (no en localStorage) para
 *  que se vea igual sin importar quién ni desde qué equipo lo abra. */
export async function marcarLoteEnterado(idLote: string, enterado: boolean): Promise<void> {
    try {
        await window.api.execute(
            `UPDATE Lote SET enterado = ?, enterado_por = ?, enterado_en = ? WHERE id_lote = ?`,
            [enterado, enterado ? obtenerActorId() : null, enterado ? new Date() : null, idLote],
            ENTITY
        );
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err, 'este lote'));
    }
}

/** Solo los productos activos, en el shape ProductoRow que espera
 *  AddEntrada (selector de producto + último costo + margen/impuesto). */
export async function listarProductosParaModal(): Promise<ProductoRow[]> {
    const rows = await window.api.query(
        `SELECT
            p.id_producto, p.id_familia, p.codigo_interno, p.nombre, p.descripcion,
            p.costo_referencia, p.id_margenes, p.costo_final,
            p.umbral_rojo_dias, p.umbral_amarillo_dias,
            p.umbral_rojo_stock, p.umbral_amarillo_stock, p.meta_estanteria, p.activo,
            (SELECT pi.id_impuestos FROM Producto_Impuesto pi
              WHERE pi.id_producto = p.id_producto AND pi.activo = TRUE LIMIT 1) AS id_impuestos,
            (SELECT e.costo_compra_promedio FROM Entrada e
              WHERE e.id_producto = p.id_producto
              ORDER BY e.created DESC LIMIT 1) AS ultimo_costo_compra
         FROM Producto p
         WHERE p.activo = TRUE
         ORDER BY p.nombre ASC`
    );
    return armarProductoRow(rows);
}

/** Un producto completo (con codigos_alternos e id_impuestos) para
 *  abrir el modal de edición — más confiable que armar el objeto a
 *  mano desde la fila de la tabla, como hacía openEditarProducto()
 *  en Inventory.tsx con el mock. */
export async function obtenerProducto(idProducto: string): Promise<ProductoRow | null> {
    const rows = await window.api.query(
        `SELECT
            p.id_producto, p.id_familia, p.codigo_interno, p.nombre, p.descripcion,
            p.costo_referencia, p.id_margenes, p.costo_final,
            p.umbral_rojo_dias, p.umbral_amarillo_dias,
            p.umbral_rojo_stock, p.umbral_amarillo_stock, p.meta_estanteria, p.activo,
            (SELECT pi.id_impuestos FROM Producto_Impuesto pi
              WHERE pi.id_producto = p.id_producto AND pi.activo = TRUE LIMIT 1) AS id_impuestos
         FROM Producto p
         WHERE p.id_producto = ?`,
        [idProducto]
    );
    if (rows.length === 0) return null;
    const [row] = await armarProductoRow(rows);
    return row;
}

/** Validación en vivo del código interno (columna UNIQUE). */
export async function codigoInternoDisponible(
    codigo: string,
    idProductoExcluir?: string
): Promise<boolean> {
    const rows = await window.api.query(
        idProductoExcluir
            ? `SELECT 1 FROM Producto WHERE codigo_interno = ? AND id_producto <> ? LIMIT 1`
            : `SELECT 1 FROM Producto WHERE codigo_interno = ? LIMIT 1`,
        idProductoExcluir ? [codigo, idProductoExcluir] : [codigo]
    );
    return rows.length === 0;
}

/** Validación en vivo de un código alterno (también UNIQUE, tabla
 *  aparte). Usado tanto en addproducto.tsx como en addentrada.tsx. */
export async function codigoAlternoDisponible(codigo: string): Promise<boolean> {
    const rows = await window.api.query(
        `SELECT 1 FROM Codigos_Alternos WHERE codigo = ? LIMIT 1`,
        [codigo]
    );
    return rows.length === 0;
}

/* ─── Escrituras: productos ──────────────────────────────── */

/** Alta de producto (AddProducto -> onSave sin editProduct). No se
 *  manda costo_final: tr_costo_final_insert lo calcula solo. */
export async function crearProducto(payload: ProductoPayload): Promise<string> {
    const idProducto = uid();
    try {
        await window.api.execute(
            `INSERT INTO Producto
                (id_producto, id_familia, codigo_interno, nombre, descripcion,
                 costo_referencia, id_margenes, umbral_rojo_dias, umbral_amarillo_dias,
                 umbral_rojo_stock, umbral_amarillo_stock, meta_estanteria, activo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                idProducto,
                payload.id_familia,
                payload.codigo_interno,
                payload.nombre,
                payload.descripcion,
                payload.costo_referencia,
                payload.id_margenes,
                payload.umbral_rojo_dias,
                payload.umbral_amarillo_dias,
                payload.umbral_rojo_stock,
                payload.umbral_amarillo_stock,
                payload.meta_estanteria,
                payload.activo,
            ],
            ENTITY
        );

        if (payload.id_impuestos) {
            // Dispara tr_pi_recalc_insert, que ya recalcula costo_final
            // incluyendo este impuesto.
            await window.api.execute(
                `INSERT INTO Producto_Impuesto (id_producto, id_impuestos) VALUES (?, ?)`,
                [idProducto, payload.id_impuestos],
                ENTITY
            );
        }

        for (const codigo of payload.codigos_alternos) {
            await window.api.execute(
                `INSERT INTO Codigos_Alternos (id_producto, codigo) VALUES (?, ?)`,
                [idProducto, codigo],
                ENTITY
            );
        }
        await logActividad('crear_producto', 'producto', `Creó el producto ${payload.nombre}`, ENTITY);
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }

    return idProducto;
}

/** Edición de producto (AddProducto -> onSave con editProduct). Sincroniza
 *  el impuesto único seleccionado y los códigos alternos contra lo que
 *  ya había, en vez de reinsertar todo a ciegas. */
export async function actualizarProducto(
    idProducto: string,
    payload: ProductoPayload
): Promise<void> {
    try {
        await window.api.execute(
            `UPDATE Producto
                SET id_familia = ?, codigo_interno = ?, nombre = ?, descripcion = ?,
                    costo_referencia = ?, id_margenes = ?, umbral_rojo_dias = ?,
                    umbral_amarillo_dias = ?, umbral_rojo_stock = ?, umbral_amarillo_stock = ?,
                    meta_estanteria = ?, activo = ?
              WHERE id_producto = ?`,
            [
                payload.id_familia,
                payload.codigo_interno,
                payload.nombre,
                payload.descripcion,
                payload.costo_referencia,
                payload.id_margenes,
                payload.umbral_rojo_dias,
                payload.umbral_amarillo_dias,
                payload.umbral_rojo_stock,
                payload.umbral_amarillo_stock,
                payload.meta_estanteria,
                payload.activo,
                idProducto,
            ],
            ENTITY
        );

        /* ── Impuesto: la UI solo permite uno activo a la vez ── */
        const impuestosActivos: { id_impuestos: string }[] = await window.api.query(
            `SELECT id_impuestos FROM Producto_Impuesto WHERE id_producto = ? AND activo = TRUE`,
            [idProducto]
        );
        for (const { id_impuestos } of impuestosActivos) {
            if (id_impuestos !== payload.id_impuestos) {
                await window.api.execute(
                    `UPDATE Producto_Impuesto SET activo = FALSE WHERE id_producto = ? AND id_impuestos = ?`,
                    [idProducto, id_impuestos],
                    ENTITY
                );
            }
        }
        if (payload.id_impuestos && !impuestosActivos.some((i) => i.id_impuestos === payload.id_impuestos)) {
            await window.api.execute(
                `INSERT INTO Producto_Impuesto (id_producto, id_impuestos) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE activo = TRUE`,
                [idProducto, payload.id_impuestos],
                ENTITY
            );
        }

        /* ── Códigos alternos: diff contra lo que ya había ── */
        const existentes: { codigo: string }[] = await window.api.query(
            `SELECT codigo FROM Codigos_Alternos WHERE id_producto = ?`,
            [idProducto]
        );
        const existentesSet = new Set(existentes.map((e) => e.codigo));
        const nuevosSet = new Set(payload.codigos_alternos);

        for (const codigo of payload.codigos_alternos) {
            if (!existentesSet.has(codigo)) {
                await window.api.execute(
                    `INSERT INTO Codigos_Alternos (id_producto, codigo) VALUES (?, ?)`,
                    [idProducto, codigo],
                    ENTITY
                );
            }
        }
        for (const codigo of existentesSet) {
            if (!nuevosSet.has(codigo)) {
                await window.api.execute(
                    `DELETE FROM Codigos_Alternos WHERE id_producto = ? AND codigo = ?`,
                    [idProducto, codigo],
                    ENTITY
                );
            }
        }
        await logActividad('actualizar_producto', 'producto', `Actualizó el producto ${payload.nombre}`, ENTITY);
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

/** "Eliminar" un producto en Inventory.tsx (botón de basura): NUNCA
 *  DELETE real — Producto está referenciado por Entrada/Lote/
 *  Venta_Detalle. Se desactiva, igual que Impuestos/Márgenes en
 *  catalogos.service.ts. */
export async function cambiarEstadoProducto(
    idProducto: string,
    activo: boolean
): Promise<void> {
    try {
        await window.api.execute(
            `UPDATE Producto SET activo = ? WHERE id_producto = ?`,
            [activo, idProducto],
            ENTITY
        );
        const msj = activo ? 'Reactivó' : 'Desactivó';
        const pName = await getProductName(idProducto);
        await logActividad('cambiar_estado', 'producto', `${msj} el producto ${pName}`, ENTITY);
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err, 'este producto'));
    }
}

/* ─── Escrituras: estantería ──────────────────────────────── */

/** Ajusta la cantidad en estantería de un producto. Acepta valores
 *  positivos (surtir anaquel) o negativos (reducir, p. ej. merma,
 *  producto caducado retirado del anaquel). El resultado siempre
 *  queda clampeado entre 0 y cantidad_total. */
export async function reponerEstanteria(idProducto: string, cantidad: number): Promise<void> {
    if (!Number.isFinite(cantidad) || cantidad === 0) return;
    try {
        await window.api.execute(
            `UPDATE Inventario
                SET cantidad_estanteria = GREATEST(0, LEAST(cantidad_estanteria + ?, cantidad_total))
              WHERE id_producto = ?`,
            [cantidad, idProducto],
            ENTITY
        );
        const pName = await getProductName(idProducto);
        await logActividad('reponer_estanteria', 'inventario', `Repuso estantería (${cantidad} pzas) de ${pName}`, ENTITY);
        await crearNotificacion({
            titulo: 'Estantería resurtida',
            descripcion: `Se rellenaron ${cantidad} pzas de ${pName} en mostrador.`,
            tipo: 'success'
        });
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err, 'la estantería de este producto'));
    }
}

/** Rellena la estantería de un producto HASTA su meta en un solo
 *  clic (botón "Estantería resurtida" de la tabla): calcula cuánto
 *  falta contra meta_estanteria y se lo pasa a reponerEstanteria. No
 *  hace nada si ya está en la meta (o por arriba) o si el producto no
 *  tiene meta configurada. */
export async function reponerEstanteriaAMeta(producto: {
    id_producto: string;
    cantidad_estanteria: number;
    meta_estanteria: number | null;
}): Promise<void> {
    if (producto.meta_estanteria === null || producto.meta_estanteria <= 0) return;
    const faltante = producto.meta_estanteria - producto.cantidad_estanteria;
    if (faltante <= 0) return;
    await reponerEstanteria(producto.id_producto, faltante);
    const pName = await getProductName(producto.id_producto);
    await logActividad('reponer_estanteria', 'inventario', `Repuso estantería a meta (${faltante} pzas) de ${pName}`, ENTITY);
}

/* ─── Escrituras: entradas ────────────────────────────────── */

/** Registrar entrada de mercancía (AddEntrada -> onSave). Inserta
 *  Entrada + Entrada_Detalle directo (en vez de CALL sp_registrar_entrada,
 *  que usa un OUT param que window.api.execute no soporta bien — mismo
 *  criterio que ya usa catalogos.service.ts con sp_actualizar_tasa_*).
 *  tr_detalle_entrada se encarga solo de sumar Inventario y crear el Lote. */
export async function crearEntrada(payload: EntradaPayload): Promise<string> {
    const idEntrada = uid();
    try {
        await window.api.execute(
            `INSERT INTO Entrada (id_entrada, id_producto, cantidad_total, costo_compra_promedio, registrado_por)
             VALUES (?, ?, ?, ?, ?)`,
            [idEntrada, payload.id_producto, payload.cantidad_total, payload.costo_compra_promedio, obtenerActorId()],
            ENTITY
        );

        for (const detalle of payload.detalles) {
            await window.api.execute(
                `INSERT INTO Entrada_Detalle (id_entrada, id_producto, cantidad, fecha_caducidad, unidad, costo_compra)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    idEntrada,
                    payload.id_producto,
                    detalle.cantidad,
                    detalle.fecha_caducidad,
                    detalle.unidad,
                    detalle.costo_compra,
                ],
                ENTITY
            );
        }

        for (const codigo of payload.codigos_alternos_nuevos) {
            await window.api.execute(
                `INSERT INTO Codigos_Alternos (id_producto, codigo) VALUES (?, ?)`,
                [payload.id_producto, codigo],
                ENTITY
            );
        }

        // payload.desglose_costos (el promedio de varios precios de compra
        // en la misma entrada) TODAVÍA no se guarda: no hay tabla para eso
        // en el esquema (Entrada_Detalle_Costo es para CONCEPTOS de costo,
        // no para esto — ver el encabezado del archivo). El promedio ya
        // calculado sí queda en Entrada.costo_compra_promedio; lo único que
        // se pierde por ahora es el detalle línea por línea de cómo se armó.
        const pName = await getProductName(payload.id_producto);
        await logActividad('crear_entrada', 'inventario', `Entrada de ${payload.cantidad_total} pzas de ${pName}`, ENTITY);
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }

    return idEntrada;
}