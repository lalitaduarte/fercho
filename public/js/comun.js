// =====================================================================
// Funciones compartidas por todas las páginas
// =====================================================================

// Página de inicio de cada rol.
const INICIO_POR_ROL = {
  administrador: '/admin.html',
  mesero: '/mesero.html',
  cocina: '/cocina.html',
};

// Enlaces del menú superior según el rol.
const ENLACES_POR_ROL = {
  administrador: [
    ['/admin.html', 'Administración'],
    ['/mesero.html', 'Pedidos'],
    ['/cocina.html', 'Cocina'],
  ],
  mesero: [['/mesero.html', 'Pedidos']],
  cocina: [['/cocina.html', 'Cocina']],
};

// Llama a la API del backend y devuelve los datos.
// Si el servidor responde con error, lanza un Error con su mensaje.
async function api(metodo, ruta, cuerpo) {
  const opciones = { method: metodo, headers: {} };
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }
  let respuesta;
  try {
    respuesta = await fetch(ruta, opciones);
  } catch {
    throw new Error('No hay conexión con el servidor.');
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (respuesta.status === 401 && !ruta.startsWith('/api/auth/')) {
    // La sesión expiró: volver a la pantalla de ingreso.
    irAIngreso();
    throw new Error(datos.error || 'Debe ingresar al sistema.');
  }
  if (!respuesta.ok) {
    const error = new Error(datos.error || 'Ocurrió un error.');
    error.estado = respuesta.status;
    throw error;
  }
  return datos;
}

function irAIngreso() {
  const volver = encodeURIComponent(location.pathname);
  location.href = `/ingresar.html?volver=${volver}`;
}

// Evita que un texto escrito por un usuario se interprete como HTML
// (protección contra inyección de código en la página).
function esc(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// 15000 -> "$ 15.000"
const formatoPesos = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
});
function pesos(valor) {
  return formatoPesos.format(Number(valor) || 0);
}

// Fechas y horas siempre en hora de Colombia.
function hora(fechaIso) {
  return new Date(fechaIso).toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit',
  });
}
function fechaHora(fechaIso) {
  return new Date(fechaIso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}
// Fecha de hoy en Colombia con formato AAAA-MM-DD (para los campos de fecha).
function hoyColombia(desplazamientoDias = 0) {
  const fecha = new Date(Date.now() + desplazamientoDias * 86400000);
  return fecha.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

// Mensaje flotante temporal. tipo: '' | 'exito' | 'error'
function aviso(mensaje, tipo = '') {
  let zona = document.getElementById('avisos');
  if (!zona) {
    zona = document.createElement('div');
    zona.id = 'avisos';
    zona.setAttribute('role', 'status');
    zona.setAttribute('aria-live', 'polite');
    document.body.appendChild(zona);
  }
  const caja = document.createElement('div');
  caja.className = `aviso ${tipo}`;
  caja.textContent = mensaje;
  zona.appendChild(caja);
  setTimeout(() => caja.remove(), tipo === 'error' ? 6000 : 3500);
}

// Verifica la sesión y el rol. Si no hay sesión, lleva al ingreso; si el
// rol no tiene permiso, lleva a su propia página. Devuelve el usuario.
async function exigirSesion(rolesPermitidos) {
  let usuario;
  try {
    usuario = await api('GET', '/api/auth/yo');
  } catch {
    irAIngreso();
    return new Promise(() => {}); // detiene la página mientras redirige
  }
  if (!rolesPermitidos.includes(usuario.rol)) {
    location.href = INICIO_POR_ROL[usuario.rol] || '/';
    return new Promise(() => {});
  }
  pintarNavegacion(usuario);
  return usuario;
}

// Dibuja los enlaces del menú superior y el botón "Salir".
function pintarNavegacion(usuario) {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const enlaces = (ENLACES_POR_ROL[usuario.rol] || [])
    .map(([url, texto]) =>
      `<a href="${url}" class="${location.pathname === url ? 'activo' : ''}">${texto}</a>`)
    .join('');
  nav.innerHTML = `
    ${enlaces}
    <a href="/contrasena.html" class="${location.pathname === '/contrasena.html' ? 'activo' : ''}"
       title="Cambiar contraseña">${esc(usuario.nombre)}</a>
    <button type="button" id="boton-salir">Salir</button>`;
  document.getElementById('boton-salir').addEventListener('click', async () => {
    await api('POST', '/api/auth/salir').catch(() => {});
    location.href = '/ingresar.html';
  });
}

// Pestañas: botones con data-pestana="id" que muestran la sección con ese id.
function activarPestanas(alCambiar) {
  const botones = document.querySelectorAll('.pestanas button');
  botones.forEach((boton) => {
    boton.addEventListener('click', () => {
      botones.forEach((b) => {
        const activo = b === boton;
        b.setAttribute('aria-selected', String(activo));
        document.getElementById(b.dataset.pestana).hidden = !activo;
      });
      if (alCambiar) alCambiar(boton.dataset.pestana);
    });
  });
}
