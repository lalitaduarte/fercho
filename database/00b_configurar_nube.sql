-- =====================================================================
-- Script 00b: Configuración de la base de datos EN LA NUBE (Neon)
-- Proyecto: Hamburguesas y Pinchos Fercho (Equipo 1, D194 / B194)
--
-- En la nube el proveedor ya crea la base de datos (en Neon se llama
-- "neondb"), así que el script 00 no se usa allí. Este script hace lo
-- equivalente: fija la zona horaria de Colombia en esa base.
--
-- Después de este script se ejecutan los scripts 01 a 05, igual que en
-- el computador local.
-- =====================================================================

-- current_database() devuelve el nombre de la base actual. Como ALTER
-- DATABASE necesita el nombre escrito, se arma la orden con format()
-- y se ejecuta con EXECUTE dentro de un bloque anónimo DO.
--   %I = identificador (nombre) escrito de forma segura.
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET timezone TO %L',
                   current_database(), 'America/Bogota');
END;
$$;
