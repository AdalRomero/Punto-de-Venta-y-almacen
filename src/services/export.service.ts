/* ============================================================
   export.service.ts
   Genera los archivos .xlsx descargables del botón "Exportar" de
   Inventory.tsx (Productos / Lotes / Productos y Lotes). Usa SheetJS
   (paquete npm 'xlsx') para armar el workbook en el propio renderer
   y disparar la descarga con XLSX.writeFile — no toca window.api ni
   la base de datos, solo transforma los shapes que ya arma
   inventory.service.ts (ProductoListado / LoteExportRow) en filas de
   hoja de cálculo.

   Requiere que el paquete 'xlsx' (SheetJS) esté instalado:
     npm install xlsx
   ============================================================ */

import * as XLSX from 'xlsx';
import type { ProductoListado, LoteExportRow } from './inventory.service';

/* ─── Helpers ─────────────────────────────────────────────── */

/** Mismo criterio de zona horaria que inventory.service.ts: lee los
 *  componentes de fecha tal cual, sin pasar por .toISOString() (que
 *  corre la fecha un día en zonas detrás de UTC). */
function formatearFecha(fecha: string | Date | null): string {
    if (!fecha) return '';
    if (typeof fecha === 'string') return fecha.slice(0, 10);
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function nombreArchivo(base: string): string {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = String(hoy.getMonth() + 1).padStart(2, '0');
    const d = String(hoy.getDate()).padStart(2, '0');
    return `${base}_${y}-${m}-${d}.xlsx`;
}

const ESTADO_LOTE_LABEL: Record<LoteExportRow['estado_lote'], string> = {
    activo: 'Activo',
    parcial: 'Parcial',
    agotado: 'Agotado',
    caducado: 'Caducado',
};

/* ─── Filas por hoja ──────────────────────────────────────── */

function filaProducto(p: ProductoListado) {
    return {
        'Código Interno': p.codigo_interno ?? '',
        Producto: p.nombre,
        Familia: p.familia_nombre ?? '',
        Unidad: p.unidad === 'kilos' ? 'KG' : 'PZA',
        'Costo Final': p.costo_final ?? '',
        'Impuesto %': p.impuesto_porcentaje,
        'Stock Total': p.cantidad_total,
        'En Estantería': p.cantidad_estanteria,
        'Meta Estantería': p.meta_estanteria ?? '',
        'Próxima Caducidad': formatearFecha(p.proxima_caducidad),
        Estado: p.activo ? 'Activo' : 'Inactivo',
    };
}

function filaLote(l: LoteExportRow) {
    return {
        'Código Interno': l.codigo_interno ?? '',
        Producto: l.producto_nombre,
        Familia: l.familia_nombre ?? '',
        Lote: l.id_lote,
        'Cantidad Original': l.cantidad,
        'Cantidad Disponible': l.cantidad_disponible,
        Unidad: l.unidad === 'kilos' ? 'KG' : 'PZA',
        'Costo de Compra': l.costo_compra ?? '',
        'Fecha de Caducidad': formatearFecha(l.fecha_caducidad),
        'Estado del Lote': ESTADO_LOTE_LABEL[l.estado_lote],
        Enterado: l.enterado ? 'Sí' : 'No',
        Creado: formatearFecha(l.created),
    };
}

/** Ancho de columna aproximado según el contenido más largo de cada
 *  una, para que el .xlsx no salga con todo apretado en Excel. */
function autoAncho(filas: Record<string, unknown>[]): { wch: number }[] {
    if (filas.length === 0) return [];
    const columnas = Object.keys(filas[0]);
    return columnas.map((col) => {
        const maxLargo = Math.max(col.length, ...filas.map((f) => String(f[col] ?? '').length));
        return { wch: Math.min(Math.max(maxLargo + 2, 10), 40) };
    });
}

function hojaProductos(productos: ProductoListado[]): XLSX.WorkSheet {
    const filas = productos.map(filaProducto);
    const ws = XLSX.utils.json_to_sheet(filas);
    ws['!cols'] = autoAncho(filas);
    return ws;
}

function hojaLotes(lotes: LoteExportRow[]): XLSX.WorkSheet {
    const filas = lotes.map(filaLote);
    const ws = XLSX.utils.json_to_sheet(filas);
    ws['!cols'] = autoAncho(filas);
    return ws;
}

/* ─── Exports públicos — uno por opción del menú "Exportar" ─── */

/** Solo productos. Recibe la lista YA filtrada (visibleProductos de
 *  Inventory.tsx): lo que se ve en pantalla es lo que se descarga. */
export function exportarProductos(productos: ProductoListado[]): void {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, hojaProductos(productos), 'Productos');
    XLSX.writeFile(wb, nombreArchivo('productos'));
}

/** Solo lotes. Siempre el universo completo (listarTodosLosLotes),
 *  no el filtro de la tabla de productos: los filtros de estado de
 *  Inventory.tsx trabajan a nivel producto y no aplican 1-a-1 a
 *  lotes individuales. */
export function exportarLotes(lotes: LoteExportRow[]): void {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, hojaLotes(lotes), 'Lotes');
    XLSX.writeFile(wb, nombreArchivo('lotes'));
}

/** Conjunto: un solo archivo con dos hojas, "Productos" y "Lotes". */
export function exportarInventarioCompleto(
    productos: ProductoListado[],
    lotes: LoteExportRow[]
): void {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, hojaProductos(productos), 'Productos');
    XLSX.utils.book_append_sheet(wb, hojaLotes(lotes), 'Lotes');
    XLSX.writeFile(wb, nombreArchivo('inventario_completo'));
}
