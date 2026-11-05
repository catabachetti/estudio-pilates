# Arquitectura: dónde vive el estado de este proyecto

Auditoría contra los módulos 6 y 7 del curso —las clases 05 y 06— y la decisión
de arquitectura que explica la diferencia.

**Este es el único módulo de los catorce donde la arquitectura del proyecto
contradice lo que la clase enseña.** No es un descuido, y el documento existe
para que no haya que adivinarlo: si alguien busca `useState` o `useEffect` acá,
conviene que encuentre primero el motivo.

**Actualizado el 4 de noviembre de 2026**, cuando el formulario de contacto
agregó el segundo —y último— componente de cliente del proyecto. Los números de
abajo son los de después de ese cambio; donde algo era distinto antes, se dice.

Todos los números de este documento salen de contar el código. El comando está
al lado de cada uno.

---

## 1. Los números, primero

```sh
grep -rnE 'useEffect\(' app/                   # 0  (a secas da 2: ver abajo)
grep -rn "= useState(" app/                    # 4
grep -rn "fetch(" app/                         # 1
grep -rn "localStorage\|sessionStorage" app/   # 0
grep -rn "innerHTML" app/                      # 0
grep -rnE '\balert\(|\bconfirm\(|\bprompt\(' app/   # 0
```

| | Cuántos | Dónde |
|---|---|---|
| Directivas `'use client'` | **3** | `CampoDeContrasena.jsx`, `FormularioDeContacto.jsx` y `app/error.jsx` |
| Llamadas a `useState` | **4** | 1 en el medidor, 3 en el formulario de contacto |
| Llamadas a `useEffect` | **0** | — |
| Componentes controlados | **0** | — |
| Llamadas a `fetch` | **1** | `FormularioDeContacto.jsx:79`, a `POST /api/v1/mensajes` |
| Otros hooks de cliente | **0** | ni `useRef`, ni `useReducer`, ni `useContext`, ni `useMemo`, ni `useCallback`, ni `useOptimistic`, ni `useFormStatus`, ni `useTransition` |
| Directivas `'use server'` | **8** | los ocho archivos de `app/acciones/` |
| Archivos `loading.jsx` | **0** | §4.3, y el motivo está medido |

**Cuidado con tres greps que mienten, y mienten todos igual.**

| grep | da | de verdad hay |
|---|---|---|
| `"'use client'"` | 7 archivos | **3 directivas**; los otros cuatro son comentarios que explican por qué *no* la llevan |
| `"onSubmit"` | 3 | **1 atributo**; dos son comentarios |
| `"useEffect"` | 2 | **0 llamadas**; las dos son comentarios de `app/error.jsx` explicando por qué no lo usa |

El patrón es siempre el mismo, y es una consecuencia del estilo de este
proyecto: **los comentarios nombran mucho las cosas que no se hacen**, así que
contar coincidencias de texto da de más. Por eso cada número de este documento
viene con el grep **preciso**, no con el obvio.

Para contar directivas de verdad hay que mirar la primera línea:

```sh
for f in $(grep -rl "use client" app/); do
  awk 'NR==1 && /^[[:space:]]*.use client.[[:space:]]*;?[[:space:]]*$/ {print FILENAME}' "$f"
done
```

Y los 24 `value=` del proyecto **no son componentes controlados**: son 12
`<input type="hidden">` con un valor que el servidor ya calculó, 11 `<option>`
—que en HTML plano se escriben igual— y el `value` del `<meter>` del medidor.
Un componente controlado es `value` **más** `onChange` sobre el mismo campo, y
eso no pasa ni una vez.

---

## 2. Módulo 7, concepto por concepto

