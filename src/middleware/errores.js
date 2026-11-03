// =====================================================================
// Manejo centralizado de errores
// Convierte los errores de PostgreSQL en mensajes claros en español.
// =====================================================================

// Error creado por la propia aplicación, con su código HTTP.
class ErrorApp extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}

// Express ejecuta los "async" sin capturar sus errores; esta función los
// envía al manejador de errores.
const asincrono = (funcion) => (req, res, next) =>
  Promise.resolve(funcion(req, res, next)).catch(next);

// Códigos de error de PostgreSQL más comunes:
//   P0001 -> RAISE EXCEPTION de nuestros triggers (regla de negocio)
//   23505 -> valor repetido (UNIQUE)
//   23514 -> condición incumplida (CHECK)
//   23503 -> referencia inexistente (FOREIGN KEY)
//   23502 -> falta un dato obligatorio (NOT NULL)
//   22P02 -> formato inválido (por ejemplo, texto donde va un número)
const MENSAJES_CHECK = {
  ck_productos_precio: 'El precio debe ser mayor que cero.',
  ck_detalle_cantidad: 'La cantidad debe ser mayor que cero.',
  ck_usuarios_formato: 'El usuario solo admite minúsculas, números, punto o guion bajo (3 a 30 caracteres).',
  ck_pedidos_pago_completo: 'El pago debe tener fecha y forma de pago.',
};
const MENSAJES_UNIQUE = {
  uq_productos_nombre: 'Ya existe un producto con ese nombre.',
  uq_categorias_nombre: 'Ya existe una categoría con ese nombre.',
  uq_usuarios_usuario: 'Ese nombre de usuario ya está en uso.',
};

function manejadorErrores(error, req, res, next) {
  if (error instanceof ErrorApp) {
    return res.status(error.estado).json({ error: error.message });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Los datos enviados no son JSON válido.' });
  }
  switch (error.code) {
    case 'P0001':
      return res.status(409).json({ error: error.message });
    case '23505':
      return res.status(409).json({ error: MENSAJES_UNIQUE[error.constraint] || 'El valor ya existe.' });
    case '23514':
      return res.status(400).json({ error: MENSAJES_CHECK[error.constraint] || 'Un dato no cumple las reglas.' });
    case '23503':
      return res.status(400).json({ error: 'Se hace referencia a un registro que no existe.' });
    case '23502':
      return res.status(400).json({ error: `Falta un dato obligatorio (${error.column}).` });
    case '22P02':
      return res.status(400).json({ error: 'Un dato tiene un formato inválido.' });
  }
  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor.' });
}

module.exports = { ErrorApp, asincrono, manejadorErrores };
