-- ============================================================
-- LA CUCHILLA — ESQUEMA FINAL UNIFICADO (MySQL 8.0+)
-- ============================================================
-- Este archivo reemplaza a TODOS los anteriores:
--   1) esquema_la_cuchilla_mysql.sql                  (esquema original)
--   2) migracion_perfil_credenciales_contacto.sql      (Usuario -> Perfil_Info/Credenciales/Contacto)
--   3) migracion_desglose_costos.sql                   (Entrada_Detalle_Costo)
--   4) migracion_avisos_stock_estanteria.sql           (Aviso, estantería, umbrales de stock)
--   5) esquema_la_cuchilla_unificado.sql               (unificación de 1-4)
--   6) migracion_margenes_impuestos_escalables.sql     (impuestos múltiples + historial de tasas)
--   7) migracion_bitacora_actividad.sql                (tabla Bitacora, "Actividad Reciente" de detailsuser.tsx)
--
-- NO es una migración: crea el esquema FINAL de una sola vez.
-- Pensado para ejecutarse al arrancar el .exe / instalación limpia,
-- sin datos previos que conservar. Es seguro correrlo con
-- CREATE DATABASE IF NOT EXISTS + el resto de sentencias fallará
-- si la base ya existe con tablas — está pensado para primera
-- instalación, no para reintentos sobre una base ya poblada.
--
-- ============================================================
-- MODELO DE MÁRGENES E IMPUESTOS (parte escalable)
-- ============================================================
--   - Impuestos y Márgenes son catálogos (solo nombre + activo).
--     Su % vive en tablas de historial (Impuesto_Tasa_Historial /
--     Margen_Tasa_Historial): cada cambio de tasa cierra la fila
--     vigente (vigente_hasta) y abre una nueva. La tasa "actual"
--     es siempre la fila con vigente_hasta IS NULL.
--   - Un producto puede tener VARIOS impuestos (Producto_Impuesto,
--     tabla puente N a M). Un margen puede aplicar a varios
--     productos (Producto.id_margenes, 1 margen -> N productos).
--   - Producto.costo_final se recalcula solo (vía triggers) cada
--     vez que cambia: el costo de referencia, el margen asignado,
--     la tasa vigente de un impuesto, o los impuestos ligados al
--     producto. Nunca hay que tocarlo a mano.
--   - Cada línea de venta CONGELA (Venta_Detalle + Venta_Detalle_
--     Impuesto) el nombre y % exacto del margen e impuestos que
--     se usaron en ese momento. Así, aunque las tasas cambien
--     después, los reportes de ventas ya hechas no se alteran
--     jamás — es historial administrativo fijo.
--   - Cambiar una tasa SIEMPRE debe hacerse con los procedimientos
--     sp_actualizar_tasa_impuesto / sp_actualizar_tasa_margen
--     (nunca con UPDATE directo a las tablas de historial), porque
--     son los que abren/cierran vigencias y disparan el recálculo
--     en cascada de todos los productos afectados.
--
-- NOTAS DE CONVERSIÓN (heredadas del esquema original, PostgreSQL -> MySQL):
-- 1) No existe CREATE TYPE ENUM -> los enums van inline en cada columna.
-- 2) No existe uuid/gen_random_uuid() -> se usa CHAR(36) DEFAULT (UUID()).
-- 3) No existen funciones PL/pgSQL que devuelvan TRIGGER -> la lógica
--    del trigger se escribe directo dentro de CREATE TRIGGER.
-- 4) No existe RETURNING -> los procedimientos usan parámetros OUT.
-- 5) jsonb_array_elements -> JSON_TABLE (MySQL 8.0.19+).
-- 6) ON CONFLICT ... DO UPDATE -> ON DUPLICATE KEY UPDATE.
-- 7) Índice GIN + tsvector -> FULLTEXT INDEX (búsqueda con MATCH/AGAINST).
-- ============================================================

CREATE DATABASE IF NOT EXISTS la_cuchilla
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE la_cuchilla;

-- ============================================================
-- PERSONAL (Perfil_Info + Credenciales + Contacto)
-- Pantalla: Personal / usuarios.css -> .usr-*
-- ============================================================