| Lo que enseña la clase | Qué hace este proyecto en su lugar |
|---|---|
| **Virtual DOM, JSX, componentes, props** | Igual. Es React, y los componentes reciben props: `EncabezadoPagina({ titulo, bajada, compensacion })`, `CampoDeContrasena({ id, name, etiqueta })` |
| **`useState` para el estado de la interfaz** | El estado vive en **la URL, la base y la cookie de sesión**. Sección 3 |
| **`useEffect` para pedir datos al montar** | Los datos se piden **antes de renderizar**, en el componente de servidor. No hay "montar": el HTML sale con los datos adentro |
| **Componentes controlados (`value` + `onChange`)** | Formularios **HTML nativos** que hacen POST a Server Actions. El navegador es dueño del valor del campo |
| **`fetch` en `useEffect` con `data` / `loading` / `error`** | `await` directo en el componente. Dos de los tres estados existen en el servidor; **el tercero no existe.** Sección 4 |
| **Listas con `.map()` y `key`** | Igual, y en el servidor: `paquetes.map((paquete) => <li key={paquete.id}>…)` |
| **Levantar el estado al padre** | No aplica: no hay estado que levantar |

### Por qué, en una frase

Un componente de cliente pide los datos **después** de que la página llegó al
navegador: HTML vacío, `useEffect`, `fetch`, re-render. Un componente de
servidor los pide **antes** de que exista el HTML. El `useState` que guardaría
"¿ya llegaron los datos?" no hace falta, porque cuando el HTML existe los datos
ya están adentro.

Eso tiene una consecuencia que es la razón de fondo de toda la decisión: **el
sitio funciona con JavaScript desactivado.** No es un detalle de accesibilidad
teórico — está probado en los tres motores de navegador, en
`e2e/sin-javascript.spec.js`, incluida una reserva completa con su cancelación.

---

## 3. Dónde vive el estado que en una app de cliente estaría en `useState`

En tres lugares, y cada uno tiene una propiedad que `useState` no tiene.

### 3.1 La URL

**Doce rutas guardan estado en la query string.** Medido:

| Ruta | Parámetros | Qué guarda |
|---|---|---|
| `/reservar` | `dia`, `r` | **qué día de la agenda se está mirando**, y el motivo de un rechazo |
| `/paquetes` | `r` | el motivo por el que una compra no arrancó |
| `/cuenta` | `r`, `credito` | el resultado de una cancelación, y si el crédito volvió |
| `/ingresar` | `volver`, `error`, `estado`, `segundos` | **a dónde volver** después de entrar, y el bloqueo progresivo |
| `/registro` | `error` | qué rechazó el servidor |
| `/recuperar` | `estado` | en qué paso del circuito está |
| `/cuenta/contrasena` | `error` | ídem |
| `/admin/clases` | `fecha`, `error`, `estado`, `reservas` | qué día edita el panel |
| `/admin/reservas` | `fecha` | ídem |
| `/admin/creditos` | `persona`, `creditos`, `error`, `estado` | a quién se le están otorgando |
| `/admin/paquetes` | `error`, `estado` | el resultado de guardar |
| `/auth/confirmar` | `token_hash`, `type`, `volver` | el token del correo |

**Lo que la URL tiene y `useState` no:** se puede compartir, se puede marcar
como favorito, el botón "atrás" del navegador funciona, y **sobrevive a recargar
la página**. `/reservar?dia=2026-11-09` es un enlace que alguien puede mandar
por WhatsApp. El mismo día guardado en `useState` se pierde con F5 y no se puede
nombrar.

Es también lo que hace posible la prueba E2: el circuito de `volver` se puede
inspeccionar porque está **escrito en la barra de direcciones**, y por eso se
puede comprobar que `rutaInterna()` lo valida y que el login no es una
redirección abierta.

### 3.2 La base de datos

Los créditos de una persona, sus reservas, las clases, los paquetes, los
intentos de ingreso. Nada de eso es estado de interfaz: es estado del negocio, y
`useState` lo perdería al recargar.

Y hay un caso donde esto no es una preferencia sino un requisito: **el bloqueo
progresivo de ingreso guarda los intentos en la tabla `intentos_ingreso`, no en
una variable.** En un entorno serverless no hay proceso vivo entre pedidos, así
que un contador en memoria arrancaría en cero cuando le conviene a quien ataca.
Está explicado en `docs/despliegue.md` §1.

### 3.3 La cookie de sesión

Quién está conectado. La lee `app/lib/supabase-sesion.js` con `cookies()`, en el
servidor, y la cookie es `HttpOnly`: **`document.cookie` no la ve**, que es la
defensa de la que depende que un XSS no se lleve la sesión.

