// =====================================================================
// Aplicación Express: une las rutas, la seguridad y los archivos públicos
// =====================================================================
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./db');
const { manejadorErrores, asincrono } = require('./middleware/errores');

const app = express();

// En la nube la aplicación está detrás de un proxy HTTPS; esto permite
// que Express lo reconozca (necesario para las cookies seguras).
app.set('trust proxy', 1);
app.disable('x-powered-by'); // no revelar la tecnología del servidor

// Encabezados básicos de seguridad.
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

app.use(express.json({ limit: '100kb' })); // lee cuerpos JSON
app.use(cookieParser());                  // lee las cookies

// Verificación de que el servidor y la base de datos responden.
app.get('/api/salud', asincrono(async (req, res) => {
  const { rows } = await db.query('SELECT now() AS hora_bd');
  res.json({ estado: 'ok', hora_bd: rows[0].hora_bd });
}));

// Rutas de la API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/pedidos', require('./routes/pedidos'));
app.use('/api/ventas', require('./routes/ventas'));

// Ruta de API inexistente
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// Frontend: archivos HTML, CSS y JS de la carpeta public/
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(manejadorErrores);

module.exports = app;
