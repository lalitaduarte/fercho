// =====================================================================
// Rutas de ingreso y salida del personal
//   POST /api/auth/ingresar   { usuario, contrasena }
//   POST /api/auth/salir
//   GET  /api/auth/yo         -> datos del usuario con sesión activa
// =====================================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { crearSesion, cerrarSesion, requiereSesion } = require('../middleware/auth');
const { ErrorApp, asincrono } = require('../middleware/errores');

const router = express.Router();

// Protección básica contra adivinar contraseñas: máximo 5 intentos
// fallidos por usuario cada 15 minutos (se guarda en memoria).
const intentos = new Map();
const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

function bloqueado(usuario) {
  const registro = intentos.get(usuario);
  if (!registro) return false;
  if (Date.now() - registro.desde > VENTANA_MS) {
    intentos.delete(usuario);
    return false;
  }
  return registro.cantidad >= MAX_INTENTOS;
}

function registrarFallo(usuario) {
  const registro = intentos.get(usuario) || { cantidad: 0, desde: Date.now() };
  registro.cantidad += 1;
  intentos.set(usuario, registro);
}

router.post('/ingresar', asincrono(async (req, res) => {
  const usuario = String(req.body?.usuario || '').trim().toLowerCase();
  const contrasena = String(req.body?.contrasena || '');

  if (!usuario || !contrasena) {
    throw new ErrorApp(400, 'Escriba el usuario y la contraseña.');
  }
  if (bloqueado(usuario)) {
    throw new ErrorApp(429, 'Demasiados intentos fallidos. Espere 15 minutos.');
  }

  const { rows } = await db.query(
    `SELECT u.id_usuario, u.nombre_completo, u.contrasena_hash, u.activo, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON r.id_rol = u.id_rol
      WHERE u.usuario = $1`,
    [usuario]
  );
  const encontrado = rows[0];

  // bcrypt.compare cifra la contraseña escrita y la compara con el hash.
  const valida = encontrado && encontrado.activo &&
    (await bcrypt.compare(contrasena, encontrado.contrasena_hash));

  if (!valida) {
    registrarFallo(usuario);
    // Mensaje genérico: no revela si el usuario existe.
    throw new ErrorApp(401, 'Usuario o contraseña incorrectos.');
  }

  intentos.delete(usuario);
  crearSesion(res, encontrado);
  res.json({ id: encontrado.id_usuario, nombre: encontrado.nombre_completo, rol: encontrado.rol });
}));

router.post('/salir', (req, res) => {
  cerrarSesion(res);
  res.json({ ok: true });
});

router.get('/yo', requiereSesion, (req, res) => {
  const { id, nombre, rol } = req.usuario;
  res.json({ id, nombre, rol });
});

module.exports = router;