Eso es lo contrario de guardar un token en `localStorage`, que es lo que la
clase 05 propone para el carrito. Un token en `localStorage` es legible por
cualquier script de la página.

**Y tiene un costo medido**, que está acá porque este documento no es una lista
de ventajas: esa cookie hace **dinámicas todas las rutas del sitio**. El header
la lee, el header está en el layout raíz, y leer una cookie impide prerenderizar.
Contraprueba, sacando solo `<Header />` del layout: el build pasa de **1 página
estática a 16**. El detalle está en `docs/despliegue.md` §3.

---

## 4. Los tres estados de una petición asíncrona

La clase los enseña como tres `useState`: `data`, `loading`, `error`. Acá hay
dos, y **el tercero no existe.** Decirlo así importa: una versión amable de esta
sección diría "los tres están resueltos en el servidor", y sería falso.

### 4.1 `data` — el componente espera y después renderiza

```js
const { data: paquetes, error } = await clienteSupabase()
  .from('paquetes')
  .select('id, nombre, clases, precio, dias_vigencia, incluye')
  .eq('activo', true)
  .order('orden')
```

`app/paquetes/page.jsx:34`. El `await` es el estado: mientras no resuelve, no
hay HTML. No hace falta una bandera que diga "todavía no".

### 4.2 `error` — una pantalla por cada lectura que puede fallar

**Cuatro rutas tienen su propio componente de respaldo**, y ninguna muestra una
pantalla rota:

| Archivo | Qué muestra si la base no contesta |
|---|---|
| `app/paquetes/page.jsx:104` | "No podemos mostrar los precios ahora", con un enlace de WhatsApp para pedirlos |
| `app/clases/page.jsx:75` | "No podemos mostrar las clases ahora" |
| `app/horarios/page.jsx:50` | "No podemos mostrar los horarios ahora" |
| `app/reservar/page.jsx:296` | "No podemos mostrar la disponibilidad" — y **"No hay clases cargadas"** cuando el problema no es un fallo sino que la agenda se agotó, que son cosas distintas y se dicen distinto |

El error además se registra del lado del servidor con `console.error`, así que
queda en los logs de Vercel aunque la persona solo vea el mensaje amable.

### 4.3 `loading` — no existe, y el intento de cerrarlo mostró por qué no es barato

```sh
find app -name "loading.jsx" | wc -l     # 0
```

**Este documento afirmó dos cosas sucesivas sobre esto y las dos eran
incompletas.** Conviene dejar el recorrido porque el resultado es lo más útil de
toda la sección.

Primero dijo que el estado no existía y que era **la deuda más barata del
proyecto**: cinco archivos, sin tocar lógica y sin agregar JavaScript de
cliente. Después se escribieron los cinco y el documento los declaró cerrados.

**Y después se midió, y hubo que revertirlos.**

#### Qué se pierde sin `loading.jsx`

Durante una consulta lenta la persona ve **la página anterior**, con el
indicador de carga del navegador, y nada más. Sin esqueleto, sin "cargando…". Y
hay un número que mide cuánto puede doler: `/salud` tarda **7,0 segundos** en
devolver su 503 cuando la base no responde, porque la consulta no tiene tiempo
límite.

#### Y qué cuesta ponerlo, que es lo que no se había medido

`loading.jsx` **no agrega una línea de JavaScript al navegador**, y eso es
cierto. Lo que agrega es otra cosa: **hace que el contenido dependa de que el
navegador ejecute JavaScript.**

Cuando hay un `loading.jsx`, Next envuelve la ruta en un `<Suspense>` y
**transmite** la respuesta: manda primero el armazón con el "Cargando…", y
después el contenido real, que un `<script>` en línea inserta en su lugar. Sin
JavaScript, ese script no corre.

Medido con una ruta que tarda 1,5 segundos a propósito y su `loading.jsx`:

| | al cargar | a los 4 segundos |
|---|---|---|
| JavaScript prendido | "Cargando…" | **el contenido llegó** |
| JavaScript apagado | "Cargando…" | **el contenido NO llegó** |

**Sin JavaScript la página se queda en "Cargando…" para siempre.** Eso es peor
que el problema que venía a resolver: cambia "no hay señal mientras espera" por
"nunca se ve el contenido".

