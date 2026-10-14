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

## 2026-09-18 — Vite sobrescribió el README

**Qué pasó:** Al correr `npm create vite@latest .` sobre la carpeta del
repo, elegí "Ignore files and continue" para conservar los archivos
existentes. La plantilla de React igual reemplazó el README.md por el suyo.

**Cómo lo detecté:** `git status` mostraba `modified: README.md` cuando yo
no había tocado ese archivo.

**Corrección:** `git restore README.md` para recuperar la versión del
último commit. El .gitignore que generó Vite sí lo conservé, porque
incluye node_modules, dist y los archivos .env.

**Aprendizaje:** "Ignore files" no garantiza que no se pisen archivos.
Conviene commitear antes de correr cualquier scaffolding, justamente para
poder revertir.

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

## 2026-10-13 — Panel de administración: protección y paquetes

**Prompt:** Panel de administración con `/admin` protegido solo para `rol =
'admin'`, distinguiendo 401 de 403; CRUD de paquetes; sin `'use client'`, todo
con Server Actions; validación en el servidor; `revalidatePath` después de cada
cambio; y sin usar la clave secreta de Supabase.

### Hallazgo 1: la tabla de créditos no tenía política de INSERT

Antes de escribir la pantalla de créditos se revisaron las políticas de RLS de
`003-politicas.sql`. `creditos` tiene una sola política, de SELECT. Con RLS
activa eso significa que **nadie** puede insertar créditos con la clave
publishable, ni siquiera una cuenta con `rol = 'admin'`. `compras` sí tiene
INSERT, pero con `with check (user_id = auth.uid())`: permite comprar para uno
mismo, no acreditarle un paquete a otra persona. Y `perfiles` no tiene columna
de correo, así que "buscar una persona por mail" tampoco era posible: los mails
viven en `auth.users`.

La pantalla de créditos se habría escrito completa y habría fallado recién al
apretar el botón, con un error de permisos difícil de interpretar.

**Cómo se detectó:** leyendo las políticas antes de escribir la página, no
después. La salida de `grep` sobre `003-politicas.sql` muestra tres políticas
para `compras` y `reservas` y una sola para `creditos`.

**Decisión:** no se usa la clave secreta. La solución son funciones
`security definer` que verifican `es_admin()` adentro, el mismo patrón que ya
usan `es_admin()` y `lugares_disponibles()`. La clave secreta saltea RLS por
completo: si se filtra desde el servidor, expone todo. Una función hace una sola
cosa y se puede auditar. Queda para la migración que acompañe esa pantalla.

### Hallazgo 2: la verificación de rol no va en el layout

El plan aprobado decía que la verificación autoritativa de `rol = 'admin'` iba
en `app/admin/layout.jsx`. La documentación de la versión instalada de Next
(`node_modules/next/dist/docs/01-app/02-guides/authentication.md`, sección
"Layouts and auth checks") dice que no, con tres razones:

1. Un layout no se vuelve a renderizar al navegar entre páginas que lo
   comparten, así que la sesión no se revisa en cada cambio de ruta.
2. Un layout no decide si el resto de la ruta se renderiza: los segmentos los
   renderiza el router por su cuenta.
3. Las Server Actions no pasan por ningún layout. Tienen su propia entrada.

La tercera es la decisiva: `/admin/paquetes` edita precios con una Server
Action, y con la verificación solo en el layout, esa acción se podía invocar
directo. La misma página cita textual la recomendación de poner los controles
"as close as possible to your data source".

**Corrección aplicada:** la verificación vive en `app/lib/autorizacion.js` y la
llaman todas las páginas y todas las acciones. El layout solo decide si dibuja
el menú, que es decoración. El proxy quedó con una verificación optimista —solo
si hay sesión, sin consultar la base— porque la misma documentación pide no
consultar la base ahí: el proxy corre también en los pedidos que Next hace por
adelantado al pasar el mouse por un enlace.

### Hallazgo 3: el parámetro de retorno era una redirección abierta

Para que `/admin/clases` devuelva a `/admin/clases` después de entrar, el proxy
manda a `/ingresar?volver=/admin/clases`. Ese parámetro viaja en la URL, así que
lo escribe cualquiera. Sin validar, `/ingresar?volver=https://sitio-falso.com`
usa el login del estudio como trampolín: la persona ve el dominio real, escribe
su contraseña y el sitio la deposita en una copia que se los pide otra vez.

