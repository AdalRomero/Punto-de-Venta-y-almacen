/* ============================================================
   user.service.ts
   Capa de datos para el módulo Personal (users.tsx / newusers.tsx
   / detailsuser.tsx). Envuelve window.api (expuesto por preload.ts)
   y traduce entre la vista v_usuarios / tablas Perfil_Info,
   Credenciales, Contacto del esquema y el shape `Usuario` que ya
   usan las tres pantallas.

   Ubícalo junto a tus otros servicios (ej. src/services/user.service.ts)
   y en users.tsx / detailsuser.tsx cambia:
     interface Usuario { ... }
   por:
     import type { Usuario } from '../../services/user.service';
   para no mantener el tipo duplicado en 3 archivos.
   ============================================================ */

import { SESSION_KEY } from '../context/AuthContext';

/* ─── Tipos ───────────────────────────────────────────────── */

// Mismo shape que ya usan users.tsx y detailsuser.tsx.
export interface Usuario {
    id_perfil_info: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string;
    usuario: string;
    rol: string;
    auth_usuario: string | null;
    contacto: {
        correo_personal: string | null;
        telefono: string | null;
        lada: string | null;
        direccion: string | null;
    } | null;
    // Extra respecto al mock: viene gratis de v_usuarios y sirve
    // para detailsuser.tsx (ej. "Miembro desde"), es opcional para
    // no romper nada de lo ya construido.
    correo_acceso?: string | null;
    created?: string;
    last_update?: string;
}

// Fila cruda tal como la regresa `SELECT * FROM v_usuarios`
// (columnas planas, no el objeto `contacto` anidado). Se exporta
// para que auth.service.ts pueda reusar el mismo mapeo sin
// duplicarlo (el login también arma un `Usuario` a partir de la
// misma vista).
export interface UsuarioRow {
    id_perfil_info: string;
    usuario: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    rol: string;
    auth_usuario: string | null;
    correo_acceso: string | null;
    correo_personal: string | null;
    lada: string | null;
    telefono: string | null;
    direccion: string | null;
    created: string;
    last_update: string;
}

export interface NuevoUsuarioInput {
    usuario: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    rol: string; // 'Dev' | 'administrador' | 'cajero' | 'contador'
    correo_acceso: string;
    password: string; // texto plano: el hash se genera en main.ts, nunca aquí
    correo_personal: string | null;
    lada: string | null;
    telefono: string | null;
    direccion: string | null;
}

export interface ActualizarPerfilInput {
    usuario: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    rol: string;
}

export interface ActualizarContactoInput {
    correo_personal: string | null;
    lada: string | null;
    telefono: string | null;
    direccion: string | null;
}

// Fila cruda de Bitacora (esquema_la_cuchilla_final.sql). `descripcion`
// ya viene traducida desde donde se escribió el registro, así que
// detailsuser.tsx solo la muestra tal cual, sin armar texto.
export interface ActividadItem {
    id_bitacora: string;
    accion: string;
    entidad: string;
    descripcion: string;
    creado_en: string;
}

export interface ActividadPagina {
    items: ActividadItem[];
    total: number;
}

/* ─── Helpers internos ───────────────────────────────────── */

const ENTITY = "usuarios";

export function mapRow(row: UsuarioRow): Usuario {
    return {
        id_perfil_info: row.id_perfil_info,
        nombres: row.nombres,
        apellido_paterno: row.apellido_paterno,
        apellido_materno: row.apellido_materno ?? "",
        usuario: row.usuario,
        rol: row.rol,
        auth_usuario: row.auth_usuario,
        contacto: {
            correo_personal: row.correo_personal,
            telefono: row.telefono,
            lada: row.lada,
            direccion: row.direccion,
        },
        correo_acceso: row.correo_acceso,
        created: row.created,
        last_update: row.last_update,
    };
}

/* ─── Auditoría (Bitacora) ────────────────────────────────── */

/** Quién está logueado ahora mismo, leído directo de sessionStorage
 *  (AuthContext.tsx guarda ahí la sesión). Los *.service.ts no son
 *  componentes, así que no pueden usar useAuth(); esta es la única
 *  forma de saber el actor sin pedirle el id a cada caller. */
function obtenerActorId(): string | null {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const sesion = JSON.parse(raw) as Usuario;
        return sesion.id_perfil_info ?? null;
    } catch {
        return null;
    }
}

/** Inserta un registro en Bitacora. Nunca deja que un fallo aquí
 *  tumbe la operación principal (crear/editar/etc.) — si el log
 *  falla, solo se pierde ese renglón de "Actividad Reciente", no
 *  el cambio real que ya se guardó. */
async function registrarBitacora(
    idPerfilInfo: string,
    accion: string,
    descripcion: string
): Promise<void> {
    try {
        await window.api.execute(
            `INSERT INTO Bitacora (id_perfil_info, id_actor, accion, descripcion)
             VALUES (?, ?, ?, ?)`,
            [idPerfilInfo, obtenerActorId(), accion, descripcion],
            ENTITY
        );
    } catch {
        // no-op: el registro real (perfil/contacto/credenciales) ya se
        // guardó, no vale la pena romper la UI por la bitácora.
    }
}

