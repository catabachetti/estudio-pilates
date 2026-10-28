# API

Recorrido del módulo 11. Qué se construyó, dónde está cada cosa y cómo se
comprueba.

Base: `/api/v1`. Todo entra y sale en JSON. Las respuestas que salen bien
traen `{"datos": ...}` y las que salen mal `{"error": ...}`, siempre, para que
quien llama pueda distinguirlas sin mirar el código de estado.

```json
{"datos":{"estado":"bien","base":"responde","ms":86}}
```

```json
{"error":{"codigo":"no_autenticado","mensaje":"Hace falta iniciar sesión.",
          "id":"ab93befb-fd51-406e-a82d-b330b867a482"}}
```

La versión va en la URL y no en una cabecera a propósito: `/api/v1/clases` se
puede abrir en el navegador, pegar en un mensaje y guardar en un marcador. Una
cabecera `Accept: application/vnd.active.v1+json` es más pura y no se puede
hacer nada de eso con ella.

---

## 1. ¿Para quién es esta API?

Esta sección va primera porque es la pregunta que vuelve inútil a todo lo
demás si no se contesta. **Un endpoint documentado como ejercicio es
información honesta; uno presentado como pieza de arquitectura cuando nadie lo
llama es decorado.**

**Hoy nada del proyecto llama a `/api/v1`.** No es una impresión, se mide:

```
grep -rn "api/v1" app --include='*.js' --include='*.jsx' | grep -v '^app/api/'
# (sin resultados)
```

Y el motivo no es un olvido: las páginas son Server Components y leen los
datos **llamando a las funciones directamente**, no por HTTP.

```
app/reservar/page.jsx      ->  agendaDeLaSemana()     (app/lib/agenda-db.js)
app/horarios/page.jsx      ->  semanaTipo()           (app/lib/horarios.js)
app/components/Reservas.jsx->  semanaTipo()
app/components/Footer.jsx  ->  horariosDeAtencion()
```

Una página que hiciera `fetch('/api/v1/clases')` contra su propio servidor
pagaría un viaje de red para pedirse algo a sí misma, y agregaría un modo de
falla —el servidor no se alcanza a sí mismo— que hoy no existe. No se hace, y
no se va a hacer.

Entonces, con nombre y apellido:

| Endpoint | Quién lo llama hoy | Quién lo llamaría |
|---|---|---|
| `GET /salud` | nadie todavía | **un servicio de uptime externo.** Es el único endpoint cuyo propósito ninguna Server Action puede cubrir: una acción solo corre si alguien la invoca, y el monitoreo tiene que preguntar sin que haya nadie usando el sitio |
| `GET /clases`, `GET /clases/{id}`, `GET /paquetes` | nadie | un cliente que no sea este sitio: una app, un script, una pantalla en el estudio |
| `GET /reservas`, `POST /reservas`, `PATCH /reservas/{id}`, `GET /creditos` | nadie | lo mismo, con sesión |
| `POST /clases`, `PATCH /clases/{id}`, `GET /clases/{id}/reservas` | nadie | lo mismo, con rol de administración |

O sea: **`/salud` tiene un consumidor real pendiente de configurar, y los
otros diez son un ejercicio hoy.** Lo que los justifica no es que alguien los
use: es que el módulo pide construirlos, y que son el destino de la migración
de la sección 12.

Lo que **no** se hizo, justamente para no decorar: inventar un consumidor.
No hay un `'use client'` nuevo llamando a `fetch` para poder decir que la API
se usa. La única excepción de `'use client'` del proyecto sigue siendo el
medidor de contraseña, y está argumentada en `CLAUDE.md`.

---

## 2. Lo que muestra la materia (Express) y lo que hace Next 16

Las diapositivas enseñan Route Handlers en **Express**, y la traducción no es
línea por línea. Esta es la tabla, porque confundirlas es la forma más rápida
de escribir código que no compila.

