-- =====================================================================
-- Script 05: Datos iniciales
-- Proyecto: Hamburguesas y Pinchos Fercho (Equipo 1, D194 / B194)
--
-- Se ejecuta después del script 04, conectado a fercho_db.
--
-- IMPORTANTE:
--   * Los catálogos (roles, estados, formas de pago) son DEFINITIVOS.
--   * El menú (categorías, productos, precios) es DE EJEMPLO: se debe
--     reemplazar por el menú real de Hamburguesas y Pinchos Fercho.
--   * Los usuarios y contraseñas son DE PRUEBA y deben cambiarse antes
--     de publicar la aplicación.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Extensión pgcrypto
-- ---------------------------------------------------------------------
-- Aporta la función crypt(), que cifra contraseñas con bcrypt, el mismo
-- algoritmo que usará el backend en Node.js.
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ---------------------------------------------------------------------
-- 1. Catálogos
-- ---------------------------------------------------------------------
INSERT INTO roles (nombre, descripcion) VALUES
    ('administrador', 'Gestiona productos, usuarios y consulta ventas'),
    ('mesero',        'Registra pedidos y pagos'),
    ('cocina',        'Consulta pedidos y actualiza su estado');

-- El orden de inserción define los id: 1 = Pendiente (valor por defecto
-- de pedidos.id_estado definido en el script 02).
INSERT INTO estados_pedido (codigo, nombre, orden) VALUES
    ('pendiente',      'Pendiente',      1),
    ('en_preparacion', 'En preparación', 2),
    ('listo',          'Listo',          3),
    ('entregado',      'Entregado',      4),
    ('cancelado',      'Cancelado',      5);

INSERT INTO formas_pago (nombre) VALUES
    ('Efectivo'),
    ('Transferencia'),
    ('Tarjeta');

-- Mesas del local (cantidad de ejemplo: 8).
-- generate_series(1, 8) produce los números del 1 al 8.
INSERT INTO mesas (numero, capacidad)
SELECT n, 4 FROM generate_series(1, 8) AS n;


-- ---------------------------------------------------------------------
-- 2. Usuarios de prueba (uno por rol)
-- ---------------------------------------------------------------------
-- crypt('texto', gen_salt('bf', 10)) genera el hash bcrypt.
-- Contraseñas de prueba:  admin -> Admin2026*   mesero1 -> Mesero2026*   cocina1 -> Cocina2026*
-- La subconsulta (SELECT id_rol ...) busca el id por nombre, para no
-- depender de números fijos.
INSERT INTO usuarios (nombre_completo, usuario, contrasena_hash, id_rol) VALUES
    ('Administrador Fercho', 'admin',
        crypt('Admin2026*',  gen_salt('bf', 10)), (SELECT id_rol FROM roles WHERE nombre = 'administrador')),
    ('Mesero de prueba',     'mesero1',
        crypt('Mesero2026*', gen_salt('bf', 10)), (SELECT id_rol FROM roles WHERE nombre = 'mesero')),
    ('Cocina de prueba',     'cocina1',
        crypt('Cocina2026*', gen_salt('bf', 10)), (SELECT id_rol FROM roles WHERE nombre = 'cocina'));


-- ---------------------------------------------------------------------
-- 3. Menú de ejemplo
-- ---------------------------------------------------------------------
INSERT INTO categorias (nombre, descripcion, orden) VALUES
    ('Hamburguesas', 'Hamburguesas artesanales a la plancha', 1),
    ('Pinchos',      'Pinchos asados al carbón',              2),
    ('Acompañantes', 'Para compartir o complementar',         3),
    ('Bebidas',      'Bebidas frías',                         4);

-- Precios en pesos colombianos (COP).
INSERT INTO productos (id_categoria, nombre, descripcion, precio) VALUES
    ((SELECT id_categoria FROM categorias WHERE nombre = 'Hamburguesas'),
        'Hamburguesa sencilla',  'Carne de res, queso, lechuga, tomate y salsas',        15000),
    ((SELECT id_categoria FROM categorias WHERE nombre = 'Hamburguesas'),
        'Hamburguesa doble',     'Doble carne, doble queso, tocineta y salsas',          22000),
    ((SELECT id_categoria FROM categorias WHERE nombre = 'Hamburguesas'),
        'Hamburguesa de pollo',  'Pechuga apanada, queso, lechuga y salsa de la casa',   17000),
    ((SELECT id_categoria FROM categorias WHERE nombre = 'Pinchos'),
        'Pincho de res',         'Carne de res con papa criolla y arepa',                12000),
    ((SELECT id_categoria FROM categorias WHERE nombre = 'Pinchos'),
        'Pincho de pollo',       'Pollo con papa criolla y arepa',                       11000),
    ((SELECT id_categoria FROM categorias WHERE nombre = 'Pinchos'),
        'Pincho mixto',          'Res, pollo y cerdo con papa criolla y arepa',          14000),
    ((SELECT id_categoria FROM categorias WHERE nombre = 'Acompañantes'),
        'Papas a la francesa',   'Porción mediana',                                       6000),
    ((SELECT id_categoria FROM categorias WHERE nombre = 'Acompañantes'),
        'Salchipapa',            'Papas con salchicha y salsas',                          9000),
    ((SELECT id_categoria FROM categorias WHERE nombre = 'Bebidas'),
        'Gaseosa 400 ml',        NULL,                                                    4000),
    ((SELECT id_categoria FROM categorias WHERE nombre = 'Bebidas'),
        'Jugo natural',          'En agua o en leche',                                    6000),
    ((SELECT id_categoria FROM categorias WHERE nombre = 'Bebidas'),
        'Agua 600 ml',           NULL,                                                    3000);