/** Trata null, undefined y cadena vacía como "sin valor" — sin esto,
 *  comparar lo que regresa mapRow (siempre string, nunca null) contra
 *  lo que manda un formulario (string | null) se ve como un cambio
 *  aunque ambos signifiquen "vacío". */
function normalizar(valor: unknown): unknown {
    if (valor === null || valor === undefined || valor === '') return null;
    return valor;
}

/** Compara campo por campo y arma el texto tipo
 *  "rol: contador → cajero, correo: a@x.com → b@x.com" que pide
 *  Bitacora.descripcion. Si nada cambió, regresa null — el caller
 *  debe interpretar null como "no loguear nada", no como "loguear
 *  con un texto genérico". */
function describirCambios<T extends Record<string, unknown>>(
    anterior: T,
    nuevo: T,
    etiquetas: Partial<Record<keyof T, string>>
): string | null {
    const cambios: string[] = [];
    for (const key in etiquetas) {
        const etiqueta = etiquetas[key];
        if (!etiqueta) continue;
        const valorAnterior = normalizar(anterior[key]);
        const valorNuevo = normalizar(nuevo[key]);
        if (valorAnterior !== valorNuevo) {
            cambios.push(`${etiqueta}: ${valorAnterior ?? '—'} → ${valorNuevo ?? '—'}`);
        }
    }
    return cambios.length ? cambios.join(', ') : null;
}

/* ─── Lecturas ────────────────────────────────────────────── */

/** Lista completa para la pantalla de Personal (users.tsx filtra
 *  en el cliente por búsqueda/rol/credenciales, así que aquí no
 *  se manda ningún WHERE). */
export async function listarUsuarios(): Promise<Usuario[]> {
    const rows: UsuarioRow[] = await window.api.query(
        "SELECT * FROM v_usuarios ORDER BY nombres, apellido_paterno"
    );
    return rows.map(mapRow);
}

/** Para refrescar solo el detalle abierto en detailsuser.tsx tras
 *  guardar cambios, sin recargar toda la lista. */
export async function obtenerUsuario(idPerfilInfo: string): Promise<Usuario | null> {
    const rows: UsuarioRow[] = await window.api.query(
        "SELECT * FROM v_usuarios WHERE id_perfil_info = ?",
        [idPerfilInfo]
    );
    return rows.length ? mapRow(rows[0]) : null;
}

/** Para la validación en vivo del username en newusers.tsx
 *  (reemplaza a checkUsernameAvailability / USUARIOS_OCUPADOS). */
export async function usuarioDisponible(usuario: string): Promise<boolean> {
    const rows = await window.api.query(
        "SELECT 1 FROM Perfil_Info WHERE usuario = ? LIMIT 1",
        [usuario]
    );
    return rows.length === 0;
}

/** Actividad reciente de un perfil (detailsuser.tsx -> tarjeta
 *  "Actividad Reciente"), paginada de 3 en 3 y de la más nueva a
 *  la más vieja — mismo orden que ya cubre idx_bitacora_perfil,
 *  así que no hace falta ningún índice extra para esto. */
export async function obtenerActividadUsuario(
    idPerfilInfo: string,
    pagina: number,
    porPagina: number
): Promise<ActividadPagina> {
    const offset = (pagina - 1) * porPagina;

    const [items, totalRows] = await Promise.all([
        window.api.query(
            `SELECT id_bitacora, accion, entidad, descripcion, creado_en
             FROM Bitacora
             WHERE id_perfil_info = ?
             ORDER BY creado_en DESC
             LIMIT ? OFFSET ?`,
            [idPerfilInfo, porPagina, offset]
        ),
        window.api.query(
            "SELECT COUNT(*) AS total FROM Bitacora WHERE id_perfil_info = ?",
            [idPerfilInfo]
        ),
    ]);

    return {
        items,
        total: Number(totalRows[0]?.total ?? 0),
    };
}

/** Igual que arriba pero para el correo de acceso (Credenciales.correo_acceso
 *  también es UNIQUE en el esquema). Útil antes de crear o de
 *  asignar credenciales nuevas. */
export async function correoAccesoDisponible(correoAcceso: string): Promise<boolean> {
    const rows = await window.api.query(
        "SELECT 1 FROM Credenciales WHERE correo_acceso = ? LIMIT 1",
        [correoAcceso]
    );
    return rows.length === 0;
}

/* ─── Escrituras ──────────────────────────────────────────── */

/** Alta completa (newusers.tsx). Devuelve el id_perfil_info nuevo. */
export async function crearUsuario(input: NuevoUsuarioInput): Promise<string> {
    const idPerfilInfo = await window.api.users.crear(input);
    await registrarBitacora(
        idPerfilInfo,
        'crear',
        `Se creó el usuario "${input.usuario}" (rol: ${input.rol})`
    );
    return idPerfilInfo;
}

