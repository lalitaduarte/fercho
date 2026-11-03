-- =====================================================================
-- Script 99: Reiniciar la base de datos (SOLO PARA DESARROLLO)
-- Proyecto: Hamburguesas y Pinchos Fercho (Equipo 1, D194 / B194)
--
-- ¡CUIDADO! Borra TODAS las tablas, vistas, funciones y datos de
-- fercho_db, dejándola vacía. Después se deben ejecutar de nuevo los
-- scripts 01 a 05. Nunca ejecutar sobre la base publicada.
--
-- DROP SCHEMA ... CASCADE elimina el esquema "public" con todo su
-- contenido; luego se vuelve a crear vacío.
-- =====================================================================

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