```js
// Express, como en la diapositiva
app.get('/api/clases', (req, res) => {
  const { fecha } = req.query
  res.status(200).json({ clases })
})
```

```js
// Next 16, app/api/v1/clases/route.js
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')
  return Response.json({ datos: { clases } }, { status: 200 })
}
```

| Express | Next 16 (App Router) |
|---|---|
| `app.get(ruta, handler)`: la ruta es un argumento | **el archivo es la ruta**: `app/api/v1/clases/route.js` responde en `/api/v1/clases` |
| el método va en el nombre de la función (`app.get`, `app.post`) | el método es **el nombre de la exportación**: `export async function GET` |
| `(req, res)` | `(request, contexto)`. **No hay `res`** |
| `res.json(x)` muta y envía una respuesta | `return Response.json(x)` **devuelve** una nueva |
| `res.status(404).json(x)` | `Response.json(x, { status: 404 })` |
| `req.query.fecha` | `new URL(request.url).searchParams.get('fecha')` |
| `req.params.id` | `(await contexto.params).id` — **es una Promise** |
| `req.body`, previo `app.use(express.json())` | `await request.json()`, sin configurar nada |
| `res.set('X', 'y')` | tercer argumento: `{ headers: { X: 'y' } }` |
| 405 hay que escribirlo | **automático**: un método que no se exporta responde 405 |

La diferencia de fondo: `req` y `res` son objetos de Express. `request` y
`Response` acá son los **estándar de la plataforma web**, los mismos que usa
`fetch` en el navegador. No hay que aprender una API del framework; hay que
conocer la del lenguaje. Eso también significa que un handler se puede probar
sin levantar un servidor: se le pasa un `Request` construido a mano y devuelve
un `Response`.

**Y una que se paga caro si se ignora:** `contexto.params` es una Promise en
esta versión. `const { id } = contexto.params` no explota, deja `id` en
`undefined`, y el handler sigue adelante con un valor vacío.

---

## 3. No hay Global Error Middleware: hubo que construir el equivalente

La materia muestra el manejo centralizado como un middleware final que
captura lo que los anteriores lanzaron. **En App Router eso no existe**, y
conviene saber por qué antes de buscarlo:

- `proxy.js` corre **antes** del enrutamiento. Decide si el pedido sigue, pero
  no envuelve al handler y no puede capturar una excepción lanzada adentro.
- `error.js` es para errores de renderizado de React en páginas. Un Route
  Handler no renderiza nada, así que nunca lo alcanza.

La única forma de centralizar es **componer una función alrededor de cada
handler**. Eso es `manejador()`, en `app/api/_lib/errores.js`:

```js
export const GET = manejador(async (request) => { ... })
```

A partir de ahí ningún error se escapa sin pasar por un solo lugar, que
decide tres cosas:

1. **Un `ZodError`** se convierte en 400 con el detalle por campo, que es lo
   que le sirve a quien llama para corregir el pedido.
2. **Un `ErrorDeApi`** sale con el código y el mensaje que trae.
3. **Cualquier otra cosa** se registra completa en el servidor y al cliente le
   llega `error_interno` y nada más. Devolver una traza expone nombres de
   archivos, estructura de la base y versiones de librerías; la materia lo
   marca como vulnerabilidad crítica y tiene razón.

En los tres casos la respuesta lleva un **`id`** que también va a los
registros. Alguien puede reportar "me dio error ab93befb" y se encuentra el
error completo, sin haberle mostrado nada de adentro.

El costo de este enfoque, dicho: **se centraliza solo lo que se envuelve.** Un
handler que alguien exporte sin `manejador()` queda afuera y nadie avisa. En
Express el middleware cubre todo lo que se monte después; acá la cobertura es
una convención, y por eso se comprueba contando:

```
grep -rhoE 'export (const|async function) (GET|POST|PATCH|PUT|DELETE)' app/api/v1 | wc -l
grep -rhoE 'export const (GET|POST|PATCH|PUT|DELETE) = manejador\(' app/api/v1 | wc -l
# 11 y 11
```

