/* ============================================================
   catalogos.service.ts
   Capa de datos para la pantalla de Catálogos (catalogo.tsx):
   Familias, Impuestos y Márgenes.

   Familia: alta/edición/borrado simple, sin historial.

   Impuestos y Márgenes comparten un mismo patrón: el % vigente
   nunca se sobrescribe. Cambiar la tasa SIEMPRE cierra la fila
   vigente (vigente_hasta = NOW()) y abre una nueva — igual que
   hacían las mocks del componente (comentario "sp_actualizar_tasa_
   impuesto / sp_actualizar_tasa_margen"), aquí implementado como
   dos sentencias SQL en vez de asumir el nombre exacto de esos
   stored procedures (no los tenía a la vista). Si ya existen esos
   SPs en tu esquema, puedes cambiar actualizarTasaVigente() por un
   `CALL sp_actualizar_tasa_...` sin tocar el resto del archivo.

   "Eliminar" un Impuesto/Margen NO hace DELETE: hace UPDATE activo
   = false. Es lo mismo que veía el usuario en el mock (desaparece
   de la lista, porque listarImpuestos/listarMargenes solo trae los
   activos) pero sin arriesgarse a que el DELETE reviente por la
   llave foránea de Producto_Impuesto / Venta_Detalle_Impuesto /
   Historial de tasas que ya lo referencian. Familia sí hace DELETE
   real porque no tiene columna `activo` en el esquema.
   ============================================================ */

/* ─── Tipos ───────────────────────────────────────────────── */

export interface Familia {
    id_familia: string;
    nombre: string;
    digitos: number;
    created: string;
}

export interface TasaHistorial {
    id_tasa: string;
    porcentaje: number;
    vigente_desde: string;
    vigente_hasta: string | null;
}

export interface TasaCatalogItem {
    id: string;
    nombre: string;
    activo: boolean;
    created: string;
    historial: TasaHistorial[];
}

/* ─── Helpers internos ───────────────────────────────────── */

const uid = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Quita el prefijo que Electron le pega a errores que cruzan IPC
 *  ("Error invoking remote method '...': Error: mensaje real") y,
 *  si detecta una violación de llave foránea, la traduce a algo
 *  que sí se le puede mostrar a quien está usando la app. */
function limpiarMensajeIpc(err: unknown, contexto?: string): string {
    let msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/Error:\s*(.+)$/);
    if (match) msg = match[1];

    // Antes de la constraint genérica: el choque de código de familia
    // (uq_familia_digitos) necesita su propio mensaje, no el de "nombre".
    const esCodigoDuplicado = /uq_familia_digitos/i.test(msg);
    if (esCodigoDuplicado) {
        return "Ese código de familia ya lo tiene otra familia. Cada código (01, 02...) solo puede usarse una vez.";
    }
    const esCodigoInvalido = /chk_familia_digitos_min/i.test(msg);
    if (esCodigoInvalido) {
        return "El código de familia debe ser 01 o mayor.";
    }

    const esConstraint = /foreign key|fk_|constraint/i.test(msg);
    if (esConstraint) {
        return contexto
            ? `No se puede completar la acción: "${contexto}" está en uso por otros registros.`
            : "No se puede completar la acción porque el registro está en uso por otros datos.";
    }
    const esDuplicado = /duplicate|unique/i.test(msg);
    if (esDuplicado) {
        return "Ya existe un registro con ese nombre.";
    }
    return msg || "Ocurrió un error inesperado. Intenta de nuevo.";
}

/** El código de familia (digitos) nunca puede ser menor a 1 (el
 *  catálogo arranca en "01"). Se valida aquí, en el borde de la
 *  capa de datos, para que ninguna pantalla pueda saltárselo aunque
 *  no repita la regla en su propio formulario. */
function validarDigitosFamilia(digitos: number): void {
    if (!Number.isInteger(digitos) || digitos < 1) {
        throw new Error("El código de familia debe ser un número entero de 01 en adelante.");
    }
}

function obtenerActorId(): string | null {
    try {
        const raw = sessionStorage.getItem("auth_session_cuchilla");
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
    } catch {}
}

/* ═══════════════════════════════════════════════════════════
   FAMILIAS
   ═══════════════════════════════════════════════════════════ */

const ENTITY_FAMILIAS = "familias";

