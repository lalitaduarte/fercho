-- =====================================================================
-- Script 00: Creación de la base de datos
-- Proyecto: Hamburguesas y Pinchos Fercho (Equipo 1, D194 / B194)
-- Motor:    PostgreSQL 17
--
-- Se ejecuta UNA sola vez, conectado a la base "postgres" (la que trae
-- PostgreSQL por defecto), porque una base de datos no puede crearse
-- desde dentro de sí misma.
-- =====================================================================

-- CREATE DATABASE crea una base de datos nueva y vacía.
--   ENCODING 'UTF8'  -> permite guardar tildes, eñes y símbolos ($, °).
--   TEMPLATE template0 -> parte de una plantilla limpia; es necesario
--                        para poder elegir la codificación.
CREATE DATABASE fercho_db
    WITH ENCODING 'UTF8'
    TEMPLATE template0;

-- Descripción visible en herramientas como pgAdmin.
COMMENT ON DATABASE fercho_db IS
    'Sistema de pedidos y ventas de Hamburguesas y Pinchos Fercho';

-- Zona horaria de Colombia (UTC-5). Así las fechas y horas de pedidos y
-- ventas se muestran con la hora local, y los reportes "por día" cortan
-- a la medianoche de Colombia y no a la de Londres (UTC).
ALTER DATABASE fercho_db SET timezone TO 'America/Bogota';
