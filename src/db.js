// =====================================================================
// Conexión a PostgreSQL
// Un "pool" mantiene varias conexiones abiertas y las reutiliza, lo que
// es más rápido que abrir una conexión nueva en cada consulta.
// =====================================================================
const { Pool } = require('pg');
const config = require('./config');

// La zona horaria (America/Bogota) se configura en la propia base de
// datos con ALTER DATABASE (script 00); server.js verifica que sea así.
const pool = new Pool(config.db);

// Consulta simple: db.query('SELECT ... WHERE id = $1', [id])
// Los valores van SIEMPRE como parámetros ($1, $2...), nunca pegados al
// texto SQL. Así se evita la inyección SQL.
function query(texto, parametros) {
  return pool.query(texto, parametros);
}

// Ejecuta varias consultas dentro de una TRANSACCIÓN: o se guardan todas
// o no se guarda ninguna (si algo falla, se hace ROLLBACK).
async function transaccion(funcion) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await funcion(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release(); // devuelve la conexión al pool
  }
}

module.exports = { pool, query, transaccion };
