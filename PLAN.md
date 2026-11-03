# Plan de desarrollo — Hamburguesas y Pinchos Fercho

**Equipo 1** · Grupo D194 (Motores de Base de Datos) · Grupo B194 (Planeación de Sistemas Informáticos)
Unidades Tecnológicas de Santander

## Objetivo

Construir una aplicación web funcional, publicada en internet con enlace HTTPS y con datos
persistentes en PostgreSQL, para gestionar el menú, los pedidos, la cocina y las ventas del negocio.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Base de datos | PostgreSQL |
| Backend | Node.js + Express |
| Frontend | HTML, CSS y JavaScript (sin frameworks), en español y adaptable a celulares |
| Scripts SQL | Archivos separados y comentados en la carpeta `database/` |

## Estado del entorno (comprobado el 2026-11-02)

| Herramienta | Estado | Evidencia |
|---|---|---|
| Node.js | ✅ Instalado | `node --version` → v22.20.0 |
| npm | ✅ Instalado | `npm --version` → 10.9.3 |
| Git | ✅ Instalado | `git --version` → 2.55.0 |
| PostgreSQL | ✅ Instalado (5 versiones) | Servicios de Windows en ejecución |

Versiones de PostgreSQL encontradas en este equipo (todas en ejecución):

| Versión | Puerto | Nota |
|---|---|---|
| 9.4 | 5433 | Muy antigua, no recomendada |
| 13 | 5432 | Puerto por defecto |
| 14 | 5434 | Es la que abre el comando `psql` por defecto |
| **17** | **5435** | **Propuesta para el proyecto** (acepta conexiones, comprobado con `pg_isready`) |
| 18 | 5436 | La más reciente |

## Etapas

Leyenda: ✅ hecho · 🔄 en curso · ⏳ pendiente

### Etapa 1 — Preparación del entorno ✅
- ✅ Comprobar Node.js, npm, Git y PostgreSQL.
- ✅ Crear este PLAN.md.
- ✅ Confirmar el acceso a PostgreSQL 17 con el usuario `postgres` (hecho por Laura: versión 17.4, puerto 5435).
- ✅ Crear `.gitignore`, `.env.example` y `database/00_crear_base_datos.sql`.
- ✅ Crear el archivo privado `.env` con la contraseña (hecho por Laura).
- ✅ Crear la base de datos `fercho_db` con el script 00. Verificado: codificación UTF8 y descripción registrada.

> **Nota sobre tildes en la consola:** psql muestra una advertencia porque la consola usa la
> página de códigos 850 y Windows usa la 1252. Esto puede dañar tildes y eñes en pantalla.
> Solución: ejecutar `chcp 1252` en la consola antes de abrir psql.

### Etapa 2 — Diseño de la base de datos ✅ (falta el diagrama)
Scripts en `database/`, ejecutados en este orden sobre `fercho_db`:

| Script | Contenido | Estado |
|---|---|---|
| `00_crear_base_datos.sql` | Base `fercho_db`, UTF8, zona horaria America/Bogota | ✅ Ejecutado |
| `01_crear_tablas.sql` | 10 tablas con llaves primarias y foráneas | ✅ Ejecutado |
| `02_restricciones.sql` | UNIQUE, CHECK, DEFAULT e índices | ✅ Ejecutado |
| `03_funciones_y_triggers.sql` | 5 funciones / 6 triggers: total automático, validaciones, historial | ✅ Ejecutado |
| `04_vistas_y_consultas.sql` | Vistas de menú, cocina, ventas y la función `fn_ventas_por_rango` | ✅ Ejecutado |
| `05_datos_iniciales.sql` | Catálogos, 8 mesas, 3 usuarios de prueba y menú de ejemplo | ✅ Ejecutado |
| `06_pruebas.sql` | 11 comprobaciones dentro de una transacción con ROLLBACK | ✅ 11/11 OK |
| `99_reiniciar.sql` | Borra todo (solo para desarrollo) | No ejecutar salvo necesidad |

- Tablas: `roles`, `usuarios`, `categorias`, `productos`, `mesas`, `estados_pedido`,
  `formas_pago`, `pedidos`, `detalle_pedido`, `historial_estados`.
