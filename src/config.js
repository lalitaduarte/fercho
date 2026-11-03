// =====================================================================
// Configuración de la aplicación
// Lee los valores del archivo .env (en el computador local) o de las
// variables de entorno del servidor (cuando esté publicada).
// =====================================================================
const crypto = require('node:crypto');

// Node.js 22 puede leer el archivo .env sin librerías adicionales.
// Si el archivo no existe (por ejemplo, en el servidor publicado), se ignora.
try {
  process.loadEnvFile();
} catch {
  // sin archivo .env: se usan las variables de entorno del sistema
}

const esProduccion = process.env.NODE_ENV === 'production';

// Clave secreta para firmar las sesiones (tokens JWT).
// En producción es OBLIGATORIA. En desarrollo, si no existe, se genera una
// al azar (las sesiones se cierran cada vez que se reinicia el servidor).
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (esProduccion) {
    throw new Error('Falta la variable de entorno JWT_SECRET.');
  }
  jwtSecret = crypto.randomBytes(32).toString('hex');
}

// En la nube, la conexión va cifrada (SSL). Se usa el modo "verify-full",
// que además comprueba el certificado del servidor (que de verdad sea
// Neon). La librería pg ya trata "require" como "verify-full"; aquí se
// deja explícito para mayor claridad y para evitar su aviso.
function urlConSslEstricto(url) {
  return url.replace(/sslmode=(prefer|require|verify-ca)\b/, 'sslmode=verify-full');
}

module.exports = {
  esProduccion,
  puerto: Number(process.env.PORT) || 3000,
  jwtSecret,
  duracionSesionHoras: 12,

  // Conexión a PostgreSQL:
  //  - En la nube se usa una sola variable DATABASE_URL.
  //  - En el computador local se usan las variables DB_*.
  db: process.env.DATABASE_URL
    ? { connectionString: urlConSslEstricto(process.env.DATABASE_URL) }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'fercho_db',
      },
};
