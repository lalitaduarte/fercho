// =====================================================================
// Punto de arranque: comprueba la base de datos e inicia el servidor
// Ejecutar con:  npm start   (o  npm run dev  para reiniciar al guardar)
// =====================================================================
const app = require('./app');
const config = require('./config');
const db = require('./db');

async function iniciar() {
  try {
    const { rows } = await db.query(
      "SELECT current_database() AS base, current_setting('TimeZone') AS zona"
    );
    console.log(`Base de datos conectada: ${rows[0].base} (zona horaria ${rows[0].zona})`);
    if (rows[0].zona !== 'America/Bogota') {
      console.warn("AVISO: la zona horaria no es America/Bogota. Ejecute:\n" +
        `  ALTER DATABASE ${rows[0].base} SET timezone TO 'America/Bogota';`);
    }
  } catch (error) {
    console.error('No fue posible conectar con PostgreSQL:', error.message);
    console.error('Revise los datos del archivo .env');
    process.exit(1);
  }

  app.listen(config.puerto, () => {
    console.log(`Servidor listo en http://localhost:${config.puerto}`);
  });
}

iniciar();
