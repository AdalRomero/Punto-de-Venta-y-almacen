/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

export { };

declare global {
  /* ============================================================
     Tipos de fila, calcados 1:1 de esquema_la_cuchilla_final.sql.
     Úsalos en cada *.service.ts al tipar lo que regresa window.api
     .query(...) (ej. `const rows: DB.Producto[] = await window.api
     .query("SELECT * FROM Producto")`) en vez de re-declarar el
     shape de cada tabla en cada archivo. Si el esquema cambia
     (columna nueva, tabla nueva), actualiza aquí y ya.

     Nota: los TIMESTAMP/DATETIME/DATE se tipan como `string` (así
     los entrega mysql2 por default); las columnas JSON se tipan
     `unknown` porque su forma depende de qué se guardó ahí.
     ============================================================ */
  namespace DB {
    /* ─── PERSONAL ────────────────────────────────────────── */
    interface Perfil_Info {
      id_perfil_info: string;
      usuario: string;
      nombres: string;
      apellido_paterno: string;
      apellido_materno: string | null;
      rol: 'Dev' | 'administrador' | 'cajero' | 'contador';
      created: string;
      last_update: string;
    }

    interface Credenciales {
      id_credencial: string;
      id_perfil_info: string;
      correo_acceso: string;
      password_hash: string;
      created: string;
      last_update: string;
    }

    interface Contacto {
      id_contacto: string;
      id_perfil_info: string;
      correo_personal: string | null;
      lada: string | null;
      telefono: string | null;
      direccion: string | null;
      created: string;
      last_update: string;
    }

    interface Bitacora {
      id_bitacora: string;
      id_perfil_info: string;
      id_actor: string | null;
      accion: string;
      entidad: string;
      descripcion: string;
      creado_en: string;
    }

    /* ─── CATÁLOGOS ───────────────────────────────────────── */
    interface Familia {
      id_familia: string;
      nombre: string;
      digitos: number;
      created: string;
      last_update: string;
    }

    interface Impuestos {
      id_impuestos: string;
      nombre: string;
      activo: boolean;
      created: string;
    }

    interface Impuesto_Tasa_Historial {
      id_tasa: string;
      id_impuestos: string;
      porcentaje: number;
      vigente_desde: string;
      vigente_hasta: string | null;
      registrado_por: string | null;
      created: string;
    }

    interface Margenes {
      id_margenes: string;
      nombre: string;
      activo: boolean;
      created: string;
    }

    interface Margen_Tasa_Historial {
      id_tasa: string;
      id_margenes: string;
      porcentaje: number;
      vigente_desde: string;
      vigente_hasta: string | null;
      registrado_por: string | null;
      created: string;
    }

    /* ─── PRODUCTO ────────────────────────────────────────── */
    interface Producto {
      id_producto: string;
      id_familia: string | null;
      codigo_interno: string | null;
      nombre: string;
      descripcion: string | null;
      costo_referencia: number;
      id_margenes: string | null;
      costo_final: number | null;
      umbral_rojo_dias: number | null;
      umbral_amarillo_dias: number | null;
      umbral_rojo_stock: number | null;
      umbral_amarillo_stock: number | null;
      meta_estanteria: number | null;
      activo: boolean;
      created: string;
      last_update: string;
    }

    interface Producto_Impuesto {
      id_producto_impuesto: string;
      id_producto: string;
      id_impuestos: string;
      activo: boolean;
      created: string;
    }

    interface Historial_Precio {
      id_historial: string;
      id_producto: string;
      costo_anterior: number | null;
      costo_nuevo: number | null;
      editado_por: string | null;
      created: string;
    }

    interface Codigos_Alternos {
      id_codigo: string;
      id_producto: string;
      codigo: string;
      descripcion: string | null;
      created: string;
    }

    /* ─── INVENTARIO / ENTRADA / LOTE ────────────────────────*/
    interface Inventario {
      id_producto: string;
      cantidad_total: number;
      cantidad_estanteria: number;
      cantidad_almacen: number; // columna generada, solo lectura
      last_update: string;
    }

    interface Entrada {
      id_entrada: string;
      id_producto: string;
      cantidad_total: number;
      costo_compra_promedio: number | null;
      registrado_por: string | null;
      created: string;
    }

    interface Entrada_Detalle {
      id_detalle: string;
      id_entrada: string;
      id_producto: string;
      cantidad: number;
      fecha_caducidad: string | null;
      unidad: 'piezas' | 'kilos';
      costo_compra: number | null;
      created: string;
    }

    interface Entrada_Detalle_Costo {
      id_costo: string;
      id_detalle: string;
      concepto: string;
      monto: number;
      activo: boolean;
      orden: number;
      created: string;
    }

    interface Lote {
      id_lote: string;
      id_producto: string;
      id_entrada: string;
      cantidad: number;
      cantidad_disponible: number;
      fecha_caducidad: string | null;
      estado_lote: 'activo' | 'parcial' | 'agotado' | 'caducado';
      unidad: 'piezas' | 'kilos';
      costo_compra: number | null;
      created: string;
      last_update: string;
    }

    /* ─── VENTA ───────────────────────────────────────────── */
    interface Venta {
      id_venta: string;
      numero_venta: number;
      registrado_por: string | null;
      snapshot: unknown | null;
      created: string;
    }

    interface Venta_Detalle {
      id_vd: string;
      id_venta: string;
      id_producto: string;
      cantidad: number;
      precio_unitario: number;
      subtotal: number; // columna generada, solo lectura
      id_margenes: string | null;
      margen_nombre: string | null;
      margen_porcentaje_aplicado: number | null;
      costo_referencia_usado: number | null;
      created: string;
    }

    interface Venta_Detalle_Impuesto {
      id_vdi: string;
      id_vd: string;
      id_impuestos: string | null;
      impuesto_nombre: string;
      porcentaje_aplicado: number;
      monto_aplicado: number;
      created: string;
    }

    interface Documento {
      id_documento: string;
      id_venta: string;
      contenido: unknown;
      created: string;
    }

    /* ─── AJUSTES DE INVENTARIO ───────────────────────────── */
    interface Ajuste_Inventario {
      id_ajuste: string;
      id_producto: string;
      id_lote: string | null;
      cantidad_ajuste: number;
      motivo: string;
      autorizado_por: string | null;
      created: string;
    }

    /* ─── DEVOLUCIONES ────────────────────────────────────── */
    interface Devolucion {
      id_devolucion: string;
      id_producto: string;
      cantidad_devuelta: number;
      precio_unitario: number;
      monto_devuelto: number; // columna generada, solo lectura
      motivo: 'producto_danado' | 'producto_caducado' | 'error_cobro' | 'cliente_insatisfecho' | 'otro';
      observaciones: string | null;
      accion: 'reembolso' | 'nota_credito' | 'cambio';
      restock: boolean;
      id_ajuste: string | null;
      registrado_por: string | null;
      created: string;
    }

    /* ─── AVISOS ──────────────────────────────────────────── */
    interface Aviso {
      id_aviso: string;
      id_producto: string;
      tipo: 'stock_critico' | 'estanteria_baja';
      nivel: 'amarillo' | 'rojo';
      mensaje: string;
      cantidad_actual: number;
      cantidad_esperada: number | null;
      leido: boolean;
      created: string;
      last_update: string;
    }

    /* ─── VISTAS ──────────────────────────────────────────── */
    interface V_Usuarios {
      id_perfil_info: string;
      usuario: string;
      nombres: string;
      apellido_paterno: string;
      apellido_materno: string | null;
      rol: Perfil_Info['rol'];
      auth_usuario: string | null;
      correo_acceso: string | null;
      correo_personal: string | null;
      lada: string | null;
      telefono: string | null;
      direccion: string | null;
      created: string;
      last_update: string;
    }

    interface V_Entrada_Desglose {
      id_costo: string;
      id_detalle: string;
      id_entrada: string;
      id_producto: string;
      producto_nombre: string;
      codigo_interno: string | null;
      concepto: string;
      monto: number;
      activo: boolean;
      orden: number;
      costo_compra_total_linea: number | null;
    }

    interface V_Producto_Impuestos {
      id_producto: string;
      producto_nombre: string;
      codigo_interno: string | null;
      id_impuestos: string;
      impuesto_nombre: string;
      porcentaje_vigente: number | null;
      activo: boolean;
    }

    interface V_Impuestos_Vigentes {
      id_impuestos: string;
      nombre: string;
      activo: boolean;
      porcentaje: number;
      vigente_desde: string;
    }

    interface V_Margenes_Vigentes {
      id_margenes: string;
      nombre: string;
      activo: boolean;
      porcentaje: number;
      vigente_desde: string;
    }

    interface V_Venta_Desglose {
      id_vd: string;
      id_venta: string;
      id_producto: string;
      producto_nombre: string;
      codigo_interno: string | null;
      cantidad: number;
      precio_unitario: number;
      subtotal: number;
      costo_referencia_usado: number | null;
      margen_nombre: string | null;
      margen_porcentaje_aplicado: number | null;
      impuesto_nombre: string | null;
      impuesto_porcentaje_aplicado: number | null;
      impuesto_monto: number | null;
      created: string;
    }

    interface V_Avisos_Stock {
      id_aviso: string;
      id_producto: string;
      producto_nombre: string;
      codigo_interno: string | null;
      tipo: Aviso['tipo'];
      nivel: Aviso['nivel'];
      mensaje: string;
      cantidad_actual: number;
      cantidad_esperada: number | null;
      leido: boolean;
      created: string;
      last_update: string;
    }

    interface V_Alertas_Caducidad {
      id_lote: string;
      id_producto: string;
      producto_nombre: string;
      codigo_interno: string | null;
      fecha_caducidad: string;
      cantidad_disponible: number;
      dias_restantes: number;
      alerta: 'rojo' | 'amarillo' | 'verde';
    }

    interface V_Dashboard_Producto {
      id_producto: string;
      codigo_interno: string | null;
      nombre: string;
      familia: string | null;
      cantidad_total: number | null;
      proxima_caducidad: string | null;
      lotes_activos: number;
    }

    interface V_Valor_Inventario {
      valor_total: number;
    }
  }

  interface Window {
    api: {
      query: (sql: string, params?: any[]) => Promise<any>;
      execute: (sql: string, params?: any[], entity?: string) => Promise<any>;
      onChange: (callback: (entity: string) => void) => () => void;

      // Dominio Auth: login con correo de acceso o username.
      auth: {
        login: (identifier: string, password: string) => Promise<DB.V_Usuarios>;
      };

      users: {
        crear: (input: {
          usuario: string;
          nombres: string;
          apellido_paterno: string;
          apellido_materno: string | null;
          rol: string;
          correo_acceso: string;
          password: string;
          correo_personal: string | null;
          lada: string | null;
          telefono: string | null;
          direccion: string | null;
        }) => Promise<string>;
        asignarCredenciales: (payload: {
          id_perfil_info: string;
          correo_acceso: string;
          password: string;
        }) => Promise<void>;
        cambiarPassword: (payload: { id_perfil_info: string; password: string }) => Promise<void>;
        revocarCredenciales: (idPerfilInfo: string) => Promise<void>;
      };
    };
  }
}

// ─── Tipos de base de datos: Notificaciones ──────────────────────────────────
// Corresponde a la tabla Notificacion del esquema la_cuchilla_final.sql
// (campana de notificaciones — feed de eventos efímeros, no semáforos de stock).
export interface Notificacion {
    id_notificacion: string;
    titulo: string;
    descripcion: string;
    tipo: 'info' | 'warning' | 'alert' | 'success';
    prioridad?: 'baja' | 'media' | 'alto' | 'urgente' | null;
    is_read: boolean;
    is_completed: boolean;
    id_referencia?: string | null;
    tabla_referencia?: string | null;
    id_perfil_info?: string | null;
    created: string;
}