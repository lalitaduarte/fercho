# Hamburguesas y Pinchos Fercho

Aplicación web para gestionar el menú, los pedidos, la cocina y las ventas de
Hamburguesas y Pinchos Fercho.

**Equipo 1** · Unidades Tecnológicas de Santander
Grupo D194 (Motores de Base de Datos) · Grupo B194 (Planeación de Sistemas Informáticos)

## Funciones

- Menú público con categorías, precios y disponibilidad.
- Ingreso del personal con tres roles: administrador, mesero y cocina.
- Registro de pedidos con mesa opcional, cantidades y notas para cocina.
- Pantalla de cocina que se actualiza sola y permite cambiar el estado de los pedidos.
- Registro del pago y consulta de ventas por rango de fechas.
- Administración de productos y control de disponibilidad.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Base de datos | PostgreSQL (17 en local, Neon en la nube) |
| Backend | Node.js 22 + Express |
| Frontend | HTML, CSS y JavaScript, adaptable a celulares |

## Estructura

```
database/   Scripts SQL comentados (ejecutar en orden)
src/        Backend: servidor, rutas de la API y seguridad
public/     Frontend: páginas, estilos y JavaScript del navegador
scripts/    Prueba automática de la API
PLAN.md     Etapas del desarrollo y decisiones
```

## Instalación local

1. Crear la base de datos con `database/00_crear_base_datos.sql` (conectado a `postgres`).
2. Ejecutar sobre `fercho_db`, en orden, los scripts `01` a `05` de `database/`.
3. Copiar `.env.example` como `.env` y escribir los datos de conexión.
4. Instalar las dependencias: `npm install`
5. Iniciar el servidor: `npm run dev` y abrir http://localhost:3000

> En Windows PowerShell, si aparece "la ejecución de scripts está deshabilitada",
> use `npm.cmd` en lugar de `npm`.

## Pruebas

- `database/06_pruebas.sql`: reglas de la base de datos. Deshace todo con ROLLBACK.
- `npm run probar`: recorrido completo de la API con los tres roles. Borra sus datos al terminar.

## Variables de entorno en producción

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión de PostgreSQL en la nube |
| `JWT_SECRET` | Clave larga y aleatoria para firmar las sesiones |
| `NODE_ENV` | `production` |