Los dos números tienen que ser iguales. Hoy son 11 y 11.

---

## 4. Los tres mecanismos de extracción

Los tres viven en `app/api/_lib/pedido.js`, cada uno con un esquema, y los
tres lanzan `ZodError` que `manejador()` convierte en 400.

| Mecanismo | Para qué | Dónde se usa |
|---|---|---|
| **Route params** — `paramsDeRuta(contexto, esquema)` | identificar **un** recurso | `GET/PATCH /clases/{id}`, `GET /clases/{id}/reservas`, `PATCH /reservas/{id}` |
| **Query params** — `paramsDeConsulta(request, esquema)` | filtrar, ordenar, paginar. Nunca identificar | `GET /clases?fecha=`, `GET /reservas?estado=&fecha=` |
| **Body** — `cuerpo(request, esquema)` | estructuras complejas, en JSON | `POST /clases`, `POST /reservas`, `PATCH /clases/{id}`, `PATCH /reservas/{id}` |

El criterio no es estético. Un identificador en la URL hace que el recurso
tenga una dirección propia, que se pueda cachear y enlazar; un filtro en la
URL hace lo mismo con la consulta. Un identificador escondido en el cuerpo
convierte a `POST /clases` en un procedimiento remoto con un nombre de recurso
encima.

Hay **una ruta que no usa `cuerpo()`**: `PATCH /clases/{id}`. Acepta dos formas
distintas —un cambio de estado `{"estado":"cancelada"}` o una edición completa
`{tipo_clase_id, instructora_id, cupo_total}`— y para elegir el esquema tiene
que mirar el objeto antes de validarlo. Para eso está `cuerpoCrudo()`, que es
la mitad de `cuerpo()`: convierte el JSON o lanza 400. Las dos comparten esa
mitad para que el mensaje de "el cuerpo tiene que ser JSON válido" esté escrito
una sola vez.

Medido:

```
PATCH /clases/{id}  con cuerpo "esto no es json"  ->  400 datos_invalidos
                                                      "El cuerpo del pedido tiene que ser JSON válido."
PATCH /clases/{id}  con cuerpo {}                 ->  400 datos_invalidos
GET   /clases?fecha=mañana                        ->  400 {"fecha":["No es una fecha válida (AAAA-MM-DD)."]}
GET   /clases/hola/reservas                       ->  400 datos_invalidos
```

---

## 5. Autenticación: cookie o Bearer, con un solo ayudante

`app/api/_lib/sesion.js` tiene **un** ayudante, `clienteDeApi()`, y acepta dos
mecanismos porque los clientes son distintos:

| Mecanismo | Quién lo usa | Por qué |
|---|---|---|
| **cookie de sesión** | un navegador, con `fetch` desde el propio sitio | es la misma cookie `HttpOnly` del resto del proyecto y el navegador la manda sola. Pedirle un token a una página sería guardarlo en JavaScript, que es exactamente lo que `HttpOnly` evita |
| **`Authorization: Bearer`** | un script, un servicio, una app | no tiene cookies ni forma de obtenerlas. Manda el mismo JWT que emite Supabase al iniciar sesión |

Importa que la identidad viaje **al cliente de Supabase**, no que se guarde en
una variable: RLS decide con `auth.uid()`, así que un cliente sin identidad ve
lo que ve cualquiera, no lo que ve esa persona.

Sobre eso hay tres funciones, y la diferencia entre ellas es qué hacen cuando
no hay nadie:

- `quienLlama()` devuelve `null` y no lanza. Para rutas públicas que igual
  quieren saber si hay alguien del otro lado.
- `exigirSesion()` lanza **401**.
- `exigirAdminApi()` lanza 401 si no hay sesión y **403** si la hay y no
  alcanza. Si el rol no se puede leer, la respuesta es "no": ante la duda,
  negar.

