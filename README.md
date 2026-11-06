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

Las directivas `'use client'` son **la excepción, y cada una tiene que
demostrar por qué no se puede sin ella**. Están enumeradas una por una, con su
argumento y su medición, en [docs/arquitectura.md](docs/arquitectura.md) §5.
Todo el resto —incluidos los formularios de reserva, de ingreso y del panel—
son formularios HTML nativos que hacen POST a Server Actions.

La consecuencia concreta: **el sitio funciona con JavaScript desactivado**, y
eso está probado en los tres motores de navegador en
`e2e/sin-javascript.spec.js`, incluida una reserva completa con su cancelación.
El HTML llega armado desde el servidor, que además es lo que conviene para SEO
y para la primera carga.

Esa decisión es también la diferencia con lo que enseña el módulo de React: el
estado de la interfaz no vive en el cliente. **Dónde vive en su lugar —la URL,
la base de datos y la cookie de sesión—, qué se pierde con esa decisión, y los
números con el comando que los verifica, están en
[docs/arquitectura.md](docs/arquitectura.md).**

## Modelo de datos

Agrupadas por para qué sirven, **una línea por tabla**. Las columnas completas
están en `supabase/migraciones/`, que es el único lugar donde no pueden quedar
desactualizadas: ahí son el esquema, no una descripción del esquema.

La lista de tablas sale del esquema y no de la memoria de nadie:

```bash
grep -hoE '^create table [a-z_]+' supabase/migraciones/*.sql \
  | sed 's/create table //' | sort
```

**Catálogo** — lo que el estudio ofrece. El sitio público solo lo lee; se edita
desde el panel.

| Tabla | Qué guarda |
|---|---|
| `tipos_clase` | Las clases que existen: nombre, descripción, nivel, requisito, duración y su foto |
| `paquetes` | Los paquetes en venta: cuántas clases incluyen, precio y días de vigencia |
| `instructoras` | Quiénes dan clase: nombre, bio y foto |

**Agenda** — qué se dicta y quién viene.

| Tabla | Qué guarda |
|---|---|
| `clases` | Una clase concreta: fecha, hora, tipo, instructora, cupo y estado. Única por (fecha, hora) |
| `reservas` | Quién tomó qué clase, con qué crédito, y si está confirmada o cancelada |
| `lista_espera` | Quién quiere entrar a una clase completa. **Existe y ninguna pantalla le escribe todavía** |

**Personas**

| Tabla | Qué guarda |
|---|---|
| `perfiles` | Nombre, teléfono y rol. Se crea sola al registrarse; el correo vive en `auth.users`, no acá |
| `intentos_ingreso` | Los intentos fallidos por (correo, IP), que son los que imponen el bloqueo progresivo |

**Pagos**

| Tabla | Qué guarda |
|---|---|
| `intenciones_de_pago` | A quién y qué paquete, anotado **antes** de pagar: es a lo que apunta la `external_reference` |
| `compras` | Un pago acreditado. El `mp_payment_id` es único, y eso es lo que da la idempotencia |
| `creditos` | **Una fila por crédito**, con su vencimiento. No es un contador: un crédito está tomado si una reserva lo referencia |

**Operación**

| Tabla | Qué guarda |
|---|---|
| `ajustes` | Parámetros del negocio en pares clave/valor, como `horas_cancelacion` |
| `mensajes` | Lo que llega por el formulario de contacto |

## Reglas de negocio

- Los créditos vencen según el paquete comprado. Se consume primero el
  crédito que vence antes.
- Una clase no admite más reservas que su cupo.
- Hay una ventana para cancelar sin perder el crédito: cancelando antes, el
  crédito vuelve; después, se pierde. **Cuántas horas no está escrito acá ni en
  el código**: sale de `ajustes.horas_cancelacion`, y el sitio lo muestra leyendo
  ese valor.

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
hace admisible que sea un componente de cliente. El razonamiento completo está
en [docs/arquitectura.md](docs/arquitectura.md) §5.2.

## Desarrollo local

```bash
npm install
npm run dev          # http://localhost:3000
```

Hacen falta las claves en `.env.local`, que está ignorado por git. Las que usa
el sitio están listadas en [docs/despliegue.md](docs/despliegue.md) §5.

```bash
npm test             # lint y las pruebas de nodo: lo mismo que corre el CI
npm run test:e2e     # las pruebas de Playwright, en tres navegadores
zsh supabase/validar-local.sh    # el esquema, RLS y el seed en un Postgres descartable
```

## Estructura del repositorio

```
/app                 rutas y componentes (App Router)
/public              archivos estáticos
/docs                documentación, arneses de prueba y registro de prompts
/e2e                 las pruebas de Playwright
/supabase            migraciones, seed y los arneses de base de datos
/.github/workflows   el pipeline de integración continua
```
