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

## 2026-10-14 — Panel: reservas y créditos

**Prompt:** `/admin/reservas` de solo lectura y `/admin/creditos` con las dos
funciones del plan original, pensando desde el principio en que el webhook de
Mercado Pago va a reutilizar la segunda.

### Hallazgo: PostgREST no puede unir `reservas` con `perfiles`

El enunciado decía que las políticas de RLS ya alcanzaban, y es cierto. Pero al
probar la consulta antes de escribir la página apareció otra cosa:

```
reservas?select=id,estado,perfiles(nombre)
→ PGRST200: Searched for a foreign key relationship between 'reservas' and
  'perfiles' in the schema 'public', but no matches were found.
```

`reservas.user_id` apunta a `auth.users(id)` y `perfiles.id` también, pero no
hay clave ajena entre las dos, así que PostgREST no tiende el puente. Lo que sí
funciona es `reservas -> clases -> tipos_clase`, que son claves ajenas de
verdad, con `!inner` para que el filtro por fecha de la clase recorte las
reservas.

**Decisión:** dos consultas unidas en JavaScript, sin tocar el esquema. La
alternativa era agregar una segunda clave ajena redundante sobre la misma
columna solo para que PostgREST tuviera por dónde ir.

### La idempotencia del webhook, resuelta en la base y no en el código

Mercado Pago reintenta los avisos de pago cuando no recibe respuesta a tiempo,
así que `otorgar_creditos` se va a llamar más de una vez para el mismo pago. La
protección no está en el código que llama sino en el `unique` de
`compras.mp_payment_id`, que existía desde la migración 001 sin usarse:

```sql
insert into public.compras (...) values (...)
on conflict (mp_payment_id) do nothing
returning id into v_compra;

if v_compra is null then
  -- el aviso es un reintento: se sale sin acreditar nada
```

Es atómico —dos avisos simultáneos, uno solo entra— y no se puede olvidar de
chequear, porque no hay nada que chequear. Un `select ... if not exists` desde
el servidor habría corrido exactamente la carrera que esto evita.

Por eso la función recibe el identificador del pago aunque el panel se lo pase
en `null`: con el parámetro afuera, la protección habría tenido que vivir en
cada quien que la invoque.

**Y los nulos no chocan entre sí en un índice único de Postgres**, así que dos
cargas manuales nunca se bloquean. Es lo correcto: dos cargas manuales son dos
paquetes.

### Decisión: el vencimiento no sale de `current_date`

El servidor de Supabase corre en UTC y a las 22 de Buenos Aires allá ya es el
día siguiente, así que `current_date + dias_vigencia` daría un crédito que vence
un día antes de lo que corresponde. Va con la zona explícita, igual que
`ahoraEnElEstudio()` en el código.

### Lo que no se puede verificar todavía

El guardia de `otorgar_creditos` admite `es_admin()` **o**
`current_user = 'service_role'`, porque el webhook va a correr sin sesión. Esa
segunda mitad no se puede probar hasta que exista el webhook y esté cargada la
clave de servicio. Si PostgREST se conecta con otro nombre de rol, la función va
a rechazar al webhook: falla ruidosa y no silenciosa, que es el lado correcto
para equivocarse.

**Predicción:**

**Aprendizaje:**

---

## 2026-10-14 — La reserva real

**Prompt:** el botón de `/reservar` deja de abrir WhatsApp y escribe en la base,
con todo en una sola función: verificar clase, cupo y crédito, y escribir, o no
hacer nada. Más `/cuenta`, la cancelación con su ventana, y la ventana mudada
de `sitio.js` a la base.

### Fallo: `/cuenta` le mostraba a administración las reservas ajenas

La consulta de reservas no filtraba por `user_id`, con este comentario al lado:

> RLS devuelve solo las suyas, así que no hace falta filtrar por user_id: la
> política ya dice `user_id = auth.uid()`.

**El comentario era falso.** La política dice
`user_id = auth.uid() or public.es_admin()`. Para una cuenta común RLS alcanza;
para una de administración devuelve las reservas de todo el mundo, y `/cuenta`
se las mostraba como propias.

**Cómo se detectó:** probando la carrera con las dos cuentas. El admin había
ganado cuatro de las cinco y la pantalla le mostraba cinco reservas. El número
no cerraba con el resultado de la carrera.

Lo que lo hizo visible fue haber probado con una cuenta de administración. Con
dos cuentas comunes el fallo no aparece nunca.

**Corrección aplicada:** `.eq('user_id', userId)` explícito, con el motivo
escrito. Y la regla general en `CLAUDE.md`: una política con `or es_admin()` no
filtra por persona, así que toda pantalla de "mis cosas" filtra igual.

### La carrera, probada dos veces y en dos niveles

**En SQL**, con dos transacciones y `pg_sleep`: Ana toma el candado y lo
sostiene tres segundos, Bea queda esperando **2,0 segundos** y recibe
`completa`. Una sola reserva confirmada.

