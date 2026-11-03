// =====================================================================
// Administración de productos y categorías
//   GET   /api/productos                    (todos los roles del personal)
//   POST  /api/productos                    (administrador)
//   PUT   /api/productos/:id                (administrador)
//   PATCH /api/productos/:id/disponibilidad (administrador y cocina)
//   GET   /api/productos/categorias         (personal)
//
// Los productos no se borran: se marcan como inactivos (activo = false)
// para no perder el historial de ventas que los referencia.
// =====================================================================
const express = require('express');
const db = require('../db');
const { requiereSesion, requiereRol } = require('../middleware/auth');
const { ErrorApp, asincrono } = require('../middleware/errores');

const router = express.Router();

const SELECT_PRODUCTOS = `
  SELECT p.id_producto, p.id_categoria, c.nombre AS categoria, p.nombre,
         p.descripcion, p.precio::float AS precio, p.disponible, p.activo,
         p.actualizado_en
    FROM productos p
    JOIN categorias c ON c.id_categoria = p.id_categoria`;

// Revisa y limpia los datos que llegan del formulario.
function validarProducto(cuerpo) {
  const nombre = String(cuerpo?.nombre || '').trim();
  const descripcion = String(cuerpo?.descripcion || '').trim() || null;
  const precio = Number(cuerpo?.precio);
  const idCategoria = Number(cuerpo?.id_categoria);

  if (!nombre) throw new ErrorApp(400, 'El nombre es obligatorio.');
  if (nombre.length > 80) throw new ErrorApp(400, 'El nombre admite máximo 80 caracteres.');
  if (descripcion && descripcion.length > 300) throw new ErrorApp(400, 'La descripción admite máximo 300 caracteres.');
  if (!Number.isFinite(precio) || precio <= 0) throw new ErrorApp(400, 'El precio debe ser un número mayor que cero.');
  if (!Number.isInteger(idCategoria)) throw new ErrorApp(400, 'Seleccione una categoría.');

  return {
    nombre,
    descripcion,
    precio,
    idCategoria,
    disponible: cuerpo.disponible !== false,
    activo: cuerpo.activo !== false,
  };
}

router.get('/categorias', requiereSesion, asincrono(async (req, res) => {
  const { rows } = await db.query(
    'SELECT id_categoria, nombre, descripcion, orden, activa FROM categorias ORDER BY orden, nombre'
  );
  res.json(rows);
}));

router.get('/', requiereSesion, asincrono(async (req, res) => {
  const { rows } = await db.query(`${SELECT_PRODUCTOS} ORDER BY c.orden, p.nombre`);
  res.json(rows);
}));

router.post('/', requiereRol('administrador'), asincrono(async (req, res) => {
  const p = validarProducto(req.body);
  const { rows } = await db.query(
    `INSERT INTO productos (id_categoria, nombre, descripcion, precio, disponible, activo)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id_producto`,
    [p.idCategoria, p.nombre, p.descripcion, p.precio, p.disponible, p.activo]
  );
  const creado = await db.query(`${SELECT_PRODUCTOS} WHERE p.id_producto = $1`, [rows[0].id_producto]);
  res.status(201).json(creado.rows[0]);
}));

router.put('/:id', requiereRol('administrador'), asincrono(async (req, res) => {
  const p = validarProducto(req.body);
  const { rowCount } = await db.query(
    `UPDATE productos
        SET id_categoria = $1, nombre = $2, descripcion = $3, precio = $4,
            disponible = $5, activo = $6
      WHERE id_producto = $7`,
    [p.idCategoria, p.nombre, p.descripcion, p.precio, p.disponible, p.activo, req.params.id]
  );
  if (rowCount === 0) throw new ErrorApp(404, 'El producto no existe.');
  const actualizado = await db.query(`${SELECT_PRODUCTOS} WHERE p.id_producto = $1`, [req.params.id]);
  res.json(actualizado.rows[0]);
}));

// Cambio rápido de disponibilidad (por ejemplo, cuando algo se agota).
router.patch('/:id/disponibilidad', requiereRol('administrador', 'cocina'), asincrono(async (req, res) => {
  if (typeof req.body?.disponible !== 'boolean') {
    throw new ErrorApp(400, 'Indique disponible: true o false.');
  }
  const { rows } = await db.query(
    'UPDATE productos SET disponible = $1 WHERE id_producto = $2 RETURNING id_producto, nombre, disponible',
    [req.body.disponible, req.params.id]
  );
  if (rows.length === 0) throw new ErrorApp(404, 'El producto no existe.');
  res.json(rows[0]);
}));

module.exports = router;
