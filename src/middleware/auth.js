// =====================================================================
// Control de acceso
// Al ingresar, el servidor entrega un "token" firmado (JWT) guardado en
// una cookie httpOnly (el JavaScript de la página no puede leerla, lo que
// la protege de robos). En cada petición se verifica ese token.
// =====================================================================
const jwt = require('jsonwebtoken');
const config = require('../config');

const NOMBRE_COOKIE = 'fercho_sesion';

function crearSesion(res, usuario) {
  const token = jwt.sign(
    { id: usuario.id_usuario, nombre: usuario.nombre_completo, rol: usuario.rol },
    config.jwtSecret,
    { expiresIn: `${config.duracionSesionHoras}h` }
  );
  res.cookie(NOMBRE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.esProduccion, // en internet solo viaja por HTTPS
    maxAge: config.duracionSesionHoras * 60 * 60 * 1000,
  });
}

function cerrarSesion(res) {
  res.clearCookie(NOMBRE_COOKIE);
}

// Middleware: exige haber ingresado. Deja los datos del usuario en req.usuario.
function requiereSesion(req, res, next) {
  const token = req.cookies[NOMBRE_COOKIE];
  if (!token) {
    return res.status(401).json({ error: 'Debe ingresar al sistema.' });
  }
  try {
    req.usuario = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    cerrarSesion(res);
    return res.status(401).json({ error: 'La sesión expiró. Ingrese de nuevo.' });
  }
}

// Middleware: exige uno de los roles indicados.
// Uso: router.get('/ruta', requiereRol('administrador', 'mesero'), ...)
function requiereRol(...roles) {
  return [
    requiereSesion,
    (req, res, next) => {
      if (!roles.includes(req.usuario.rol)) {
        return res.status(403).json({ error: 'No tiene permiso para esta acción.' });
      }
      next();
    },
  ];
}

module.exports = { crearSesion, cerrarSesion, requiereSesion, requiereRol };
