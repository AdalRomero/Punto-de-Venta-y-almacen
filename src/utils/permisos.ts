/* ============================================================
   permisos.ts
   Fuente única de verdad de "qué puede hacer cada rol". Es la misma
   matriz que ya vivía como texto decorativo en detailsuser.tsx
   (rolPermisos: Dev/administrador/cajero/contador × Inventario/
   Ventas/Reportes/Personal/Sistema) — aquí se vuelve algo que el
   resto de la app puede consultar de verdad para decidir qué
   páginas se ven en el sidebar, a cuáles se puede entrar, y si
   dentro de esas páginas el acceso es de solo lectura.

   El rol 'Dev' queda FUERA de MATRIZ_PERMISOS a propósito: un Dev
   tiene acceso total a todo, incluida la página "dev" (que ningún
   otro rol puede ver), y es el único que puede ver/crear otros
   usuarios Dev. Todo eso se resuelve con esDev(), no con la matriz.
   ============================================================ */

export type Rol = 'Dev' | 'administrador' | 'cajero' | 'contador';

export type Modulo = 'inventario' | 'ventas' | 'reportes' | 'personal' | 'sistema' | 'fiados';

export type NivelAcceso = 'ninguno' | 'lectura' | 'completo';

/** Calca 1:1 los niveles que ya se mostraban en detailsuser.tsx:
 *  "Acceso total/completo" -> completo, "Solo lectura" -> lectura,
 *  "Sin acceso" -> ninguno, "Puede configurar" (admin en Sistema)
 *  -> completo (sigue siendo el único no-Dev que puede tocar Sistema). */
const MATRIZ_PERMISOS: Record<Exclude<Rol, 'Dev'>, Record<Modulo, NivelAcceso>> = {
    administrador: {
        inventario: 'completo',
        ventas: 'completo',
        reportes: 'completo',
        personal: 'completo',
        sistema: 'completo',
        fiados: 'completo',
    },
    cajero: {
        inventario: 'completo',
        ventas: 'completo',
        reportes: 'ninguno',
        personal: 'ninguno',
        sistema: 'ninguno',
        // Fiados es una operación de mostrador, igual que Ventas: el
        // cajero es justo quien registra/abona un fiado en el día a día.
        fiados: 'completo',
    },
    contador: {
        inventario: 'lectura',
        ventas: 'lectura',
        reportes: 'completo',
        personal: 'lectura',
        sistema: 'ninguno',
        // Puede ver cuánto hay por cobrar (útil para sus reportes) pero
        // no registrar ni abonar fiados.
        fiados: 'lectura',
    },
};

/** Mapea los IDs de página del Sidebar/AppLayout a su módulo de la
 *  matriz. 'home' no aparece a propósito (universal, sin
 *  restricción); 'dev' tampoco (no es un Modulo, se resuelve aparte
 *  con esDev() en puedeVerPagina). */
export const PAGINA_A_MODULO: Partial<Record<string, Modulo>> = {
    inventory: 'inventario',
    sales: 'ventas',
    reports: 'reportes',
    users: 'personal',
    catalogos: 'sistema',
    fiados: 'fiados',
};

export function esDev(rol: Rol | string | undefined | null): boolean {
    return rol === 'Dev';
}

/** Nivel de acceso de un rol a un módulo. Dev siempre es 'completo',
 *  sin importar el módulo — no pasa por MATRIZ_PERMISOS. */
export function nivelAcceso(rol: Rol | string | undefined | null, modulo: Modulo): NivelAcceso {
    if (esDev(rol)) return 'completo';
    if (!rol || !(rol in MATRIZ_PERMISOS)) return 'ninguno';
    return MATRIZ_PERMISOS[rol as Exclude<Rol, 'Dev'>][modulo];
}

export function puedeAcceder(rol: Rol | string | undefined | null, modulo: Modulo): boolean {
    return nivelAcceso(rol, modulo) !== 'ninguno';
}

export function esSoloLectura(rol: Rol | string | undefined | null, modulo: Modulo): boolean {
    return nivelAcceso(rol, modulo) === 'lectura';
}

/** Puede ver/entrar a una página del Sidebar/AppLayout.
 *  - 'home' siempre visible, para cualquier rol.
 *  - 'dev' exclusiva del rol Dev (ni sale en el menú ni es
 *    accesible directamente para nadie más).
 *  - el resto se resuelve por PAGINA_A_MODULO + la matriz.
 *  - un pageId sin entrada en PAGINA_A_MODULO no se bloquea por
 *    default (evita romper páginas nuevas que aún no se den de alta
 *    aquí), salvo 'dev' que ya está cubierto arriba. */
export function puedeVerPagina(rol: Rol | string | undefined | null, pageId: string): boolean {
    if (pageId === 'home') return true;
    if (pageId === 'dev') return esDev(rol);
    const modulo = PAGINA_A_MODULO[pageId];
    if (!modulo) return true;
    return puedeAcceder(rol, modulo);
}