**Un tercer cliente que no usa ninguno de los dos: el webhook de Mercado
Pago.** Los servidores de MP no tienen cuenta en el estudio ni token nuestro.
Se identifican **firmando el pedido**, y verificar esa firma es un mecanismo
aparte que va a vivir en su propia ruta cuando llegue ese módulo. No pasa por
`clienteDeApi()` y no debe: tratar de encajarlo acá obligaría a que este
ayudante acepte "o una firma HMAC", y entonces dejaría de ser el lugar donde se
decide quién es quien llama.

---

## 6. Códigos de estado

| Código | `codigo` | Cuándo |
|---|---|---|
| 200 | — | salió bien |
| 201 | — | se creó algo. Lleva `Location` apuntando al recurso nuevo |
| 400 | `datos_invalidos` | el pedido está mal formado o no cumple un esquema. Trae `detalles` por campo |
| 401 | `no_autenticado` | no hay sesión, o el token no sirve |
| 403 | `sin_permiso` | hay sesión y no alcanza |
| 404 | `no_encontrado` | el recurso no existe, o no está disponible para quien pregunta |
| 405 | — | método no exportado. Lo pone Next, no el proyecto |
| 409 | varios | el pedido estaba bien y choca con el estado actual |
| 500 | `error_interno` | algo falló de nuestro lado |
| 503 | — | solo `/salud`, cuando la base no responde |

**401 y 403 no son lo mismo**, y es la confusión que la materia marca como
error. 401 dice "no sé quién sos"; 403 dice "sé quién sos y no alcanza".
Volver a iniciar sesión con la misma cuenta arregla el primero y no el segundo.

**El 409 no está en la lista de la materia y hace falta igual.** "La clase se
llenó", "ya tenías esa reserva", "ya hay una clase ese día a esa hora" no son
datos inválidos (400) ni recursos ausentes (404): son un choque con el estado
actual del sistema. Devolver 400 le diría a quien llama que arregle su pedido,
cuando el pedido estaba perfecto y lo que cambió fue el mundo. Los códigos:

```
horario_ocupado   POST /clases       ya hay una clase ese dia a esa hora
cupo_ocupado      PATCH /clases/{id} el cupo nuevo dejaria afuera a quien ya reservo
clase_completa    POST /reservas     no quedan lugares
ya_reservada      POST /reservas     esa persona ya la tenia
sin_creditos      POST /reservas     no le quedan creditos
clase_pasada      POST /reservas     la clase ya empezo
ya_cancelada      PATCH /reservas/{id}
```

**El 401 de la API manda `WWW-Authenticate` y el del sitio no.** La RFC 9110
pide que un 401 traiga un desafío. En el sitio no se manda, porque la sesión va
por cookie y no hay esquema de autenticación HTTP que corresponda; está
documentado en `docs/seguridad.md` §10.1. **Ese argumento no vale acá:** la API
acepta `Bearer` como mecanismo de primera clase, así que existe un esquema
aplicable y hay que nombrarlo. Sin la cabecera, un cliente que recibe 401 no
tiene de dónde deducir cómo identificarse.

Medido:

```
GET /reservas  sin credenciales       ->  401  www-authenticate: Bearer realm="api", charset="UTF-8"
GET /reservas  Bearer no-es-un-token  ->  401  www-authenticate: Bearer realm="api", charset="UTF-8"
POST /clases   con sesion de cliente  ->  403  (sin www-authenticate)
GET /cuenta    (el sitio, no la API)  ->  307  /ingresar?volver=%2Fcuenta
```

El 403 **no** la lleva, y es deliberado: quien llama ya está identificado, y
repetir el desafío lo invitaría a reintentar lo mismo.

---

## 7. Mapa de endpoints

