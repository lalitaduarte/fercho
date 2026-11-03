// =====================================================================
// Pedidos y cocina
//   GET   /api/pedidos/catalogos     mesas, formas de pago y estados (personal)
//   GET   /api/pedidos               pedidos de hoy y abiertos (administrador, mesero)
//   GET   /api/pedidos/cocina        pedidos para la cocina (administrador, cocina)
//   GET   /api/pedidos/:id           un pedido con su detalle (personal)
//   POST  /api/pedidos               registrar pedido (administrador, mesero)
//   PATCH /api/pedidos/:id/estado    cambiar estado (según el rol)
//   PATCH /api/pedidos/:id/pago      registrar pago = venta (administrador, mesero)
//
// Las reglas de fondo (total, productos agotados, pedidos pagados...) las
// hace cumplir la base de datos con los triggers del script 03.
// =====================================================================
const express = require('express');
const db = require('../db');
const { requiereSesion, requiereRol } = require('../middleware/auth');
const { ErrorApp, asincrono } = require('../middleware/errores');

const router = express.Router();

// Qué estados puede asignar cada rol.
const ESTADOS_POR_ROL = {
  administrador: ['pendiente', 'en_preparacion', 'listo', 'entregado', 'cancelado'],
  cocina: ['en_preparacion', 'listo'],
  mesero: ['entregado', 'cancelado'],
};

const SELECT_PEDIDOS = `
  SELECT pe.id_pedido, pe.id_mesa, m.numero AS mesa_numero,
         e.codigo AS estado_codigo, e.nombre AS estado,
         pe.observaciones, pe.total::float AS total,
         pe.creado_en, pe.pagado_en, fp.nombre AS forma_pago,
         u.nombre_completo AS mesero
    FROM pedidos pe
    JOIN estados_pedido e   ON e.id_estado      = pe.id_estado
    JOIN usuarios u         ON u.id_usuario     = pe.id_mesero
    LEFT JOIN mesas m       ON m.id_mesa        = pe.id_mesa
    LEFT JOIN formas_pago fp ON fp.id_forma_pago = pe.id_forma_pago`;

async function obtenerPedido(idPedido) {
  const { rows } = await db.query(`${SELECT_PEDIDOS} WHERE pe.id_pedido = $1`, [idPedido]);
  if (rows.length === 0) throw new ErrorApp(404, 'El pedido no existe.');
  const detalle = await db.query(
    `SELECT d.id_detalle, d.id_producto, p.nombre AS producto, d.cantidad,
            d.precio_unitario::float AS precio_unitario, d.subtotal::float AS subtotal,
            d.observaciones
       FROM detalle_pedido d
       JOIN productos p ON p.id_producto = d.id_producto
      WHERE d.id_pedido = $1
      ORDER BY d.id_detalle`,
    [idPedido]
  );
  return { ...rows[0], detalle: detalle.rows };
}

router.get('/catalogos', requiereSesion, asincrono(async (req, res) => {
  const [mesas, formasPago, estados] = await Promise.all([
    db.query('SELECT id_mesa, numero, capacidad FROM mesas WHERE activa ORDER BY numero'),
    db.query('SELECT id_forma_pago, nombre FROM formas_pago WHERE activa ORDER BY id_forma_pago'),
    db.query('SELECT codigo, nombre, orden FROM estados_pedido ORDER BY orden'),
  ]);
  res.json({ mesas: mesas.rows, formas_pago: formasPago.rows, estados: estados.rows });
}));

// Pedidos del día y los que siguen abiertos (sin pagar y no cancelados).
router.get('/', requiereRol('administrador', 'mesero'), asincrono(async (req, res) => {
  const { rows } = await db.query(
    `${SELECT_PEDIDOS}
      WHERE pe.creado_en >= current_date
         OR (pe.pagado_en IS NULL AND e.codigo <> 'cancelado')
      ORDER BY pe.creado_en DESC`
  );
  res.json(rows);
}));

// Pantalla de cocina: usa la vista v_pedidos_cocina (script 04).
router.get('/cocina', requiereRol('administrador', 'cocina'), asincrono(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM v_pedidos_cocina');
  res.json(rows);
}));

router.get('/:id', requiereSesion, asincrono(async (req, res) => {
  res.json(await obtenerPedido(req.params.id));
}));

// Registrar un pedido.
// Cuerpo: { id_mesa: 3 | null, observaciones: "...",
//           items: [{ id_producto: 1, cantidad: 2, observaciones: "sin cebolla" }] }
router.post('/', requiereRol('administrador', 'mesero'), asincrono(async (req, res) => {
  const { id_mesa = null, observaciones = null, items } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    throw new ErrorApp(400, 'El pedido debe tener al menos un producto.');
  }
  for (const item of items) {
    if (!Number.isInteger(item?.id_producto) || !Number.isInteger(item?.cantidad) || item.cantidad < 1) {
      throw new ErrorApp(400, 'Cada producto debe tener un id y una cantidad entera mayor que cero.');
    }
    if (item.cantidad > 99) throw new ErrorApp(400, 'La cantidad máxima por producto es 99.');
  }

  // Encabezado y detalle en UNA transacción: si un producto está agotado,
  // el trigger rechaza la línea y no queda un pedido a medias.
  const idPedido = await db.transaccion(async (cliente) => {
    const { rows } = await cliente.query(
      `INSERT INTO pedidos (id_mesa, id_mesero, observaciones)
       VALUES ($1, $2, $3) RETURNING id_pedido`,
      [id_mesa, req.usuario.id, String(observaciones || '').trim().slice(0, 300) || null]
    );
    const id = rows[0].id_pedido;
    for (const item of items) {
      // precio_unitario no se envía: el trigger lo copia del menú.
      await cliente.query(
        `INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, observaciones)
         VALUES ($1, $2, $3, $4)`,
        [id, item.id_producto, item.cantidad, String(item.observaciones || '').trim().slice(0, 200) || null]
      );
    }
    return id;
  });

  res.status(201).json(await obtenerPedido(idPedido));
}));

router.patch('/:id/estado', requiereSesion, asincrono(async (req, res) => {
  const codigo = String(req.body?.estado || '');
  const permitidos = ESTADOS_POR_ROL[req.usuario.rol] || [];
  if (!permitidos.includes(codigo)) {
    throw new ErrorApp(403, 'Su rol no puede asignar ese estado.');
  }
  const { rowCount } = await db.query(
    `UPDATE pedidos
        SET id_estado = (SELECT id_estado FROM estados_pedido WHERE codigo = $1)
      WHERE id_pedido = $2`,
    [codigo, req.params.id]
  );
  if (rowCount === 0) throw new ErrorApp(404, 'El pedido no existe.');
  res.json(await obtenerPedido(req.params.id));
}));

// Registrar el pago: desde aquí el pedido cuenta como venta.
router.patch('/:id/pago', requiereRol('administrador', 'mesero'), asincrono(async (req, res) => {
  const idFormaPago = Number(req.body?.id_forma_pago);
  if (!Number.isInteger(idFormaPago)) throw new ErrorApp(400, 'Seleccione la forma de pago.');

  const { rowCount } = await db.query(
    `UPDATE pedidos
        SET pagado_en = now(), id_forma_pago = $1
      WHERE id_pedido = $2 AND pagado_en IS NULL`,
    [idFormaPago, req.params.id]
  );
  if (rowCount === 0) {
    await obtenerPedido(req.params.id); // lanza 404 si no existe
    throw new ErrorApp(409, 'El pedido ya estaba pagado.');
  }
  res.json(await obtenerPedido(req.params.id));
}));

module.exports = router;
