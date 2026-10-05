# Registro de prompts

Bitácora de uso de IA durante el desarrollo. Incluye los prompts usados,
los resultados, los fallos detectados y las correcciones aplicadas.

---

## 2026-09-18 — Punto de partida

Configuración de git, creación del repositorio en GitHub y definición
del modelo de datos. Sin uso de IA para generación de código todavía.

**Decisión propia:** elegir un modelo de créditos (paquetes de N clases)
en lugar de un carrito de compras tradicional, porque separa la
transacción (compra) de la operación (reserva) y le da un rol real al
webhook: acreditar clases cuando el pago se confirma.

---

## 2026-09-24 — Migración de Vite a Next.js

**Prompt:** migrar el proyecto de Vite a Next.js 16 con App Router: desinstalar
Vite, crear `app/` con layout raíz y metadata, y actualizar los scripts de
`package.json`.

**Resultado:** se eliminaron `vite.config.js`, `index.html` y `src/`. Se creó
`app/` con `layout.jsx`, `page.jsx` y `globals.css`. El build quedó en 1,7 s y
la home como `○ (Static)`.

**Fallo detectado:** al sumar las fuentes con `next/font/google`, el build
abortó con 21 errores de Turbopack:

```
Error: Module not found: Can't resolve
'@vercel/turbopack-next/internal/font/google/font'
next/font/google queries have exactly one entry
Import trace: ./app/layout.jsx
```

**Cómo se detectó:** `npm run build`. En `npm run dev` no aparecía.

**Causa:** las dos fuentes se declararon con `weight: ['300', '400', '500']`.
Inter y Cormorant Garamond son fuentes variables, y la documentación de Next 16
(`node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`)
indica que el array de pesos es para fuentes que no son variables. Next generaba
un `@font-face` por cada combinación de peso y subconjunto de caracteres, y el
cargador de Turbopack acepta una sola.

**Corrección:** se eliminaron las dos líneas `weight`. Build: `✓ Compiled
successfully in 631ms`.

**Predicción:**

**Aprendizaje:**

---

## 2026-10-02 — Landing con imágenes

**Prompt:** armar la landing con hero, tipos de clase, paquetes y cómo funciona;
después montar ocho fotografías con `next/image` y sumar un efecto de
movimiento al scrollear sin JavaScript.

**Resultado:** ocho componentes nuevos, todos Server Components, y las ocho
rutas internas. El efecto de scroll se resolvió con `animation-timeline: view()`
dentro de `@supports` y `prefers-reduced-motion: no-preference`.

### Fallo 1: desborde horizontal reportado que no existía

El asistente informó desborde a 420px a partir de capturas tomadas con
`chrome --headless --window-size=420,900`. Ese modo no aplica el ancho de
ventana al layout: maqueta a un ancho por defecto y recorta la imagen. La
medición real con `Emulation.setDeviceMetricsOverride` del protocolo de Chrome
dio `scrollWidth === innerWidth` en 320, 375, 420, 560, 768, 1024 y 1280px, y
también con el arreglo deshabilitado, o sea que el problema nunca existió.

### Fallo 2: espacio perdido al ocultar un `<br>`

Se ocultó el salto de línea del título con `display: none` en celular. El título
pasó a leerse "consciente,cuerpo presente", sin espacio, porque el JSX no tenía
ninguno alrededor de la etiqueta. Corregido con `{' '}`.

### Fallo 3: 145 MB de imágenes

Las ocho fotos llegaron en PNG de 5504 × 3072, entre 17,3 y 18,7 MB cada una.
Convertidas a JPG de 2000px de ancho y calidad 80 quedaron entre 284 y 430 KB.
Total: de 145 MB a 2,8 MB.

### Fallo 4: la medición de contraste leía el header, no la foto

El primer informe de contraste sobre los paneles dio `1,00:1`, que es el valor
exacto de dos colores idénticos. La causa era el método: el header es pegajoso y
quedaba por encima de las cajas de texto medidas, así que se comparaba el texto
contra el crema del header. Corregido centrando cada bloque en pantalla antes de
medir y descartando los tapados.

### Fallo 5: texto ilegible sobre la foto del hero

Con la medición ya corregida, el peor píxel del título del hero dio **1,80:1 en
escritorio y 1,74:1 en celular**, contra el mínimo de 4,5:1 de WCAG AA. Las
letras caían sobre las cortinas claras de la fotografía. Se reforzó el degradado
dos veces, con un degradado propio para celular. Resultado final: 8,31:1 en
escritorio y 10,30:1 en celular. El peor de los catorce bloques de texto sobre
foto quedó en 6,75:1.

### Fallo 6: el efecto de scroll dejaba huecos

El efecto se implementó agrandando la imagen con `height: 124%` y `top: -12%`.
No funcionaba. La inspección del DOM mostró por qué:

```
styleAttr: "position:absolute;height:100%;width:100%;left:0;top:0;right:0;bottom:0"
altoContenedor: 320   altoImagen: 320
```