/** Edición de datos personales/rol (detailsuser.tsx -> "Guardar Cambios").
 *  No toca Credenciales ni Contacto. */
export async function actualizarPerfil(
    idPerfilInfo: string,
    data: ActualizarPerfilInput
): Promise<void> {
    const anterior = await obtenerUsuario(idPerfilInfo);

    await window.api.execute(
        `UPDATE Perfil_Info
         SET usuario = ?, nombres = ?, apellido_paterno = ?, apellido_materno = ?, rol = ?
         WHERE id_perfil_info = ?`,
        [data.usuario, data.nombres, data.apellido_paterno, data.apellido_materno, data.rol, idPerfilInfo],
        ENTITY
    );

    const cambios = anterior
        ? describirCambios(anterior, { ...anterior, ...data }, {
            usuario: 'usuario',
            nombres: 'nombres',
            apellido_paterno: 'apellido paterno',
            apellido_materno: 'apellido materno',
            rol: 'rol',
        })
        : null;

    if (cambios) {
        await registrarBitacora(idPerfilInfo, 'editar_perfil', `Se actualizó el perfil (${cambios})`);
    }
}

/** Edición de datos de contacto (detailsuser.tsx). La fila en
 *  Contacto siempre existe (la crea sp_crear_usuario), así que
 *  aquí basta un UPDATE, nunca hace falta INSERT. */
export async function actualizarContacto(
    idPerfilInfo: string,
    data: ActualizarContactoInput
): Promise<void> {
    const anterior = await obtenerUsuario(idPerfilInfo);

    await window.api.execute(
        `UPDATE Contacto
         SET correo_personal = ?, lada = ?, telefono = ?, direccion = ?
         WHERE id_perfil_info = ?`,
        [data.correo_personal, data.lada, data.telefono, data.direccion, idPerfilInfo],
        ENTITY
    );

    const cambios = anterior?.contacto
        ? describirCambios(anterior.contacto, { ...anterior.contacto, ...data }, {
            correo_personal: 'correo personal',
            lada: 'lada',
            telefono: 'teléfono',
            direccion: 'dirección',
        })
        : null;

    if (cambios) {
        await registrarBitacora(idPerfilInfo, 'editar_contacto', `Se actualizó el contacto (${cambios})`);
    }
}

/** "Agregar credenciales" en users.tsx (handleAgregarCredenciales)
 *  para un perfil que cayó a "Sin Acceso". */
export async function asignarCredenciales(
    idPerfilInfo: string,
    correoAcceso: string,
    password: string
): Promise<void> {
    await window.api.users.asignarCredenciales({
        id_perfil_info: idPerfilInfo,
        correo_acceso: correoAcceso,
        password,
    });
    await registrarBitacora(
        idPerfilInfo,
        'asignar_credenciales',
        `Se asignaron credenciales de acceso (${correoAcceso})`
    );
}

/** Cambiar la contraseña de alguien que YA tiene acceso activo
 *  (detailsuser.tsx -> handleCambiarContrasena). Usa UPDATE, no
 *  asignarCredenciales (ese es solo para altas nuevas). */
export async function cambiarPassword(
    idPerfilInfo: string,
    nuevaPassword: string
): Promise<void> {
    await window.api.users.cambiarPassword({
        id_perfil_info: idPerfilInfo,
        password: nuevaPassword,
    });
    await registrarBitacora(idPerfilInfo, 'cambiar_password', 'Se cambió la contraseña');
}

/** Cambiar solo el correo de acceso (detailsuser.tsx -> handleCambiarCorreo).
 *  No hay password de por medio, así que va por el canal genérico. */
export async function cambiarCorreoAcceso(
    idPerfilInfo: string,
    nuevoCorreoAcceso: string
): Promise<void> {
    const anterior = await obtenerUsuario(idPerfilInfo);

    await window.api.execute(
        "UPDATE Credenciales SET correo_acceso = ? WHERE id_perfil_info = ?",
        [nuevoCorreoAcceso, idPerfilInfo],
        ENTITY
    );

    const correoAnterior = normalizar(anterior?.correo_acceso);
    const correoNuevo = normalizar(nuevoCorreoAcceso);

    if (correoAnterior !== correoNuevo) {
        const descripcion = correoAnterior
            ? `Se cambió el correo de acceso (${correoAnterior} → ${correoNuevo ?? '—'})`
            : `Se asignó el correo de acceso (${correoNuevo ?? '—'})`;
        await registrarBitacora(idPerfilInfo, 'cambiar_correo', descripcion);
    }
}

/** "Eliminar" en users.tsx (handleConfirmDelete): revoca el acceso,
 *  el perfil se conserva como historial. */
export async function revocarCredenciales(idPerfilInfo: string): Promise<void> {
    await window.api.users.revocarCredenciales(idPerfilInfo);
    await registrarBitacora(idPerfilInfo, 'revocar_credenciales', 'Se revocó el acceso');
}