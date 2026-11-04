# Estudio Pilates

[![ci](https://github.com/catabachetti/estudio-pilates/actions/workflows/ci.yml/badge.svg)](https://github.com/catabachetti/estudio-pilates/actions/workflows/ci.yml)

Proyecto final de Programación Web (71.38) — ITBA.
Aplicación web para la gestión de reservas de clases de pilates reformer.

## Demo: https://estudio-pilates-theta.vercel.app

## Descripción

Los usuarios compran paquetes de clases, que se acreditan en su cuenta,
y los usan para reservar turnos de la grilla semanal.

Si una clase está completa, la grilla ofrece **anotarse en la lista de espera
por WhatsApp**, y el estudio avisa cuando se libera un lugar. No hay promoción
automática: la tabla `lista_espera` existe con sus políticas pero ninguna
pantalla le escribe todavía. Esta descripción decía lo contrario hasta el
módulo 14.

## Stack

- Next.js 16 con App Router (frontend y API interna)
- Supabase (base de datos y autenticación)
- Mercado Pago (checkout en modo sandbox)
- Vercel (despliegue continuo)

## Arquitectura

El proyecto usa el App Router de Next.js: cada carpeta dentro de `app/`
es una ruta, y el archivo `page.jsx` que contiene es lo que la hace
navegable.

Los componentes son Server Components por defecto. Se renderizan en el
servidor y no envían JavaScript al cliente.

**Hay una sola directiva `'use client'` en todo el proyecto**, y es el medidor
de fortaleza de contraseña (`app/components/CampoDeContrasena.jsx`). Todo el
resto —incluidos los formularios de reserva, de ingreso y del panel— son
formularios HTML nativos que hacen POST a Server Actions.

La consecuencia concreta: **el sitio funciona con JavaScript desactivado**, y
eso está probado en los tres motores de navegador en
`e2e/sin-javascript.spec.js`, incluida una reserva completa con su cancelación.
El HTML llega armado desde el servidor, que además es lo que conviene para SEO
y para la primera carga.

Esa decisión es también la diferencia con lo que enseña el módulo de React: no
hay `useEffect`, no hay componentes controlados y `useState` aparece una sola
vez. **Dónde vive el estado que estaría en `useState`, y qué se pierde con esta
decisión, está en [docs/arquitectura.md](docs/arquitectura.md).**

## Modelo de datos

| Tabla | Campos |
|---|---|
| `profiles` | id, nombre, email, rol |
| `paquetes` | id, nombre, cantidad_clases, precio, dias_vigencia |
| `compras` | id, usuario_id, paquete_id, monto, estado, mp_payment_id |
| `creditos` | id, usuario_id, disponibles, vence_el |
| `clases` | id, tipo, fecha, hora, instructor, cupo_total, cupo_disponible |
| `reservas` | id, usuario_id, clase_id, estado |
| `lista_espera` | id, usuario_id, clase_id, posicion |

## Reglas de negocio

- Los créditos vencen según el paquete comprado. Se consume primero el
  crédito que vence antes.
- Una clase no admite más reservas que su cupo.
- Se puede cancelar hasta 6 horas antes y se recupera el crédito.
  Después de esa ventana, el crédito se pierde.
- Al cancelar, el primero de la lista de espera toma el lugar liberado.

## Estado del proyecto

| | Entregable | Dónde está documentado |
|---|---|---|
| [x] | Repositorio y control de versiones | |
| [x] | E1 — CI/CD y preview por PR | [docs/despliegue.md](docs/despliegue.md) |
| [x] | E2 — Landing semántica y responsive | |
| [x] | E3 — Formularios dinámicos con validación y `fetch` | [docs/arquitectura.md](docs/arquitectura.md) |
| [x] | E4 — Catálogo navegable y API interna | [docs/api.md](docs/api.md) |
| [x] | E5 — CRUD en Supabase y panel de administración | [docs/seguridad.md](docs/seguridad.md) |
| [x] | E6 — Checkout y webhook de Mercado Pago | [docs/api.md](docs/api.md) |

Una aclaración sobre E3, porque el proyecto hace las dos cosas: **el formulario
de contacto usa `fetch`** y muestra los tres estados de la petición, y **los
demás usan Server Actions**, que es lo que hace que el sitio funcione con
JavaScript desactivado — probado en los tres motores de navegador, ver
[docs/pruebas.md](docs/pruebas.md).

El de contacto también funciona sin JavaScript, y eso no es un detalle: su
`<form>` lleva un `action` de respaldo, y **ese respaldo es la condición** que
hace admisible que sea uno de los dos únicos componentes de cliente del
proyecto. El razonamiento completo está en
[docs/arquitectura.md](docs/arquitectura.md) §5.

## Desarrollo local

```bash
npm install
npm run dev          # http://localhost:3000
```

Hacen falta las claves en `.env.local`, que está ignorado por git. Las que usa
el sitio están listadas en [docs/despliegue.md](docs/despliegue.md) §5.

```bash
npm test             # lint y las tres pruebas de nodo: lo mismo que el CI
npm run test:e2e     # las 76 pruebas de Playwright, en tres navegadores
zsh supabase/validar-local.sh    # el esquema, RLS y el seed en un Postgres descartable
```

## Estructura del repositorio

```
/app                 rutas y componentes (App Router)
/public              archivos estáticos
/docs                documentación, arneses de prueba y registro de prompts
/e2e                 las pruebas de Playwright
/supabase            migraciones, seed y los siete arneses de base de datos
/.github/workflows   el pipeline de integración continua
```