export async function listarFamilias(): Promise<Familia[]> {
    try {
        return await window.api.query(
            "SELECT id_familia, nombre, digitos, created FROM Familia ORDER BY created DESC"
        );
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

export async function crearFamilia(nombre: string, digitos: number): Promise<Familia> {
    validarDigitosFamilia(digitos);
    const id_familia = uid();
    try {
        await window.api.execute(
            "INSERT INTO Familia (id_familia, nombre, digitos) VALUES (?, ?, ?)",
            [id_familia, nombre, digitos],
            ENTITY_FAMILIAS
        );
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
    const rows: Familia[] = await window.api.query(
        "SELECT id_familia, nombre, digitos, created FROM Familia WHERE id_familia = ?",
        [id_familia]
    );
    await logActividad('crear_catalogo', 'catalogo', `Creó familia: ${nombre}`, ENTITY_FAMILIAS);
    return rows[0];
}

export async function actualizarFamilia(
    id_familia: string,
    nombre: string,
    digitos: number
): Promise<void> {
    validarDigitosFamilia(digitos);
    try {
        await window.api.execute(
            "UPDATE Familia SET nombre = ?, digitos = ? WHERE id_familia = ?",
            [nombre, digitos, id_familia],
            ENTITY_FAMILIAS
        );
        await logActividad('actualizar_catalogo', 'catalogo', `Actualizó familia: ${nombre}`, ENTITY_FAMILIAS);
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

export async function eliminarFamilia(id_familia: string): Promise<void> {
    try {
        await window.api.execute(
            "DELETE FROM Familia WHERE id_familia = ?",
            [id_familia],
            ENTITY_FAMILIAS
        );
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err, "esta familia"));
    }
}

/* ═══════════════════════════════════════════════════════════
   IMPUESTOS / MÁRGENES
   Mismo patrón de catálogo + historial de tasas, parametrizado
   por tabla para no duplicar la lógica.
   ═══════════════════════════════════════════════════════════ */

interface TasaTableConfig {
    tablaCatalogo: "Impuestos" | "Margenes";
    tablaHistorial: "Impuesto_Tasa_Historial" | "Margen_Tasa_Historial";
    idCol: "id_impuestos" | "id_margenes";
    entity: string;
}

const IMPUESTOS_CFG: TasaTableConfig = {
    tablaCatalogo: "Impuestos",
    tablaHistorial: "Impuesto_Tasa_Historial",
    idCol: "id_impuestos",
    entity: "impuestos",
};

const MARGENES_CFG: TasaTableConfig = {
    tablaCatalogo: "Margenes",
    tablaHistorial: "Margen_Tasa_Historial",
    idCol: "id_margenes",
    entity: "margenes",
};

async function listarTasaCatalogo(cfg: TasaTableConfig): Promise<TasaCatalogItem[]> {
    let catalogos: { id: string; nombre: string; activo: number | boolean; created: string }[];
    try {
        catalogos = await window.api.query(
            `SELECT ${cfg.idCol} AS id, nombre, activo, created
             FROM ${cfg.tablaCatalogo}
             WHERE activo = TRUE
             ORDER BY created DESC`
        );
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }

    if (catalogos.length === 0) return [];

    const historialRows: {
        id_tasa: string;
        parent_id: string;
        porcentaje: number;
        vigente_desde: string;
        vigente_hasta: string | null;
    }[] = await window.api.query(
        `SELECT id_tasa, ${cfg.idCol} AS parent_id, porcentaje, vigente_desde, vigente_hasta
         FROM ${cfg.tablaHistorial}
         ORDER BY vigente_desde ASC`
    );

    const porItem = new Map<string, TasaHistorial[]>();
    for (const h of historialRows) {
        const list = porItem.get(h.parent_id) ?? [];
        list.push({
            id_tasa: h.id_tasa,
            porcentaje: Number(h.porcentaje),
            vigente_desde: h.vigente_desde,
            vigente_hasta: h.vigente_hasta,
        });
        porItem.set(h.parent_id, list);
    }

    return catalogos.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        activo: !!c.activo,
        created: c.created,
        historial: porItem.get(c.id) ?? [],
    }));
}

async function crearTasaCatalogo(
    cfg: TasaTableConfig,
    nombre: string,
    porcentajeInicial: number,
    registradoPor: string | null
): Promise<TasaCatalogItem> {
    const id = uid();
    const idTasa = uid();
    try {
        await window.api.execute(
            `INSERT INTO ${cfg.tablaCatalogo} (${cfg.idCol}, nombre, activo) VALUES (?, ?, TRUE)`,
            [id, nombre],
            cfg.entity
        );
        await window.api.execute(
            `INSERT INTO ${cfg.tablaHistorial}
             (id_tasa, ${cfg.idCol}, porcentaje, vigente_desde, vigente_hasta, registrado_por)
             VALUES (?, ?, ?, NOW(), NULL, ?)`,
            [idTasa, id, porcentajeInicial, registradoPor],
            cfg.entity
        );
        await logActividad('crear_catalogo', 'catalogo', `Creó ${cfg.entity}: ${nombre}`, cfg.entity);
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }

    const nowIso = new Date().toISOString();
    return {
        id,
        nombre,
        activo: true,
        created: nowIso,
        historial: [{ id_tasa: idTasa, porcentaje: porcentajeInicial, vigente_desde: nowIso, vigente_hasta: null }],
    };
}