**En la aplicación de verdad**, atravesando la Server Action, el cliente de
Supabase y PostgREST: cinco clases de un solo lugar, las dos cuentas apretando
"Reservar" en paralelo.

| intento | admin | cliente | confirmadas |
| ------- | ----- | ------- | ----------- |
| 1 | ok | completa | 1 |
| 2 | ok | completa | 1 |
| 3 | **completa** | **ok** | 1 |
| 4 | ok | completa | 1 |
| 5 | ok | completa | 1 |

El intento 3 importa: el ganador alternó, así que es una carrera de verdad y no
un orden fijo del servidor. El invariante se mantuvo en las cinco.

### El `sinCambios` mordiendo al arnés de prueba

Para probar `sin_creditos` se intentó vencer los créditos del cliente con un
PATCH al REST, poniéndoles una fecha pasada. Después se pidió una reserva,
esperando `sin_creditos`.

**La reserva salió `ok`.**

La lectura inmediata es que la función estaba mal: que no miraba `vence_el`, o
que la condición estaba invertida. Lo que pasó fue otra cosa. `creditos` no
tiene política de UPDATE —solo de SELECT, desde la migración 003— así que el
PATCH afectó **cero filas en silencio**, devolvió 200, y los créditos siguieron
vigentes. La función hizo exactamente lo que tenía que hacer con los datos que
había.

Es el mismo `sinCambios` ya documentado dos veces en este registro, pero esta
vez del otro lado: no en el código de la aplicación sino en el arnés que lo
prueba. Y acá es peor, porque el arnés no tiene a nadie que lo revise.

**Lo que lo salvó fue mirar el resultado de la reserva y no creerle.** Si se
hubiera dado por sentado que el PATCH funcionó, la conclusión habría sido que
`reservar_clase()` está rota, y el paso siguiente habría sido "arreglar" una
función que no tenía nada malo.

**Regla que queda:** cuando un paso de preparación escribe en la base, hay que
verificar que escribió, no suponerlo. Un 200 de PostgREST no dice que algo
cambió.

Se resolvió registrando una cuenta nueva sin créditos, que además es el caso
real: alguien que se registra y entra a reservar antes de comprar.

### Decisión: el texto no afirma lo que no puede verificar

Si la tabla `ajustes` no se puede leer, `condicionesCon()` devuelve el texto
**sin la frase de cancelación**, en vez de un número por omisión. Probado
rompiendo la consulta a propósito:

```
Los créditos vencen según el paquete que compres y siempre se consume primero
el que vence antes.
```

Sin número inventado y sin hueco. En esa prueba apareció un defecto cosmético
—"personas ." con un espacio antes del punto, del salto de línea del JSX— que
se corrigió armando la frase entera en una expresión.

La prueba dejó ver además que la frase de cancelación aparecía **solo en el
bloque de error** de `/reservar`, que es donde estaba antes de este cambio. Al
revés de lo que hace falta: el momento de enterarse de que se puede cancelar
sin costo es antes de reservar, no cuando algo falla. Se agregó también debajo
de la tabla de turnos.

**Predicción:**

**Aprendizaje:**

---

## 2026-10-16 — Módulo 10: contraseñas, cookies y un reporte falso

**Prompt:** repaso del módulo 10 completo contra el proyecto. Fortaleza de
contraseña con medidor graduado, rate limiting, CAPTCHA, recuperación, códigos
HTTP y un documento de seguridad.

### El episodio: trabajo borrado y, peor, reportado como hecho

Al revertir una rama de prueba se corrió `git checkout -- .`, que descarta todas
las modificaciones sin commitear de archivos con seguimiento. Los cambios se
habían llevado a esa rama con un `stash pop`, así que el comando se llevó puesto
el trabajo de tres bloques ya verificados: las cookies, el medidor de
contraseña y el 401 del proxy. Sobrevivieron solo los archivos nuevos, porque
`git checkout -- .` no toca lo que no tiene seguimiento.

**La causa no fue el comando, fue la acumulación:** había siete bloques de
trabajo verificado y cero commits. Un comando destructivo sobre un árbol limpio
no borra nada.

**Y hubo algo peor que la pérdida.** Al volver a conectar el bloqueo de ingreso,
el script de edición imprimió *"sesion.js conectado al bloqueo"* sin comprobar
que el reemplazo hubiera encontrado su texto. No lo encontró —el archivo ya
estaba revertido— y el cambio se reportó como hecho sin haber ocurrido.

El síntoma apareció después: cinco intentos fallidos seguidos devolvían
`error=credenciales` en vez del bloqueo. La primera hipótesis fue que la
migración estaba mal, y se perdió tiempo probando las funciones por RPC —que
andaban perfecto— antes de mirar el archivo y encontrar que el código
simplemente no existía.

**Por qué esto es más grave que el `git checkout`:** un error de git se arregla
con un commit. Un reporte sin verificar envenena todo lo que viene después,
porque a partir de ahí se razona sobre un estado que no es el real. Las dos
hipótesis que se investigaron primero eran imposibles.