#### Cómo apareció, que es la parte que vale

No lo encontró una revisión: lo encontró **la suite completa**. Los cinco
archivos se escribieron, las pruebas se corrieron de a una y pasaron, y al
correr las 83 juntas fallaron **15**, entre ellas nueve que no tienen nada que
ver con cargar datos. El motivo: con la base más cargada las consultas tardan
más, el `<Suspense>` se activa —y **solo se activa cuando los datos tardan**, no
siempre— y las tres pruebas sin JavaScript vieron el "Cargando…" donde esperaban
el contenido.

Sacando los cinco archivos, las fallas pasaron de 15 a 1. La que quedó era otra
cosa y también real: una carrera entre un `click()` y el `goto` siguiente.

**Lo que esto enseña sobre el comportamiento dependiente del tiempo:** un
`loading.jsx` no se ve en desarrollo, donde la base contesta rápido, ni en una
prueba aislada. Se ve bajo carga. Una comprobación que solo corre de a una no
puede encontrar esto, y la suite completa sí.

#### Qué queda, entonces

El estado "cargando" **sigue sin existir**, y ahora con el motivo medido en vez
de anotado como pendiente. Lo que lo desbloquearía no es escribir los archivos:
es decidir que el sitio puede dejar de funcionar sin JavaScript en las rutas
lentas, que es la decisión que este proyecto viene tomando al revés desde
septiembre.

### 4.4 `error.jsx` sí existe, y es la tercera excepción

Lo de 4.2 cubre el fallo **previsto**: la consulta devolvió `error` y la página
lo mira. Una excepción **imprevista** necesita otra cosa, y lo que había antes
era la pantalla genérica de Next. Medido, con una ruta que revienta a propósito:

```
THIS PAGE COULDN'T LOAD
A server error occurred. Reload to try again.
ERROR 1090
```

En inglés, sin el layout del sitio. Ahora hay `app/error.jsx`, en castellano,
con el header y el pie, y mostrando el `error.digest` — que es el mismo
mecanismo que la API ya usaba: un identificador que la persona puede pasar y que
está en el registro del servidor.

**Es un componente de cliente obligatoriamente**, y su argumento está en §5.3.
No hay `global-error.jsx`: cubriría los errores del layout raíz, pero reemplaza
el `<html>` entero, así que tendría que duplicar el layout. Queda afuera a
propósito.

---

## 5. Las tres excepciones

### 5.1 El medidor de contraseña

`app/components/CampoDeContrasena.jsx`, y es el archivo que hace que esta
arquitectura sea una decisión y no una limitación.

### Por qué hizo falta

El módulo 10 pide un indicador visual de **fortaleza** de contraseña, y
*fortaleza* implica grados. Con CSS puro un campo puede decir "falta algo", pero
no "débil / bien / muy buena", porque un `<input>` tiene un solo `pattern`. Para
graduarlo hay que leer lo que se escribe mientras se escribe, y eso es estado de
cliente. No hay forma de hacerlo en el servidor.

### El límite que lo hace aceptable, y es lo que vale copiar

**El medidor es un agregado, no una dependencia. Nada funcional pasa por ahí.**

Con JavaScript apagado el componente **igual se renderiza en el servidor** y
queda un campo de contraseña normal, con su `pattern`, su `minLength` y la lista
de requisitos a la vista. Lo único que se pierde es la barra moviéndose.

Y hay un detalle de implementación que es el que lo garantiza: **el input va con
`defaultValue` y sin `value`.** O sea que **ni el único componente de cliente
del proyecto usa un componente controlado.** El `useState` existe solo para
pintar la barra; el valor del campo lo sigue teniendo el navegador. Si fuera
`value={valor}`, el campo dependería de que React hidrate.

### Qué demuestra

Tres cosas, y por eso está escrito así:

1. **Que el patrón de la clase está implementado**, con su `useState`, su
   `onChange` y su render derivado del estado.
2. **Que la ausencia en el resto del proyecto es una elección**, no una
   carencia. Está hecho una vez, a propósito, donde era la única manera.