-- Identidad de la persona. NUNCA se borra: es el historial.
CREATE TABLE Perfil_Info (
  id_perfil_info    CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  usuario           VARCHAR(100) UNIQUE NOT NULL,   -- username interno, ej. "@jdelgado"
  nombres           VARCHAR(150) NOT NULL,
  apellido_paterno  VARCHAR(100) NOT NULL,
  apellido_materno  VARCHAR(100),
  rol               ENUM('Dev','administrador','cajero','contador') NOT NULL DEFAULT 'cajero',
  created           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_update       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Acceso al sistema. 1 a 1 con Perfil_Info. Mientras exista esta
-- fila, la persona tiene acceso activo. "Eliminar" a alguien en la
-- UI = borrar su fila de aquí (sp_revocar_credenciales), no su perfil.
CREATE TABLE Credenciales (
  id_credencial   CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_perfil_info  CHAR(36) NOT NULL UNIQUE,
  correo_acceso   VARCHAR(150) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  created         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_update     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_credenciales_perfil FOREIGN KEY (id_perfil_info)
    REFERENCES Perfil_Info(id_perfil_info) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Datos de contacto. 1 a 1 con Perfil_Info, siempre se conserva.
CREATE TABLE Contacto (
  id_contacto     CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_perfil_info  CHAR(36) NOT NULL UNIQUE,
  correo_personal VARCHAR(150),
  lada            VARCHAR(5),
  telefono        VARCHAR(20),
  direccion       VARCHAR(255),
  created         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_update     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_contacto_perfil FOREIGN KEY (id_perfil_info)
    REFERENCES Perfil_Info(id_perfil_info) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_perfil_rol ON Perfil_Info(rol);

-- Bitácora de actividad. Diseño genérico a propósito (columna
-- `entidad`) para que, más adelante, otros módulos (productos,
-- ventas, clientes...) puedan reusar esta misma tabla en vez de
-- crear una bitácora por módulo. Por ahora solo el módulo de
-- Personal (user.service.ts) escribe en ella, con entidad = 'usuario'.
-- Alimenta la sección "Actividad Reciente" de detailsuser.tsx.
CREATE TABLE Bitacora (
  id_bitacora     CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  -- De qué perfil es esta entrada (a quién se le hizo / a quién pertenece).
  id_perfil_info  CHAR(36)     NOT NULL,
  -- Quién ejecutó la acción. NULL hasta que exista sesión de usuario actual
  -- (ningún canal IPC recibe hoy "quién" hace la acción, solo "qué" se
  -- cambia). Cuando exista login persistente, basta con mandar ese id.
  id_actor        CHAR(36)     NULL,
  -- 'crear' | 'editar_perfil' | 'editar_contacto' | 'asignar_credenciales'
  -- | 'cambiar_password' | 'cambiar_correo' | 'revocar_credenciales' | ...
  accion          VARCHAR(30)  NOT NULL,
  -- 'usuario' por ahora; deja la puerta abierta a 'producto', 'venta', etc.
  entidad         VARCHAR(30)  NOT NULL DEFAULT 'usuario',
  -- Texto ya traducido y listo para mostrarse tal cual en el timeline,
  -- ej. "Se actualizó el perfil (rol: contador → cajero)".
  descripcion     VARCHAR(255) NOT NULL,
  creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bitacora_perfil
    FOREIGN KEY (id_perfil_info) REFERENCES Perfil_Info(id_perfil_info),
  CONSTRAINT fk_bitacora_actor
    FOREIGN KEY (id_actor) REFERENCES Perfil_Info(id_perfil_info)
) ENGINE=InnoDB;

-- La consulta de detailsuser.tsx siempre filtra por id_perfil_info y
-- ordena por fecha descendente (más nuevo primero); este índice cubre
-- exactamente ese acceso.
CREATE INDEX idx_bitacora_perfil ON Bitacora(id_perfil_info, creado_en DESC);

-- ============================================================
-- CATÁLOGOS
-- ============================================================
CREATE TABLE Familia (
  id_familia  CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  nombre      VARCHAR(150) NOT NULL,
  digitos     INT NOT NULL DEFAULT 2,
  created     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Catálogo de impuestos. El % NO vive aquí (ver Impuesto_Tasa_
-- Historial): esta tabla solo identifica "qué impuesto es".
CREATE TABLE Impuestos (
  id_impuestos CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  nombre       VARCHAR(150) NOT NULL,
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  created      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Historial de tasas de cada impuesto. La fila vigente es la que
-- tiene vigente_hasta IS NULL. Nunca se hace UPDATE directo aquí:
-- usar sp_actualizar_tasa_impuesto.
CREATE TABLE Impuesto_Tasa_Historial (
  id_tasa        CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_impuestos   CHAR(36) NOT NULL,
  porcentaje     DECIMAL(6,4) NOT NULL,
  vigente_desde  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  vigente_hasta  TIMESTAMP NULL DEFAULT NULL,
  registrado_por CHAR(36),
  created        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_impth_impuestos FOREIGN KEY (id_impuestos)
    REFERENCES Impuestos(id_impuestos) ON DELETE CASCADE,
  CONSTRAINT fk_impth_perfil FOREIGN KEY (registrado_por)
    REFERENCES Perfil_Info(id_perfil_info) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Catálogo de márgenes. El % NO vive aquí (ver Margen_Tasa_
-- Historial), mismo patrón que Impuestos.
CREATE TABLE Margenes (
  id_margenes CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  nombre      VARCHAR(150) NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Historial de tasas de cada margen. Mismo patrón que
-- Impuesto_Tasa_Historial: usar sp_actualizar_tasa_margen.
CREATE TABLE Margen_Tasa_Historial (
  id_tasa        CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_margenes    CHAR(36) NOT NULL,
  porcentaje     DECIMAL(6,4) NOT NULL,
  vigente_desde  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  vigente_hasta  TIMESTAMP NULL DEFAULT NULL,
  registrado_por CHAR(36),
  created        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_marth_margenes FOREIGN KEY (id_margenes)
    REFERENCES Margenes(id_margenes) ON DELETE CASCADE,
  CONSTRAINT fk_marth_perfil FOREIGN KEY (registrado_por)
    REFERENCES Perfil_Info(id_perfil_info) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_impth_vigente ON Impuesto_Tasa_Historial(id_impuestos, vigente_hasta);
CREATE INDEX idx_marth_vigente ON Margen_Tasa_Historial(id_margenes, vigente_hasta);

-- ============================================================
-- PRODUCTO
-- ============================================================
CREATE TABLE Producto (
  id_producto          CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_familia           CHAR(36),
  codigo_interno       VARCHAR(50) UNIQUE,
  nombre               VARCHAR(200) NOT NULL,
  descripcion          TEXT,
  costo_referencia     DECIMAL(12,2) NOT NULL,
  id_margenes          CHAR(36),
  costo_final          DECIMAL(12,2),
  umbral_rojo_dias     INT DEFAULT 7,
  umbral_amarillo_dias INT DEFAULT 15,
  umbral_rojo_stock     INT DEFAULT NULL COMMENT 'Unidades totales o menos = stock muy bajo (rojo)',
  umbral_amarillo_stock INT DEFAULT NULL COMMENT 'Unidades totales o menos = stock bajo (amarillo)',
  meta_estanteria       INT DEFAULT NULL COMMENT 'Unidades que siempre quieres ver en la estantería',
  activo               BOOLEAN DEFAULT TRUE,
  created              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_update          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_producto_familia FOREIGN KEY (id_familia) REFERENCES Familia(id_familia) ON DELETE SET NULL,
  CONSTRAINT fk_producto_margenes FOREIGN KEY (id_margenes) REFERENCES Margenes(id_margenes) ON DELETE SET NULL,
  FULLTEXT INDEX idx_producto_nombre_ft (nombre)
) ENGINE=InnoDB;

-- Impuestos ligados a un producto (N a M). Un producto puede
-- tener 0, 1 o varios impuestos activos a la vez.
CREATE TABLE Producto_Impuesto (
  id_producto_impuesto CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_producto           CHAR(36) NOT NULL,
  id_impuestos           CHAR(36) NOT NULL,
  activo                 BOOLEAN NOT NULL DEFAULT TRUE,
  created                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pi_producto  FOREIGN KEY (id_producto)  REFERENCES Producto(id_producto)   ON DELETE CASCADE,
  CONSTRAINT fk_pi_impuestos FOREIGN KEY (id_impuestos) REFERENCES Impuestos(id_impuestos) ON DELETE CASCADE,
  CONSTRAINT uq_pi_producto_impuesto UNIQUE (id_producto, id_impuestos)
) ENGINE=InnoDB;

CREATE INDEX idx_pi_producto  ON Producto_Impuesto(id_producto);
CREATE INDEX idx_pi_impuestos ON Producto_Impuesto(id_impuestos);

CREATE TABLE Historial_Precio (
  id_historial   CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_producto    CHAR(36) NOT NULL,
  costo_anterior DECIMAL(12,2),
  costo_nuevo    DECIMAL(12,2),
  editado_por    CHAR(36),
  created        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hist_producto FOREIGN KEY (id_producto) REFERENCES Producto(id_producto) ON DELETE CASCADE,
  CONSTRAINT fk_hist_perfil FOREIGN KEY (editado_por) REFERENCES Perfil_Info(id_perfil_info) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE Codigos_Alternos (
  id_codigo   CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_producto CHAR(36) NOT NULL,
  codigo      VARCHAR(100) UNIQUE NOT NULL,
  descripcion VARCHAR(255),
  created     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_codalt_producto FOREIGN KEY (id_producto) REFERENCES Producto(id_producto) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- INVENTARIO / ENTRADA / LOTE
-- ============================================================
CREATE TABLE Inventario (
  id_producto         CHAR(36) PRIMARY KEY,
  cantidad_total      INT NOT NULL DEFAULT 0,
  cantidad_estanteria INT NOT NULL DEFAULT 0
    COMMENT 'Unidades actualmente puestas en estantería (subconjunto de cantidad_total)',
  cantidad_almacen    INT GENERATED ALWAYS AS (cantidad_total - cantidad_estanteria) STORED,
  last_update         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inv_producto FOREIGN KEY (id_producto) REFERENCES Producto(id_producto) ON DELETE CASCADE,
  CONSTRAINT chk_inv_estanteria CHECK (cantidad_estanteria >= 0 AND cantidad_estanteria <= cantidad_total)
) ENGINE=InnoDB;

CREATE TABLE Entrada (
  id_entrada            CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_producto           CHAR(36) NOT NULL,
  cantidad_total        INT NOT NULL,
  costo_compra_promedio DECIMAL(12,2),
  registrado_por        CHAR(36),
  created               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_entrada_cantidad CHECK (cantidad_total > 0),
  CONSTRAINT fk_entrada_producto FOREIGN KEY (id_producto) REFERENCES Producto(id_producto),
  CONSTRAINT fk_entrada_perfil FOREIGN KEY (registrado_por) REFERENCES Perfil_Info(id_perfil_info) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE Entrada_Detalle (
  id_detalle      CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_entrada      CHAR(36) NOT NULL,
  id_producto     CHAR(36) NOT NULL,
  cantidad        INT NOT NULL,
  fecha_caducidad DATE,
  unidad          ENUM('piezas','kilos') DEFAULT 'piezas',
  costo_compra    DECIMAL(12,2),
  created         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_detalle_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_detalle_entrada FOREIGN KEY (id_entrada) REFERENCES Entrada(id_entrada) ON DELETE CASCADE,
  CONSTRAINT fk_detalle_producto FOREIGN KEY (id_producto) REFERENCES Producto(id_producto)
) ENGINE=InnoDB;

-- Desglose de costos de una línea de entrada (modal Registrar
-- Entrada de Mercancía / addentrada.css -> .aen-desglose-*).
-- Ej: "Precio proveedor", "Flete", "Empaque"...
CREATE TABLE Entrada_Detalle_Costo (
  id_costo    CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_detalle  CHAR(36) NOT NULL,
  concepto    VARCHAR(150) NOT NULL,
  monto       DECIMAL(12,2) NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,  -- corresponde al toggle .aen-desglose-activate
  orden       INT NOT NULL DEFAULT 0,         -- orden en que aparecen las filas en el modal
  created     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_costo_detalle FOREIGN KEY (id_detalle)
    REFERENCES Entrada_Detalle(id_detalle) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Lote (
  id_lote             CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_producto         CHAR(36) NOT NULL,
  id_entrada          CHAR(36) NOT NULL,
  cantidad            INT NOT NULL,
  cantidad_disponible INT NOT NULL,
  fecha_caducidad     DATE,
  estado_lote         ENUM('activo','parcial','agotado','caducado') DEFAULT 'activo',
  unidad              ENUM('piezas','kilos') DEFAULT 'piezas',
  costo_compra        DECIMAL(12,2),
  created             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_update         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lote_producto FOREIGN KEY (id_producto) REFERENCES Producto(id_producto),
  CONSTRAINT fk_lote_entrada FOREIGN KEY (id_entrada) REFERENCES Entrada(id_entrada)
) ENGINE=InnoDB;

-- ============================================================
-- VENTA
-- ============================================================
CREATE TABLE Venta (
  id_venta       CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  numero_venta   INT AUTO_INCREMENT UNIQUE,
  registrado_por CHAR(36),
  snapshot       JSON,
  created        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_venta_perfil FOREIGN KEY (registrado_por) REFERENCES Perfil_Info(id_perfil_info) ON DELETE SET NULL
) ENGINE=InnoDB;

-- id_margenes / margen_nombre / margen_porcentaje_aplicado /
-- costo_referencia_usado quedan CONGELADOS al momento de la venta
-- (los llena tr_vd_congelar_desglose). No se recalculan después
-- aunque cambien las tasas — es el registro administrativo fijo.
CREATE TABLE Venta_Detalle (
  id_vd                       CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_venta                    CHAR(36) NOT NULL,
  id_producto                 CHAR(36) NOT NULL,
  cantidad                    INT NOT NULL,
  precio_unitario              DECIMAL(12,2) NOT NULL,
  subtotal                    DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  id_margenes                 CHAR(36) NULL,
  margen_nombre                VARCHAR(150) NULL,
  margen_porcentaje_aplicado   DECIMAL(6,4) NULL,
  costo_referencia_usado       DECIMAL(12,2) NULL,
  created                      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_vd_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_vd_venta FOREIGN KEY (id_venta) REFERENCES Venta(id_venta) ON DELETE CASCADE,
  CONSTRAINT fk_vd_producto FOREIGN KEY (id_producto) REFERENCES Producto(id_producto),
  CONSTRAINT fk_vd_margenes FOREIGN KEY (id_margenes) REFERENCES Margenes(id_margenes) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Impuestos aplicados a una línea de venta, CONGELADOS (nombre y
-- % ya fijos, independientes del catálogo). 0..N filas por línea.
-- Los llena tr_vd_congelar_desglose justo después del INSERT en
-- Venta_Detalle.
CREATE TABLE Venta_Detalle_Impuesto (
  id_vdi              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_vd                CHAR(36)      NOT NULL,
  id_impuestos           CHAR(36),                      -- referencia informativa; puede quedar NULL si el impuesto se borra del catálogo
  impuesto_nombre        VARCHAR(150)  NOT NULL,         -- congelado
  porcentaje_aplicado    DECIMAL(6,4)  NOT NULL,         -- congelado
  monto_aplicado         DECIMAL(12,2) NOT NULL,         -- congelado (subtotal_linea * porcentaje_aplicado)
  created                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vdi_vd FOREIGN KEY (id_vd) REFERENCES Venta_Detalle(id_vd) ON DELETE CASCADE,
  CONSTRAINT fk_vdi_impuestos FOREIGN KEY (id_impuestos) REFERENCES Impuestos(id_impuestos) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE Documento (
  id_documento CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_venta     CHAR(36) NOT NULL,
  contenido    JSON NOT NULL,
  created      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_venta FOREIGN KEY (id_venta) REFERENCES Venta(id_venta)
) ENGINE=InnoDB;

-- ============================================================
-- AJUSTES DE INVENTARIO
-- ============================================================
CREATE TABLE Ajuste_Inventario (
  id_ajuste       CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_producto     CHAR(36) NOT NULL,
  id_lote         CHAR(36),
  cantidad_ajuste INT NOT NULL,
  motivo          VARCHAR(255) NOT NULL,
  autorizado_por  CHAR(36),
  created         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ajuste_producto FOREIGN KEY (id_producto) REFERENCES Producto(id_producto),
  CONSTRAINT fk_ajuste_lote FOREIGN KEY (id_lote) REFERENCES Lote(id_lote) ON DELETE SET NULL,
  CONSTRAINT fk_ajuste_perfil FOREIGN KEY (autorizado_por) REFERENCES Perfil_Info(id_perfil_info) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- AVISOS (Alertas de Inventario / Estantería)
-- Modal Agregar/Editar Producto -> .aip-* / widget "Alertas de
-- Inventario". Un renglón "vivo" por producto + tipo de aviso
-- (UNIQUE): se actualiza in-place mientras la condición siga
-- activa y se borra solo cuando el stock/estantería se recupera.
-- ============================================================
CREATE TABLE Aviso (
  id_aviso          CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  id_producto       CHAR(36) NOT NULL,
  tipo              ENUM('stock_critico','estanteria_baja') NOT NULL,
  nivel             ENUM('amarillo','rojo') NOT NULL,
  mensaje           VARCHAR(255) NOT NULL,
  cantidad_actual   INT NOT NULL,
  cantidad_esperada INT,
  leido             BOOLEAN NOT NULL DEFAULT FALSE,
  created           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_update       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_aviso_producto FOREIGN KEY (id_producto)
    REFERENCES Producto(id_producto) ON DELETE CASCADE,
  CONSTRAINT uq_aviso_producto_tipo UNIQUE (id_producto, tipo)
) ENGINE=InnoDB;

-- ============================================================
-- ÍNDICES ADICIONALES
-- ============================================================
CREATE INDEX idx_lote_producto  ON Lote(id_producto);
CREATE INDEX idx_lote_caducidad ON Lote(fecha_caducidad ASC);
CREATE INDEX idx_vd_producto    ON Venta_Detalle(id_producto);
CREATE INDEX idx_vdi_vd         ON Venta_Detalle_Impuesto(id_vd);
CREATE INDEX idx_venta_created  ON Venta(created DESC);
CREATE INDEX idx_costo_detalle  ON Entrada_Detalle_Costo(id_detalle);
CREATE INDEX idx_aviso_leido    ON Aviso(leido);

-- ============================================================
-- PROCEDIMIENTOS ALMACENADOS — MÁRGENES / IMPUESTOS
-- Se definen primero porque los triggers de Producto y de
-- Producto_Impuesto los llaman.
-- ============================================================
DELIMITER $$

-- "Botón de recálculo": tocar la fila del producto sin cambiar
-- nada dispara tr_costo_final_update (más abajo), que sabe sumar
-- margen + impuestos vigentes. Así la fórmula vive en un solo
-- lugar y no se duplica en cada procedimiento.
CREATE PROCEDURE sp_recalcular_costo_producto(
  IN p_id_producto CHAR(36)
)
BEGIN
  UPDATE Producto SET costo_referencia = costo_referencia WHERE id_producto = p_id_producto;
END$$

-- Recalcula todos los productos ligados a un impuesto (al cambiar
-- su tasa o activarlo/desactivarlo).
CREATE PROCEDURE sp_recalcular_costo_por_impuesto(
  IN p_id_impuestos CHAR(36)
)
BEGIN
  UPDATE Producto p
  JOIN Producto_Impuesto pi ON pi.id_producto = p.id_producto
  SET p.costo_referencia = p.costo_referencia
  WHERE pi.id_impuestos = p_id_impuestos AND pi.activo = TRUE;
END$$

-- Recalcula todos los productos ligados a un margen (al cambiar
-- su tasa).
CREATE PROCEDURE sp_recalcular_costo_por_margen(
  IN p_id_margenes CHAR(36)
)
BEGIN
  UPDATE Producto SET costo_referencia = costo_referencia WHERE id_margenes = p_id_margenes;
END$$

-- Alta de un impuesto nuevo con su primera tasa.
CREATE PROCEDURE sp_crear_impuesto(
  IN  p_nombre         VARCHAR(150),
  IN  p_porcentaje      DECIMAL(6,4),
  IN  p_registrado_por  CHAR(36),
  OUT p_id_impuestos    CHAR(36)
)
BEGIN
  SET p_id_impuestos = UUID();
  INSERT INTO Impuestos (id_impuestos, nombre) VALUES (p_id_impuestos, p_nombre);
  INSERT INTO Impuesto_Tasa_Historial (id_impuestos, porcentaje, registrado_por)
  VALUES (p_id_impuestos, p_porcentaje, p_registrado_por);
END$$

-- Cambiar la tasa de un impuesto ya existente (ej. cambia de 16%
-- a 8% por zona fronteriza, o por reforma fiscal). No borra
-- historial: cierra la vigente y abre una nueva, luego recalcula
-- en cascada todos los productos afectados.
CREATE PROCEDURE sp_actualizar_tasa_impuesto(
  IN p_id_impuestos    CHAR(36),
  IN p_nuevo_porcentaje DECIMAL(6,4),
  IN p_registrado_por   CHAR(36)
)
BEGIN
  UPDATE Impuesto_Tasa_Historial
  SET vigente_hasta = CURRENT_TIMESTAMP
  WHERE id_impuestos = p_id_impuestos AND vigente_hasta IS NULL;

  INSERT INTO Impuesto_Tasa_Historial (id_impuestos, porcentaje, registrado_por)
  VALUES (p_id_impuestos, p_nuevo_porcentaje, p_registrado_por);

  CALL sp_recalcular_costo_por_impuesto(p_id_impuestos);
END$$

-- Alta de un margen nuevo con su primera tasa.
CREATE PROCEDURE sp_crear_margen(
  IN  p_nombre         VARCHAR(150),
  IN  p_porcentaje      DECIMAL(6,4),
  IN  p_registrado_por  CHAR(36),
  OUT p_id_margenes    CHAR(36)
)
BEGIN
  SET p_id_margenes = UUID();
  INSERT INTO Margenes (id_margenes, nombre) VALUES (p_id_margenes, p_nombre);
  INSERT INTO Margen_Tasa_Historial (id_margenes, porcentaje, registrado_por)
  VALUES (p_id_margenes, p_porcentaje, p_registrado_por);
END$$

-- Cambiar la tasa de un margen ya existente. Mismo patrón que
-- sp_actualizar_tasa_impuesto.
CREATE PROCEDURE sp_actualizar_tasa_margen(
  IN p_id_margenes     CHAR(36),
  IN p_nuevo_porcentaje DECIMAL(6,4),
  IN p_registrado_por   CHAR(36)
)
BEGIN
  UPDATE Margen_Tasa_Historial
  SET vigente_hasta = CURRENT_TIMESTAMP
  WHERE id_margenes = p_id_margenes AND vigente_hasta IS NULL;

  INSERT INTO Margen_Tasa_Historial (id_margenes, porcentaje, registrado_por)
  VALUES (p_id_margenes, p_nuevo_porcentaje, p_registrado_por);

  CALL sp_recalcular_costo_por_margen(p_id_margenes);
END$$

-- Asignar / reactivar un impuesto en un producto (checkboxes de
-- impuestos en el modal Agregar/Editar Producto).
CREATE PROCEDURE sp_asignar_impuesto_producto(
  IN p_id_producto  CHAR(36),
  IN p_id_impuestos CHAR(36)
)
BEGIN
  INSERT INTO Producto_Impuesto (id_producto, id_impuestos)
  VALUES (p_id_producto, p_id_impuestos)
  ON DUPLICATE KEY UPDATE activo = TRUE;
END$$

-- Quitar (desactivar) un impuesto de un producto sin perder el
-- vínculo histórico.
CREATE PROCEDURE sp_quitar_impuesto_producto(
  IN p_id_producto  CHAR(36),
  IN p_id_impuestos CHAR(36)
)
BEGIN
  UPDATE Producto_Impuesto SET activo = FALSE
  WHERE id_producto = p_id_producto AND id_impuestos = p_id_impuestos;
END$$

DELIMITER ;

-- ============================================================
-- PROCEDIMIENTOS ALMACENADOS — AVISOS
-- Se definen antes de los triggers de abajo porque los llaman.
-- ============================================================
DELIMITER $$

-- Recalcula los avisos de UN producto (stock total + estantería).
-- Se usa desde los triggers de Inventario/Producto y también se
-- puede llamar directo desde la app (ej. tras guardar un producto
-- con nuevos umbrales, o tras mover unidades a estantería).
CREATE PROCEDURE sp_recalcular_avisos_producto(
  IN p_id_producto CHAR(36)
)
BEGIN
  DECLARE v_rojo_stock INT;
  DECLARE v_amarillo_stock INT;
  DECLARE v_meta_estanteria INT;
  DECLARE v_cantidad_total INT;
  DECLARE v_cantidad_estanteria INT;

  SELECT p.umbral_rojo_stock, p.umbral_amarillo_stock, p.meta_estanteria,
         COALESCE(i.cantidad_total, 0), COALESCE(i.cantidad_estanteria, 0)
    INTO v_rojo_stock, v_amarillo_stock, v_meta_estanteria,
         v_cantidad_total, v_cantidad_estanteria
  FROM Producto p
  LEFT JOIN Inventario i ON i.id_producto = p.id_producto
  WHERE p.id_producto = p_id_producto;

  -- ── Aviso de stock total (rojo tiene prioridad sobre amarillo) ──
  IF v_rojo_stock IS NOT NULL AND v_cantidad_total <= v_rojo_stock THEN
    INSERT INTO Aviso (id_producto, tipo, nivel, mensaje, cantidad_actual, cantidad_esperada)
    VALUES (p_id_producto, 'stock_critico', 'rojo',
            CONCAT('Quedan ', v_cantidad_total, ' unidades en total'),
            v_cantidad_total, v_rojo_stock)
    ON DUPLICATE KEY UPDATE
      nivel = 'rojo', mensaje = VALUES(mensaje), cantidad_actual = VALUES(cantidad_actual),
      cantidad_esperada = VALUES(cantidad_esperada), leido = FALSE, last_update = CURRENT_TIMESTAMP;
  ELSEIF v_amarillo_stock IS NOT NULL AND v_cantidad_total <= v_amarillo_stock THEN
    INSERT INTO Aviso (id_producto, tipo, nivel, mensaje, cantidad_actual, cantidad_esperada)
    VALUES (p_id_producto, 'stock_critico', 'amarillo',
            CONCAT('Quedan ', v_cantidad_total, ' unidades en total'),
            v_cantidad_total, v_amarillo_stock)
    ON DUPLICATE KEY UPDATE
      nivel = 'amarillo', mensaje = VALUES(mensaje), cantidad_actual = VALUES(cantidad_actual),
      cantidad_esperada = VALUES(cantidad_esperada), leido = FALSE, last_update = CURRENT_TIMESTAMP;
  ELSE
    DELETE FROM Aviso WHERE id_producto = p_id_producto AND tipo = 'stock_critico';
  END IF;

  -- ── Aviso de estantería (comparado contra la meta del producto, no contra el total) ──
  IF v_meta_estanteria IS NOT NULL AND v_meta_estanteria > 0 THEN
    IF v_cantidad_estanteria <= 0 THEN
      INSERT INTO Aviso (id_producto, tipo, nivel, mensaje, cantidad_actual, cantidad_esperada)
      VALUES (p_id_producto, 'estanteria_baja', 'rojo',
              'No hay en estantería', 0, v_meta_estanteria)
      ON DUPLICATE KEY UPDATE
        nivel = 'rojo', mensaje = VALUES(mensaje), cantidad_actual = 0,
        cantidad_esperada = VALUES(cantidad_esperada), leido = FALSE, last_update = CURRENT_TIMESTAMP;
    ELSEIF v_cantidad_estanteria < v_meta_estanteria THEN
      INSERT INTO Aviso (id_producto, tipo, nivel, mensaje, cantidad_actual, cantidad_esperada)
      VALUES (p_id_producto, 'estanteria_baja', 'amarillo',
              CONCAT('Quedan ', v_cantidad_estanteria, ' en estantería (meta: ', v_meta_estanteria, ')'),
              v_cantidad_estanteria, v_meta_estanteria)
      ON DUPLICATE KEY UPDATE
        nivel = 'amarillo', mensaje = VALUES(mensaje), cantidad_actual = VALUES(cantidad_actual),
        cantidad_esperada = VALUES(cantidad_esperada), leido = FALSE, last_update = CURRENT_TIMESTAMP;
    ELSE
      DELETE FROM Aviso WHERE id_producto = p_id_producto AND tipo = 'estanteria_baja';
    END IF;
  ELSE
    DELETE FROM Aviso WHERE id_producto = p_id_producto AND tipo = 'estanteria_baja';
  END IF;
END$$

-- Mover unidades de almacén a estantería (botón "Reponer" en la UI).
-- Deja el resto en almacén (no puede exceder cantidad_total).
CREATE PROCEDURE sp_reponer_estanteria(
  IN p_id_producto CHAR(36),
  IN p_cantidad INT
)
BEGIN
  UPDATE Inventario
  SET cantidad_estanteria = LEAST(cantidad_estanteria + p_cantidad, cantidad_total)
  WHERE id_producto = p_id_producto;
END$$

DELIMITER ;

-- ============================================================
-- TRIGGERS
-- (En MySQL la lógica va directo dentro del trigger, no se
-- reutiliza una función externa como en PL/pgSQL)
-- ============================================================
DELIMITER $$

-- Código interno automático al insertar producto
CREATE TRIGGER tr_generar_codigo
BEFORE INSERT ON Producto
FOR EACH ROW
BEGIN
  DECLARE v_digitos INT DEFAULT 2;
  DECLARE v_secuencia INT DEFAULT 1;

  IF NEW.codigo_interno IS NULL THEN
    SELECT digitos INTO v_digitos FROM Familia WHERE id_familia = NEW.id_familia LIMIT 1;
    SET v_digitos = COALESCE(v_digitos, 2);

    SELECT COUNT(*) + 1 INTO v_secuencia FROM Producto WHERE id_familia = NEW.id_familia;

    SET NEW.codigo_interno = LPAD(CAST(v_secuencia AS CHAR), v_digitos + 3, '0');
  END IF;
END$$

-- Calcular costo final al insertar producto. En un INSERT todavía
-- no pueden existir filas en Producto_Impuesto para este producto
-- (la FK exige que el producto ya exista), así que el total de
-- impuestos arranca en 0; se completa solo en cuanto se le asignen
-- impuestos (ver tr_pi_recalc_insert más abajo).
CREATE TRIGGER tr_costo_final_insert
BEFORE INSERT ON Producto
FOR EACH ROW
BEGIN
  DECLARE v_margen DECIMAL(6,4) DEFAULT 0;

  SELECT mth.porcentaje INTO v_margen
  FROM Margen_Tasa_Historial mth
  WHERE mth.id_margenes = NEW.id_margenes AND mth.vigente_hasta IS NULL
  LIMIT 1;

  SET NEW.costo_final = NEW.costo_referencia * (1 + COALESCE(v_margen, 0));
END$$

-- Calcular costo final al actualizar producto: usa el margen
-- vigente (por Producto.id_margenes) y la SUMA de todos los
-- impuestos activos y vigentes ligados al producto.
CREATE TRIGGER tr_costo_final_update
BEFORE UPDATE ON Producto
FOR EACH ROW
BEGIN
  DECLARE v_margen DECIMAL(6,4) DEFAULT 0;
  DECLARE v_impuesto_total DECIMAL(8,4) DEFAULT 0;

  SELECT mth.porcentaje INTO v_margen
  FROM Margen_Tasa_Historial mth
  WHERE mth.id_margenes = NEW.id_margenes AND mth.vigente_hasta IS NULL
  LIMIT 1;

  SELECT COALESCE(SUM(ith.porcentaje), 0) INTO v_impuesto_total
  FROM Producto_Impuesto pi
  JOIN Impuestos i ON i.id_impuestos = pi.id_impuestos AND i.activo = TRUE
  JOIN Impuesto_Tasa_Historial ith ON ith.id_impuestos = pi.id_impuestos AND ith.vigente_hasta IS NULL
  WHERE pi.id_producto = NEW.id_producto AND pi.activo = TRUE;

  SET NEW.costo_final = NEW.costo_referencia * (1 + COALESCE(v_margen, 0)) * (1 + COALESCE(v_impuesto_total, 0));
END$$

CREATE TRIGGER tr_log_precio
AFTER UPDATE ON Producto
FOR EACH ROW
BEGIN
  IF NOT (OLD.costo_referencia <=> NEW.costo_referencia) THEN
    INSERT INTO Historial_Precio(id_producto, costo_anterior, costo_nuevo)
    VALUES (NEW.id_producto, OLD.costo_referencia, NEW.costo_referencia);
  END IF;
END$$

-- Asignar / quitar / activar-desactivar un impuesto de un producto
-- recalcula ese producto de inmediato (dispara tr_costo_final_update).
CREATE TRIGGER tr_pi_recalc_insert
AFTER INSERT ON Producto_Impuesto
FOR EACH ROW
BEGIN
  CALL sp_recalcular_costo_producto(NEW.id_producto);
END$$

CREATE TRIGGER tr_pi_recalc_update
AFTER UPDATE ON Producto_Impuesto
FOR EACH ROW
BEGIN
  CALL sp_recalcular_costo_producto(NEW.id_producto);
END$$

CREATE TRIGGER tr_pi_recalc_delete
AFTER DELETE ON Producto_Impuesto
FOR EACH ROW
BEGIN
  CALL sp_recalcular_costo_producto(OLD.id_producto);
END$$

-- Al insertar una línea de Entrada_Detalle: suma inventario y crea el lote
CREATE TRIGGER tr_detalle_entrada
AFTER INSERT ON Entrada_Detalle
FOR EACH ROW
BEGIN
  INSERT INTO Inventario (id_producto, cantidad_total)
    VALUES (NEW.id_producto, NEW.cantidad)
  ON DUPLICATE KEY UPDATE
    cantidad_total = cantidad_total + NEW.cantidad,
    last_update = CURRENT_TIMESTAMP;

  INSERT INTO Lote (id_producto, id_entrada, cantidad, cantidad_disponible,
                     fecha_caducidad, unidad, costo_compra)
  VALUES (NEW.id_producto, NEW.id_entrada, NEW.cantidad, NEW.cantidad,
          NEW.fecha_caducidad, NEW.unidad, NEW.costo_compra);
END$$

-- Descuento FEFO automático al insertar línea de venta
CREATE TRIGGER tr_venta_fefo
AFTER INSERT ON Venta_Detalle
FOR EACH ROW
BEGIN
  DECLARE v_id_lote CHAR(36);
  DECLARE v_disponible INT;
  DECLARE v_restante INT DEFAULT 0;
  DECLARE v_descontar INT;
  DECLARE done INT DEFAULT FALSE;

  DECLARE cur_lotes CURSOR FOR
    SELECT id_lote, cantidad_disponible FROM Lote
     WHERE id_producto = NEW.id_producto
       AND estado_lote IN ('activo','parcial')
       AND cantidad_disponible > 0
     ORDER BY fecha_caducidad ASC;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  SET v_restante = NEW.cantidad;

  OPEN cur_lotes;
  read_loop: LOOP
    IF v_restante <= 0 THEN
      LEAVE read_loop;
    END IF;

    FETCH cur_lotes INTO v_id_lote, v_disponible;
    IF done THEN
      LEAVE read_loop;
    END IF;

    SET v_descontar = LEAST(v_restante, v_disponible);
    SET v_restante = v_restante - v_descontar;

    UPDATE Lote SET
      cantidad_disponible = cantidad_disponible - v_descontar,
      estado_lote = CASE WHEN cantidad_disponible - v_descontar = 0
                         THEN 'agotado' ELSE 'parcial' END,
      last_update = CURRENT_TIMESTAMP
    WHERE id_lote = v_id_lote;
  END LOOP;
  CLOSE cur_lotes;

  UPDATE Inventario SET cantidad_total = cantidad_total - NEW.cantidad, last_update = CURRENT_TIMESTAMP
  WHERE id_producto = NEW.id_producto;
END$$

-- Congela margen + impuestos aplicados en esta línea de venta,
-- justo después de insertarla (ver Venta_Detalle / Venta_Detalle_
-- Impuesto). Esto es lo que queda fijo para reportes, aunque las
-- tasas cambien después.
CREATE TRIGGER tr_vd_congelar_desglose
AFTER INSERT ON Venta_Detalle
FOR EACH ROW
BEGIN
  DECLARE v_id_margenes CHAR(36);
  DECLARE v_margen_nombre VARCHAR(150);
  DECLARE v_margen_pct DECIMAL(6,4) DEFAULT 0;
  DECLARE v_costo_ref DECIMAL(12,2);

  SELECT p.id_margenes, p.costo_referencia
    INTO v_id_margenes, v_costo_ref
  FROM Producto p WHERE p.id_producto = NEW.id_producto;

  IF v_id_margenes IS NOT NULL THEN
    SELECT m.nombre, mth.porcentaje
      INTO v_margen_nombre, v_margen_pct
    FROM Margenes m
    JOIN Margen_Tasa_Historial mth
      ON mth.id_margenes = m.id_margenes AND mth.vigente_hasta IS NULL
    WHERE m.id_margenes = v_id_margenes
    LIMIT 1;
  END IF;

  UPDATE Venta_Detalle
  SET id_margenes                = v_id_margenes,
      margen_nombre              = v_margen_nombre,
      margen_porcentaje_aplicado = v_margen_pct,
      costo_referencia_usado     = v_costo_ref
  WHERE id_vd = NEW.id_vd;

  INSERT INTO Venta_Detalle_Impuesto (id_vd, id_impuestos, impuesto_nombre, porcentaje_aplicado, monto_aplicado)
  SELECT
    NEW.id_vd,
    i.id_impuestos,
    i.nombre,
    ith.porcentaje,
    ROUND(NEW.subtotal * ith.porcentaje, 2)
  FROM Producto_Impuesto pi
  JOIN Impuestos i ON i.id_impuestos = pi.id_impuestos AND i.activo = TRUE
  JOIN Impuesto_Tasa_Historial ith
    ON ith.id_impuestos = i.id_impuestos AND ith.vigente_hasta IS NULL
  WHERE pi.id_producto = NEW.id_producto AND pi.activo = TRUE;
END$$

-- Aplicar ajuste de inventario
CREATE TRIGGER tr_ajuste
AFTER INSERT ON Ajuste_Inventario
FOR EACH ROW
BEGIN
  UPDATE Inventario SET cantidad_total = cantidad_total + NEW.cantidad_ajuste, last_update = CURRENT_TIMESTAMP
  WHERE id_producto = NEW.id_producto;

  IF NEW.id_lote IS NOT NULL THEN
    UPDATE Lote SET
      cantidad_disponible = cantidad_disponible + NEW.cantidad_ajuste,
      estado_lote = CASE
        WHEN cantidad_disponible + NEW.cantidad_ajuste <= 0 THEN 'agotado'
        WHEN cantidad_disponible + NEW.cantidad_ajuste < cantidad THEN 'parcial'
        ELSE 'activo'
      END,
      last_update = CURRENT_TIMESTAMP
    WHERE id_lote = NEW.id_lote;
  END IF;
END$$

-- Cuando cambia el inventario (entradas, ventas, ajustes,
-- reponer estantería): recalcular avisos de ese producto.
CREATE TRIGGER tr_avisos_inventario_insert
AFTER INSERT ON Inventario
FOR EACH ROW
BEGIN
  CALL sp_recalcular_avisos_producto(NEW.id_producto);
END$$

CREATE TRIGGER tr_avisos_inventario_update
AFTER UPDATE ON Inventario
FOR EACH ROW
BEGIN
  CALL sp_recalcular_avisos_producto(NEW.id_producto);
END$$

-- Cuando cambian los umbrales/meta en el producto (desde el
-- modal Agregar/Editar Producto): recalcular con el stock actual.
CREATE TRIGGER tr_avisos_producto
AFTER UPDATE ON Producto
FOR EACH ROW
BEGIN
  IF NOT (OLD.umbral_rojo_stock <=> NEW.umbral_rojo_stock)
     OR NOT (OLD.umbral_amarillo_stock <=> NEW.umbral_amarillo_stock)
     OR NOT (OLD.meta_estanteria <=> NEW.meta_estanteria) THEN
    CALL sp_recalcular_avisos_producto(NEW.id_producto);
  END IF;
END$$

DELIMITER ;

-- ============================================================
-- PROCEDIMIENTOS ALMACENADOS — PERSONAL
-- (De la migración Perfil_Info/Credenciales/Contacto)
-- ============================================================
DELIMITER $$

-- Alta completa: perfil + credenciales + contacto en una sola
-- transacción (usado por el formulario "Nuevo Usuario").
CREATE PROCEDURE sp_crear_usuario(
  IN  p_usuario          VARCHAR(100),
  IN  p_nombres           VARCHAR(150),
  IN  p_apellido_paterno  VARCHAR(100),
  IN  p_apellido_materno  VARCHAR(100),
  IN  p_rol               VARCHAR(20),
  IN  p_correo_acceso     VARCHAR(150),
  IN  p_password_hash     VARCHAR(255),
  IN  p_correo_personal   VARCHAR(150),
  IN  p_lada              VARCHAR(5),
  IN  p_telefono          VARCHAR(20),
  IN  p_direccion         VARCHAR(255),
  OUT p_id_perfil_info    CHAR(36)
)
BEGIN
  SET p_id_perfil_info = UUID();

  INSERT INTO Perfil_Info (id_perfil_info, usuario, nombres, apellido_paterno, apellido_materno, rol)
  VALUES (p_id_perfil_info, p_usuario, p_nombres, p_apellido_paterno, p_apellido_materno, p_rol);

  INSERT INTO Credenciales (id_perfil_info, correo_acceso, password_hash)
  VALUES (p_id_perfil_info, p_correo_acceso, p_password_hash);

  INSERT INTO Contacto (id_perfil_info, correo_personal, lada, telefono, direccion)
  VALUES (p_id_perfil_info, p_correo_personal, p_lada, p_telefono, p_direccion);
END$$

-- Revocar acceso ("eliminar" a la persona en la UI): sólo borra
-- Credenciales. Perfil_Info y Contacto quedan intactos como
-- historial y el usuario cae al grupo "Sin Acceso".
CREATE PROCEDURE sp_revocar_credenciales(
  IN p_id_perfil_info CHAR(36)
)
BEGIN
  DELETE FROM Credenciales WHERE id_perfil_info = p_id_perfil_info;
END$$

-- Asignar credenciales a un perfil que no tenía acceso (pantalla
-- /auth/AsignarCredenciales).
CREATE PROCEDURE sp_asignar_credenciales(
  IN p_id_perfil_info CHAR(36),
  IN p_correo_acceso   VARCHAR(150),
  IN p_password_hash   VARCHAR(255)
)
BEGIN
  INSERT INTO Credenciales (id_perfil_info, correo_acceso, password_hash)
  VALUES (p_id_perfil_info, p_correo_acceso, p_password_hash);
END$$

DELIMITER ;

-- ============================================================
-- PROCEDIMIENTOS ALMACENADOS — INVENTARIO / VENTA
-- ============================================================
DELIMITER $$

-- Registrar una entrada con múltiples líneas de caducidad y, de
-- forma opcional, un desglose de costos por línea (modal Registrar
-- Entrada de Mercancía). p_detalles debe ser un JSON array, ej:
-- '[{
--    "cantidad":15,
--    "fecha_caducidad":"2026-08-12",
--    "costo_compra":10.5,
--    "unidad":"piezas",
--    "desglose":[
--      {"concepto":"Precio proveedor","monto":8.5,"activo":true},
--      {"concepto":"Flete","monto":2.0,"activo":true}
--    ]
-- }]'
-- Si una línea no trae "desglose", simplemente no se insertan
-- filas en Entrada_Detalle_Costo.
CREATE PROCEDURE sp_registrar_entrada(
  IN  p_id_producto CHAR(36),
  IN  p_cantidad_total INT,
  IN  p_costo_compra_promedio DECIMAL(12,2),
  IN  p_detalles JSON,
  IN  p_registrado_por CHAR(36),
  OUT p_id_entrada CHAR(36)
)
BEGIN
  DECLARE v_i INT DEFAULT 0;
  DECLARE v_n INT;
  DECLARE v_id_detalle CHAR(36);
  DECLARE v_item JSON;
  DECLARE v_desglose JSON;

  SET p_id_entrada = UUID();
  SET v_n = JSON_LENGTH(p_detalles);

  INSERT INTO Entrada (id_entrada, id_producto, cantidad_total, costo_compra_promedio, registrado_por)
  VALUES (p_id_entrada, p_id_producto, p_cantidad_total, p_costo_compra_promedio, p_registrado_por);

  WHILE v_i < v_n DO
    SET v_item = JSON_EXTRACT(p_detalles, CONCAT('$[', v_i, ']'));
    SET v_id_detalle = UUID();

    INSERT INTO Entrada_Detalle (id_detalle, id_entrada, id_producto, cantidad, fecha_caducidad, unidad, costo_compra)
    VALUES (
      v_id_detalle,
      p_id_entrada,
      p_id_producto,
      JSON_UNQUOTE(JSON_EXTRACT(v_item, '$.cantidad')),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_item, '$.fecha_caducidad')), 'null'),
      COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v_item, '$.unidad')), 'piezas'),
      JSON_UNQUOTE(JSON_EXTRACT(v_item, '$.costo_compra'))
    );

    SET v_desglose = JSON_EXTRACT(v_item, '$.desglose');

    IF v_desglose IS NOT NULL THEN
      INSERT INTO Entrada_Detalle_Costo (id_detalle, concepto, monto, activo, orden)
      SELECT
        v_id_detalle,
        jt.concepto,
        jt.monto,
        (IFNULL(jt.activo_txt, 'true') = 'true'),
        jt.orden
      FROM JSON_TABLE(
        v_desglose, '$[*]'
        COLUMNS (
          orden      FOR ORDINALITY,
          concepto   VARCHAR(150)  PATH '$.concepto',
          monto      DECIMAL(12,2) PATH '$.monto',
          activo_txt VARCHAR(10)   PATH '$.activo'
        )
      ) AS jt;
    END IF;

    SET v_i = v_i + 1;
  END WHILE;
END$$

-- Registrar una venta con múltiples líneas.
-- p_lineas debe ser un JSON array, ej:
-- '[{"id_producto":"...", "cantidad":2, "precio_unitario":15.5}]'
CREATE PROCEDURE sp_registrar_venta(
  IN  p_lineas JSON,
  IN  p_registrado_por CHAR(36),
  OUT p_id_venta CHAR(36)
)
BEGIN
  DECLARE v_lineas_doc JSON;
  DECLARE v_total DECIMAL(12,2);

  SET p_id_venta = UUID();

  INSERT INTO Venta (id_venta, registrado_por) VALUES (p_id_venta, p_registrado_por);

  INSERT INTO Venta_Detalle (id_venta, id_producto, cantidad, precio_unitario)
  SELECT
    p_id_venta,
    jt.id_producto,
    jt.cantidad,
    COALESCE(jt.precio_unitario, p.costo_final)
  FROM JSON_TABLE(
    p_lineas, '$[*]'
    COLUMNS (
      id_producto     CHAR(36)      PATH '$.id_producto',
      cantidad        INT           PATH '$.cantidad',
      precio_unitario DECIMAL(12,2) PATH '$.precio_unitario'
    )
  ) AS jt
  JOIN Producto p ON p.id_producto = jt.id_producto;

  SELECT
    JSON_ARRAYAGG(JSON_OBJECT(
      'id_producto', vd.id_producto,
      'nombre', p.nombre,
      'codigo_interno', p.codigo_interno,
      'cantidad', vd.cantidad,
      'precio_unitario', vd.precio_unitario,
      'subtotal', vd.subtotal
    )),
    SUM(vd.subtotal)
  INTO v_lineas_doc, v_total
  FROM Venta_Detalle vd JOIN Producto p ON p.id_producto = vd.id_producto
  WHERE vd.id_venta = p_id_venta;

  INSERT INTO Documento (id_venta, contenido)
  VALUES (p_id_venta, JSON_OBJECT('lineas', v_lineas_doc, 'total', v_total, 'fecha', NOW()));

  UPDATE Venta SET snapshot = JSON_OBJECT('lineas', v_lineas_doc, 'total', v_total)
  WHERE id_venta = p_id_venta;
END$$

DELIMITER ;

-- ============================================================
-- VISTAS
-- ============================================================

-- Arma el mismo objeto que consume la pantalla de Personal
-- (usr-*). auth_usuario es NULL cuando no tiene credenciales
-- activas -> se muestra en "Historial".
CREATE OR REPLACE VIEW v_usuarios AS
SELECT
  p.id_perfil_info,
  p.usuario,
  p.nombres,
  p.apellido_paterno,
  p.apellido_materno,
  p.rol,
  c.id_credencial AS auth_usuario,
  c.correo_acceso,
  ct.correo_personal,
  ct.lada,
  ct.telefono,
  ct.direccion,
  p.created,
  p.last_update
FROM Perfil_Info p
LEFT JOIN Credenciales c  ON c.id_perfil_info = p.id_perfil_info
LEFT JOIN Contacto ct     ON ct.id_perfil_info = p.id_perfil_info;

-- Desglose de costos de compra junto con su entrada/producto
CREATE OR REPLACE VIEW v_entrada_desglose AS
SELECT
  edc.id_costo, edc.id_detalle, ed.id_entrada, ed.id_producto,
  p.nombre AS producto_nombre, p.codigo_interno,
  edc.concepto, edc.monto, edc.activo, edc.orden,
  ed.costo_compra AS costo_compra_total_linea
FROM Entrada_Detalle_Costo edc
JOIN Entrada_Detalle ed ON ed.id_detalle = edc.id_detalle
JOIN Producto p ON p.id_producto = ed.id_producto
ORDER BY ed.id_entrada, ed.id_detalle, edc.orden;

-- Impuestos vigentes por producto (para el modal Agregar/Editar
-- Producto y para listar "qué impuestos trae este producto hoy").
CREATE OR REPLACE VIEW v_producto_impuestos AS
SELECT
  pi.id_producto, p.nombre AS producto_nombre, p.codigo_interno,
  i.id_impuestos, i.nombre AS impuesto_nombre,
  ith.porcentaje AS porcentaje_vigente,
  pi.activo
FROM Producto_Impuesto pi
JOIN Producto p  ON p.id_producto = pi.id_producto
JOIN Impuestos i ON i.id_impuestos = pi.id_impuestos
LEFT JOIN Impuesto_Tasa_Historial ith
  ON ith.id_impuestos = i.id_impuestos AND ith.vigente_hasta IS NULL;

-- Tasa vigente de cada impuesto (para combos y catálogos).
CREATE OR REPLACE VIEW v_impuestos_vigentes AS
SELECT i.id_impuestos, i.nombre, i.activo, ith.porcentaje, ith.vigente_desde
FROM Impuestos i
JOIN Impuesto_Tasa_Historial ith ON ith.id_impuestos = i.id_impuestos AND ith.vigente_hasta IS NULL;

-- Tasa vigente de cada margen (para combos y catálogos).
CREATE OR REPLACE VIEW v_margenes_vigentes AS
SELECT m.id_margenes, m.nombre, m.activo, mth.porcentaje, mth.vigente_desde
FROM Margenes m
JOIN Margen_Tasa_Historial mth ON mth.id_margenes = m.id_margenes AND mth.vigente_hasta IS NULL;

-- Desglose completo de una venta ya facturada, con margen e
-- impuestos ya congelados: esto es lo que debe alimentar
-- cualquier reporte contable, sin importar qué tasas estén
-- vigentes hoy en los catálogos.
CREATE OR REPLACE VIEW v_venta_desglose AS
SELECT
  vd.id_vd, vd.id_venta, vd.id_producto, p.nombre AS producto_nombre, p.codigo_interno,
  vd.cantidad, vd.precio_unitario, vd.subtotal,
  vd.costo_referencia_usado,
  vd.margen_nombre, vd.margen_porcentaje_aplicado,
  vdi.impuesto_nombre, vdi.porcentaje_aplicado AS impuesto_porcentaje_aplicado, vdi.monto_aplicado AS impuesto_monto,
  vd.created
FROM Venta_Detalle vd
JOIN Producto p ON p.id_producto = vd.id_producto
LEFT JOIN Venta_Detalle_Impuesto vdi ON vdi.id_vd = vd.id_vd
ORDER BY vd.created DESC;

-- Alimenta el widget "Alertas de Inventario" (mismo patrón que
-- v_alertas_caducidad, pero para stock/estantería en vez de fechas).
CREATE OR REPLACE VIEW v_avisos_stock AS
SELECT
  a.id_aviso, a.id_producto, p.nombre AS producto_nombre, p.codigo_interno,
  a.tipo, a.nivel, a.mensaje, a.cantidad_actual, a.cantidad_esperada,
  a.leido, a.created, a.last_update
FROM Aviso a
JOIN Producto p ON p.id_producto = a.id_producto
ORDER BY (a.nivel = 'rojo') DESC, a.created DESC;

CREATE OR REPLACE VIEW v_alertas_caducidad AS
SELECT
  l.id_lote, l.id_producto, p.nombre AS producto_nombre, p.codigo_interno,
  l.fecha_caducidad, l.cantidad_disponible,
  DATEDIFF(l.fecha_caducidad, CURDATE()) AS dias_restantes,
  CASE
    WHEN DATEDIFF(l.fecha_caducidad, CURDATE()) <= p.umbral_rojo_dias THEN 'rojo'
    WHEN DATEDIFF(l.fecha_caducidad, CURDATE()) <= p.umbral_amarillo_dias THEN 'amarillo'
    ELSE 'verde'
  END AS alerta
FROM Lote l
JOIN Producto p ON p.id_producto = l.id_producto
WHERE l.estado_lote IN ('activo','parcial') AND l.fecha_caducidad IS NOT NULL
ORDER BY l.fecha_caducidad ASC;

CREATE OR REPLACE VIEW v_dashboard_producto AS
SELECT
  p.id_producto, p.codigo_interno, p.nombre, f.nombre AS familia,
  i.cantidad_total,
  (SELECT MIN(fecha_caducidad) FROM Lote
     WHERE id_producto = p.id_producto AND estado_lote IN ('activo','parcial')) AS proxima_caducidad,
  (SELECT COUNT(*) FROM Lote
     WHERE id_producto = p.id_producto AND estado_lote IN ('activo','parcial')) AS lotes_activos
FROM Producto p
LEFT JOIN Familia f ON f.id_familia = p.id_familia
LEFT JOIN Inventario i ON i.id_producto = p.id_producto
WHERE p.activo = TRUE;

CREATE OR REPLACE VIEW v_valor_inventario AS
SELECT COALESCE(SUM(l.cantidad_disponible * p.costo_final), 0) AS valor_total
FROM Lote l JOIN Producto p ON p.id_producto = l.id_producto
WHERE l.estado_lote IN ('activo','parcial');