**Las dos reglas que quedan para el resto del proyecto:**

1. **Commit antes de cualquier comando destructivo, y commit por bloque.** Aunque
   la rama quede con diez commits chicos.
2. **Ningún paso informa "hecho" sin verificar que pasó.** Un script que escribe
   archivos y avisa "listo" sin comprobar que el reemplazo encontró su texto
   está mintiendo por omisión. Se usaba `assert` en las migraciones y no en los
   scripts de edición; ahora hay un ayudante que corta si el texto no está, y que
   además relee del disco, porque comprobar sobre la variable en memoria no
   prueba que el archivo haya quedado escrito.

Todo se rehizo volviendo a correr cada verificación, no dándolas por buenas
porque ya habían pasado una vez.

### Hallazgo: la cookie de sesión salía sin `HttpOnly` ni `Secure`

```
sb-...-auth-token   Path=/  Max-Age=34560000  SameSite=lax
HttpOnly  NO        Secure  NO
```

Es textualmente uno de los errores de la diapositiva 17. `@supabase/ssr` no los
pone, y no es un descuido suyo: la misma librería sirve a aplicaciones donde el
navegador lee la cookie con `createBrowserClient`, y ahí `httpOnly` la rompería.
Este proyecto no es una de esas —cero `createBrowserClient`, cero `'use
client'`— así que se verificó eso primero.

**Verificación:** con sesión iniciada, `document.cookie` devuelve vacío y
`/cuenta` sigue dando 200.

### Un `pattern` mal escapado se descarta en silencio

El atributo `pattern` se compila con la bandera `v`, que **obliga a escapar**
`( ) [ ] { } / - |` dentro de una clase de caracteres. Si no compila, **el
navegador no avisa**: no hay error en consola. Simplemente deja de validar.

El formulario se habría visto igual y habría aceptado cualquier cosa. Lo evitó
probar que compilaba antes de construir encima.

**La regla:** una validación que falla en silencio es peor que no tenerla,
porque da una garantía que no existe.

### Una validación de más, en el lugar equivocado

`/ingresar` validaba la fortaleza antes de consultar a Supabase. Al endurecer
las reglas eso dejó de ser inofensivo: quien se registró con las viejas quedaba
afuera de su propia cuenta con un "credenciales incorrectas" que era mentira, y
de paso el formulario revelaba la política vigente.

**La regla:** validar de más, en el lugar equivocado, rompe tanto como validar
de menos.

### El techo puesto en el lugar equivocado

`espera_por_fallos` acotaba el resultado y no el exponente:

```sql
least(30 * (2 ^ (p_fallos - 5))::integer, 300)
```

La potencia se calcula antes del `least`. Medido contra Postgres 18, **a partir
de 32 fallos** la función corta con "integer out of range". No desborda el
casteo sino la multiplicación: 30 * 2^27 da 4.026.531.840 contra un máximo de
2.147.483.647.

Y 32 fallos es exactamente lo que acumula quien prueba contraseñas, que es el
caso para el que existe la tabla: habría fallado justo cuando hacía falta, y
dentro de `registrar_fallo()`, que es la función que impone el bloqueo.

**Cómo se escapó:** la función parecía correcta en todos los valores que uno
prueba a mano. El script de pruebas llegaba hasta 12.

### Lo que Supabase trae y lo que no

Todo medido contra el proyecto, no leído de la documentación:

| Qué | Resultado |
| --- | --- |
| Contraseñas que aceptaba | solo 6 caracteres; `"12345678"` creaba cuenta |
| Límite de login | 429 en el intento 35, a los 9,5 s |
| ¿Por IP o por cuenta? | **por IP**: la otra cuenta, con clave correcta, también recibió 429 |
| ¿Cuánto dura? | ~10 segundos |
| Registro con correo existente | `422 user_already_exists`: revela que la cuenta existe |

Las tres primeras se hicieron **salteando la aplicación**, con `curl` contra el
endpoint de Supabase y la clave publishable. De ahí sale la regla que organiza
todo el módulo: **lo que se configura en Supabase no se puede saltear; lo que
escribimos nosotros, sí.**

**Predicción:**

**Aprendizaje:**

---

## 2026-11-02 — Módulo 12: Mercado Pago, y una clave por ambiente

**Prompt:** integrar Mercado Pago sandbox. Preferencia, Checkout Pro, webhook
con validación de firma y acreditación de créditos.

### El hallazgo: Mercado Pago tiene una clave secreta distinta por modo

El pago de prueba salió **aprobado** y el crédito **no apareció**. El webhook
respondía **401 a cada aviso**, que es exactamente lo que devuelve cuando una
firma no coincide.

Todo lo verificable desde el código decía que estaba bien:

| Qué se comprobó | Resultado |
| --- | --- |
| el pago existe y está aprobado | `186232108573`, `approved / accredited` |
| la intención quedó escrita | sí, 6 filas |
| `external_reference` ↔ intención | coincide exacto |
| `notification_url` de la preferencia | correcta |
| el comprador era un usuario de prueba | sí, `test_user_…@testuser.com` |
| la ruta está tomada en el deploy | `x-matched-path: /api/webhooks/mercadopago` |
| la clave de Vercel coincide con la local | **200 a un aviso que firmé yo** |

