// =====================================================================
// Menú público (no requiere ingresar)
//   GET /api/menu  -> categorías con sus productos
// =====================================================================
const express = require('express');
const db = require('../db');
const { asincrono } = require('../middleware/errores');

const router = express.Router();

router.get('/', asincrono(async (req, res) => {
  // La vista v_menu_publico (script 04) ya filtra lo inactivo y ordena.
  const { rows } = await db.query('SELECT * FROM v_menu_publico');

  // Agrupar las filas por categoría: [{ categoria, productos: [...] }]
  const categorias = [];
  for (const fila of rows) {
    let cat = categorias.find((c) => c.id_categoria === fila.id_categoria);
    if (!cat) {
      cat = { id_categoria: fila.id_categoria, nombre: fila.categoria, productos: [] };
      categorias.push(cat);
    }
    cat.productos.push({
      id_producto: fila.id_producto,
      nombre: fila.producto,
      descripcion: fila.descripcion,
      precio: Number(fila.precio),
      disponible: fila.disponible,
    });
  }
  res.json(categorias);
}));

module.exports = router;
