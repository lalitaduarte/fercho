// =====================================================================
// Pantalla del administrador: consulta de ventas y gestión de productos
// =====================================================================

// ---------- Ventas ----------

// ancha = true: la tabla conserva su ancho y se desplaza de lado en celulares.
function tabla(encabezados, filas, ancha = false) {
  if (filas.length === 0) return '<p class="vacio">Sin datos en este rango.</p>';
  return `<div class="tabla-envoltura"><table class="${ancha ? 'ancha' : ''}">
    <thead><tr>${encabezados.map(([t, num]) => `<th class="${num ? 'num' : ''}">${t}</th>`).join('')}</tr></thead>
    <tbody>${filas.join('')}</tbody>
  </table></div>`;
}

async function consultarVentas() {
  const desde = document.getElementById('desde').value;
  const hasta = document.getElementById('hasta').value;
  const zona = document.getElementById('resultado-ventas');
  zona.innerHTML = '<p class="vacio">Consultando…</p>';
  try {
    const v = await api('GET', `/api/ventas?desde=${desde}&hasta=${hasta}`);
    const maxUnidades = Math.max(1, ...v.productos.map((p) => p.unidades));
    const promedio = v.numero_ventas ? v.total_vendido / v.numero_ventas : 0;

    zona.innerHTML = `
      <div class="indicadores">
        <div class="tarjeta indicador"><div class="rotulo">Total vendido</div><div class="valor">${pesos(v.total_vendido)}</div></div>
        <div class="tarjeta indicador"><div class="rotulo">Número de ventas</div><div class="valor">${v.numero_ventas}</div></div>
        <div class="tarjeta indicador"><div class="rotulo">Venta promedio</div><div class="valor">${pesos(promedio)}</div></div>
        <div class="tarjeta indicador"><div class="rotulo">Días con ventas</div><div class="valor">${v.por_dia.length}</div></div>
      </div>

      <div class="rejilla">
        <div class="tarjeta seccion">
          <h3>Por forma de pago</h3>
          ${tabla([['Forma de pago'], ['Ventas', 1], ['Total', 1]],
            v.por_forma_pago.map((f) => `<tr><td>${esc(f.forma_pago)}</td><td class="num">${f.numero_ventas}</td><td class="num">${pesos(f.total_vendido)}</td></tr>`))}
        </div>
        <div class="tarjeta seccion">
          <h3>Por día</h3>
          ${tabla([['Fecha'], ['Ventas', 1], ['Total', 1]],
            v.por_dia.map((d) => `<tr><td>${d.fecha}</td><td class="num">${d.numero_ventas}</td><td class="num">${pesos(d.total_vendido)}</td></tr>`))}
        </div>
      </div>

      <div class="tarjeta seccion">
        <h3>Productos vendidos</h3>
        ${tabla([['Producto'], [''], ['Unidades', 1], ['Total', 1]],
          v.productos.map((p) => `<tr>
            <td>${esc(p.producto)}</td>
            <td style="width:30%"><div class="barra-dato" style="width:${(p.unidades / maxUnidades) * 100}%"></div></td>
            <td class="num">${p.unidades}</td>
            <td class="num">${pesos(p.total_vendido)}</td></tr>`))}
      </div>

      <div class="tarjeta seccion">
        <h3>Detalle de ventas</h3>
        ${tabla([['Pedido'], ['Fecha y hora'], ['Mesa'], ['Mesero'], ['Pago'], ['Total', 1]],
          v.ventas.map((x) => `<tr>
            <td>#${x.id_pedido}</td><td>${fechaHora(x.pagado_en)}</td><td>${esc(x.mesa)}</td>
            <td>${esc(x.mesero)}</td><td>${esc(x.forma_pago)}</td><td class="num">${pesos(x.total)}</td></tr>`), true)}
      </div>`;
  } catch (error) {
    zona.innerHTML = `<p class="vacio">${esc(error.message)}</p>`;
  }
}

document.getElementById('formulario-ventas').addEventListener('submit', (evento) => {
  evento.preventDefault();
  consultarVentas();
});

// Botones de rangos rápidos.
document.querySelectorAll('[data-rango]').forEach((boton) => {
  boton.addEventListener('click', () => {
    const rango = boton.dataset.rango;
    const hoy = hoyColombia();
    let desde = hoy;
    if (rango === '7') desde = hoyColombia(-6);
    if (rango === 'mes') desde = `${hoy.slice(0, 8)}01`;
    document.getElementById('desde').value = desde;
    document.getElementById('hasta').value = hoy;
    consultarVentas();
  });
});