La última fila es la que más engañaba, y es un error de método mío: **firmé con
la misma clave que tenía Vercel, así que la prueba era simétrica conmigo misma.**
Demostraba que Vercel y `.env.local` tenían el mismo valor, no que ese valor
fuera el que Mercado Pago usa para firmar. Una clave equivocada pero consistente
pasa esa prueba sin que se note. Es la misma familia que los episodios
anteriores: una comprobación que no puede fallar no comprueba nada.

**La causa:** el panel tiene **dos** claves de firma, *Modo productivo* y *Modo
de prueba*, y los avisos de pagos hechos con cuentas de prueba llegan firmados
con la de **Modo de prueba**. Nada de lo visible lo sugiere:

- el pago dice **`live_mode: true`**, no `false`
- la URL estaba cargada en el campo de **modo productivo**, y era la correcta
- el evento tildado era **Pagos (legacy)**, el que corresponde
- que la cuenta vendedora sea de prueba solo se ve en `GET /users/me`, en `tags`

**Cómo se detectó:** el **historial de notificaciones del panel de Mercado
Pago**, donde cada aviso trae un filtro de ambiente que decía **"Prueba"**. Ni
los registros del servidor ni la API lo dicen, y no pueden: del lado nuestro un
aviso firmado con la otra clave es **indistinguible de uno falsificado**, y
tiene que serlo. Esa es la parte que vale recordar — el 401 era correcto; lo
que faltaba era la pregunta "¿de qué ambiente viene?", que no se puede contestar
desde el código.

**Corrección aplicada:** el handler acepta las dos claves,
`MP_WEBHOOK_SECRET` y `MP_WEBHOOK_SECRET_PRUEBA`, y **registra con qué modo
validó**, que es el dato que faltaba. Cuando hay solo una configurada y la firma
falla, el registro agrega que el 401 puede ser de configuración y no de
seguridad, para no volver a buscar el problema donde no está.

`docs/ejemplos/probar-webhook-dos-claves.sh` prueba las cuatro combinaciones, e
incluye **a propósito el estado que perdió el aviso**: solo la clave productiva
cargada y firma de prueba, 401. Sin esa fila el arreglo no se distingue de un
cambio cosmético.

### El guardia de rol que rechazaba al webhook

`otorgar_creditos()` dejaba entrar al webhook con
`current_user = 'service_role'`. **Dentro de una función `security definer`,
`current_user` es el dueño de la función, no quien la llama.** Medido contra
Postgres 18, imitando cómo PostgREST atiende un pedido con la clave secreta:

| Expresión | Fuera | Dentro de `security definer` |
| --- | --- | --- |
| `current_user` | `service_role` | el dueño (`postgres`) |
| `session_user` | `authenticator` | `authenticator` |
| `current_setting('role')` | `service_role` | **`service_role`** |

Esa rama **no se cumplía nunca**. No se había notado porque las pruebas de
idempotencia corrieron con sesión de administración, donde `es_admin()` ya
devuelve verdadero y el `or` corta antes de llegar ahí: la condición que
importaba nunca se evaluó.

Tampoco sirve `request.jwt.claim.role`, que mide bien en una prueba local: las
claves nuevas (`sb_secret_...`) **no son JWT**, son opacas.

### La `idempotencyKey` que no hace nada

El SDK la acepta y parecía la defensa contra un doble clic. **Medido: misma
clave y el mismo cuerpo devuelven dos preferencias distintas.**

La primera versión de esa prueba mandaba un cuerpo **distinto** en la segunda
llamada, así que no probaba nada: un resultado diferente podía ser por el cuerpo
y no por la clave. Corregida, el resultado es concluyente. Se quitó del código:
dejarla puesta habría sido una protección aparente, que es peor que ninguna.

Lo que protege de verdad contra acreditar dos veces es el `unique` de
`compras.mp_payment_id`, probado en producción: tres avisos del mismo pago, una
compra y un crédito.

### Un POST a una ruta inexistente devuelve 200

Medido sobre el deploy: el cuerpo es el HTML del not-found y la cabecera dice
`x-matched-path: /_not-found`. En local, con `next start`, los cinco verbos dan
404. La documentación de la versión instalada explica el mecanismo: *"Before
streaming starts, Next.js returns a `404` status code. After streaming starts,
the status code remains `200`"*. No se pudo aislar si lo causa la versión o el
borde de Vercel.

Importa porque **una URL de webhook mal escrita recibiría 200**, el aviso se
daría por entregado y el pago se perdería en silencio. De ahí la regla
operativa: para saber si una ruta está tomada hay que mirar `x-matched-path`, no
el código.

Y tener una página de 404 propia **no lo arregla**: cambia el cuerpo, no el
código.

### Lo que el sandbox exige y no dice