**Corrección aplicada:** `rutaInterna()` en `app/lib/rutas.js`. Exige que
empiece con una sola barra y rechaza `//sitio`, `/\sitio`, las barras
invertidas y los espacios en cualquier posición, y borra los caracteres de
control que los navegadores descartan antes de interpretar una URL. Se valida
en los dos lados: al dibujar el formulario, para que el valor hostil no llegue
nunca al HTML, y al recibirlo en la acción, que es la única validación que
cuenta.

### Hallazgo 4: una escritura rechazada por RLS no devuelve error

Una escritura que RLS rechaza **no devuelve error: devuelve que no modificó
ninguna fila**, porque para la política esa fila no existe. Sin pedir de vuelta
lo actualizado, un rechazo de permisos se ve exactamente igual que un guardado
exitoso.

**Corrección aplicada:** las dos escrituras del panel terminan en
`.select('id')` y, si vuelve vacío, redirigen con `?error=permiso`.

Esto después resultó ser la señal que hizo medible la contraprueba del layout,
porque permite distinguir "la acción no corrió" de "la acción corrió y la base
la frenó".

**Comprobado en vivo**, con el token de la cuenta de cliente contra la API de
Supabase, salteando la aplicación entera. Dos protecciones distintas, dos
señales de falla opuestas:

| intento                            | mecanismo que lo frena      | respuesta             |
| ---------------------------------- | --------------------------- | --------------------- |
| ponerse `rol = 'admin'` a sí misma | `revoke update` en la tabla | **403** `42501`       |
| editar el precio de un paquete     | política de RLS             | **200** y cuerpo `[]` |

El segundo caso es el peligroso: la base contesta *éxito* con cero filas. Nada
en esa respuesta dice "no tenías permiso". Por eso `.select()` no es una
formalidad.

### Verificación: el agujero abierto y cerrado

Una verificación que nunca falló no demuestra nada. Las dos columnas son el
mismo pedido POST, con la misma sesión de cliente, al mismo identificador de
Server Action, replicando lo que manda el formulario sin JavaScript
(`multipart/form-data` con el campo `$ACTION_ID_...`, sacado de
`.next/dev/server/server-reference-manifest.json`).

|                                   | verificación en el DAL | verificación solo en el layout |
| --------------------------------- | ---------------------- | ------------------------------ |
| GET `/admin/paquetes`             | "Sin permiso", 200     | "Sin permiso", 200             |
| POST de `editarPaquete`           | **500, cortado**       | **303 → `?error=permiso`**     |
| precio en la base (antes/después) | 64000 / 64000          | 64000 / 64000                  |

La fila del medio es el hallazgo. Con la verificación solo en el layout, la
página se protege igual —la pantalla dice "Sin permiso" y no dibuja el
formulario— y **la acción de abajo corre completa**: parsea el formulario,
valida, arma el cliente de Supabase y le manda el UPDATE a Postgres. El 303 a
`?error=permiso` solo es alcanzable *después* de que la base contesta, así que
es la prueba de que el cuerpo de la acción se ejecutó.

El precio no cambió en ninguna de las dos columnas, y eso es exactamente lo que
hay que leer con cuidado: en la segunda, lo único que lo salvó fue RLS. La
autorización dejó de estar en la puerta y pasó a depender enteramente de que la
política de la base esté bien escrita. Un layout protege lo que se ve y no hace
nada por lo que se puede hacer.

### Nota sobre los códigos de estado

El rechazo de la acción devuelve **500, no 403**, porque `exigirAdmin()` corta
con un `throw` y no hay forma de fijar el código desde una Server Action sin
`forbidden()`, que es experimental. El comportamiento es el correcto —no se
escribe nada— pero el código HTTP dice "el servidor se rompió" donde pasó "no
tenés permiso". Queda anotado como deuda, no como prueba pasada.

### Efecto lateral: la grilla de cinco paquetes

Sacar el mes libre dejó cuatro paquetes y activó la deuda que estaba anotada en
`CLAUDE.md`: `.paquetes-grilla-pagina` centraba la última fila con
`nth-child(4)` y `nth-child(5)`, calculado para exactamente cinco. Con cuatro,
esa regla dejaba la cuarta tarjeta sola y corrida. Reemplazada por cuatro
columnas que bajan a dos y a una, sin reglas por posición. La grilla de la home
tenía `repeat(5, 1fr)` fijo y pasó a `auto-fit`.

