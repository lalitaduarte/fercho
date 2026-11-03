-- =====================================================================
-- Script 02: Restricciones, valores por defecto e índices
-- Proyecto: Hamburguesas y Pinchos Fercho (Equipo 1, D194 / B194)
--
-- Se ejecuta después del script 01, conectado a fercho_db.
-- Todas las reglas se agregan con ALTER TABLE para mostrar que pueden
-- añadirse a una tabla ya existente. Cada restricción lleva un nombre
-- propio (CONSTRAINT nombre) para que los mensajes de error sean claros.
--
-- Convención de nombres:
--   uq_  = UNIQUE (valor no repetido)
--   ck_  = CHECK  (condición que debe cumplirse)
--   ix_  = índice (acelera búsquedas)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. UNIQUE: valores que no pueden repetirse
-- ---------------------------------------------------------------------
ALTER TABLE roles          ADD CONSTRAINT uq_roles_nombre        UNIQUE (nombre);
ALTER TABLE estados_pedido ADD CONSTRAINT uq_estados_codigo      UNIQUE (codigo);
ALTER TABLE estados_pedido ADD CONSTRAINT uq_estados_orden       UNIQUE (orden);
ALTER TABLE formas_pago    ADD CONSTRAINT uq_formas_pago_nombre  UNIQUE (nombre);
ALTER TABLE usuarios       ADD CONSTRAINT uq_usuarios_usuario    UNIQUE (usuario);
ALTER TABLE categorias     ADD CONSTRAINT uq_categorias_nombre   UNIQUE (nombre);
ALTER TABLE productos      ADD CONSTRAINT uq_productos_nombre    UNIQUE (nombre);
ALTER TABLE mesas          ADD CONSTRAINT uq_mesas_numero        UNIQUE (numero);


-- ---------------------------------------------------------------------
-- 2. CHECK: condiciones que los datos deben cumplir
-- ---------------------------------------------------------------------

-- Solo se permiten los tres roles definidos.
ALTER TABLE roles ADD CONSTRAINT ck_roles_nombre
    CHECK (nombre IN ('administrador', 'mesero', 'cocina'));

-- El nombre de usuario: minúsculas, números, punto o guion bajo; 3 a 30 caracteres.
ALTER TABLE usuarios ADD CONSTRAINT ck_usuarios_formato
    CHECK (usuario ~ '^[a-z0-9._]{3,30}$');

-- Precios mayores que cero.
ALTER TABLE productos ADD CONSTRAINT ck_productos_precio
    CHECK (precio > 0);

-- Número de mesa y capacidad positivos.
ALTER TABLE mesas ADD CONSTRAINT ck_mesas_numero    CHECK (numero > 0);
ALTER TABLE mesas ADD CONSTRAINT ck_mesas_capacidad CHECK (capacidad IS NULL OR capacidad > 0);

-- Cantidades positivas y precios no negativos en el detalle.
ALTER TABLE detalle_pedido ADD CONSTRAINT ck_detalle_cantidad CHECK (cantidad > 0);
ALTER TABLE detalle_pedido ADD CONSTRAINT ck_detalle_precio   CHECK (precio_unitario >= 0);

-- El total del pedido no puede ser negativo.
ALTER TABLE pedidos ADD CONSTRAINT ck_pedidos_total CHECK (total >= 0);

-- Coherencia del pago: o están los dos datos (fecha y forma de pago)
-- o no está ninguno. No puede haber fecha de pago sin forma de pago.
ALTER TABLE pedidos ADD CONSTRAINT ck_pedidos_pago_completo
    CHECK ((pagado_en IS NULL) = (id_forma_pago IS NULL));


-- ---------------------------------------------------------------------
-- 3. DEFAULT: valor que se usa si el INSERT no lo indica
-- ---------------------------------------------------------------------
ALTER TABLE formas_pago ALTER COLUMN activa         SET DEFAULT TRUE;

ALTER TABLE usuarios    ALTER COLUMN activo         SET DEFAULT TRUE;
ALTER TABLE usuarios    ALTER COLUMN creado_en      SET DEFAULT now();

ALTER TABLE categorias  ALTER COLUMN activa         SET DEFAULT TRUE;
ALTER TABLE categorias  ALTER COLUMN orden          SET DEFAULT 0;

ALTER TABLE productos   ALTER COLUMN disponible     SET DEFAULT TRUE;
ALTER TABLE productos   ALTER COLUMN activo         SET DEFAULT TRUE;
ALTER TABLE productos   ALTER COLUMN creado_en      SET DEFAULT now();
ALTER TABLE productos   ALTER COLUMN actualizado_en SET DEFAULT now();

ALTER TABLE mesas       ALTER COLUMN activa         SET DEFAULT TRUE;

ALTER TABLE pedidos     ALTER COLUMN id_estado      SET DEFAULT 1;   -- 1 = Pendiente (ver script 05)
ALTER TABLE pedidos     ALTER COLUMN total          SET DEFAULT 0;
ALTER TABLE pedidos     ALTER COLUMN creado_en      SET DEFAULT now();
ALTER TABLE pedidos     ALTER COLUMN actualizado_en SET DEFAULT now();

ALTER TABLE historial_estados ALTER COLUMN cambiado_en SET DEFAULT now();


-- ---------------------------------------------------------------------
-- 4. ÍNDICES: aceleran las búsquedas más frecuentes
-- ---------------------------------------------------------------------
-- PostgreSQL crea índices automáticamente para PRIMARY KEY y UNIQUE,
-- pero NO para las llaves foráneas. Se crean aquí los más útiles.

-- Productos por categoría (menú público).
CREATE INDEX ix_productos_categoria ON productos (id_categoria);

-- Pedidos por estado (pantalla de cocina).
CREATE INDEX ix_pedidos_estado ON pedidos (id_estado);

-- Ventas por fecha de pago (reportes). Índice PARCIAL: solo incluye
-- los pedidos pagados, que son los que interesan al reporte.
CREATE INDEX ix_pedidos_pagado_en ON pedidos (pagado_en) WHERE pagado_en IS NOT NULL;

-- Líneas de detalle por pedido.
CREATE INDEX ix_detalle_pedido ON detalle_pedido (id_pedido);

-- Historial por pedido.
CREATE INDEX ix_historial_pedido ON historial_estados (id_pedido);