Pagar como invitada o con una cuenta real se rechaza con *"No pudimos procesar
tu pago"*, sin más explicación. La documentación oficial pide **iniciar sesión
como usuario comprador de prueba**, en ventana de incógnito, con tarjeta de
prueba y titular `APRO`. El mensaje de error no apunta a nada de eso.

**Predicción:**

**Aprendizaje:** una prueba que uso para verificar una credencial compartida
tiene que firmar con la credencial **del otro lado**, no con la mía. Si las dos
puntas salen del mismo archivo, lo único que se comprueba es que el archivo es
igual a sí mismo. Y cuando un sistema externo tiene ambientes, el ambiente es
un dato de entrada más: no estaba en ninguna de las cosas que medí porque no se
me ocurrió que existiera.

---

## 2026-11-02 — Dos hallazgos de los datos de prueba

**Prompt:** módulo 13. Al armar las pruebas E2E apareció primero uno y después,
corriendo la limpieza, el otro.

### Los datos de prueba degradaron el sitio sin que ninguna línea estuviera mal

`/reservar` dejaba avanzar semana por semana por unas treinta y cinco semanas
**vacías**. El final real de la agenda era el 2026-12-05 y se podía llegar al
2026-12-14 y seguir.

La causa no está en el código. `agendaDeLaSemana()` decide hasta dónde se puede
avanzar con la fecha de la última clase programada de la tabla:

```js
siguiente: aClave(lunesSiguiente) <= ultimaFecha ? aClave(lunesSiguiente) : null
```

Y hace **exactamente** lo que dice su propio comentario: *"hacia adelante, hasta
donde haya clases cargadas: el límite ya no es una constante del código"*. Eso
era una mejora deliberada sobre una versión anterior que tenía el límite escrito
a mano.

Lo que estaba mal eran **los datos**: ocho clases de prueba en 2027, creadas
probando los endpoints de administración del módulo 11, con fechas elegidas
justamente para que se distinguieran de las reales. La última era el 2027-07-07.

**Lo que esto enseña**, y es lo que lo hace valer una entrada: una revisión de
código no lo habría encontrado nunca, porque no hay código que revisar. Y una
prueba sobre base vacía tampoco: el síntoma **necesita** datos sembrados para
existir. Apareció porque la prueba E2E iba a crear clases en 2027 y se midió qué
rango ofrecía la agenda antes de escribirla.

**Efecto secundario sobre las pruebas:** la regla de datos que había escrito
—"lo que las pruebas creen, lo crean en 2027", para que la limpieza las
levante— reintroducía el problema **en cada corrida**, y peor: si una corrida se
corta antes del cleanup, queda. Cambiada: las clases de prueba se crean en una
fecha que **ya tiene clases**, a una hora que el estudio no usa, así
`ultimaFecha` no se mueve. Y la prueba de reservar usa una clase existente en
vez de fabricar una.

### El script de limpieza tenía el mismo error de orden que su propio freno prevenía

Corriendo la limpieza contra datos de verdad, falló con **23503**: borraba los
créditos de las cuentas de prueba **antes** que las reservas que los
referencian.

Lo irónico es que el script ya tenía un freno para exactamente este problema,
pero en otra sección. La 2.5, la de los pagos de Mercado Pago, lo explica:

> `creditos.compra_id` es `on delete cascade`, así que borrar la compra se lleva
> sus créditos sola. Pero `reservas.credito_id` **no** tiene acción de borrado.

Y el comentario de la sección 2 decía *"los créditos antes, que son los que
referencian la compra"*. Eso es **cierto** —y es la razón por la que los
créditos van antes que `compras`— pero mira una sola de las dos puntas:
`creditos → compras` hacia abajo, y se olvida de `reservas → creditos` hacia
arriba. Un argumento correcto que justifica un orden incorrecto es peor que
ningún argumento, porque invita a no revisarlo.

**Por qué el arnés no lo vio.** `probar-limpieza.sh` tenía tres casos y en los
tres las reservas de las cuentas de prueba estaban en clases de 2027, que el
script borra **primero**. Ninguno ponía a una cuenta de prueba a reservar en una
clase que el script **no** toca. En los datos reales sí había una.

**Corregido y contraprobado.** Se agregó ese cuarto caso, y después se invirtió
el orden a propósito para comprobar que el arnés lo ve: ahora corta con
`reservas_credito_id_fkey`, el mismo 23503. Antes del caso nuevo, pasaba.

**Predicción:**

### El arreglo vivía en el editor de Supabase y no en el repositorio

El error de orden de arriba se corrigió **a mano, en el editor SQL de
Supabase**, para que la limpieza terminara. Eso hizo su trabajo: la limpieza
corrió. Pero el archivo del repositorio quedó con el orden malo, y el `git
diff` estaba vacío.

**La asimetría es lo que importa:** el arreglo quedó en el lugar que se usa una
vez, y faltaba en el único que se va a volver a correr. La próxima vez que
alguien abra `limpiar-datos-de-prueba.sql` —o que lo corra un arnés— vuelve a
fallar con el mismo 23503, y esta vez sin nadie que recuerde por qué.

