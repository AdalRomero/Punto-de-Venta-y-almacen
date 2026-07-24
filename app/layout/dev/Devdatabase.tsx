import {
    AlertCircle,
    Check,
    ChevronRight,
    Copy,
    Database,
    Loader2,
    Play,
    RefreshCw,
    Search,
    Table2,
    Terminal,
} from "lucide-react";
import React, { useMemo, useState } from "react";

/* ============================================================
   dev-database.tsx
   Panel de inspección de base de datos.
   No usa rutas propias: AppLayout.tsx lo registra directo en su
   `pages` (pages.dev = <DevDatabase />) y la navegación la maneja
   el Sidebar cambiando `activePage` — mismo patrón que Inventory,
   Ventas, Users, etc. Por eso este componente no importa nada de
   expo-router ni asume una URL.

   Conectado directo a la_cuchilla vía window.api (IPC -> mysqlManager
   -> pool de mysql2, ver main.ts/preload.ts):
     - Explorar: SELECT * FROM <tabla> LIMIT 50 + COUNT(*), al elegir
       una tabla del catálogo de la izquierda.
     - Consola SQL: corre lo que escribas. Si la query empieza con un
       verbo de lectura (SELECT/SHOW/DESCRIBE/EXPLAIN) usa
       window.api.query; cualquier otra cosa (INSERT/UPDATE/DELETE/
       CALL/CREATE...) usa window.api.execute, que además dispara
       "db:changed" para que el resto de la app se refresque sola.

   El catálogo de tablas de la izquierda sigue siendo estático
   (calcado de esquema_la_cuchilla_final.sql) — no se lee de
   information_schema porque cambia poco y así evita un roundtrip
   extra; si agregas una tabla nueva al esquema, agrégala también
   en CATALOGO_TABLAS.
   ============================================================ */

/* ─── Catálogo de tablas, agrupado igual que esquema_la_cuchilla_final.sql ─── */

interface TablaInfo {
    nombre: string;
    tipo: "tabla" | "vista";
}

interface GrupoTablas {
    categoria: string;
    tablas: TablaInfo[];
}

const CATALOGO_TABLAS: GrupoTablas[] = [
    {
        categoria: "Personal",
        tablas: [
            { nombre: "Perfil_Info", tipo: "tabla" },
            { nombre: "Credenciales", tipo: "tabla" },
            { nombre: "Contacto", tipo: "tabla" },
            { nombre: "Bitacora", tipo: "tabla" },
        ],
    },
    {
        categoria: "Catálogos",
        tablas: [
            { nombre: "Familia", tipo: "tabla" },
            { nombre: "Impuestos", tipo: "tabla" },
            { nombre: "Impuesto_Tasa_Historial", tipo: "tabla" },
            { nombre: "Margenes", tipo: "tabla" },
            { nombre: "Margen_Tasa_Historial", tipo: "tabla" },
        ],
    },
    {
        categoria: "Producto",
        tablas: [
            { nombre: "Producto", tipo: "tabla" },
            { nombre: "Producto_Impuesto", tipo: "tabla" },
            { nombre: "Historial_Precio", tipo: "tabla" },
            { nombre: "Codigos_Alternos", tipo: "tabla" },
        ],
    },
    {
        categoria: "Inventario / Entrada / Lote",
        tablas: [
            { nombre: "Inventario", tipo: "tabla" },
            { nombre: "Entrada", tipo: "tabla" },
            { nombre: "Entrada_Detalle", tipo: "tabla" },
            { nombre: "Entrada_Detalle_Costo", tipo: "tabla" },
            { nombre: "Lote", tipo: "tabla" },
        ],
    },
    {
        categoria: "Venta",
        tablas: [
            { nombre: "Venta", tipo: "tabla" },
            { nombre: "Venta_Detalle", tipo: "tabla" },
            { nombre: "Venta_Detalle_Impuesto", tipo: "tabla" },
            { nombre: "Documento", tipo: "tabla" },
        ],
    },
    {
        categoria: "Ajustes y devoluciones",
        tablas: [
            { nombre: "Ajuste_Inventario", tipo: "tabla" },
            { nombre: "Devolucion", tipo: "tabla" },
        ],
    },
    {
        categoria: "Avisos",
        tablas: [{ nombre: "Aviso", tipo: "tabla" }],
    },
    {
        categoria: "Vistas",
        tablas: [
            { nombre: "v_usuarios", tipo: "vista" },
            { nombre: "v_entrada_desglose", tipo: "vista" },
            { nombre: "v_producto_impuestos", tipo: "vista" },
            { nombre: "v_impuestos_vigentes", tipo: "vista" },
            { nombre: "v_margenes_vigentes", tipo: "vista" },
            { nombre: "v_venta_desglose", tipo: "vista" },
            { nombre: "v_avisos_stock", tipo: "vista" },
            { nombre: "v_alertas_caducidad", tipo: "vista" },
            { nombre: "v_dashboard_producto", tipo: "vista" },
            { nombre: "v_valor_inventario", tipo: "vista" },
        ],
    },
];

