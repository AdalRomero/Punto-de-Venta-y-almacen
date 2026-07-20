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
    proxima_caducidad: string | null;
    activo: boolean;
    alertLevel: AlertLevel;
    unidad: 'piezas' | 'kilos';
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
    id_familia: string | null;
    familia_nombre: string | null;
    cantidad_total: number | null;
    proxima_caducidad: string | null;
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

/** Traduce dias_restantes + stock actual contra los umbrales del
 *  producto a un solo semáforo. Un producto inactivo siempre es
 *  "none"; si tiene un lote ya vencido (dias_restantes <= 0) es
 *  "black"; de ahí en adelante gana el peor de los dos criterios
 *  (stock o caducidad). Ajustable si el negocio quiere otra regla. */
function calcularAlertLevel(row: ProductoListadoRow): AlertLevel {
    if (!row.activo) return 'none';

    const stock = row.cantidad_total ?? 0;
    const diasRestantes = row.proxima_caducidad
        ? Math.ceil(
            (new Date(row.proxima_caducidad).getTime() - Date.now()) / 86_400_000
        )
        : null;

    if (diasRestantes !== null && diasRestantes <= 0) return 'black';

    const stockRojo = row.umbral_rojo_stock;
    const stockAmarillo = row.umbral_amarillo_stock;
    const diasRojo = row.umbral_rojo_dias;
    const diasAmarillo = row.umbral_amarillo_dias;

    const esRojoPorStock = stockRojo !== null && stock <= stockRojo;
    const esRojoPorCaducidad =
        diasRestantes !== null && diasRojo !== null && diasRestantes <= diasRojo;
    if (esRojoPorStock || esRojoPorCaducidad) return 'red';

    const esAmarilloPorStock = stockAmarillo !== null && stock <= stockAmarillo;
    const esAmarilloPorCaducidad =
        diasRestantes !== null && diasAmarillo !== null && diasRestantes <= diasAmarillo;
    if (esAmarilloPorStock || esAmarilloPorCaducidad) return 'yellow';

    return 'green';
}

function mapProductoListado(row: ProductoListadoRow): ProductoListado {
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
        alertLevel: calcularAlertLevel(row),
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
        f.id_familia, f.nombre AS familia_nombre,
        COALESCE(i.cantidad_total, 0) AS cantidad_total,
        (SELECT MIN(l.fecha_caducidad) FROM Lote l
          WHERE l.id_producto = p.id_producto AND l.estado_lote IN ('activo','parcial')) AS proxima_caducidad,
        (SELECT l.unidad FROM Lote l
          WHERE l.id_producto = p.id_producto ORDER BY l.created DESC LIMIT 1) AS unidad,
        (SELECT MAX(ith.porcentaje) FROM Producto_Impuesto pi
          JOIN Impuesto_Tasa_Historial ith
            ON ith.id_impuestos = pi.id_impuestos AND ith.vigente_hasta IS NULL
          WHERE pi.id_producto = p.id_producto AND pi.activo = TRUE) AS impuesto_porcentaje
    FROM Producto p
    LEFT JOIN Familia f ON f.id_familia = p.id_familia
    LEFT JOIN Inventario i ON i.id_producto = p.id_producto
`;

/** Lista completa para la tabla de Inventory.tsx (reemplaza
 *  MOCK_PRODUCTOS). Incluye activos e inactivos — el componente ya
 *  se encarga de mandar los inactivos al final. */
export async function listarProductosInventario(): Promise<ProductoListado[]> {
    const rows: ProductoListadoRow[] = await window.api.query(
        `${SELECT_LISTADO} ORDER BY p.nombre ASC`
    );
    return rows.map(mapProductoListado);
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
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err, 'este producto'));
    }
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
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }

    return idEntrada;
}