- ⏳ Diagrama entidad-relación (se generará para la documentación).
- ⏳ Reemplazar el menú de ejemplo por el menú y los precios reales de Fercho.

**Usuarios de prueba** (cambiar antes de publicar):

| Usuario | Contraseña | Rol |
|---|---|---|
| admin | Admin2026* | administrador |
| mesero1 | Mesero2026* | mesero |
| cocina1 | Cocina2026* | cocina |

**Reglas que hace cumplir la base de datos** (aunque se modifiquen datos fuera de la aplicación):
- El total del pedido se calcula solo.
- El precio se copia al pedido, así que un cambio de precio posterior no altera las ventas pasadas.
- No se pueden pedir productos agotados o retirados.
- Un pedido pagado no se modifica, no se cancela y su pago no se anula.
- Un pedido cancelado no se puede pagar; los entregados y cancelados no cambian de estado.
- Cada cambio de estado queda en `historial_estados`.

> Nota: los números de pedido (`id_pedido`) pueden saltarse valores, por ejemplo cuando se
> ejecutan las pruebas. Es el comportamiento normal de PostgreSQL y no es un error.

### Etapa 3 — Backend (API con Express) ✅
Estructura:
```
src/
  server.js            arranque; verifica la conexión y la zona horaria
  app.js               une rutas, seguridad y archivos públicos
  config.js            lee .env o las variables del servidor
  db.js                pool de conexiones y transacciones
  middleware/auth.js   sesión (JWT en cookie httpOnly) y control por rol
  middleware/errores.js traduce errores de PostgreSQL a mensajes en español
  routes/              auth, menu, productos, pedidos, ventas
scripts/probar-api.js  prueba de punta a punta (npm run probar)
```

| Ruta | Método | Quién |
|---|---|---|
| `/api/salud` | GET | Público |
| `/api/menu` | GET | Público |
| `/api/auth/ingresar` · `/salir` · `/yo` | POST · POST · GET | Personal |
| `/api/productos` · `/categorias` | GET | Personal |
| `/api/productos` · `/:id` | POST · PUT | Administrador |
| `/api/productos/:id/disponibilidad` | PATCH | Administrador, cocina |
| `/api/pedidos/catalogos` · `/:id` | GET | Personal |
| `/api/pedidos` | GET · POST | Administrador, mesero |
| `/api/pedidos/cocina` | GET | Administrador, cocina |
| `/api/pedidos/:id/estado` | PATCH | Cocina: en preparación y listo · Mesero: entregado y cancelado · Administrador: todos |
| `/api/pedidos/:id/pago` | PATCH | Administrador, mesero |
| `/api/ventas?desde=&hasta=` | GET | Administrador |

- ✅ `npm run probar`: 30/30 pruebas OK. Borra sus datos de prueba al terminar (verificado: 0 pedidos).
- ✅ Seguridad: contraseñas bcrypt, cookie httpOnly, máximo 5 intentos de ingreso fallidos cada 15 minutos, consultas parametrizadas.
- ⏳ Gestión de usuarios desde la aplicación: crear o desactivar personal. Hoy se hace con SQL.
- ⏳ Gestión de categorías y mesas desde la aplicación. Hoy se hace con SQL.

### Etapa 4 — Frontend ✅
Archivos en `public/` (HTML, CSS y JavaScript, sin frameworks):

| Página | Quién | Qué hace |
|---|---|---|
| `index.html` | Público | Menú por categorías, precios y "Agotado" |
| `ingresar.html` | Personal | Ingreso; lleva a la pantalla de cada rol |
| `mesero.html` + `js/mesero.js` | Mesero, administrador | Nuevo pedido (mesa opcional, cantidades, notas) · Pedidos de hoy: detalle, pago, entregado, cancelar |
| `cocina.html` | Cocina, administrador | Tarjetas de pedidos que se actualizan cada 10 s · Empezar / Listo · Disponibilidad de productos |
| `admin.html` + `js/admin.js` | Administrador | Ventas por fechas: totales, forma de pago, por día, productos y detalle · Crear y editar productos |
| `css/estilos.css`, `js/comun.js` | — | Estilos móvil primero y funciones compartidas |

