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
- Una fuente por dato, no una aparición por dato. Cada hecho del negocio
  (horarios, dirección, cupo máximo, duración, política de cancelación) se
  escribe una sola vez en `app/datos/` y las páginas lo leen de ahí. Que ese
  dato después se vea en dos lugares de la pantalla no es un problema: el
  footer con dirección y horario es una convención, y quien entra a /contacto
  espera encontrarlos ahí sin bajar al pie. Lo que no puede repetirse es el
  valor escrito a mano en dos archivos, porque se desincroniza.

## Deuda conocida

- La compensación óptica de los títulos (`--compensacion` en `app/globals.css`)
  depende de la **primera letra** del título, no de la página. El valor por
  defecto (0.07em) sirve para las letras de asta recta (N, P, R, H, E). Hoy hay
  dos overrides: `/contacto` porque empieza con C y `/terminos` porque empieza
  con T. Si esos títulos cambian de nombre, el valor queda mal y nada lo avisa:
  hay que volver a medir el borde visible del primer carácter.

- La grilla de `/paquetes` (`.paquetes-grilla-pagina` en `app/globals.css`) está
  calculada para exactamente cinco paquetes: usa `nth-child(4)` y `nth-child(5)`
  para centrar la última fila. Hoy los paquetes son un array fijo en
  `app/datos/contenido.js`. Cuando pasen a venir de Supabase, la cantidad deja de
  ser conocida de antemano y esta regla deja de ser válida: hay que reemplazarla
  por una distribución que no dependa de la posición de cada tarjeta.