**Cómo se detectó:** mirando `git diff` antes de dar el arreglo por aplicado, en
vez de creerle al informe de que ya estaba. El informe era cierto —se había
corregido— y aun así el repositorio estaba mal.

**Regla que queda:** un arreglo hecho en una consola, un panel o un editor web
no está hecho hasta que está en el repositorio. Vale para el SQL, para las
variables de entorno de Vercel y para la configuración de Supabase; de las tres
hubo un episodio en este proyecto.

### Un argumento verdadero justificando una decisión incorrecta

El orden equivocado no estaba sin explicar. Tenía un comentario al lado:

> Los creditos y las compras de las cuentas de prueba. Los creditos antes, que
> son los que referencian la compra.

**Eso es cierto.** `creditos.compra_id` referencia `compras`, así que los
créditos tienen que borrarse antes que las compras, y el comentario describe
bien esa parte. Lo que falla es que mira **una sola de las dos puntas**: hacia
abajo ve `creditos → compras` y hacia arriba no ve `reservas → creditos`, que
es la que no tiene acción de borrado y la que hace fallar el delete.

Y lo irónico es que el mismo archivo ya tenía esa otra punta escrita, en la
sección 2.5:

> `creditos.compra_id` es `on delete cascade`, así que borrar la compra se
> lleva sus créditos sola. Pero `reservas.credito_id` **no** tiene acción de
> borrado.

**Por qué esto es peor que no tener comentario.** Un `delete` sin explicación
invita a revisar el orden. Uno con un argumento correcto al lado invita a
confiar: quien lo lee verifica que el argumento sea verdadero, comprueba que
sí, y sigue. El comentario funcionó como una prueba que no podía fallar.

**Regla que queda:** cuando un comentario justifica un orden, tiene que nombrar
**todas** las referencias que lo obligan, no la primera que se encontró. Y si
el mismo archivo ya explica una restricción en otra sección, eso es señal de
que las dos secciones tenían que compartir el razonamiento en vez de
descubrirlo cada una por su cuenta.

**Aprendizaje:** un arnés que prueba un script de borrado tiene que incluir una
fila que el script **no** borra. Los tres casos originales eran variaciones de
"todo lo que hay es de prueba", y ese es el escenario fácil: el difícil es el
mixto, que es el único que existe en la realidad. Y el patrón general, que ya
está en la sección de depuración: el argumento escrito al lado de una línea
puede ser correcto y aun así no alcanzar.

---

## 2026-11-02 — Módulo 13: las pruebas encontrando afirmaciones falsas

**Prompt:** Playwright, casos de prueba formales, reportes de bug y una sección
de depuración. Lo que ya existía —seis arneses de Postgres y cinco pruebas de
nodo— se reconoce y no se rehace.

### Las pruebas encontraron dos afirmaciones falsas escritas en el código

No bugs de lógica: **comentarios que afirmaban algo que no era cierto**, y que
nadie iba a descubrir leyendo.

**La primera, en `app/lib/cookies.js`:** *"los navegadores igual tratan a
localhost como origen seguro, así que con `next start` local tampoco molesta"*.
Las pruebas sin JavaScript fallaron solo en WebKit. Medido con los tres motores
enviando el mismo formulario contra `next start` en http://localhost:

| motor | cookies `sb-` guardadas | sesión |
| --- | --- | --- |
| chromium | 2, las dos `Secure` | abre |
| firefox | 2, las dos `Secure` | abre |
| webkit | **0** | **no abre** |

WebKit **descarta** una cookie `Secure` que llega por http, sin avisar.

**Lo que no se hizo:** bajar `secure` para que la prueba pase. Debilitar una
defensa real por comodidad local es el canje equivocado. Se corrigió el
comentario para que diga lo medido y se saltean **solo** las dos pruebas que
necesitan sesión, **solo** en WebKit, con el motivo escrito en el `skip`.

**La segunda es el bug de la agenda**, que ya tiene su entrada arriba: el aviso
"No hay clases cargadas" no se podía mostrar nunca.

### Un caso nuevo del patrón, y el peor escrito al revés

`page.evaluate(() => 1)` **funciona con `javaScriptEnabled: false`**, porque
Playwright lo ejecuta por el protocolo de depuración y no por la página. Era el
detector obvio de "¿está apagado de verdad?" y mide otra cosa: es el tipo (a) de
la clasificación.

**Y lo importante es la otra dirección.** Si el detector hubiera sido "si
`evaluate` funciona, JavaScript está prendido", habría afirmado algo falso y el
paso siguiente habría sido perseguir una configuración que estaba bien. Se cazó
antes de que engañara a nadie porque la aserción estaba escrita como "esto tiene
que fallar", y falló al revés.