const QUERY_EJEMPLO = `SHOW TRIGGERS FROM la_cuchilla WHERE \`Trigger\` = 'tr_ajuste';`;

const LIMITE_FILAS = 50;

/** Verbos que solo leen — todo lo demás se manda por execute() para
 *  que dispare db:changed y el resto de la app se refresque solo. */
const VERBOS_LECTURA = new Set(["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN"]);

function esQueryDeLectura(sql: string): boolean {
    const primeraPalabra = sql.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
    return VERBOS_LECTURA.has(primeraPalabra);
}

/** Render seguro de cualquier valor que regrese mysql2 (null, Date,
 *  Buffer, JSON parseado, boolean como 0/1, etc.) */
function renderValor(val: unknown): string {
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "boolean") return val ? "true" : "false";
    if (val instanceof Date) return val.toISOString();
    if (typeof val === "object") {
        try {
            return JSON.stringify(val);
        } catch {
            return String(val);
        }
    }
    return String(val);
}

function mensajeError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

const uid = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Tabla de texto plano (columnas separadas por " | ") — pensada para
 *  pegarse en un chat/issue, no para verse bonita en una terminal. */
function filasATextoTabla(filas: Record<string, unknown>[]): string {
    if (filas.length === 0) return "(sin filas)";
    const columnas = Object.keys(filas[0]);
    const encabezado = columnas.join(" | ");
    const separador = columnas.map(() => "---").join(" | ");
    const cuerpo = filas.map((fila) => columnas.map((c) => renderValor(fila[c])).join(" | "));
    return [encabezado, separador, ...cuerpo].join("\n");
}

/** Serializa una ejecución completa (query + resultado o error) a
 *  texto plano listo para copiar/pegar. */
function entradaATexto(e: EjecucionConsola): string {
    const encabezado = `$ ${e.query.trim()}`;
    if (e.estado === "error") {
        return `${encabezado}\n✗ Error: ${e.error}`;
    }
    if (e.filas) {
        const resumen = `✓ ${e.filas.length} fila${e.filas.length === 1 ? "" : "s"} · ${e.ms.toFixed(0)}ms`;
        return `${encabezado}\n${resumen}\n${filasATextoTabla(e.filas)}`;
    }
    const resumen = `✓ ${e.affectedRows ?? 0} fila${e.affectedRows === 1 ? "" : "s"} afectada${e.affectedRows === 1 ? "" : "s"
        } · ${e.ms.toFixed(0)}ms`;
    return `${encabezado}\n${resumen}`;
}

type Tab = "explorar" | "consola";

interface EjecucionConsola {
    id: string;
    query: string;
    hora: string;
    estado: "ok" | "error";
    filas: Record<string, unknown>[] | null;
    affectedRows: number | null;
    error: string | null;
    ms: number;
}

