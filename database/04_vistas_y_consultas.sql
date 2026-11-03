-- =====================================================================
-- Script 04: Vistas y funciones de consulta
-- Proyecto: Hamburguesas y Pinchos Fercho (Equipo 1, D194 / B194)
--
-- Se ejecuta después del script 03, conectado a fercho_db.
--
-- ¿Qué es una vista (VIEW)?
--   Es una consulta SELECT guardada con un nombre. Se usa como si fuera
--   una tabla (SELECT * FROM v_menu_publico), pero no guarda datos:
--   cada vez que se consulta, ejecuta su SELECT con los datos actuales.
--   Ventajas: simplifica consultas largas y oculta columnas privadas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Menú público
-- ---------------------------------------------------------------------
-- Lo que ve cualquier visitante: solo categorías y productos activos.
-- Muestra la disponibilidad para indicar "Agotado" en pantalla.
CREATE OR REPLACE VIEW v_menu_publico AS
SELECT c.id_categoria,
       c.nombre       AS categoria,
       c.orden        AS orden_categoria,
       p.id_producto,
       p.nombre       AS producto,
       p.descripcion,
       p.precio,
       p.disponible
  FROM productos  p
  JOIN categorias c ON c.id_categoria = p.id_categoria   -- JOIN: une cada producto con su categoría
 WHERE c.activa
   AND p.activo
 ORDER BY c.orden, p.nombre;


-- ---------------------------------------------------------------------
-- 2. Pantalla de cocina
-- ---------------------------------------------------------------------
-- Pedidos que la cocina debe atender (pendiente, en preparación, listo),
-- del más antiguo al más reciente, con sus productos en una sola fila.
--   LEFT JOIN mesas: incluye pedidos sin mesa (para llevar).
--   string_agg: concatena las líneas del detalle en un solo texto.
--   minutos_espera: tiempo transcurrido desde que se creó el pedido.
CREATE OR REPLACE VIEW v_pedidos_cocina AS
SELECT pe.id_pedido,
       COALESCE('Mesa ' || m.numero, 'Para llevar') AS mesa,
       e.codigo                                     AS estado_codigo,
       e.nombre                                     AS estado,
       pe.observaciones,
       pe.creado_en,
       floor(extract(EPOCH FROM now() - pe.creado_en) / 60)::INTEGER AS minutos_espera,
       string_agg(
           d.cantidad || ' x ' || pr.nombre
             || COALESCE(' (' || d.observaciones || ')', ''),
           E'\n' ORDER BY d.id_detalle
       ) AS productos
  FROM pedidos pe
  JOIN estados_pedido e  ON e.id_estado    = pe.id_estado
  LEFT JOIN mesas m      ON m.id_mesa      = pe.id_mesa
  JOIN detalle_pedido d  ON d.id_pedido    = pe.id_pedido
  JOIN productos pr      ON pr.id_producto = d.id_producto
 WHERE e.codigo IN ('pendiente', 'en_preparacion', 'listo')
 GROUP BY pe.id_pedido, m.numero, e.codigo, e.nombre, e.orden
 ORDER BY pe.creado_en;


-- ---------------------------------------------------------------------
-- 3. Ventas (detalle por pedido)
-- ---------------------------------------------------------------------
-- Decisión del equipo: un pedido cuenta como VENTA cuando se registra
-- su pago (pagado_en con valor). Los cancelados nunca se pueden pagar
-- (lo impide el trigger del script 03), así que no aparecen.
CREATE OR REPLACE VIEW v_ventas AS
SELECT pe.id_pedido,
       pe.pagado_en,
       pe.pagado_en::DATE                           AS fecha,   -- ::DATE convierte a solo fecha
       COALESCE('Mesa ' || m.numero, 'Para llevar') AS mesa,
       u.nombre_completo                            AS mesero,
       fp.nombre                                    AS forma_pago,
       pe.total
  FROM pedidos pe
  JOIN usuarios u     ON u.id_usuario     = pe.id_mesero
  JOIN formas_pago fp ON fp.id_forma_pago = pe.id_forma_pago
  LEFT JOIN mesas m   ON m.id_mesa        = pe.id_mesa
 WHERE pe.pagado_en IS NOT NULL;


-- ---------------------------------------------------------------------
-- 4. Resumen de ventas por día
-- ---------------------------------------------------------------------
-- GROUP BY agrupa las ventas de la misma fecha; COUNT y SUM resumen.
CREATE OR REPLACE VIEW v_ventas_por_dia AS
SELECT fecha,
       COUNT(*)   AS numero_ventas,
       SUM(total) AS total_vendido
  FROM v_ventas
 GROUP BY fecha
 ORDER BY fecha;


-- ---------------------------------------------------------------------
-- 5. Función: ventas entre dos fechas
-- ---------------------------------------------------------------------
-- Uso:  SELECT * FROM fn_ventas_por_rango('2026-11-01', '2026-11-30');
-- Devuelve un resumen por forma de pago dentro del rango (ambas fechas
-- incluidas). Se usa "< hasta + 1 día" en lugar de "<= hasta" para
-- incluir todas las horas del último día.
CREATE OR REPLACE FUNCTION fn_ventas_por_rango(p_desde DATE, p_hasta DATE)
RETURNS TABLE (forma_pago VARCHAR, numero_ventas BIGINT, total_vendido NUMERIC)
LANGUAGE sql
STABLE   -- no modifica datos
AS $$
    SELECT fp.nombre, COUNT(*), SUM(pe.total)
      FROM pedidos pe
      JOIN formas_pago fp ON fp.id_forma_pago = pe.id_forma_pago
     WHERE pe.pagado_en >= p_desde
       AND pe.pagado_en <  p_hasta + 1
     GROUP BY fp.nombre
     ORDER BY fp.nombre;
$$;


-- ---------------------------------------------------------------------
-- 6. Productos más vendidos
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_productos_mas_vendidos AS
SELECT pr.nombre        AS producto,
       SUM(d.cantidad)  AS unidades,
       SUM(d.subtotal)  AS total_vendido
  FROM detalle_pedido d
  JOIN pedidos pe   ON pe.id_pedido   = d.id_pedido
  JOIN productos pr ON pr.id_producto = d.id_producto
 WHERE pe.pagado_en IS NOT NULL
 GROUP BY pr.nombre
 ORDER BY unidades DESC;