3. **Que la excepción tiene un límite comprobable.** No es una promesa: es un
   caso de prueba. `e2e/sin-javascript.spec.js` mide que con JavaScript apagado
   el `<meter>` **no se mueve** al escribir —y lo usa como detector de que
   JavaScript está realmente apagado— y que el registro **crea la cuenta igual**.

La regla que queda escrita en `CLAUDE.md`: si aparece otro caso que parezca
necesitar `'use client'`, no alcanza con citar este. Hay que demostrar primero
que no se puede con CSS, y que lo que se agrega no es funcional.

### 5.2 El formulario de contacto, y por qué su argumento es distinto

`app/components/FormularioDeContacto.jsx`. Entró con el módulo 6 del curso, que
pide un formulario con DOM dinámico, validación y `fetch`.

**La primera mitad de la regla se cumple igual que antes:** lo que se agrega son
los tres estados de una petición en curso —enviando, enviado, falló— y CSS no
sabe que hay un pedido en vuelo.

**La segunda mitad no se cumple, y hay que decirlo así: el `fetch` ES
funcional.** Es el camino por el que se manda el mensaje. Si el formulario fuera
solo `fetch`, el JavaScript sería la única forma de usarlo, y esta excepción
violaría la regla del proyecto en vez de respetarla.

**Lo que la hace admisible es que el respaldo sin JavaScript funcione.** El
`<form>` lleva un `action` que apunta a una Server Action, así que sin
JavaScript el navegador lo postea y el mensaje se guarda igual. Con eso el
camino funcional es el formulario nativo y el `fetch` vuelve a ser un agregado,
como la barra del medidor.

**El respaldo no es un extra: es la condición.** Si deja de funcionar, el
componente no corresponde. Por eso la prueba que lo verifica —caso 18 de
`e2e/sin-javascript.spec.js`— no es una prueba más: es la que habilita al
componente.

#### Cómo conviven el `action` y el `fetch`, que es la parte que hubo que medir

El `onSubmit` llama a `preventDefault()`, y la pregunta era si eso impide que
React ejecute el `action`. **La documentación de la versión instalada no lo
dice:** muestra los dos patrones por separado —`01-getting-started/07-mutating-data.md:132`
para la mejora progresiva, `02-guides/interactive-apps.md:484` para el `onSubmit`
con estado manual, y ese ejemplo **no lleva `action`**—. Lo más cercano es
`03-api-reference/02-components/form.md:160`, que lo afirma para el componente
`<Form>` de Next, no para una Server Action.

Así que se midió, en Next 16.4.3, **con su control**:

| caso | `onSubmit` | POST observados | acción ejecutada |
|---|---|---|---|
| con `preventDefault()` | corrió | **0** | **no** |
| control, sin `preventDefault()` | corrió | 1, con cabecera `Next-Action` | **sí** |

El control era imprescindible. Sin el segundo caso, "no pasó nada" también
habría sido el resultado de un montaje donde la acción nunca funciona, y la
conclusión habría sido la correcta por casualidad.

**Si hubiera salido al revés** el plan era un `<noscript>` con su propio
formulario, para no depender de una semántica que la documentación no afirma. No
hizo falta, y con eso se evitó el problema que ese camino traía: dos formularios
con los mismos campos, que es la duplicación que este proyecto corrige en todos
lados.

#### Y el input tampoco es controlado

Los tres campos van con `defaultValue` y sin `value`, igual que el medidor. Por
eso el conteo de **componentes controlados sigue en cero** aun con tres
componentes de cliente: el valor de cada campo lo sigue teniendo el navegador, y
el `useState` guarda el estado del **envío**, no el del campo.

### 5.3 `app/error.jsx`, y su argumento es el tercero

**No hay opción.** La documentación de la versión instalada lo dice en ocho
lugares de `03-api-reference/03-file-conventions/error.md`:

> `'use client' // Error boundaries must be Client Components`

Y no ofrece variante de servidor. `not-found.jsx` **sí** es un componente de
servidor, y por eso el 404 propio se pudo hacer sin una línea de JavaScript.
Este no.

**Lo que se midió antes de escribirlo**, con una ruta que revienta y con su
control:

| | HTML servido, sin ejecutar JS | con JavaScript |
|---|---|---|
| sin `error.jsx` | 11.574 bytes, **ni una palabra visible** | `THIS PAGE COULDN'T LOAD … ERROR 1090` |
| con `error.jsx` | 11.754 bytes, **ni una palabra visible** | la pantalla propia |

El *error boundary* se renderiza **solo en el navegador**: el HTML de un 500 es
un `<body>` con un `<div hidden>`, con o sin el archivo.

**Y por eso su argumento no es ninguno de los dos anteriores.** No es "lo que se
agrega no es funcional" como el medidor, ni "hay un respaldo nativo que sí lo
es" como el formulario. Es un tercero:

- **Sin JavaScript no se pierde nada**, porque la pantalla ya estaba vacía. El
  archivo no empeora ese camino, lo deja igual.
- **Nada de lo que una persona hace pasa por acá.** Solo se renderiza
  **después** de que algo ya se rompió. No es una función, es una red.

Las tres ramas de la regla están escritas en `CLAUDE.md`.

**Un detalle que no lleva:** `useEffect`. El ejemplo de la documentación lo usa
para registrar el error, y acá no haría falta — el error ya quedó en el registro
del servidor con su `digest`, que es lo que la pantalla muestra. Sería una
segunda copia del mismo dato, y el primer `useEffect` del proyecto.

---

## 6. Qué se pierde

Esta sección existe porque un documento que solo enumera ventajas no sirve para
decidir nada.

| Qué se pierde | Cuánto importa acá |
|---|---|
| **El estado "cargando"** | Es la pérdida real, §4.3, y **no es barata de cerrar**: se escribieron los cinco `loading.jsx` y hubo que revertirlos, porque con `<Suspense>` el contenido llega por un `<script>` y sin JavaScript la página se queda en "Cargando…" para siempre. Medido |
| **La validación mientras se escribe** | Un formulario controlado puede decir "ese correo ya está en uso" antes de enviar. En las ocho pantallas que no son el contacto hay que enviar y volver con `?error=`. El `pattern` y el `required` del navegador cubren la forma del dato, no su disponibilidad. **El formulario de contacto es la excepción**: valida con el esquema de Zod en el cliente, y es parte de lo que el módulo 6 pedía |
| **El envío sin recargar** | Cada acción es un POST con redirección: se pierde el scroll y hay un repintado completo. **Salvo el formulario de contacto**, que con JavaScript envía por `fetch` y no navega — y sin JavaScript hace exactamente lo que hacen las demás. Esa es la forma de tenerlo sin perder la mejora progresiva, y cuesta un componente de cliente por formulario |
| **La respuesta inmediata al clic** | Sin JavaScript no hay forma de deshabilitar el botón mientras el servidor trabaja, así que un doble clic manda dos POST. En las reservas **no hace daño, y lo que lo impide es la base**: `reservas` tiene `unique (user_id, clase_id)` —migración 001, línea 80— así que la segunda inserción no entra y la transacción vuelve atrás sin consumir el crédito. En `/admin/creditos` **sí hace daño**: ahí no hay restricción equivalente, un doble clic otorga dos veces, y hoy eso solo se arregla desde el editor SQL. Está en la deuda conocida de `CLAUDE.md` |
| **Una interacción rica** | Un calendario que se despliega, arrastrar para reordenar, un filtro que responde a cada tecla. Nada de eso se puede hacer así, y nada de eso lo pide este sitio |
| **Lo que el servidor hace en cada pedido** | El header consulta `perfiles` para cada persona con sesión. Un cliente lo pediría una vez y lo guardaría. Está mitigado con `cache()` dentro del pedido, no entre pedidos |

### Lo que sí se gana, para que el canje quede completo

- **El sitio funciona sin JavaScript**, probado en tres motores.
- **Las claves nunca llegan al navegador**: la consulta a Supabase ocurre en el
  servidor. Lo que viaja es HTML.
- **El precio sale de la base, no del formulario.** Del formulario viaja solo el
  id del paquete. Un precio en un campo oculto se edita y se paga el paquete de
  12 clases a un peso.
- **No hay estado duplicado.** El bug clásico de una app de cliente es que la
  pantalla y la base dicen cosas distintas. Acá no hay dos copias.

---

## 7. Módulo 6: los cuatro puntos donde el proyecto se apartó

