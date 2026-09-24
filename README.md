# Estudio Pilates

Proyecto final de Programación Web (71.38) — ITBA.
Aplicación web para la gestión de reservas de clases de pilates reformer.

## Demo: https://estudio-pilates-theta.vercel.app

## Descripción

Los usuarios compran paquetes de clases, que se acreditan en su cuenta,
y los usan para reservar turnos de la grilla semanal. Si una clase está
completa, pueden anotarse en lista de espera y entran automáticamente
cuando alguien cancela.

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
servidor y no envían JavaScript al cliente. La landing y el catálogo
funcionan así.

La directiva `'use client'` se usa solo donde hay interactividad real:
el formulario de reserva, el buscador y el carrito.

La ventaja concreta es que el HTML llega ya armado desde el servidor,
lo que mejora el SEO y la velocidad de la primera carga.

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

- [x] Repositorio y control de versiones
- [x] E1 — CI/CD y preview por PR
- [ ] E2 — Landing semántica y responsive
- [ ] E3 — Formularios dinámicos con fetch y validación
- [ ] E4 — Catálogo navegable y API interna
- [ ] E5 — CRUD en Supabase y panel de administración
- [ ] E6 — Checkout y webhook de Mercado Pago

## Desarrollo local

```bash
npm install
npm run dev
```

El servidor queda en http://localhost:3000

## Estructura del repositorio

```
/app          rutas y componentes (App Router)
/public       archivos estáticos
/docs         documentación y registro de prompts
```