`next/image` con `fill` escribe esas propiedades como estilos en línea, y los
estilos en línea tienen más prioridad que una hoja de estilos. La imagen quedaba
del tamaño exacto del contenedor y la animación la corría fuera, dejando huecos
de hasta 22px. Corregido moviendo el agrandado al `transform`, que es la única
propiedad que `next/image` no escribe en línea. Medición recorriendo la página
cada 100px: peor borde -26px en escritorio y -18px en celular, o sea que la
imagen siempre sobra.

### Fallo 7: 26 selectores CSS duplicados

`globals.css` llegó a 1070 líneas con 26 selectores declarados dos veces
(`.hero`, `.panel`, `.franja` y 23 más), por capas agregadas en tandas
sucesivas. Se reescribió completo: 760 líneas sin duplicados.

### Fallo 8: salto de nivel en los encabezados

Tres rutas (`/clases/flow`, `/horarios`, `/preguntas`) saltaban de `h1` a `h3`:
no tenían ningún `h2` propio y el primer encabezado posterior era el `h3` del
pie de página. Corregido subiendo los títulos del footer a `h2`.

### Fallo 9: "1 disponibles"

La tabla de horarios mostraba `${turno.cupos} disponibles` sin contemplar el
singular. El turno de las 8:00 decía "1 disponibles". Corregido distinguiendo
los tres casos: sin cupo, un lugar, varios lugares.

### Fallo 10: teléfono de relleno válido

El sitio usaba `+54 11 2233 4455`, que es un número de celular perfectamente
válido de Buenos Aires y puede pertenecer a una persona real. Reemplazado por
`+54 11 0000 0000`, que no existe.

**Predicción:**

**Aprendizaje:**

---

## 2026-10-04 — Limpieza visual y calendario de reservas

**Prompt:** eliminar rótulos duplicados y líneas separadoras decorativas;
después separar `/horarios` de `/reservar` y construir un calendario con todo el
estado en la URL, sin JavaScript de cliente.

**Resultado:** `/horarios` quedó informativa, con la semana tipo y sin cupos.
`/reservar` muestra un calendario mensual y las clases del día elegido, con los
cupos generados por una función determinista. Ningún `'use client'` en todo
`app/`.

### Fallo 11: rótulos que repetían el título

Tres secciones tenían un rótulo pequeño en mayúsculas inmediatamente arriba de
su encabezado, con el mismo texto: "El estudio" sobre `<h1>El estudio`,
"Contacto" sobre `<h1>Contacto` y "Clases" sobre `<h1>Nuestras clases`. Un
lector de pantalla leía el mismo texto dos veces seguidas. Se eliminaron los
tres y la clase CSS que quedó sin uso.

También se eliminaron cinco líneas separadoras decorativas, reemplazadas por
espacio con un token único (`--aire: 72px`) para que la separación sea igual en
todos los casos.

### Fallo 12: tarjeta huérfana en /paquetes

Las cinco tarjetas de paquetes quedaban 4 + 1, con la última sola en la segunda
fila. Se cambió a 3 + 2 centradas, con una grilla de seis columnas donde cada
tarjeta ocupa dos. Verificado con `getBoundingClientRect()`: los centros de
ambas filas coinciden (640 y 640 a 1280px) y ninguna tarjeta parte su nombre ni
su precio en ningún ancho.

Al medirlo apareció el mismo problema un escalón más abajo: a 900 y 768px, con
dos columnas, la quinta tarjeta quedaba sola a la izquierda (centros 450, 450 y
232). Corregido con el mismo método.

### Deuda registrada: la grilla asume cinco paquetes

La solución usa `nth-child(4)` y `nth-child(5)`, así que depende de que los
paquetes sean exactamente cinco. Hoy son un array fijo. Queda documentado en un
comentario en `globals.css` y en la sección "Deuda conocida" de `CLAUDE.md`:
cuando los paquetes vengan de Supabase, la regla deja de ser válida.

### Fallo 13: conteo equivocado en la verificación, no en la página

Al verificar el calendario, el asistente informó "24 enlaces de día" cuando el
HTML tiene 48. **El error estaba en el script de medición, no en la página:** la
expresión regular contaba cada fecha una sola vez, y Next incluye cada enlace
dos veces, una en el HTML y otra en el payload que usa para navegar. Los días
distintos sí son 24.

La diferencia con los 27 días del 5 al 31 de octubre son los tres domingos (11,
18 y 25), que quedan sin enlace porque el estudio no abre.

### Corrección menor

El `<caption>` de la tabla del día repetía casi textual el `<h2>` que tenía
encima ("miércoles 14 de octubre" y "Clases del miércoles 14 de octubre"),
el mismo problema de duplicación corregido horas antes. Cambiado por "Turnos y
disponibilidad".

### Advertencia antes del commit

Para probar que los mensajes de WhatsApp llegaran, se cargó el número personal
real en el sitio. Antes de commitear, el asistente advirtió que ese número
quedaría en el repositorio público, en el historial de git de forma permanente y
en el HTML de la demo. Se revirtió al número imposible y se verificó con `grep`,
sobre cinco variantes del número y sobre el contenido ya preparado para
commitear, que no quedara ninguna ocurrencia.

**Predicción:**

**Aprendizaje:**

---

## Plantilla

### AAAA-MM-DD — Título

**Prompt:**

**Resultado:**

**Fallo detectado:**

**Cómo lo detecté:**

**Corrección aplicada:**