async function actualizarNombreTasaCatalogo(
    cfg: TasaTableConfig,
    id: string,
    nombre: string
): Promise<void> {
    try {
        await window.api.execute(
            `UPDATE ${cfg.tablaCatalogo} SET nombre = ? WHERE ${cfg.idCol} = ?`,
            [nombre, id],
            cfg.entity
        );
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }
}

async function actualizarTasaVigente(
    cfg: TasaTableConfig,
    id: string,
    nuevoPorcentaje: number,
    registradoPor: string | null
): Promise<TasaHistorial> {
    const idTasa = uid();
    try {
        const catalogNameRows = await window.api.query(`SELECT nombre FROM ${cfg.tablaCatalogo} WHERE ${cfg.idCol} = ?`, [id]);
        const catalogName = catalogNameRows[0]?.nombre || `ID: ${id.substring(0, 8)}`;

        await window.api.execute(
            `UPDATE ${cfg.tablaHistorial}
             SET vigente_hasta = NOW()
             WHERE ${cfg.idCol} = ? AND vigente_hasta IS NULL`,
            [id],
            cfg.entity
        );
        await window.api.execute(
            `INSERT INTO ${cfg.tablaHistorial}
             (id_tasa, ${cfg.idCol}, porcentaje, vigente_desde, vigente_hasta, registrado_por)
             VALUES (?, ?, ?, NOW(), NULL, ?)`,
            [idTasa, id, nuevoPorcentaje, registradoPor],
            cfg.entity
        );
        await logActividad('actualizar_catalogo', 'catalogo', `Actualizó tasa de ${cfg.entity} (${catalogName}) al ${nuevoPorcentaje}%`, cfg.entity);
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err));
    }

    return {
        id_tasa: idTasa,
        porcentaje: nuevoPorcentaje,
        vigente_desde: new Date().toISOString(),
        vigente_hasta: null,
    };
}

async function eliminarTasaCatalogo(cfg: TasaTableConfig, id: string, contexto: string): Promise<void> {
    try {
        // Soft delete: ver nota al inicio del archivo.
        await window.api.execute(
            `UPDATE ${cfg.tablaCatalogo} SET activo = FALSE WHERE ${cfg.idCol} = ?`,
            [id],
            cfg.entity
        );
    } catch (err) {
        throw new Error(limpiarMensajeIpc(err, contexto));
    }
}

/* ─── API pública: Impuestos ─────────────────────────────── */

export const listarImpuestos = () => listarTasaCatalogo(IMPUESTOS_CFG);

export const crearImpuesto = (nombre: string, porcentajeInicial: number, registradoPor: string | null = null) =>
    crearTasaCatalogo(IMPUESTOS_CFG, nombre, porcentajeInicial, registradoPor);

export const actualizarNombreImpuesto = (id: string, nombre: string) =>
    actualizarNombreTasaCatalogo(IMPUESTOS_CFG, id, nombre);

export const actualizarTasaImpuesto = (id: string, nuevoPorcentaje: number, registradoPor: string | null = null) =>
    actualizarTasaVigente(IMPUESTOS_CFG, id, nuevoPorcentaje, registradoPor);

export const eliminarImpuesto = (id: string) => eliminarTasaCatalogo(IMPUESTOS_CFG, id, "este impuesto");

/* ─── API pública: Márgenes ───────────────────────────────── */

export const listarMargenes = () => listarTasaCatalogo(MARGENES_CFG);

export const crearMargen = (nombre: string, porcentajeInicial: number, registradoPor: string | null = null) =>
    crearTasaCatalogo(MARGENES_CFG, nombre, porcentajeInicial, registradoPor);

export const actualizarNombreMargen = (id: string, nombre: string) =>
    actualizarNombreTasaCatalogo(MARGENES_CFG, id, nombre);

export const actualizarTasaMargen = (id: string, nuevoPorcentaje: number, registradoPor: string | null = null) =>
    actualizarTasaVigente(MARGENES_CFG, id, nuevoPorcentaje, registradoPor);

export const eliminarMargen = (id: string) => eliminarTasaCatalogo(MARGENES_CFG, id, "este margen");