export default function DevDatabase() {
    const [busqueda, setBusqueda] = useState("");
    const [tablaActiva, setTablaActiva] = useState("Producto");
    const [tab, setTab] = useState<Tab>("explorar");

    // ─── Explorar tabla ───
    const [filasTabla, setFilasTabla] = useState<Record<string, unknown>[]>([]);
    const [totalFilasTabla, setTotalFilasTabla] = useState<number | null>(null);
    const [cargandoTabla, setCargandoTabla] = useState(false);
    const [errorTabla, setErrorTabla] = useState<string | null>(null);

    // ─── Consola SQL ───
    const [query, setQuery] = useState(QUERY_EJEMPLO);
    const [ejecutando, setEjecutando] = useState(false);
    const [historial, setHistorial] = useState<EjecucionConsola[]>([]);
    const [copiadoId, setCopiadoId] = useState<string | null>(null);

    const gruposFiltrados = useMemo(() => {
        if (!busqueda.trim()) return CATALOGO_TABLAS;
        const q = busqueda.trim().toLowerCase();
        return CATALOGO_TABLAS.map((g) => ({
            ...g,
            tablas: g.tablas.filter((t) => t.nombre.toLowerCase().includes(q)),
        })).filter((g) => g.tablas.length > 0);
    }, [busqueda]);

    async function cargarTabla(nombre: string) {
        setCargandoTabla(true);
        setErrorTabla(null);
        try {
            const [filas, totalRows] = await Promise.all([
                window.api.query(`SELECT * FROM \`${nombre}\` LIMIT ${LIMITE_FILAS}`),
                window.api.query(`SELECT COUNT(*) AS total FROM \`${nombre}\``),
            ]);
            setFilasTabla(filas ?? []);
            setTotalFilasTabla(Number(totalRows?.[0]?.total ?? filas?.length ?? 0));
        } catch (err) {
            setErrorTabla(mensajeError(err));
            setFilasTabla([]);
            setTotalFilasTabla(null);
        } finally {
            setCargandoTabla(false);
        }
    }

    function seleccionarTabla(nombre: string) {
        setTablaActiva(nombre);
        setTab("explorar");
        void cargarTabla(nombre);
    }

    // Carga la tabla por default al montar.
    React.useEffect(() => {
        void cargarTabla(tablaActiva);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function ejecutarQuery() {
        if (!query.trim()) return;
        setEjecutando(true);
        const inicio = performance.now();
        const queryEjecutada = query;
        const hora = new Date().toLocaleTimeString("es-MX", { hour12: false });

        try {
            if (esQueryDeLectura(queryEjecutada)) {
                const filas = await window.api.query(queryEjecutada);
                setHistorial((h) => [
                    {
                        id: uid(),
                        query: queryEjecutada,
                        hora,
                        estado: "ok",
                        filas: Array.isArray(filas) ? filas : [],
                        affectedRows: null,
                        error: null,
                        ms: performance.now() - inicio,
                    },
                    ...h,
                ]);
            } else {
                const resultado = await window.api.execute(queryEjecutada, [], "dev-console");
                setHistorial((h) => [
                    {
                        id: uid(),
                        query: queryEjecutada,
                        hora,
                        estado: "ok",
                        filas: null,
                        affectedRows: resultado?.affectedRows ?? 0,
                        error: null,
                        ms: performance.now() - inicio,
                    },
                    ...h,
                ]);
            }
        } catch (err) {
            setHistorial((h) => [
                {
                    id: uid(),
                    query: queryEjecutada,
                    hora,
                    estado: "error",
                    filas: null,
                    affectedRows: null,
                    error: mensajeError(err),
                    ms: performance.now() - inicio,
                },
                ...h,
            ]);
        } finally {
            setEjecutando(false);
        }
    }

    function copiar(texto: string, id: string) {
        navigator.clipboard?.writeText(texto).then(() => {
            setCopiadoId(id);
            setTimeout(() => setCopiadoId((actual) => (actual === id ? null : actual)), 1500);
        });
    }

    function copiarTodoElHistorial() {
        // El historial se guarda más-reciente-primero; para copiar se
        // invierte a orden cronológico, así se lee como una transcripción.
        const texto = [...historial]
            .reverse()
            .map((e) => entradaATexto(e))
            .join("\n\n");
        copiar(texto, "__historial__");
    }

    function onKeyDownQuery(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void ejecutarQuery();
        }
    }

    return (
        <div id="dev-database-page" className="min-h-screen bg-gray-950 p-8">
            {/* Neutraliza el card blanco de .app-content (padding/borde/sombra
          pensados para las páginas claras) SOLO cuando adentro vive esta
          página — así el panel dark queda a bordes completos sin tocar
          sidebar.css ni afectar Home/Inventory/Ventas/etc.
          Si tu contenedor real tiene otra clase (no .app-content),
          cambia el selector de acá por esa clase. */}
            <style>{`
        .app-content:has(#dev-database-page) {
          padding: 0;
          border: none;
          border-radius: 0;
          box-shadow: none;
          background: transparent;
        }
      `}</style>

            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
                            <Database size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold text-white tracking-tight">
                                Base de Datos
                            </h1>
                            <p className="text-slate-400 text-sm">
                                {CATALOGO_TABLAS.reduce((n, g) => n + g.tablas.length, 0)} tablas y vistas · la_cuchilla
                            </p>
                        </div>
                    </div>

                    <button
                        className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-gray-900 border border-gray-800 text-slate-400 hover:text-white hover:border-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
                        onClick={() => void cargarTabla(tablaActiva)}
                        disabled={cargandoTabla}
                    >
                        <RefreshCw size={14} className={cargandoTabla ? "animate-spin" : ""} />
                        Refrescar
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 max-w-6xl">
                {/* ─── Sidebar: catálogo de tablas ─── */}
                <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4 h-fit lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
                    <div className="relative mb-4">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar tabla..."
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-600/50 focus:ring-1 focus:ring-emerald-600/30"
                        />
                    </div>

                    <div className="flex flex-col gap-4">
                        {gruposFiltrados.map((grupo) => (
                            <div key={grupo.categoria}>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5 px-1">
                                    {grupo.categoria}
                                </p>
                                <div className="flex flex-col gap-0.5">
                                    {grupo.tablas.map((t) => {
                                        const activa = t.nombre === tablaActiva;
                                        return (
                                            <button
                                                key={t.nombre}
                                                onClick={() => seleccionarTabla(t.nombre)}
                                                className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-mono transition-colors ${activa
                                                        ? "bg-emerald-500/10 text-emerald-400"
                                                        : "text-slate-400 hover:bg-gray-800 hover:text-slate-200"
                                                    }`}
                                            >
                                                <Table2
                                                    size={13}
                                                    className={activa ? "text-emerald-400" : "text-slate-600 group-hover:text-slate-500"}
                                                />
                                                <span className="truncate">{t.nombre}</span>
                                                {t.tipo === "vista" && (
                                                    <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-600">
                                                        vista
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {gruposFiltrados.length === 0 && (
                            <p className="text-sm text-slate-600 text-center py-6">Sin resultados.</p>
                        )}
                    </div>
                </div>

                {/* ─── Panel principal ─── */}
                <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden flex flex-col">
                    {/* Tabs */}
                    <div className="flex items-center gap-1 px-4 pt-4 border-b border-gray-800">
                        <button
                            onClick={() => setTab("explorar")}
                            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === "explorar"
                                    ? "text-white bg-gray-800/60 border-b-2 border-emerald-500"
                                    : "text-slate-500 hover:text-slate-300"
                                }`}
                        >
                            <Table2 size={14} />
                            Explorar
                        </button>
                        <button
                            onClick={() => setTab("consola")}
                            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === "consola"
                                    ? "text-white bg-gray-800/60 border-b-2 border-emerald-500"
                                    : "text-slate-500 hover:text-slate-300"
                                }`}
                        >
                            <Terminal size={14} />
                            Consola SQL
                        </button>
                    </div>

                    {/* ─── Tab: Explorar tabla ─── */}
                    {tab === "explorar" && (
                        <div className="flex-1 flex flex-col">
                            <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-gray-800/60 bg-gray-950/40">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono text-sm text-emerald-400">{tablaActiva}</span>
                                    <ChevronRight size={12} className="text-slate-700 shrink-0" />
                                    <span className="text-xs text-slate-500 truncate">
                                        {cargandoTabla
                                            ? "cargando…"
                                            : totalFilasTabla !== null
                                                ? `${totalFilasTabla} fila${totalFilasTabla === 1 ? "" : "s"} en total · mostrando hasta ${LIMITE_FILAS}`
                                                : "—"}
                                    </span>
                                </div>
                                {!cargandoTabla && !errorTabla && filasTabla.length > 0 && (
                                    <button
                                        onClick={() => copiar(filasATextoTabla(filasTabla), "__tabla_actual__")}
                                        className="shrink-0 flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
                                    >
                                        {copiadoId === "__tabla_actual__" ? (
                                            <>
                                                <Check size={12} className="text-emerald-400" />
                                                Copiado
                                            </>
                                        ) : (
                                            <>
                                                <Copy size={12} />
                                                Copiar
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {cargandoTabla && (
                                <div className="flex-1 flex items-center justify-center gap-2 text-slate-500 text-sm py-16">
                                    <Loader2 size={16} className="animate-spin" />
                                    Cargando {tablaActiva}...
                                </div>
                            )}

                            {!cargandoTabla && errorTabla && (
                                <div className="flex-1 flex items-center justify-center gap-2 text-rose-400 text-sm py-16 px-5 text-center">
                                    <AlertCircle size={16} className="shrink-0" />
                                    {errorTabla}
                                </div>
                            )}

                            {!cargandoTabla && !errorTabla && filasTabla.length === 0 && (
                                <div className="flex-1 flex items-center justify-center text-slate-600 text-sm py-16">
                                    {tablaActiva} no tiene filas todavía.
                                </div>
                            )}

                            {!cargandoTabla && !errorTabla && filasTabla.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-800 text-left">
                                                {Object.keys(filasTabla[0]).map((col) => (
                                                    <th
                                                        key={col}
                                                        className="px-5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-slate-500 font-medium whitespace-nowrap"
                                                    >
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filasTabla.map((fila, i) => (
                                                <tr key={i} className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors">
                                                    {Object.keys(filasTabla[0]).map((col) => {
                                                        const val = fila[col];
                                                        const esNull = val === null || val === undefined;
                                                        return (
                                                            <td
                                                                key={col}
                                                                className={`px-5 py-2.5 font-mono whitespace-nowrap ${esNull ? "text-slate-700 italic" : "text-slate-300"
                                                                    }`}
                                                            >
                                                                {renderValor(val)}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── Tab: Consola SQL ─── */}
                    {tab === "consola" && (
                        <div className="flex-1 flex flex-col p-5 gap-3 min-h-0">
                            <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden">
                                <div className="flex items-center justify-between px-3.5 py-2 border-b border-gray-800">
                                    <span className="text-[11px] uppercase tracking-wider text-slate-600 font-medium">
                                        Query
                                    </span>
                                    <button
                                        onClick={() => copiar(query, "__query_actual__")}
                                        className="text-slate-600 hover:text-slate-300 transition-colors"
                                    >
                                        {copiadoId === "__query_actual__" ? (
                                            <Check size={13} className="text-emerald-400" />
                                        ) : (
                                            <Copy size={13} />
                                        )}
                                    </button>
                                </div>
                                <textarea
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={onKeyDownQuery}
                                    spellCheck={false}
                                    rows={5}
                                    className="w-full bg-transparent px-3.5 py-3 font-mono text-sm text-slate-200 placeholder:text-slate-700 focus:outline-none resize-none"
                                    placeholder="SELECT * FROM Producto LIMIT 10;"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <p className="text-xs text-slate-600">
                                    {esQueryDeLectura(query)
                                        ? "Lectura · window.api.query"
                                        : "Escritura · window.api.execute (dispara db:changed)"}
                                    <span className="text-slate-700"> · Ctrl/⌘+Enter para ejecutar</span>
                                </p>
                                <button
                                    onClick={() => void ejecutarQuery()}
                                    disabled={ejecutando || !query.trim()}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                                >
                                    {ejecutando ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                                    Ejecutar
                                </button>
                            </div>

                            {/* Historial de ejecuciones — cada Ejecutar agrega una entrada
                  arriba, así corras varios comandos seguidos sin perder
                  los anteriores. */}
                            <div className="flex-1 rounded-xl border border-gray-800 bg-gray-950 flex flex-col min-h-[160px] overflow-hidden">
                                {historial.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <p className="text-sm text-slate-700">Corre una query para ver resultados aquí.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
                                            <span className="text-[11px] uppercase tracking-wider text-slate-600 font-medium">
                                                Historial · {historial.length} ejecución{historial.length === 1 ? "" : "es"}
                                            </span>
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={copiarTodoElHistorial}
                                                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                                                >
                                                    {copiadoId === "__historial__" ? (
                                                        <>
                                                            <Check size={12} className="text-emerald-400" />
                                                            Copiado
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy size={12} />
                                                            Copiar todo
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => setHistorial([])}
                                                    className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
                                                >
                                                    Limpiar
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
                                            {historial.map((e) => (
                                                <div key={e.id} className="p-4">
                                                    <div className="flex items-start justify-between gap-3 mb-2">
                                                        <div className="min-w-0">
                                                            <p className="font-mono text-xs text-slate-500 truncate">{e.query}</p>
                                                            <p className="text-[11px] text-slate-700 mt-0.5">{e.hora}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => copiar(entradaATexto(e), e.id)}
                                                            className="shrink-0 flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors"
                                                        >
                                                            {copiadoId === e.id ? (
                                                                <>
                                                                    <Check size={12} className="text-emerald-400" />
                                                                    Copiado
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Copy size={12} />
                                                                    Copiar
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>

                                                    {e.estado === "error" && (
                                                        <div className="flex items-start gap-2 text-rose-400 text-sm">
                                                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                                            <span className="font-mono">{e.error}</span>
                                                        </div>
                                                    )}

                                                    {e.estado === "ok" && (
                                                        <>
                                                            <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5 mb-2">
                                                                <span className="text-emerald-400">✓</span>
                                                                {e.filas
                                                                    ? `${e.filas.length} fila${e.filas.length === 1 ? "" : "s"}`
                                                                    : `${e.affectedRows ?? 0} fila${e.affectedRows === 1 ? "" : "s"} afectada${e.affectedRows === 1 ? "" : "s"
                                                                    }`}
                                                                <span className="text-slate-700">· {e.ms.toFixed(0)}ms</span>
                                                            </div>

                                                            {e.filas && e.filas.length > 0 && (
                                                                <div className="overflow-auto rounded-lg border border-gray-800/60">
                                                                    <table className="w-full text-sm">
                                                                        <thead>
                                                                            <tr className="border-b border-gray-800 text-left">
                                                                                {Object.keys(e.filas[0]).map((col) => (
                                                                                    <th
                                                                                        key={col}
                                                                                        className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-500 font-medium whitespace-nowrap"
                                                                                    >
                                                                                        {col}
                                                                                    </th>
                                                                                ))}
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {e.filas.map((fila, i) => (
                                                                                <tr
                                                                                    key={i}
                                                                                    className="border-b border-gray-800/60 last:border-b-0 hover:bg-gray-800/30 transition-colors"
                                                                                >
                                                                                    {Object.keys(e.filas![0]).map((col) => {
                                                                                        const val = fila[col];
                                                                                        const esNull = val === null || val === undefined;
                                                                                        return (
                                                                                            <td
                                                                                                key={col}
                                                                                                className={`px-3 py-1.5 font-mono whitespace-nowrap ${esNull ? "text-slate-700 italic" : "text-slate-300"
                                                                                                    }`}
                                                                                            >
                                                                                                {renderValor(val)}
                                                                                            </td>
                                                                                        );
                                                                                    })}
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}

                                                            {e.filas && e.filas.length === 0 && (
                                                                <p className="text-sm text-slate-600">La query no regresó filas.</p>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}