### Etapa 5 — Pruebas locales 🔄
- ✅ Prueba automática de interfaz con Edge (24/24 OK): recorrido completo con los tres roles,
  sin desplazamiento horizontal a 390 px de ancho y sin errores de JavaScript.
  Se corrigieron dos hallazgos: faltaba el ícono de pestaña (error 404) y la tabla de
  detalle de ventas se cortaba en celular.
- ⏳ Prueba manual de Laura en el navegador.

### Etapa 6 — Publicación en internet 🔄
- ✅ Base de datos en Neon, proyecto `fercho`, región AWS US East 1 (N. Virginia).
  Neon la creó con **PostgreSQL 18.6** (no 17); los scripts funcionan igual.
  Las cadenas de conexión están en `.env` como `DATABASE_URL_NUBE` (directa) y `DATABASE_URL_POOLED`.
- ✅ Ejecutados en la nube `00b_configurar_nube.sql` y los scripts 01 a 05.
  Verificado: zona horaria America/Bogota, pruebas SQL 11/11 OK y API 30/30 OK contra Neon. Quedó sin datos de prueba.
- ✅ Conexión SSL en modo `verify-full`, que comprueba el certificado del servidor.
- ✅ Código en GitHub (privado): https://github.com/lalitaduarte/fercho. Verificado: GitHub tiene
  la misma versión que el equipo local y no contiene `.env`. Se agregaron `.gitattributes`
  (finales de línea LF) y `.node-version` (Node 22).
- ✅ Servicio web en Render (Free, Virginia): **https://fercho-qgmq.onrender.com**
  Verificado: `/api/salud` ok con Neon, menú completo, HTTP redirige a HTTPS, cookie `HttpOnly; Secure`,
  y sin sesión no se ven los pedidos. Se publica solo con cada cambio subido a GitHub (Auto-Deploy).
- ✅ Nueva pantalla **Cambiar contraseña** (`contrasena.html`, `PATCH /api/auth/contrasena`). Se abre
  pulsando el nombre del usuario en el menú superior. Exige la contraseña actual y un mínimo de 8 caracteres.
  Pruebas: API 36/36 y interfaz 26/26.
- ⏳ Cambiar las contraseñas de admin, mesero1 y cocina1 en la aplicación publicada (paso manual).
- Configurar en el servidor las variables `DATABASE_URL`, `JWT_SECRET` y `NODE_ENV=production`.
- **Cambiar las contraseñas de los usuarios de prueba en la aplicación publicada ANTES de compartir el enlace.**
  Las contraseñas de prueba aparecen en este archivo y en el script 05, y el código está en GitHub.
- Publicar el backend y el frontend con enlace HTTPS.
- Comprobar que los datos persisten después de reiniciar el servicio.

## Decisiones pendientes

1. ~~Versión local de PostgreSQL.~~ **Decidido:** PostgreSQL 17, puerto 5435.
2. **Servicio de publicación (hosting).** Propuesta (revisada en noviembre de 2026):
   **Neon** para PostgreSQL, porque su plan gratuito no vence, y **Render** para el servidor
   Node.js, con HTTPS automático. No se usa la base gratuita de Render porque se borra a los 30 días.
   Limitación: el servidor gratuito de Render se duerme tras 15 minutos sin visitas, y la
   primera carga después tarda cerca de un minuto.
3. ~~Estados del pedido.~~ **Decidido:** Pendiente → En preparación → Listo → Entregado, más Cancelado.
4. ~~Mesas.~~ **Decidido:** tabla `mesas`. El pedido puede no tener mesa (para llevar). Se crearon 8 de ejemplo; falta confirmar cuántas hay en el local.
5. ~~Forma de pago.~~ **Decidido:** se registra: Efectivo, Transferencia o Tarjeta.
6. ~~Cuándo cuenta como venta.~~ **Decidido:** cuando se registra el pago.
7. **Inventario cuantitativo.** Se definirá después; por ahora solo disponible / no disponible.
8. **Usuarios reales y menú real.** Hoy hay usuarios de prueba y un menú de ejemplo.
9. **Nombre del repositorio y cuenta de GitHub** para publicar.
