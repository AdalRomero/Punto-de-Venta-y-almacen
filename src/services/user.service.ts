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
// (columnas planas, no el objeto `contacto` anidado).
interface UsuarioRow {
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

function mapRow(row: UsuarioRow): Usuario {
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
    return window.api.users.crear(input);
}

/** Edición de datos personales/rol (detailsuser.tsx -> "Guardar Cambios").
 *  No toca Credenciales ni Contacto. */
export async function actualizarPerfil(
    idPerfilInfo: string,
    data: ActualizarPerfilInput
): Promise<void> {
    await window.api.execute(
        `UPDATE Perfil_Info
         SET usuario = ?, nombres = ?, apellido_paterno = ?, apellido_materno = ?, rol = ?
         WHERE id_perfil_info = ?`,
        [data.usuario, data.nombres, data.apellido_paterno, data.apellido_materno, data.rol, idPerfilInfo],
        ENTITY
    );
}

/** Edición de datos de contacto (detailsuser.tsx). La fila en
 *  Contacto siempre existe (la crea sp_crear_usuario), así que
 *  aquí basta un UPDATE, nunca hace falta INSERT. */
export async function actualizarContacto(
    idPerfilInfo: string,
    data: ActualizarContactoInput
): Promise<void> {
    await window.api.execute(
        `UPDATE Contacto
         SET correo_personal = ?, lada = ?, telefono = ?, direccion = ?
         WHERE id_perfil_info = ?`,
        [data.correo_personal, data.lada, data.telefono, data.direccion, idPerfilInfo],
        ENTITY
    );
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
}

/** Cambiar solo el correo de acceso (detailsuser.tsx -> handleCambiarCorreo).
 *  No hay password de por medio, así que va por el canal genérico. */
export async function cambiarCorreoAcceso(
    idPerfilInfo: string,
    nuevoCorreoAcceso: string
): Promise<void> {
    await window.api.execute(
        "UPDATE Credenciales SET correo_acceso = ? WHERE id_perfil_info = ?",
        [nuevoCorreoAcceso, idPerfilInfo],
        ENTITY
    );
}

/** "Eliminar" en users.tsx (handleConfirmDelete): revoca el acceso,
 *  el perfil se conserva como historial. */
export async function revocarCredenciales(idPerfilInfo: string): Promise<void> {
    await window.api.users.revocarCredenciales(idPerfilInfo);
}