| Método y ruta | Acceso | Entrada | Devuelve |
|---|---|---|---|
| `GET /salud` | público | — | `estado`, `base`, `ms`. 503 si la base no responde |
| `GET /paquetes` | público | — | los paquetes activos, ordenados |
| `GET /clases` | público | `?fecha=AAAA-MM-DD` (opcional, por omisión hoy) | las clases de ese día con `lugares_libres` |
| `GET /clases/{id}` | público | route param | la clase y sus lugares |
| `POST /clases` | **admin** | `fecha`, `hora`, `tipo_clase_id`, `instructora_id`, `cupo_total` | 201 + `Location` |
| `PATCH /clases/{id}` | **admin** | `{estado}` **o** `{tipo_clase_id, instructora_id, cupo_total}` | la clase actualizada |
| `GET /clases/{id}/reservas` | **admin** | route param | la clase y quiénes reservaron |
| `GET /reservas` | sesión | `?estado=confirmada\|cancelada`, `?fecha=AAAA-MM-DD` | **solo las propias** |
| `POST /reservas` | sesión | `{clase_id}` | 201 + `Location` |
| `PATCH /reservas/{id}` | sesión | `{"estado":"cancelada"}` | si el crédito volvió o se perdió |
| `GET /creditos` | sesión | — | el resumen de créditos de quien llama |

`GET /clases/{id}/reservas` es el **recurso anidado**: las reservas de una
clase no tienen sentido sin la clase, y la URL lo dice. Es de administración
porque devuelve nombres de otras personas. Hace dos consultas en vez de una
porque no hay clave ajena entre `reservas` y `perfiles`.

**El `?fecha=` de `GET /reservas` filtra por la fecha de la clase, no de la
reserva**, que es lo que alguien quiere decir con "mis reservas del jueves".
Eso obliga a pedir el join como `clases!inner`: con el join externo el filtro
sobre una tabla relacionada **se descarta en silencio**, y el endpoint devolvía
todo como si no hubiera filtro. Era el caso exacto de un filtro anunciado por
el esquema y tirado por el handler, y estuvo así hasta que escribir esta
sección lo destapó. Es `inner` y no cambia nada más porque `reservas.clase_id`
es una clave ajena obligatoria: no hay reserva sin clase.

**`GET /reservas` filtra por `user_id` aunque RLS ya filtre.** No es
redundante: las políticas dicen `user_id = auth.uid() or es_admin()`, así que
para una cuenta de administración RLS devuelve **todo**. Sin ese filtro, el
endpoint le mostraría a quien administra las reservas ajenas como propias. Ya
pasó una vez en `/cuenta` y está anotado en `CLAUDE.md`.

---

## 8. Dónde viven las reglas de validación

En `app/lib/esquemas.js`, y en ningún otro lugar. Los esquemas los comparten
**la API y las Server Actions**: `app/lib/validacion.js` no define nada, solo
los envuelve con la forma que las acciones del panel venían usando.

Eso importa porque si no, "qué es una fecha válida" se contestaría dos veces y
un día dejarían de coincidir. Lo mismo con los largos de texto: `LARGO_NOMBRE`
y `LARGO_INCLUYE` estaban escritos a mano en cuatro archivos —la constante de
la acción, el esquema, el `maxLength` del formulario y el texto del mensaje de
error— y ahora los cuatro los leen de acá.

```
node docs/ejemplos/probar-esquemas.mjs
```

Comprueba que el esquema use la constante exportada y no un número que
casualmente coincide, y que `TextoOpcional` y `UuidOpcional` traten igual a
`''` y a `undefined`: un formulario manda `''` cuando el campo queda vacío y un
cuerpo JSON directamente omite la clave.

**Un esquema que todavía no tiene endpoint:** `EdicionDePaquete`. Existe porque
`PATCH /paquetes/{id}` es el siguiente paso natural, y hoy no está. Decirlo acá
cuesta una línea; inventar el endpoint para que el esquema no quede solo sería
el decorado de la sección 1.

---

## 9. Lo que la API no reimplementa

Ningún endpoint vuelve a escribir una regla del negocio. Cuando apareció la
tentación, se extrajo la regla a un lugar compartido en vez de copiarla:

| Regla | Donde vive | Quién la usa |
|---|---|---|
| reservar: contar y tomar el crédito sin carrera | `reservar_clase()`, función de la base | `POST /reservas` y la Server Action |
| cancelar: devolver o perder el crédito según la ventana | `cancelar_reserva()`, función de la base | `PATCH /reservas/{id}` y la Server Action |
| el cupo nuevo no puede dejar afuera a quien ya reservó | `app/lib/clases.js` | `PATCH /clases/{id}` y el panel |
| qué cuenta como crédito tomado | `app/lib/creditos.js` | `GET /creditos`, `/cuenta` y `/admin/creditos` |
| disponibilidad de un día | `disponibilidad_del_dia()`, función de la base | `GET /clases` y `/reservar` |

El caso que vale contar es el tercero. La regla estaba **dentro** de la Server
Action del panel. Copiarla al Route Handler habría funcionado y habría dejado
al estudio con **dos reglas de cupo según por dónde entre el pedido**. Se
extrajo a `app/lib/clases.js` y ahora las dos leen la misma.

---

## 10. Por qué no hay DELETE

No hay un solo `DELETE` en toda la API, y no es una omisión: es el dominio.

- **Las reservas se cancelan, no se borran.** Quedan con estado `cancelada` y
  conservan el historial. `reservas` no tiene política de DELETE en ninguna
  parte del proyecto.
- **Hay una consecuencia que quien llama necesita saber:** si el crédito volvió
  o se perdió, según la ventana de cancelación. Un `DELETE` devuelve 204 sin
  cuerpo y no tendría dónde decirlo. Por eso cancelar es
  `PATCH {"estado":"cancelada"}`.
- **Las clases se cancelan**, y cancelarlas tampoco libera el horario: el
  `unique (fecha, hora)` sigue valiendo para la fila cancelada, porque esa fila
  tiene reservas colgando.
- **Los créditos no se quitan**, y eso es una deuda conocida anotada en
  `CLAUDE.md`, no un endpoint que falte: antes hay que decidir qué pasa si ya
  se usaron para reservar.

El esquema `{"estado":"cancelada"}` es un `literal`, no un `enum` de dos
valores, y eso también es a propósito: **reactivar una reserva cancelada no es
un PATCH, es reservar de nuevo**, y eso tiene que volver a pasar por
`reservar_clase()` con su candado, porque el lugar puede habérselo llevado otra
persona.

Inventar un endpoint destructivo para completar la tabla de verbos sería
mentir sobre lo que el sistema hace.

```
DELETE /api/v1/clases/{id}  ->  405 Method Not Allowed
```

---

## 11. Desvíos y limitaciones conocidas

- **El 405 no lleva `Allow`.** La RFC pide que un 405 diga qué métodos sí se
  aceptan. Lo genera Next, no el proyecto, y no la incluye. Se podría agregar
  exportando un `OPTIONS` por ruta; no se hizo porque serían once handlers
  nuevos cuyo único efecto es una cabecera, y hay deudas más caras.
- **`/salud` tarda lo que tarde la base en fallar.** Medido apuntando la URL de
  Supabase a un puerto que rechaza conexiones: devolvió 503 correcto, pero
  después de **7,0 segundos**, porque la consulta no tiene tiempo límite. Un
  monitoreo que corte a los 5 segundos va a ver un timeout en vez del 503.
  Arreglarlo requiere un `fetch` propio con `AbortSignal` en el cliente de
  Supabase, que es compartido con todo el sitio; no se toca por un endpoint.
- **No hay paginación.** `GET /paquetes` devuelve todos y `GET /clases` devuelve
  un día. Con el tamaño real del estudio —seis lugares, unas pocas clases por
  día— una página de resultados sería una abstracción sin nada adentro. Si
  `GET /reservas` creciera, ahí sí hace falta.
- **No hay límite de pedidos por minuto en la API.** El login sí lo tiene
  (`docs/seguridad.md` §3.2). Los endpoints de lectura son públicos y
  equivalentes a abrir una página; los de escritura pasan por RLS y por las
  funciones de la base. No es una defensa contra abuso y no se presenta como
  tal.