### Hallazgo 5, y la corrección que lo dio vuelta

Al revisar si `revalidatePath` hacía falta de verdad apareció que
`app/page.jsx` no declara `revalidate`, y que `.next/cache/fetch-cache` guarda
después de un build la consulta de `/paquetes` con `revalidate: 3600` y la de
la home con `31536000`, un año. De ahí se concluyó que sin `revalidatePath('/')`
un precio editado no aparecería nunca en la home.

**Esa conclusión era falsa, y lo demostró la contraprueba.** Se sacó el
`revalidatePath('/', 'layout')` de la acción de clases, se recompiló, se sirvió
con `next start` y se reactivó una clase: el pie de página se actualizó igual.
Para descartar que algo más estuviera revalidando, se hizo la prueba decisiva —
escribir **directo en la base**, sin pasar por Next:

| escritura directa en la base | lo que mostró la página siguiente |
| ---------------------------- | --------------------------------- |
| cancelar una clase de 21:00  | el pie pasó de "7:00 a 22:00" a "7:00 a 21:00" |
| cambiar un precio a 64999    | `/paquetes` mostró $ 64.999       |

Sin que nadie llamara a `revalidatePath`. O sea que **no hay caché de datos que
invalidar**: todas las rutas son dinámicas porque el header lee cookies, y las
lecturas de Supabase se hacen en cada pedido. El `revalidate = 3600` de
`/paquetes` tampoco alcanza a esas lecturas.

**El error de método:** las entradas de `.next/cache/fetch-cache` las escribe el
*build*, no el servidor en caliente. Verlas ahí no prueba que la página se sirva
desde ahí. Se tomó un artefacto de compilación como evidencia del
comportamiento en ejecución.

Las llamadas a `revalidatePath` quedaron igual —limpian el Router Cache del
navegador, y son la línea que va a hacer falta el día que algo se cachee de
verdad— pero con el comentario corregido en los dos archivos de acciones, para
que nadie vuelva a leer ahí una garantía que hoy no existe.

**Predicción:**

**Aprendizaje:**

---

## 2026-10-13 — Panel: la agenda de clases

**Prompt:** `/admin/clases` con listado por fecha, alta, edición de tipo,
instructora y cupo, cancelación que no borre, y reactivación. Más la deuda de
`incluye` y `orden` de paquetes, que habían quedado sin interfaz.

### Hallazgo: cancelar una clase cambia el pie de página de todo el sitio

El pedido decía revalidar `/reservar` y `/horarios`, y preguntaba si la home
también. Buscando quién lee la tabla `clases` aparecieron cuatro lectores, y el
cuarto no estaba en la lista: `Footer.jsx` llama a `horariosDeAtencion()`, que
deriva el horario de atención de la grilla de clases. El footer vive en el
layout raíz, o sea en **todas** las páginas.

Cancelar la última clase de las 7 de un día corre el horario de apertura, y eso
se ve en el pie de `/contacto`, de `/terminos` y del resto. Revalidar solo las
dos páginas de la agenda habría dejado un horario viejo en todo lo demás.

**Corrección aplicada:** las acciones de clases usan
`revalidatePath('/', 'layout')`, que invalida el layout raíz y todo lo que
cuelga de él.

**Cómo se detectó:** haciendo `grep` de `from('clases')` y de las funciones que
la envuelven antes de escribir las acciones, en vez de confiar en la lista del
enunciado.

### Decisión: el unique (fecha, hora) se deja como está

Una clase cancelada sigue ocupando su horario, así que no se puede crear otra
distinta ese día a esa hora: hay que reactivar esa. Es la opción correcta
porque esa fila tiene reservas colgando, y dos clases a la misma hora dejaría a
esas personas sin saber a cuál van. Queda anotado en `CLAUDE.md` porque
sorprende a quien no lo sepa, y el mensaje de error lo dice en castellano en
vez de mostrar el `23505` de Postgres.

### Deuda registrada: la carrera del cupo

Rechazar un cupo menor a las reservas ya tomadas se hace leyendo la cuenta y
escribiendo después, en dos viajes. Entre uno y otro alguien podría reservar.
Con seis lugares y una sola persona administrando, la ventana es teórica.

Lo que importa es lo que viene: **la misma carrera, en las reservas, sí
importa** —dos personas tomando el último lugar al mismo tiempo— y ahí la
verificación y la escritura tienen que ir en una sola sentencia desde el
principio.

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