El detector que sirve es de comportamiento y usa la única pieza de cliente del
proyecto: con JavaScript, escribir en el campo mueve el `<meter>`; sin
JavaScript queda quieto. **Contraprobado**: se le prendió JavaScript al proyecto
y el medidor pasó de 0 a 4. Que haya un solo componente de cliente lo convierte
en un detector exacto — una propiedad útil que sale de una decisión de
arquitectura tomada por otro motivo.

### La excepción a "un dato, una fuente", y por qué es una excepción

Las cinco pantallas del panel están **escritas a mano** en `admin.spec.js`, no
leídas de la navegación. Eso duplica un dato, que es lo que el proyecto prohíbe
desde septiembre.

**El motivo: una prueba que se actualiza sola no puede detectar una regresión.**
Si la lista se leyera del código, agregar una pantalla sin protegerla la
agregaría también a la prueba, la prueba la recorrería y pasaría. Escrita a
mano, queda corta y avisa.

**La regla de la fuente única aplica al código, no a lo que el código afirma
sobre sí mismo.** Una prueba es una afirmación independiente: si sale del mismo
lugar que lo que verifica, no verifica nada. Es el tipo (c) del patrón —una
comprobación que no puede fallar— aplicado a la estructura de la prueba y no a
su contenido.

### Dos clases de contraprueba, que no prueban lo mismo

Vale distinguirlas porque en esta ronda se usaron las dos y se parecen:

- **La que prueba que el arreglo sirve.** Al arnés de limpieza se le invirtió el
  orden de los `delete` y cortó con `reservas_credito_id_fkey`. Antes del caso
  nuevo, pasaba. Eso prueba que **la prueba** detecta el fallo.
- **La que prueba que una afirmación es cierta.** En `extender-agenda.sql` se
  editó un precio a 999, se corrió el extensor y siguió en 999; se corrió el
  seed y lo pisó a 18000. **Eso no prueba que el archivo funcione: prueba que la
  afirmación de su encabezado es cierta.** Es la diferencia entre documentar y
  demostrar.

### Una prueba inestable, dicha y no explicada

La de reservar y cancelar agotó los 30 segundos en una corrida de catorce, sin
error de aserción, y no se reprodujo en tres corridas posteriores. Lleva
`test.slow()` con el motivo y la aclaración de que no es un reintento
disfrazado: `retries: 0` sigue puesto.

**Queda dicha y no explicada**, que es más honesto que taparla con un reintento.
Si vuelve, se investiga con la traza, que la configuración ya graba.

**Predicción:**

**Aprendizaje:** las pruebas de navegador no encontraron bugs de lógica —esos
los habían encontrado los arneses de la base— sino **afirmaciones falsas sobre
el entorno**: qué hace un navegador con una cookie, qué significa que una
función de Playwright funcione. Son cosas que no se deducen del código porque no
están en el código, y por eso correr tres motores pagó donde correr tres veces
el mismo no habría cambiado nada.

---

## 2026-11-03 — Módulo 14: el CI encontrando una medición mal hecha

**Prompt:** GitHub Actions, que el plan del módulo 13 había descartado. Que el
pipeline bloquee de verdad, secrets con la sintaxis que corresponde y sin un
solo valor en el YAML, y una contraprueba: romper algo a propósito, ver el
pipeline en rojo y restaurarlo.

### El plan afirmaba como medido algo que no lo estaba

El plan de este módulo decía, en una tabla de resultados medidos:

> `npm run build` **sin ninguna variable de entorno** → funciona. Todas las
> rutas son dinámicas y `clienteSupabase()` solo corre al atender un pedido.

**La primera corrida del pipeline lo falsificó.** Dos de los tres jobs cortaron
en `npm run build`:

```
Error: supabaseUrl is required.
    at app/lib/supabase.js:16:10
    at app/clases/[slug]/page.jsx:28:33
> Build error occurred
Error: Failed to collect page data for /clases/[slug]
```

`generateStaticParams` consulta Supabase al compilar. Era la **única** función
del proyecto que lo hacía, y la afirmación de que ninguna lo hacía era falsa por
una sola.

**Lo que importa es por qué la medición estaba mal.** Era:

```sh
env -i PATH="$PATH" HOME="$HOME" npm run build
```

`env -i` limpia el **entorno del proceso**. No borra `.env.local` **del disco**,
y Next lo carga por su cuenta al arrancar. La variable estuvo ahí todo el
tiempo, y el comando parecía exactamente la forma rigurosa de medirlo.

Y lo que lo convierte en una trampa: **`.env.local` está en `.gitignore`**, así
que no aparece en el repositorio ni en ninguna revisión del diff. La única forma
de medirlo es un árbol con solo los archivos que git versiona:

```sh
git ls-files -z | rsync -0 --files-from=- -q . /un/directorio/limpio/
cd /un/directorio/limpio && npm ci && npm run build
```

Ahí falló al primer intento. **La regla:** para comprobar que algo funciona *sin*
una configuración, no alcanza con quitarla del entorno; hay que comprobarlo donde
la configuración no existe. Un runner limpio es el primer lugar del proyecto
donde eso pasa de verdad, y es la respuesta a "¿para qué sirve un CI si ya probé
todo en mi máquina?".