- **El cuerpo máximo es 1 MB**, límite de Next, no del proyecto. Ningún cuerpo
  de esta API se acerca.
- **La cobertura de `manejador()` es una convención, no una garantía.** Está
  explicado al final de la sección 3.

---

## 12. Pendiente: migrar las Server Actions, después de Mercado Pago

Hoy el panel y el formulario de reservas escriben por Server Actions, y la API
tiene endpoints equivalentes que nadie llama. Eso es dos caminos a lo mismo, y
a la larga uno de los dos tiene que ganar.

**La migración va después de Mercado Pago, no antes**, y el motivo es el orden
de los riesgos. Mercado Pago trae una ruta nueva con un mecanismo de
identificación que el proyecto todavía no tiene —verificar una firma— y toca
los créditos, que son lo único que la gente paga. Mover las escrituras que hoy
funcionan, y que están verificadas con pruebas, mientras se escribe eso, es
cambiar dos cimientos a la vez.

Hay además una razón que no es de calendario: las Server Actions dan
**mejora progresiva**. El formulario de reservas funciona con JavaScript
apagado, y está verificado. Pasar esas escrituras a `fetch` contra la API las
rompería sin JavaScript, así que la migración no es "lo mismo por otro camino":
es una decisión sobre qué se pierde. Cuando se haga, hay que decidirlo con eso
a la vista, y no como un paso de limpieza.

---

## 13. Cómo se verifica

```
# la salud, en sus dos ramas
curl -i http://localhost:3000/api/v1/salud
# 200  {"datos":{"estado":"bien","base":"responde","ms":86}}
# apuntando NEXT_PUBLIC_SUPABASE_URL a un puerto muerto y recompilando:
# 503  retry-after: 30   {"datos":{"estado":"degradado","base":"sin respuesta","ms":7007}}

# los tres niveles de permiso, sobre el mismo endpoint
curl -X POST http://localhost:3000/api/v1/clases -d '...'                      # 401
curl -X POST ... -H "Authorization: Bearer <token de cliente>" -d '...'        # 403
curl -X POST ... -H "Authorization: Bearer <token de admin>"   -d '...'        # 201

# el 400 con detalle por campo
curl 'http://localhost:3000/api/v1/clases?fecha=mañana'
# 400  {"fecha":["No es una fecha válida (AAAA-MM-DD)."]}

# el 409, que es el que no estaba en la lista
curl -X POST .../clases -H "Authorization: Bearer <admin>" -d '<el mismo horario dos veces>'
# 409  horario_ocupado

# que los esquemas sean una sola fuente
node docs/ejemplos/probar-esquemas.mjs

# que las reglas de reserva sigan siendo las de la base, no las del handler
supabase/probar-reservas.sh
```

Resultados medidos sobre el sitio compilado y servido con `next start`, no en
desarrollo.

