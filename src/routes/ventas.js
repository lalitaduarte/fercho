// =====================================================================
// Consulta de ventas por fechas (solo administrador)
//   GET /api/ventas?desde=2026-11-01&hasta=2026-11-30
// Si no se envían fechas, se usa el día de hoy.
// Una venta = un pedido con pago registrado (decisión del equipo).
// =====================================================================
const express = require('express');
const db = require('../db');
const { requiereRol } = require('../middleware/auth');
const { ErrorApp, asincrono } = require('../middleware/errores');

const router = express.Router();

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

router.get('/', requiereRol('administrador'), asincrono(async (req, res) => {
  const { rows: hoy } = await db.query('SELECT current_date::text AS hoy');
  const desde = req.query.desde || hoy[0].hoy;
  const hasta = req.query.hasta || desde;

  if (!FORMATO_FECHA.test(desde) || !FORMATO_FECHA.test(hasta)) {
    throw new ErrorApp(400, 'Las fechas deben tener el formato AAAA-MM-DD.');
  }
  if (desde > hasta) {
    throw new ErrorApp(400, 'La fecha inicial no puede ser posterior a la final.');
  }

  // Condición común: pagados dentro del rango (incluye todo el último día).
  const rango = 'pagado_en >= $1::date AND pagado_en < $2::date + 1';
  const parametros = [desde, hasta];

  const [porFormaPago, porDia, productos, detalle] = await Promise.all([
    // Función del script 04
    db.query('SELECT forma_pago, numero_ventas::int, total_vendido::float FROM fn_ventas_por_rango($1, $2)', parametros),
    db.query(
      `SELECT fecha::text, COUNT(*)::int AS numero_ventas, SUM(total)::float AS total_vendido
         FROM v_ventas WHERE ${rango}
        GROUP BY fecha ORDER BY fecha`, parametros),
    db.query(
      `SELECT pr.nombre AS producto, SUM(d.cantidad)::int AS unidades, SUM(d.subtotal)::float AS total_vendido
         FROM detalle_pedido d
         JOIN pedidos pe   ON pe.id_pedido   = d.id_pedido
         JOIN productos pr ON pr.id_producto = d.id_producto
        WHERE pe.${rango}
        GROUP BY pr.nombre
        ORDER BY unidades DESC, pr.nombre`, parametros),
    db.query(
      `SELECT id_pedido, pagado_en, mesa, mesero, forma_pago, total::float AS total
         FROM v_ventas WHERE ${rango}
        ORDER BY pagado_en`, parametros),
  ]);

  const totalVendido = porFormaPago.rows.reduce((suma, f) => suma + f.total_vendido, 0);
  const numeroVentas = porFormaPago.rows.reduce((suma, f) => suma + f.numero_ventas, 0);

  res.json({
    desde,
    hasta,
    total_vendido: totalVendido,
    numero_ventas: numeroVentas,
    por_forma_pago: porFormaPago.rows,
    por_dia: porDia.rows,
    productos: productos.rows,
    ventas: detalle.rows,
  });
}));

module.exports = router;