El módulo 6 es un e-commerce en JavaScript puro. Lo conceptual está cubierto, y
en cuatro puntos el proyecto hace otra cosa. **Verificado archivo por archivo:**

| Lo que pide la clase | Qué hay acá | Medición |
|---|---|---|
| Array de productos simulado en JS | **Postgres.** `paquetes`, `tipos_clase`, `instructoras` y `clases` son tablas | `app/datos/` no tiene ningún array de catálogo: son hechos del sitio (dirección, menú, cupo, preguntas) y ayudantes de fecha |
| `innerHTML` con template literals | **Server Components** | `grep -rn innerHTML app/` → **0**. Y `document.`/`window.` → **1 coincidencia, dentro de un comentario** que explica por qué la cookie es `HttpOnly` |
| `localStorage` para el carrito | **La base y la URL** | `grep -rn "localStorage\|sessionStorage" app/` → **0**. Y 12 rutas con estado en la URL, §3.1 |
| `alert('¡Compra realizada!')` | **Mercado Pago con webhook firmado** | `grep -rnE '\balert\(\|\bconfirm\(\|\bprompt\(' app/` → **0**. El circuito real está en `docs/api.md` §14 |

**No encontré ninguna excepción a esos cuatro.** Ni un `localStorage` olvidado,
ni un `alert` de depuración, ni un `innerHTML`.

### Pero sí encontré dos cosas que la tabla del módulo 6 daba por buenas

**El CSS no es Mobile-First. Es Desktop-First.** Medido:

```sh
grep -c "min-width" app/globals.css   # 4
grep -c "max-width" app/globals.css   # 27
```

Y la base lo confirma: `.paquetes-grilla-pagina` arranca en
`grid-template-columns: repeat(4, 1fr)` y las consultas **bajan** a 2 y a 1. Eso
es lo contrario de mobile-first, que arranca en una columna y sube.

Funciona, se ve bien en teléfono y está probado a 500px. **Pero la clase enseña
mobile-first por un motivo**: escribir primero el caso angosto evita cargar al
teléfono con reglas que después hay que deshacer. Acá se hizo al revés, y el
documento lo dice en vez de tildar la casilla.

Lo que **sí** está como la clase pide: `auto-fit` con `minmax()` en cinco
grillas, 23 `display: grid` y 20 `display: flex`, y la paleta en `:root`.

**Y `--compensacion` no está en `:root`.** Se consume con un valor por defecto
—`var(--compensacion, 0.07em)`— y se sobreescribe con un **estilo en línea
pasado como prop** a `EncabezadoPagina`. Las dos líneas del CSS que parecen
declararla están dentro de un comentario.

Hoy hay **tres** overrides, no dos: `/contacto` y `/compra/listo` con `0.02em`
—las dos empiezan con C— y `/terminos` con `-0.01em`. El tercero entró con
Mercado Pago, en el módulo 12, y la deuda anotada en `CLAUDE.md` todavía decía
dos. Es exactamente el riesgo que esa deuda describe: el valor depende de la
**primera letra** del título, así que cada título nuevo es un override nuevo que
nadie recuerda.

---

## 8. Cómo presentar esto

Si alguien evalúa el módulo 7 buscando `useState` y `useEffect`, va a encontrar
uno y ninguno. El orden que conviene:

1. **`useState`, `onChange`, `onSubmit` y `fetch` están implementados**, con el
   patrón completo de la clase: el medidor de contraseña
   (`CampoDeContrasena.jsx`) y el formulario de contacto
   (`FormularioDeContacto.jsx`), que valida en el cliente, llama a la API y
   muestra los tres estados de la petición.
2. **En el resto del proyecto no están porque no harían falta**, y el reemplazo
   de cada uno está en la sección 2 de este documento.
3. **La decisión se paga y se cobra.** Lo que se gana está medido —el sitio
   funciona sin JavaScript, probado en tres motores— y lo que se pierde también:
   no hay estado "cargando", y eso es una deuda, no una ventaja.
4. **No se agregó un `useState` para cumplir el módulo.** Habría sido código que
   no hace nada, en un proyecto cuyo argumento entero es que cada decisión tiene
   un motivo escrito.