| Caso | Esperado | Medido |
|---|---|---|
| `GET /salud` | 200 `bien` | 200 `bien` |
| `GET /salud`, base inalcanzable | 503 + `Retry-After` | 503 + `Retry-After: 30` |
| `POST /clases` sin credenciales | 401 | 401 `no_autenticado` + `WWW-Authenticate` |
| `POST /clases` con sesión de cliente | 403 | 403 `sin_permiso`, sin `WWW-Authenticate` |
| `POST /clases` con sesión de admin | 201 + `Location` | 201 |
| `POST /clases` mismo horario otra vez | 409 | 409 `horario_ocupado` |
| `POST /clases` con `tipo_clase_id` inexistente | 400 | 400 `datos_invalidos` |
| `POST /clases` con `cupo_total: 0` | 400 | 400 `datos_invalidos` |
| `POST /clases` con un campo faltante | 400 | 400 `datos_invalidos` |
| `POST /clases` sin `instructora_id` | 201 | 201 (igual que con `null` y con `''`) |
| `PATCH /clases/{id}` editar cupo | 200 | 200 |
| `PATCH /clases/{id}` cancelar y reactivar | 200 | 200 las dos |
| `PATCH /clases/{id}` con `estado` inventado | 400 | 400 `datos_invalidos` |
| `PATCH /clases/{id}` con cuerpo que no es JSON | 400 | 400, mensaje de JSON inválido |
| `PATCH /clases/{id}` con cuerpo vacío | 400 | 400 `datos_invalidos` |
| `PATCH /clases/{id}` con sesión de cliente | 403 | 403 `sin_permiso` |
| `GET /clases/{id}` inexistente | 404 | 404 `no_encontrado` |
| `GET /clases/hola/reservas` | 400 | 400 `datos_invalidos` |
| `GET /clases/{id}/reservas` con admin | 200 | 200 |
| `GET /clases/{id}/reservas` con cliente | 403 | 403 `sin_permiso` |
| `GET /clases/{id}/reservas` sin credenciales | 401 | 401 `no_autenticado` |
| `GET /clases` sin `fecha` | 200, el día de hoy | 200, `"fecha":"2026-10-28"` |
| `DELETE /clases/{id}` | 405 | 405 |
| `GET /reservas` sin filtro | la reserva propia | 200, 1 reserva |
| `GET /reservas?fecha=` el día de la clase | esa reserva | 200, 1 reserva |
| `GET /reservas?fecha=` otro día | ninguna | 200, 0 reservas |
| `GET /reservas?estado=cancelada` con una confirmada | ninguna | 200, 0 reservas |
| `GET /reservas?fecha=&estado=` combinados | filtran los dos | 200, coherente con cada uno por separado |
| `GET /reservas?fecha=manana` | 400 | 400 `{"fecha":["No es una fecha válida (AAAA-MM-DD)."]}` |
| `PATCH /reservas/{id}` cancelar a tiempo | 200 + crédito devuelto | 200 `{"estado":"cancelada","credito_devuelto":true}`, y los créditos pasaron de `usados:1` a `disponibles:1` |
| `PATCH /reservas/{id}` cancelar otra vez | 409 | 409 `ya_cancelada` |
| `PATCH /reservas/{id}` `{"estado":"confirmada"}` | 400 | 400 `datos_invalidos` |
| `PATCH /reservas/{id}` inexistente | 404 | 404 `no_encontrado` |
| `DELETE /reservas/{id}` | 405 | 405 |

---

## Apéndice: un horario ocupado que hizo pasar tres pruebas por buenas

La primera corrida de los endpoints de administración dio esto:

```
POST /clases  con sesion de admin     409  horario_ocupado   <- esperaba 201
POST /clases  tipo inexistente        409  horario_ocupado   <- no probo lo que pretendia
PATCH /clases/{id}  editar cupo       308
PATCH /clases/{id}  cancelar          308
PATCH /clases/{id}  cliente intenta   308
```

El horario elegido para crear la clase ya estaba ocupado por los datos de
prueba, así que el `POST` devolvió 409 y el id volvió **vacío**. Las tres URL
de `PATCH` quedaron como `/api/v1/clases/` con barra final, y a eso Next
responde con un **308** redirigiendo: las tres pruebas nunca llegaron al
handler.

Lo que hay que ver acá no es el 409. Es que **tres pruebas se ejecutaron, no
fallaron, y no probaron nada.** Un 308 no es un error; si la tabla de
resultados hubiera dicho "no 403" en vez del número, las tres habrían pasado
por verificadas. El caso de `tipo inexistente` es peor todavía: devolvió 409 en
vez del 400 que buscaba, y 409 es un código de la propia API, así que parecía
una respuesta legítima.

La corrección fue elegir horarios libres y mirar que el `POST` devolviera 201 y
un id antes de usarlo. La lección es la misma que el proyecto ya tenía anotada:
una prueba que no afirma qué esperaba no es una prueba, es una llamada.
