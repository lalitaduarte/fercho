// =====================================================================
// Prueba de la API de punta a punta
// Ejecutar con:  npm run probar
//
// Inicia el servidor en un puerto libre, recorre el flujo completo con
// los tres roles (mesero, cocina, administrador) y al final BORRA todos
// los datos de prueba que creó. Usa los usuarios del script 05.
// =====================================================================
const app = require('../src/app');
const db = require('../src/db');

const MARCA = 'PRUEBA-API'; // se pone en las observaciones para poder borrar después
let base = '';
let fallas = 0;

function comprobar(condicion, descripcion, detalle = '') {
  if (condicion) {
    console.log(`OK     ${descripcion}`);
  } else {
    fallas += 1;
    console.log(`FALLA  ${descripcion} ${detalle}`);
  }
}

// Pequeño cliente HTTP que recuerda la cookie de sesión (como un navegador).
function crearCliente() {
  let cookie = '';
  return async function pedir(metodo, ruta, cuerpo) {
    const respuesta = await fetch(base + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const nueva = respuesta.headers.get('set-cookie');
    if (nueva) cookie = nueva.split(';')[0];
    const datos = await respuesta.json().catch(() => null);
    return { estado: respuesta.status, datos };
  };
}

async function idProducto(nombre) {
  const { rows } = await db.query('SELECT id_producto FROM productos WHERE nombre = $1', [nombre]);
  return rows[0].id_producto;
}

async function probar() {
  const anonimo = crearCliente();
  const mesero = crearCliente();
  const cocina = crearCliente();
  const admin = crearCliente();

  // --- Público -------------------------------------------------------
  let r = await anonimo('GET', '/api/salud');
  comprobar(r.estado === 200, 'Servidor y base de datos responden (/api/salud)');

  r = await anonimo('GET', '/api/menu');
  comprobar(r.estado === 200 && r.datos.length === 4, 'Menú público con 4 categorías', JSON.stringify(r.datos?.length));

  r = await anonimo('GET', '/api/pedidos');
  comprobar(r.estado === 401, 'Sin ingresar no se ven los pedidos (401)');

  // --- Ingreso -------------------------------------------------------
  r = await mesero('POST', '/api/auth/ingresar', { usuario: 'mesero1', contrasena: 'incorrecta' });
  comprobar(r.estado === 401, 'Contraseña incorrecta rechazada (401)');

  r = await mesero('POST', '/api/auth/ingresar', { usuario: 'mesero1', contrasena: 'Mesero2026*' });
  comprobar(r.estado === 200 && r.datos.rol === 'mesero', 'Mesero ingresa con su contraseña');
  await cocina('POST', '/api/auth/ingresar', { usuario: 'cocina1', contrasena: 'Cocina2026*' });
  r = await admin('POST', '/api/auth/ingresar', { usuario: 'admin', contrasena: 'Admin2026*' });
  comprobar(r.estado === 200 && r.datos.rol === 'administrador', 'Administrador ingresa');

  r = await mesero('GET', '/api/ventas');
  comprobar(r.estado === 403, 'El mesero no puede ver ventas (403)');

  // --- Pedido --------------------------------------------------------
  r = await mesero('GET', '/api/pedidos/catalogos');
  const mesa3 = r.datos.mesas.find((m) => m.numero === 3);
  const efectivo = r.datos.formas_pago.find((f) => f.nombre === 'Efectivo');
  comprobar(mesa3 && efectivo, 'Catálogos: mesas y formas de pago');

  r = await mesero('POST', '/api/pedidos', {
    id_mesa: mesa3.id_mesa,
    observaciones: MARCA,
    items: [
      { id_producto: await idProducto('Hamburguesa doble'), cantidad: 2, observaciones: 'sin cebolla' },
      { id_producto: await idProducto('Gaseosa 400 ml'), cantidad: 2 },
    ],
  });
  const pedido = r.datos;
  comprobar(r.estado === 201 && pedido.total === 52000, 'Pedido registrado; total calculado = 52000', JSON.stringify(r.datos));

  r = await anonimo('POST', '/api/pedidos', { items: [] });
  comprobar(r.estado === 401, 'Un visitante no puede registrar pedidos (401)');

  // Cocina marca un producto como agotado; el mesero ya no puede pedirlo.
  const idJugo = await idProducto('Jugo natural');
  r = await cocina('PATCH', `/api/productos/${idJugo}/disponibilidad`, { disponible: false });
  comprobar(r.estado === 200 && r.datos.disponible === false, 'Cocina marca "Jugo natural" como agotado');

  const antes = (await db.query('SELECT count(*)::int AS n FROM pedidos')).rows[0].n;
  r = await mesero('POST', '/api/pedidos', {
    id_mesa: null, observaciones: MARCA,
    items: [
      { id_producto: await idProducto('Pincho de res'), cantidad: 1 },
      { id_producto: idJugo, cantidad: 1 },
    ],
  });
  const despues = (await db.query('SELECT count(*)::int AS n FROM pedidos')).rows[0].n;
  comprobar(r.estado === 409, 'Pedido con producto agotado rechazado (409)', r.datos?.error);
  comprobar(antes === despues, 'La transacción no dejó un pedido a medias');

  r = await anonimo('GET', '/api/menu');
  const jugoMenu = r.datos.flatMap((c) => c.productos).find((p) => p.id_producto === idJugo);
  comprobar(jugoMenu && jugoMenu.disponible === false, 'El menú público muestra el jugo como no disponible');

  // --- Cocina --------------------------------------------------------
  r = await cocina('GET', '/api/pedidos/cocina');
  comprobar(r.datos.some((p) => p.id_pedido === pedido.id_pedido), 'El pedido aparece en la pantalla de cocina');

  r = await cocina('PATCH', `/api/pedidos/${pedido.id_pedido}/estado`, { estado: 'en_preparacion' });
  comprobar(r.estado === 200 && r.datos.estado_codigo === 'en_preparacion', 'Cocina: En preparación');
  r = await cocina('PATCH', `/api/pedidos/${pedido.id_pedido}/estado`, { estado: 'listo' });
  comprobar(r.estado === 200 && r.datos.estado_codigo === 'listo', 'Cocina: Listo');
  r = await cocina('PATCH', `/api/pedidos/${pedido.id_pedido}/estado`, { estado: 'entregado' });
  comprobar(r.estado === 403, 'Cocina no puede marcar Entregado (403)');

  // --- Pago ----------------------------------------------------------
  r = await mesero('PATCH', `/api/pedidos/${pedido.id_pedido}/pago`, { id_forma_pago: efectivo.id_forma_pago });
  comprobar(r.estado === 200 && r.datos.pagado_en && r.datos.forma_pago === 'Efectivo', 'Pago registrado en efectivo');
  r = await mesero('PATCH', `/api/pedidos/${pedido.id_pedido}/pago`, { id_forma_pago: efectivo.id_forma_pago });
  comprobar(r.estado === 409, 'No se puede pagar dos veces (409)');
  r = await mesero('PATCH', `/api/pedidos/${pedido.id_pedido}/estado`, { estado: 'cancelado' });
  comprobar(r.estado === 409, 'No se puede cancelar un pedido pagado (409)', r.datos?.error);
  r = await mesero('PATCH', `/api/pedidos/${pedido.id_pedido}/estado`, { estado: 'entregado' });
  comprobar(r.estado === 200 && r.datos.estado_codigo === 'entregado', 'Mesero: Entregado');

  // --- Ventas --------------------------------------------------------
  r = await admin('GET', '/api/ventas');
  comprobar(r.estado === 200 && r.datos.ventas.some((v) => v.id_pedido === pedido.id_pedido),
    `Ventas de hoy incluyen el pedido (total del día: ${r.datos?.total_vendido})`);
  r = await admin('GET', '/api/ventas?desde=2026-12-01&hasta=2026-11-01');
  comprobar(r.estado === 400, 'Rango de fechas invertido rechazado (400)');

  // --- Administración de productos ----------------------------------
  const idCategoria = (await db.query("SELECT id_categoria FROM categorias WHERE nombre = 'Bebidas'")).rows[0].id_categoria;
  r = await admin('POST', '/api/productos', { nombre: `${MARCA} Limonada`, precio: 5000, id_categoria: idCategoria });
  const nuevo = r.datos;
  comprobar(r.estado === 201 && nuevo.precio === 5000, 'Administrador crea un producto');
  r = await admin('PUT', `/api/productos/${nuevo.id_producto}`, { ...nuevo, precio: 5500 });
  comprobar(r.estado === 200 && r.datos.precio === 5500, 'Administrador cambia el precio');
  r = await admin('POST', '/api/productos', { nombre: `${MARCA} Limonada`, precio: 5000, id_categoria: idCategoria });
  comprobar(r.estado === 409, 'Nombre de producto repetido rechazado (409)');
  r = await admin('POST', '/api/productos', { nombre: `${MARCA} X`, precio: 0, id_categoria: idCategoria });
  comprobar(r.estado === 400, 'Precio cero rechazado (400)');
  r = await mesero('POST', '/api/productos', { nombre: `${MARCA} Y`, precio: 1000, id_categoria: idCategoria });
  comprobar(r.estado === 403, 'El mesero no puede crear productos (403)');

  // --- Cambio de contraseña (al final se deja la original) ---------
  r = await mesero('PATCH', '/api/auth/contrasena', { actual: 'equivocada', nueva: 'OtraClave2026' });
  comprobar(r.estado === 400, 'Cambio de contraseña con la actual equivocada rechazado (400)');
  r = await mesero('PATCH', '/api/auth/contrasena', { actual: 'Mesero2026*', nueva: 'corta' });
  comprobar(r.estado === 400, 'Contraseña nueva de menos de 8 caracteres rechazada (400)');
  r = await mesero('PATCH', '/api/auth/contrasena', { actual: 'Mesero2026*', nueva: 'OtraClave2026' });
  comprobar(r.estado === 200, 'Mesero cambia su contraseña');
  const otro = crearCliente();
  r = await otro('POST', '/api/auth/ingresar', { usuario: 'mesero1', contrasena: 'Mesero2026*' });
  comprobar(r.estado === 401, 'La contraseña anterior ya no sirve');
  r = await otro('POST', '/api/auth/ingresar', { usuario: 'mesero1', contrasena: 'OtraClave2026' });
  comprobar(r.estado === 200, 'La contraseña nueva sí sirve');
  r = await otro('PATCH', '/api/auth/contrasena', { actual: 'OtraClave2026', nueva: 'Mesero2026*' });
  comprobar(r.estado === 200, 'Se restaura la contraseña de prueba');

  r = await mesero('POST', '/api/auth/salir');
  r = await mesero('GET', '/api/pedidos');
  comprobar(r.estado === 401, 'Después de salir, la sesión queda cerrada');
}

async function limpiar() {
  // Borrar el pedido de prueba (su detalle e historial se borran en cascada).
  await db.query('DELETE FROM pedidos WHERE observaciones = $1', [MARCA]);
  await db.query('DELETE FROM productos WHERE nombre LIKE $1', [`${MARCA}%`]);
  await db.query("UPDATE productos SET disponible = TRUE WHERE nombre = 'Jugo natural'");
  console.log('\nDatos de prueba eliminados.');
}

const servidor = app.listen(0, async () => {
  base = `http://localhost:${servidor.address().port}`;
  try {
    await probar();
  } catch (error) {
    fallas += 1;
    console.error('Error inesperado:', error);
  } finally {
    await limpiar();
    console.log(fallas === 0 ? 'RESULTADO: todas las pruebas pasaron.' : `RESULTADO: ${fallas} prueba(s) fallaron.`);
    servidor.close();
    await db.pool.end();
    process.exitCode = fallas === 0 ? 0 : 1;
  }
});
