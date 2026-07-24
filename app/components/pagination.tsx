import { ChevronLeft, ChevronRight } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Pagination — páginas numeradas reales (1 2 3…), reutilizable
   en CUALQUIER tabla de la app (Inventario, Catálogos, etc).
   Sólo necesita saber cuántos items hay en total y de a cuántos
   pagina; el "slice" real de la lista lo hace quien la use (no
   guarda los datos, sólo el número de página). Se auto-oculta si
   todo cabe en una sola página. Estilos en la clase .cuh-pagination*
   (agregada al css de cada pantalla que la use).
──────────────────────────────────────────────────────────────── */

/** Tamaño de página por default para toda tabla paginada de la app
 *  — un solo lugar si algún día cambia (o pásalo distinto por prop). */
export const PAGE_SIZE = 6;

/** Arma la lista de "botones" a mostrar: siempre primera y última
 *  página, la actual con una de margen a cada lado, y "…" donde se
 *  salta un tramo. Ej. con 10 páginas y actual=5: [1, "…", 4,5,6, "…", 10]. */
function paginasVisibles(actual: number, total: number): (number | "…")[] {
    const margen = 1;
    const paginas: (number | "…")[] = [];
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= actual - margen && i <= actual + margen)) {
            paginas.push(i);
        } else if (paginas[paginas.length - 1] !== "…") {
            paginas.push("…");
        }
    }
    return paginas;
}

export default function Pagination({
    page,
    totalItems,
    pageSize = PAGE_SIZE,
    onPageChange,
}: {
    page: number;
    totalItems: number;
    pageSize?: number;
    onPageChange: (page: number) => void;
}) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (totalPages <= 1) return null;

    const irA = (p: number) => {
        if (p < 1 || p > totalPages || p === page) return;
        onPageChange(p);
    };

    return (
        <nav className="cuh-pagination" aria-label="Paginación">
            <button
                type="button"
                className="cuh-pagination-btn cuh-pagination-arrow"
                onClick={() => irA(page - 1)}
                disabled={page <= 1}
                aria-label="Página anterior"
            >
                <ChevronLeft size={15} />
            </button>

            {paginasVisibles(page, totalPages).map((p, idx) =>
                p === "…" ? (
                    <span key={`e-${idx}`} className="cuh-pagination-ellipsis">
                        …
                    </span>
                ) : (
                    <button
                        key={p}
                        type="button"
                        className={`cuh-pagination-btn${p === page ? " active" : ""}`}
                        onClick={() => irA(p)}
                        aria-current={p === page ? "page" : undefined}
                    >
                        {p}
                    </button>
                )
            )}

            <button
                type="button"
                className="cuh-pagination-btn cuh-pagination-arrow"
                onClick={() => irA(page + 1)}
                disabled={page >= totalPages}
                aria-label="Página siguiente"
            >
                <ChevronRight size={15} />
            </button>
        </nav>
    );
}