// ---------- Productos ----------

let productos = [];
let categorias = [];
let productoEditado = null; // null = creando uno nuevo

async function cargarProductos() {
  productos = await api('GET', '/api/productos');
  const cuerpo = document.getElementById('tabla-productos');
  if (productos.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="5" class="vacio">No hay productos.</td></tr>';
    return;
  }
  cuerpo.innerHTML = productos.map((p) => `
    <tr data-id="${p.id_producto}">
      <td><strong>${esc(p.nombre)}</strong>${p.descripcion ? `<br><small class="texto-suave">${esc(p.descripcion)}</small>` : ''}</td>
      <td>${esc(p.categoria)}</td>
      <td class="num">${pesos(p.precio)}</td>
      <td>
        ${!p.activo ? '<span class="etiqueta">Retirado</span>'
          : p.disponible ? '<span class="etiqueta listo">Disponible</span>'
          : '<span class="etiqueta agotado">Agotado</span>'}
      </td>
      <td><button type="button" class="boton pequeno" data-accion="editar">Editar</button></td>
    </tr>`).join('');
}

function abrirFormulario(producto) {
  productoEditado = producto;
  document.getElementById('producto-titulo').textContent = producto ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('p-nombre').value = producto?.nombre ?? '';
  document.getElementById('p-descripcion').value = producto?.descripcion ?? '';
  document.getElementById('p-categoria').value = producto?.id_categoria ?? categorias[0]?.id_categoria ?? '';
  document.getElementById('p-precio').value = producto?.precio ?? '';
  document.getElementById('p-disponible').checked = producto ? producto.disponible : true;
  document.getElementById('p-activo').checked = producto ? producto.activo : true;
  document.getElementById('producto-error').textContent = '';
  document.getElementById('dialogo-producto').showModal();
  document.getElementById('p-nombre').focus();
}

document.getElementById('boton-nuevo').addEventListener('click', () => abrirFormulario(null));
document.getElementById('boton-cerrar-producto').addEventListener('click', () =>
  document.getElementById('dialogo-producto').close());

document.getElementById('tabla-productos').addEventListener('click', (evento) => {
  const boton = evento.target.closest('button[data-accion="editar"]');
  if (!boton) return;
  const id = Number(boton.closest('tr').dataset.id);
  abrirFormulario(productos.find((p) => p.id_producto === id));
});

document.getElementById('formulario-producto').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const error = document.getElementById('producto-error');
  const datos = {
    nombre: document.getElementById('p-nombre').value.trim(),
    descripcion: document.getElementById('p-descripcion').value.trim(),
    id_categoria: Number(document.getElementById('p-categoria').value),
    precio: Number(document.getElementById('p-precio').value),
    disponible: document.getElementById('p-disponible').checked,
    activo: document.getElementById('p-activo').checked,
  };
  // Validación rápida en el navegador; el servidor y la base de datos
  // vuelven a validar (nunca se confía solo en el navegador).
  if (!datos.nombre) { error.textContent = 'Escriba el nombre.'; return; }
  if (!(datos.precio > 0)) { error.textContent = 'El precio debe ser mayor que cero.'; return; }

  try {
    if (productoEditado) {
      await api('PUT', `/api/productos/${productoEditado.id_producto}`, datos);
      aviso('Producto actualizado', 'exito');
    } else {
      await api('POST', '/api/productos', datos);
      aviso('Producto creado', 'exito');
    }
    document.getElementById('dialogo-producto').close();
    cargarProductos();
  } catch (e) {
    error.textContent = e.message;
  }
});

// ---------- Inicio ----------
(async function iniciar() {
  await exigirSesion(['administrador']);
  activarPestanas((pestana) => {
    if (pestana === 'seccion-productos') cargarProductos();
  });

  categorias = await api('GET', '/api/productos/categorias');
  document.getElementById('p-categoria').innerHTML = categorias
    .filter((c) => c.activa)
    .map((c) => `<option value="${c.id_categoria}">${esc(c.nombre)}</option>`).join('');

  document.getElementById('desde').value = hoyColombia();
  document.getElementById('hasta').value = hoyColombia();
  consultarVentas();
})();
