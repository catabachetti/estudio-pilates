@AGENTS.md

## Contexto del proyecto

Proyecto final de Programación Web (ITBA). Entrega: 12 de noviembre de 2026.

Stack obligatorio: Next.js (App Router), Supabase, Mercado Pago sandbox, Vercel.

## Reglas

- Trabajar siempre en ramas, nunca commitear directo a main.
- Explicar los cambios antes de aplicarlos. Soy principiante.
- Server Components por defecto. Solo usar 'use client' donde haya
  interactividad real (useState, onClick, useEffect).
- HTML semántico y accesible: labels asociados, alt en imágenes,
  jerarquía de encabezados correcta.
- Next 16: `params` es una Promise, se usa con await.

## Deuda conocida

- La grilla de `/paquetes` (`.paquetes-grilla-pagina` en `app/globals.css`) está
  calculada para exactamente cinco paquetes: usa `nth-child(4)` y `nth-child(5)`
  para centrar la última fila. Hoy los paquetes son un array fijo en
  `app/datos/contenido.js`. Cuando pasen a venir de Supabase, la cantidad deja de
  ser conocida de antemano y esta regla deja de ser válida: hay que reemplazarla
  por una distribución que no dependa de la posición de cada tarjeta.