### Los logs no se podían leer, y eso cambió el método

El pedido fue leer los logs por la API de GitHub, con el repositorio público. El
endpoint `actions/jobs/{id}/logs` devuelve **403 sin autenticación**, incluso en
un repositorio público, y `gh` no estaba instalado.

Se dijo eso en vez de adivinar el contenido de los logs, y se reprodujeron las
dos fallas localmente, que además fue más rápido. **Lo que sí se podía leer sin
autenticación** —la API de jobs, que da el nombre y la conclusión de cada paso—
alcanzó para contestar la pregunta de fondo:

```
contrato con Mercado Pago     failure   paso 5: Run npm run build
estático y unitario           failure   paso 6: build
reglas de la base             failure   paso 11: extender la agenda sin pisar el catálogo
E2E contra Supabase (a mano)  skipped
```

**Dos causas distintas, no una propagándose.** Y `base` llegando al paso 11
demostró lo que estaba en duda: la búsqueda portable de Postgres funciona en
`ubuntu-latest` y los **seis** arneses anteriores pasaron ahí, carrera por el
último lugar incluida.

La segunda causa fue barata y de la misma familia:
`probar-extender-agenda.sh` tenía escrito a mano
`P=/Users/catalina/Documents/estudio-pilates/supabase`, mientras los otros seis
derivan la ruta con `$(dirname "$0")`. Pasaba en una sola máquina del mundo.

### El arreglo había que reescribirlo, porque el canje no existía

La primera versión del arreglo documentaba un canje: en el CI las tres páginas
de detalle se generan a demanda, en producción se prerenderizan igual que antes.
**Eso era razonado, no medido, y al medirlo resultó falso.** Dos builds del mismo
árbol:

| | marcador de `/clases/[slug]` | páginas prerenderizadas |
| --- | --- | --- |
| sin variables | `●` (SSG) | **0** |
| con variables | `ƒ` (dinámica) | **0** |

Con variables, Next trae los tres slugs, intenta prerenderizarlos y los degrada
a dinámicos igual, porque el header del layout raíz lee cookies. Lo único que
cambia entre los dos builds es el marcador del resumen.

**Contraprueba, en un clon y sacando una sola línea —`<Header />` del layout:**
aparecen `flow.html`, `power.html` y `prenatal.html`, el resumen muestra la
columna `1h` del `revalidate`, y el build pasa de **1 página estática a 16**.

Eso le puso número a una deuda que CLAUDE.md tenía anotada sin número desde
octubre: lo que cuesta leer cookies en el layout raíz es que todo el sitio sea
dinámico. **El hallazgo salió de un fallo del CI que no tenía nada que ver.**

### La demostración en vivo de para qué sirve la regla de rama

No hubo que argumentarlo. En el commit del PR, GitHub tenía reportado:

```
check runs (GitHub Actions)              statuses (otros servicios)
  estático y unitario        failure       Vercel          success
  reglas de la base          failure
  contrato con Mercado Pago  failure
```

Tres checks en rojo y **Vercel desplegó y reportó éxito**, por un canal distinto
de la misma API: Actions reporta *check runs*, Vercel reporta un *commit status*.
Ninguno consulta al otro.

**La precisión que ordena el argumento:** en una rama Vercel despliega un
**preview**, no producción. Así que lo que la corrida demuestra no es "el CI en
rojo llegó a producción" — demuestra que los dos pipelines no se consultan, y por
lo tanto que el único portón entre un cambio roto y producción es el **merge**.

### El fallo accidental hizo la mitad de la contraprueba planeada

El plan pedía romper tres cosas a propósito, una por job, porque *"un CI que
nunca se vio fallar es una comprobación que no puede fallar"*. La primera corrida
mostró **los tres jobs en rojo sin que nadie los rompiera**, así que ya quedó
demostrado que cada uno corta.

Eso cambió el objetivo de la contraprueba deliberada: en vez de "ver cada job en
rojo", apuntar a **pasos cuyo fallo todavía no se vio**. El `build` de dos jobs y
el último arnés de `base` ya se vieron cortar; lo que faltaba era un paso de
pruebas unitarias, un arnés del medio y un arnés del webhook.

### Un hallazgo colateral en el README

Escribiendo la insignia del workflow apareció que el README prometía: *"Si una
clase está completa, pueden anotarse en lista de espera y **entran
automáticamente cuando alguien cancela**"*.

La tabla `lista_espera` existe con sus políticas de RLS, pero **ninguna pantalla
le escribe** y no hay promoción automática en ninguna función ni disparador.
Hoy "Lista de espera" en `/reservar` es un enlace de WhatsApp. El README decía
eso desde septiembre, y de paso tenía cinco de seis entregables sin tildar
estando los seis hechos.

## Plantilla

### AAAA-MM-DD — Título

**Prompt:**

**Resultado:**

**Fallo detectado:**

**Cómo lo detecté:**

**Corrección aplicada:**