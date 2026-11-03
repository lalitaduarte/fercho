-- =====================================================================
-- Script 01: Creación de tablas
-- Proyecto: Hamburguesas y Pinchos Fercho (Equipo 1, D194 / B194)
--
-- Se ejecuta conectado a la base fercho_db.
-- Este script define SOLO la estructura básica de cada tabla:
--   * columnas y tipos de datos
--   * NOT NULL (campos obligatorios)
--   * llave primaria (PRIMARY KEY)
--   * llaves foráneas (FOREIGN KEY / REFERENCES)
-- Las demás reglas (UNIQUE, CHECK, DEFAULT, índices) se agregan en el
-- script 02, para poder explicarlas por separado.
--
-- Nota sobre las llaves primarias:
--   GENERATED ALWAYS AS IDENTITY es la forma estándar SQL (y recomendada
--   en PostgreSQL moderno) de crear un número autoincremental. Reemplaza
--   al antiguo tipo SERIAL.
--
-- Orden de creación: primero las tablas que no dependen de otras
-- (catálogos), luego las que las referencian.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. CATÁLOGOS (tablas pequeñas de valores fijos)
-- ---------------------------------------------------------------------

-- Roles del personal: administrador, mesero, cocina.
CREATE TABLE roles (
    id_rol      SMALLINT     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      VARCHAR(20)  NOT NULL,
    descripcion VARCHAR(150)
);

-- Estados por los que pasa un pedido.
-- "orden" indica la secuencia normal (1 = primero).
CREATE TABLE estados_pedido (
    id_estado   SMALLINT     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo      VARCHAR(20)  NOT NULL,   -- valor interno, sin tildes: 'en_preparacion'
    nombre      VARCHAR(30)  NOT NULL,   -- texto para mostrar: 'En preparación'
    orden       SMALLINT     NOT NULL
);

-- Formas de pago aceptadas.
CREATE TABLE formas_pago (
    id_forma_pago SMALLINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        VARCHAR(30) NOT NULL,
    activa        BOOLEAN     NOT NULL
);


-- ---------------------------------------------------------------------
-- 2. PERSONAL
-- ---------------------------------------------------------------------

-- Usuarios que ingresan al sistema. La contraseña NUNCA se guarda en
-- texto plano: se guarda su "hash" (resultado de cifrado de un solo
-- sentido con el algoritmo bcrypt).
CREATE TABLE usuarios (
    id_usuario      INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_completo VARCHAR(100) NOT NULL,
    usuario         VARCHAR(30)  NOT NULL,   -- nombre con el que ingresa
    contrasena_hash VARCHAR(100) NOT NULL,
    id_rol          SMALLINT     NOT NULL REFERENCES roles (id_rol),
    activo          BOOLEAN      NOT NULL,
    creado_en       TIMESTAMPTZ  NOT NULL
);


-- ---------------------------------------------------------------------
-- 3. MENÚ
-- ---------------------------------------------------------------------

-- Categorías del menú: Hamburguesas, Pinchos, Bebidas...
CREATE TABLE categorias (
    id_categoria INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre       VARCHAR(50)  NOT NULL,
    descripcion  VARCHAR(200),
    orden        SMALLINT     NOT NULL,   -- posición en que se muestra en el menú
    activa       BOOLEAN      NOT NULL
);

-- Productos que se venden.
-- "disponible" es el control de disponibilidad actual (sí / no).
-- El inventario por cantidades se definirá en una etapa posterior.
CREATE TABLE productos (
    id_producto    INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_categoria   INTEGER       NOT NULL REFERENCES categorias (id_categoria),
    nombre         VARCHAR(80)   NOT NULL,
    descripcion    VARCHAR(300),
    precio         NUMERIC(10,2) NOT NULL,   -- NUMERIC evita errores de redondeo con dinero
    disponible     BOOLEAN       NOT NULL,
    activo         BOOLEAN       NOT NULL,   -- FALSE = retirado del menú (no se borra, para conservar el historial de ventas)
    creado_en      TIMESTAMPTZ   NOT NULL,
    actualizado_en TIMESTAMPTZ   NOT NULL
);


-- ---------------------------------------------------------------------
-- 4. MESAS
-- ---------------------------------------------------------------------

CREATE TABLE mesas (
    id_mesa   INTEGER  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero    SMALLINT NOT NULL,   -- número visible: Mesa 1, Mesa 2...
    capacidad SMALLINT,            -- puestos (opcional)
    activa    BOOLEAN  NOT NULL
);


-- ---------------------------------------------------------------------
-- 5. PEDIDOS
-- ---------------------------------------------------------------------

-- Encabezado del pedido.
--   id_mesa NULL       -> pedido para llevar (la mesa es opcional).
--   pagado_en NULL     -> todavía no se ha pagado (aún no es venta).
--   total              -> lo calcula automáticamente un trigger (script 03).
CREATE TABLE pedidos (
    id_pedido      INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_mesa        INTEGER       REFERENCES mesas (id_mesa),             -- opcional
    id_mesero      INTEGER       NOT NULL REFERENCES usuarios (id_usuario),
    id_estado      SMALLINT      NOT NULL REFERENCES estados_pedido (id_estado),
    observaciones  VARCHAR(300),
    total          NUMERIC(12,2) NOT NULL,
    creado_en      TIMESTAMPTZ   NOT NULL,
    actualizado_en TIMESTAMPTZ   NOT NULL,
    pagado_en      TIMESTAMPTZ,                                          -- opcional
    id_forma_pago  SMALLINT      REFERENCES formas_pago (id_forma_pago)  -- opcional
);

-- Detalle del pedido: cada producto pedido, con su cantidad.
--   precio_unitario se COPIA del producto al momento del pedido; así, si
--   luego cambia el precio del menú, las ventas pasadas no se alteran.
--   subtotal es una COLUMNA GENERADA: PostgreSQL la calcula sola.
--   ON DELETE CASCADE: si se borra un pedido, se borran sus líneas.
CREATE TABLE detalle_pedido (
    id_detalle      INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pedido       INTEGER       NOT NULL REFERENCES pedidos (id_pedido) ON DELETE CASCADE,
    id_producto     INTEGER       NOT NULL REFERENCES productos (id_producto),
    cantidad        INTEGER       NOT NULL,
    precio_unitario NUMERIC(10,2) NOT NULL,
    observaciones   VARCHAR(200),             -- ej.: "sin cebolla"
    subtotal        NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- Historial de cambios de estado de cada pedido (lo llena un trigger).
-- Permite saber, por ejemplo, cuánto tardó la cocina en preparar.
CREATE TABLE historial_estados (
    id_historial INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pedido    INTEGER     NOT NULL REFERENCES pedidos (id_pedido) ON DELETE CASCADE,
    id_estado    SMALLINT    NOT NULL REFERENCES estados_pedido (id_estado),
    cambiado_en  TIMESTAMPTZ NOT NULL
);
