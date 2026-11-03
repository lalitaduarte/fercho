// =====================================================================
// Pantalla del mesero: registrar pedidos, entregarlos, cancelarlos y
// registrar el pago (desde ese momento el pedido cuenta como venta).
// =====================================================================

let productos = [];         // productos activos del menú
let catalogos = null;       // mesas, formas de pago, estados
const carrito = new Map();  // id_producto -> { cantidad, observaciones }
let pedidoAPagar = null;

// ---------- Nuevo pedido ----------

function pintarProductos() {
  const contenedor = document.getElementById('lista-productos');
  // Agrupar por categoría (la API ya los entrega ordenados).
  const grupos = new Map();
  for (const p of productos) {
    if (!grupos.has(p.categoria)) grupos.set(p.categoria, []);
    grupos.get(p.categoria).push(p);
  }
  contenedor.innerHTML = [...grupos].map(([categoria, lista]) => `
    <div class="tarjeta seccion">
      <h2>${esc(categoria)}</h2>
      ${lista.map((p) => {
        const item = carrito.get(p.id_producto);
        const cantidad = item ? item.cantidad : 0;
        return `
        <div class="linea-producto" data-id="${p.id_producto}">
          <div>
            <div><strong>${esc(p.nombre)}</strong></div>
            <div class="texto-suave">${pesos(p.precio)}
              ${p.disponible ? '' : ' · <span class="etiqueta agotado">Agotado</span>'}</div>
          </div>
          <div class="contador">
            <button type="button" data-accion="menos" aria-label="Quitar uno de ${esc(p.nombre)}"
              ${cantidad === 0 ? 'disabled' : ''}>−</button>
            <span class="cantidad" aria-live="polite">${cantidad}</span>
            <button type="button" data-accion="mas" aria-label="Agregar uno de ${esc(p.nombre)}"
              ${p.disponible ? '' : 'disabled'}>+</button>
          </div>
          ${cantidad > 0 ? `
          <div class="nota">
            <input data-accion="nota" maxlength="200" placeholder="Nota para cocina (ej.: sin cebolla)"
              aria-label="Nota para ${esc(p.nombre)}" value="${esc(item.observaciones)}">
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>`).join('');
  pintarResumen();
}

function pintarResumen() {
  let cantidad = 0;
  let total = 0;
  for (const [id, item] of carrito) {
    const p = productos.find((x) => x.id_producto === id);
    cantidad += item.cantidad;
    total += item.cantidad * p.precio;
  }
  document.getElementById('resumen-cantidad').textContent =
    `${cantidad} producto${cantidad === 1 ? '' : 's'}`;
  document.getElementById('resumen-total').textContent = pesos(total);
  document.getElementById('boton-registrar').disabled = cantidad === 0;
}

// Un solo "escuchador" para todos los botones + y − (delegación de eventos).
document.getElementById('lista-productos').addEventListener('click', (evento) => {
  const boton = evento.target.closest('button[data-accion]');
  if (!boton) return;
  const id = Number(boton.closest('.linea-producto').dataset.id);
  const item = carrito.get(id) || { cantidad: 0, observaciones: '' };
  item.cantidad += boton.dataset.accion === 'mas' ? 1 : -1;
  if (item.cantidad > 99) item.cantidad = 99;
  if (item.cantidad <= 0) carrito.delete(id); else carrito.set(id, item);
  pintarProductos();
});

document.getElementById('lista-productos').addEventListener('input', (evento) => {
  if (evento.target.dataset.accion !== 'nota') return;
  const id = Number(evento.target.closest('.linea-producto').dataset.id);
  const item = carrito.get(id);
  if (item) item.observaciones = evento.target.value;
});

document.getElementById('boton-registrar').addEventListener('click', async (evento) => {
  const boton = evento.currentTarget;
  const idMesa = document.getElementById('mesa').value;
  const cuerpo = {
    id_mesa: idMesa ? Number(idMesa) : null,
    observaciones: document.getElementById('observaciones').value.trim() || null,
    items: [...carrito].map(([id_producto, item]) => ({
      id_producto,
      cantidad: item.cantidad,
      observaciones: item.observaciones.trim() || null,
    })),
  };
  boton.disabled = true;
  try {
    const pedido = await api('POST', '/api/pedidos', cuerpo);
    aviso(`Pedido #${pedido.id_pedido} registrado · ${pesos(pedido.total)}`, 'exito');
    carrito.clear();
    document.getElementById('observaciones').value = '';
    document.getElementById('mesa').value = '';
    pintarProductos();
  } catch (error) {
    aviso(error.message, 'error');
    // Un producto pudo agotarse mientras se tomaba el pedido: recargar.
    await cargarProductos();
  } finally {
    pintarResumen();
  }
});

async function cargarProductos() {
  const todos = await api('GET', '/api/productos');
  productos = todos.filter((p) => p.activo);
  // Quitar del carrito lo que ya no esté disponible.
  for (const id of carrito.keys()) {
    const p = productos.find((x) => x.id_producto === id);
    if (!p || !p.disponible) carrito.delete(id);
  }
  pintarProductos();
}

// ---------- Pedidos de hoy ----------

function nombreMesa(pedido) {
  return pedido.mesa_numero ? `Mesa ${pedido.mesa_numero}` : 'Para llevar';
}

function pintarPedidos(pedidos) {
  const contenedor = document.getElementById('lista-pedidos');
  if (pedidos.length === 0) {
    contenedor.innerHTML = '<p class="vacio">No hay pedidos todavía.</p>';
    return;
  }
  contenedor.innerHTML = pedidos.map((p) => {
    const cerrado = ['entregado', 'cancelado'].includes(p.estado_codigo);
    const pagado = Boolean(p.pagado_en);
    return `
    <article class="tarjeta" data-id="${p.id_pedido}">
      <div class="pedido-cabecera">
        <div>
          <div class="titulo">#${p.id_pedido} · ${esc(nombreMesa(p))}</div>
          <div class="pedido-meta">${hora(p.creado_en)} · ${esc(p.mesero)}</div>
        </div>
        <div style="text-align:right">
          <span class="etiqueta ${p.estado_codigo}">${esc(p.estado)}</span><br>
          ${pagado ? `<span class="etiqueta pagado">Pagado · ${esc(p.forma_pago)}</span>` : ''}
        </div>
      </div>
      <p><strong>${pesos(p.total)}</strong></p>
      ${p.observaciones ? `<div class="observacion">${esc(p.observaciones)}</div>` : ''}
      <div class="detalle-pedido" id="detalle-${p.id_pedido}" hidden></div>
      <div class="acciones">
        <button type="button" class="boton pequeno" data-accion="detalle">Ver detalle</button>
        ${!pagado && p.estado_codigo !== 'cancelado'
          ? '<button type="button" class="boton pequeno exito" data-accion="pagar">Registrar pago</button>' : ''}
        ${!cerrado
          ? '<button type="button" class="boton pequeno" data-accion="entregado">Entregado</button>' : ''}
        ${!cerrado && !pagado
          ? '<button type="button" class="boton pequeno peligro" data-accion="cancelado">Cancelar</button>' : ''}
      </div>
    </article>`;
  }).join('');
}

let pedidosActuales = [];

async function cargarPedidos() {
  try {
    pedidosActuales = await api('GET', '/api/pedidos');
    pintarPedidos(pedidosActuales);
  } catch (error) {
    aviso(error.message, 'error');
  }
}

document.getElementById('lista-pedidos').addEventListener('click', async (evento) => {
  const boton = evento.target.closest('button[data-accion]');
  if (!boton) return;
  const id = Number(boton.closest('article').dataset.id);
  const accion = boton.dataset.accion;

  if (accion === 'detalle') {
    const caja = document.getElementById(`detalle-${id}`);
    if (!caja.hidden) { caja.hidden = true; return; }
    const pedido = await api('GET', `/api/pedidos/${id}`);
    caja.innerHTML = `<table>${pedido.detalle.map((d) => `
      <tr>
        <td>${d.cantidad} × ${esc(d.producto)}${d.observaciones ? `<br><small class="texto-suave">${esc(d.observaciones)}</small>` : ''}</td>
        <td class="num">${pesos(d.subtotal)}</td>
      </tr>`).join('')}</table>`;
    caja.hidden = false;
    return;
  }

  if (accion === 'pagar') {
    pedidoAPagar = pedidosActuales.find((p) => p.id_pedido === id);
    document.getElementById('pago-titulo').textContent = `Pago del pedido #${id}`;
    document.getElementById('pago-total').textContent = `Total: ${pesos(pedidoAPagar.total)}`;
    const dialogo = document.getElementById('dialogo-pago');
    dialogo.returnValue = ''; // si se cierra con Esc, no debe "recordar" un pago anterior
    dialogo.showModal();
    return;
  }

  if (accion === 'cancelado' && !confirm(`¿Cancelar el pedido #${id}? Esta acción no se puede deshacer.`)) {
    return;
  }
  boton.disabled = true;
  try {
    await api('PATCH', `/api/pedidos/${id}/estado`, { estado: accion });
    aviso(`Pedido #${id}: ${accion === 'entregado' ? 'entregado' : 'cancelado'}`, 'exito');
  } catch (error) {
    aviso(error.message, 'error');
  }
  cargarPedidos();
});

document.getElementById('dialogo-pago').addEventListener('close', async (evento) => {
  const dialogo = evento.target;
  if (dialogo.returnValue !== 'pagar' || !pedidoAPagar) return;
  const id = pedidoAPagar.id_pedido;
  try {
    await api('PATCH', `/api/pedidos/${id}/pago`, {
      id_forma_pago: Number(document.getElementById('forma-pago').value),
    });
    aviso(`Pago del pedido #${id} registrado`, 'exito');
  } catch (error) {
    aviso(error.message, 'error');
  }
  pedidoAPagar = null;
  cargarPedidos();
});

document.getElementById('boton-actualizar').addEventListener('click', cargarPedidos);

// ---------- Inicio ----------
(async function iniciar() {
  await exigirSesion(['mesero', 'administrador']);
  catalogos = await api('GET', '/api/pedidos/catalogos');

  document.getElementById('mesa').innerHTML =
    '<option value="">Para llevar (sin mesa)</option>' +
    catalogos.mesas.map((m) => `<option value="${m.id_mesa}">Mesa ${m.numero}</option>`).join('');
  document.getElementById('forma-pago').innerHTML =
    catalogos.formas_pago.map((f) => `<option value="${f.id_forma_pago}">${esc(f.nombre)}</option>`).join('');

  activarPestanas((pestana) => {
    if (pestana === 'seccion-pedidos') cargarPedidos();
  });
  await cargarProductos();
  // Actualizar la lista de pedidos cada 20 segundos si está visible.
  setInterval(() => {
    if (!document.getElementById('seccion-pedidos').hidden) cargarPedidos();
  }, 20000);
})();
