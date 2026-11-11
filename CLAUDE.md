@AGENTS.md

## Contexto del proyecto

Proyecto final de Programación Web (ITBA). Entrega: 12 de noviembre de 2026.

Stack obligatorio: Next.js (App Router), Supabase, Mercado Pago sandbox, Vercel.

## Reglas

- Trabajar siempre en ramas, nunca commitear directo a main.
- Explicar los cambios antes de aplicarlos. Soy principiante.
- Server Components por defecto. Solo usar 'use client' donde haya
  interactividad real (useState, onClick, useEffect).

  **Hay tres excepciones en el proyecto, y cada una se justifica distinto.**

  **Primera: `app/components/CampoDeContrasena.jsx`.**
  El módulo 10 pide un indicador visual de fortaleza de contraseña, y
  *fortaleza* implica grados: una versión con CSS puro puede decir "falta algo"
  pero no "débil / bien / muy buena", porque un input tiene un solo `pattern`.
  Para graduarlo hace falta leer lo que se escribe, y eso es estado de cliente.

  **El límite de la excepción, que es lo que la hace aceptable:** el medidor es
  un agregado, no una dependencia. Nada funcional pasa por ahí. Con JavaScript
  apagado el componente igual se renderiza en el servidor y queda un campo
  normal con su `pattern`, su `minLength` y la lista de requisitos a la vista;
  lo único que se pierde es la barra moviéndose. Verificado: con JavaScript
  desactivado en el navegador, el registro se completa y crea la cuenta.

  **Segunda: `app/components/FormularioDeContacto.jsx`.** El módulo 6 del curso
  pide un formulario con DOM dinámico, validación y `fetch`, y los tres estados
  de una petición en curso no se pueden mostrar con CSS.

  **Pero acá la segunda mitad de la regla NO se cumple sola: el `fetch` es
  funcional.** Es el camino por el que se manda el mensaje. Lo que hace
  admisible la excepción es que el `<form>` lleve también un `action` a una
  Server Action, así que sin JavaScript el navegador lo postea y el mensaje se
  guarda igual. Con eso el camino funcional es el formulario nativo y el `fetch`
  vuelve a ser un agregado.

  **El respaldo no es un extra: es la condición.** Si deja de funcionar, el
  componente no corresponde, y la prueba que lo vigila es E22, en
  `e2e/sin-javascript.spec.js`.

  Que los dos puedan convivir está **medido**, con su control: `preventDefault()`
  en `onSubmit` impide que React ejecute el `action` en Next 16.4.3, y el mismo
  formulario sin `preventDefault` sí lo ejecuta. La documentación instalada no
  lo afirma para `action`, solo para el componente `<Form>`. Está en
  `docs/arquitectura.md` §5.2.

  **Tercera: `app/error.jsx`.** La documentación de la versión instalada dice
  en ocho lugares que *"Error boundaries must be Client Components"* y no ofrece
  variante de servidor. `not-found.jsx` sí es de servidor, y por eso el 404
  propio no necesitó JavaScript; este sí.

  **Y su argumento no es ninguno de los dos anteriores.** Medido con una ruta
  que revienta y con su control: el HTML de un 500 es un `<body>` con un
  `<div hidden>` y **ni una palabra visible, con o sin el archivo**. O sea:

  - **Sin JavaScript no se pierde nada**, porque la pantalla ya estaba vacía.
  - **Nada de lo que una persona hace pasa por ahí:** solo se renderiza
    **después** de que algo ya se rompió. No es una función, es una red.

  Muestra el `error.digest`, que es el mismo mecanismo que la API: un
  identificador que también queda en el registro. No lleva `useEffect` —el
  ejemplo de la documentación lo usa para registrar, y el servidor ya registró—.

  **Las tres ramas de la regla, para un cuarto caso.** Hay que demostrar que no
  se puede con CSS, **y** una de estas tres:
  1. que lo que se agrega no es funcional (el medidor);
  2. que hay un respaldo sin JavaScript que sí lo es (el formulario);
  3. que sin JavaScript no se pierde nada porque ya no había nada, y que nada
     de lo que la persona hace pasa por ahí (el error boundary).

  La tercera es la más fácil de usar mal: pide demostrar que el camino sin
  JavaScript **ya estaba vacío**, no suponerlo.
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

## Contraseñas

- Las reglas viven en `app/lib/contrasena.js` y las piden **tres capas**: el
  `pattern` del navegador, `esValida()` en la Server Action, y las Password
  Requirements configuradas en Supabase. Las tres tienen que pedir exactamente
  lo mismo o alguien pasa una y rebota contra otra con un error en inglés.
- **La que manda es Supabase**, porque `/auth/v1/signup` es público y
  alcanzable con la clave publishable: se puede crear una cuenta sin pasar
  nunca por nuestro formulario. Si cambian las Password Requirements en el
  panel, hay que actualizar `contrasena.js`, no al revés.
- El `pattern` se compila con la bandera `v`, que **obliga a escapar**
  `( ) [ ] { } / - |` dentro de una clase de caracteres. Mal escapado, el
  navegador lo descarta en silencio y deja de validar sin avisar.
- **Al ingresar no se valida la fortaleza.** Quien se registró con las reglas
  viejas tiene que poder entrar igual, y exigirlas ahí además revelaría la
  política vigente.
- Supabase rechaza poner **la contraseña que ya está puesta** (`same_password`),
  y compara **solo contra la actual**: no hay historial de contraseñas
  anteriores. Los textos de la pantalla dicen exactamente eso y no "ya usaste
  esa contraseña", que afirmaría una protección que no existe.

  *Posible mejora, no pendiente:* impedir de verdad el reúso de contraseñas
  anteriores requeriría guardar los hashes viejos. Eso es una decisión aparte
  con su propio costo —más datos sensibles guardados, y hay que decidir cuántos
  y por cuánto tiempo— así que no está hecho ni se debe.

## Validación

- **Los esquemas de `app/lib/esquemas.js` son la única definición** de cada
  regla: qué es un uuid, una fecha, una hora, un correo, una contraseña.
  `app/lib/validacion.js` ya no define nada, solo los envuelve con la forma que
  venían usando las Server Actions. Los dos caminos de entrada —formularios y
  API— parten de los mismos esquemas, que es lo que hace que el panel y la API
  acepten exactamente lo mismo.
- **Los largos de texto del catálogo salen de `esquemas.js`**, no de cada
  archivo: `LARGO_NOMBRE` y `LARGO_INCLUYE` estaban escritos a mano en cuatro
  lugares —la constante de la Server Action, el esquema, el `maxLength` del
  formulario y el texto del mensaje de error— y cuatro copias del mismo número
  es la manera de que un día el formulario deje escribir 80 y el servidor
  rechace a los 60 sin que nadie entienda por qué.
- **`TextoOpcional` y `UuidOpcional` tratan igual a `''` y a `undefined`**, y
  los dos terminan en `null`. Un formulario manda `''` cuando el campo queda
  vacío; un cuerpo JSON directamente omite la clave. Si uno de los dos
  ayudantes cubre un caso y el otro no, el próximo que use el incompleto se
  come un 400 sin motivo visible.
- `docs/ejemplos/probar-esquemas.mjs` comprueba que el esquema use la constante
  exportada y no un número que casualmente coincide. Corre con `node` a secas
  porque `esquemas.js` importa `'./contrasena.js'` **con la extensión**: Next
  resuelve las dos formas, pero sin la extensión el módulo no se puede importar
  sin compilar el proyecto.
- Zod v4: las formas son `z.email()` y `z.uuid()`, no `z.string().email()`.
  `z.iso.date()` además **rechaza fechas que no existen** como `2026-02-31`, que
  antes había que comprobar a mano construyendo un `Date`.
- **Zod está declarada en `package.json` a propósito.** Antes estaba disponible
  solo porque la arrastraba `eslint-plugin-react-hooks`. Usarla así es una
  trampa: el día que esa dependencia cambie, el build se rompe sin que nadie
  haya tocado una línea nuestra.

  *Mejora pendiente, sin apuro:* que las Server Actions validen el formulario
  entero con un esquema de objeto en vez de campo por campo. Es mejor estilo,
  pero **no arregla ninguna duplicación** —eso ya quedó resuelto con que
  `validacion.js` envuelva a `esquemas.js`— y toca código ya verificado.
  Mercado Pago ya está hecho, así que el impedimento de calendario no está
  más; sigue sin apuro porque no arregla nada roto.

## Claves y variables de entorno

- Las claves van en `.env.local`, nunca en el código. Ese archivo está ignorado
  por git (`*.local` en `.gitignore`).
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` es pública por diseño: viaja al
  navegador y cualquiera puede leerla. Lo que protege los datos no es la clave,
  es RLS. Si una tabla queda sin políticas o con RLS apagada, esa clave alcanza
  para leerla entera.
- La clave secreta (`sb_secret_...`) solo se usa en el servidor, nunca lleva el
  prefijo `NEXT_PUBLIC_` y nunca entra a git. Hoy el proyecto no la necesita:
  todas las lecturas son públicas.
- En Vercel las variables se cargan aparte, en Settings → Environment Variables,
  porque `.env.local` está ignorado por git y nunca llega al deploy.
  Las que empiezan con `NEXT_PUBLIC_` se cargan como **Config**, no como
  **Secret**: por definición terminan en el navegador, y marcarlas como secreto
  da una sensación de protección que no existe. La secreta, cuando haga falta,
  sí va como Secret.

## Autorización

- **Tres capas, y cada una cubre una falla distinta de la anterior.**
  `proxy.js` mira solo si hay sesión: es una verificación optimista y no
  consulta la base, porque corre en cada pedido incluidos los que Next hace por
  adelantado. `app/lib/autorizacion.js` verifica el rol, y lo llaman **todas**
  las páginas y **todas** las Server Actions. RLS en Supabase rechaza la
  escritura igual, y es la que no se puede saltear.
- **La verificación de rol no va en un layout.** La documentación de la versión
  instalada de Next lo dice en "Layouts and auth checks": los layouts no se
  vuelven a renderizar al navegar, no deciden si el resto de la ruta se
  renderiza, y las Server Actions no pasan por ellos. Un panel protegido solo
  por su layout se edita invocando la acción directo.
- **401 y 403 no son lo mismo.** Sin sesión se redirige a `/ingresar` guardando
  el destino. Con sesión y sin permiso se muestra "sin permiso" y no se
  redirige a ingresar: volver a entrar con la misma cuenta da el mismo
  resultado.
- **Todo parámetro de retorno se valida con `rutaInterna()`.** Un `volver` sin
  validar convierte el login en una redirección abierta: la víctima ve el
  dominio real y termina en una copia del sitio.
- **Para escribir lo que RLS no le permite a administración, funciones
  `security definer` que verifican `es_admin()` adentro, no la clave secreta.**
  La clave secreta saltea RLS por completo; una función hace una sola cosa y se
  puede auditar.
- **Una política con `or es_admin()` no filtra por persona.** `reservas`,
  `creditos`, `compras` y `perfiles` dicen `user_id = auth.uid() or
  es_admin()`: para una cuenta común RLS ya devuelve solo lo suyo, pero para
  una cuenta de administración devuelve **todo**. Cualquier pantalla "mis
  cosas" tiene que filtrar por `user_id` igual, aunque parezca redundante. Sin
  ese filtro, `/cuenta` le mostraba a quien administra las reservas ajenas como
  propias.

- Una escritura que RLS rechaza **no devuelve error**: devuelve que no cambió
  ninguna fila. Toda actualización del panel termina en `.select()` para
  distinguir "no tenía permiso" de "guardado".

## Reservas

- **Reservar y cancelar son funciones de la base, no código que consulta y
  después escribe.** `reservar_clase()` bloquea la fila de la clase con
  `for update` antes de contar, y toma el crédito con `for update skip locked`.
  Contar desde el servidor y escribir después es la carrera que dos personas
  tomando el último lugar ganan las dos.
- **`reservas` no tiene política de INSERT ni de UPDATE.** Es a propósito: el
  candado de la función solo vale si no hay otra puerta. Lo mismo que
  `creditos`. Si alguna pantalla necesita escribir ahí, va una función nueva,
  no una política.
- **Un crédito está tomado si lo referencia cualquier reserva**, sin mirar su
  estado. Cancelar a tiempo suelta el `credito_id` y lo devuelve; cancelar
  tarde lo deja enganchado y por eso se pierde. La regla vive en
  `app/lib/creditos.js` y la usan `/cuenta` y `/admin/creditos`.
- **Cuando el estudio cancela una clase**, un disparador pasa sus reservas a
  canceladas y les devuelve el crédito, sin mirar la ventana. Al reactivarla no
  vuelven: esas personas ya tienen su crédito de nuevo.
- `supabase/probar-reservas.sh` levanta un Postgres descartable y prueba las
  seis situaciones, incluida la carrera con dos transacciones reales. Cada
  resultado es una afirmación que corta el arnés si no se cumple; hasta el 11 de
  noviembre de 2026 solo se imprimía, y el CI no podía verlo fallar.

## La API (`/api/v1`)

El recorrido completo está en `docs/api.md`. Acá lo que hay que saber antes de
tocarla.

- **La llama una sola pantalla, desde el 4 de noviembre de 2026: el
  formulario de `/contacto`, que manda con `fetch` a `POST /mensajes`.** Para
  leer datos, las páginas son Server Components y llaman a las funciones de
  `app/lib/` directamente; un `fetch` contra el propio servidor pagaría un
  viaje de red para pedirse algo a sí mismo. `/salud` es el único endpoint con
  un propósito que ninguna Server Action puede cubrir —monitoreo externo, que
  pregunta sin que haya nadie usando el sitio—, `/mensajes` tiene su
  consumidor, y los otros diez son un ejercicio. Está dicho así en
  `docs/api.md` §1 a propósito: **un endpoint documentado como ejercicio es
  información honesta; uno presentado como pieza de arquitectura cuando nadie
  lo llama es decorado.** No agregar un consumidor inventado para disimularlo.
- **No hay Global Error Middleware en App Router.** `proxy.js` corre antes del
  enrutamiento y no envuelve al handler; `error.js` es para renderizado de
  páginas y un Route Handler no renderiza. El equivalente se construyó
  componiendo `manejador()` alrededor de cada handler. **La cobertura es una
  convención, no una garantía:** un handler exportado sin envolver queda afuera
  y nadie avisa, así que se cuenta —hoy 12 exportados y 12 envueltos— y el
  comando está en `docs/api.md` §3.
- **Un solo ayudante de identidad, `clienteDeApi()`, con dos mecanismos.**
  Cookie para el navegador (es la misma cookie `HttpOnly` del resto del sitio);
  `Authorization: Bearer` para un script o una app, que no tiene cookies. **El
  webhook de Mercado Pago no pasa por ahí y no debe:** se identifica firmando
  el pedido, que es un tercer mecanismo y va en su propia ruta. Meterlo acá
  obligaría a que este ayudante acepte "o una firma HMAC" y dejaría de ser el
  lugar donde se decide quién llama.
- **El 401 de la API manda `WWW-Authenticate` y el del sitio no.** No es una
  inconsistencia: el sitio usa cookie y no hay esquema HTTP que corresponda,
  mientras que la API acepta `Bearer` y entonces sí hay uno que nombrar. El 403
  no la lleva en ningún caso, porque quien llama ya está identificado.
- **No hay un solo `DELETE`, y es el dominio, no un olvido.** Las reservas se
  cancelan y conservan el historial; cancelar tiene una consecuencia que quien
  llama necesita saber —si el crédito volvió o se perdió— y un 204 sin cuerpo
  no tendría dónde decirla. Reactivar tampoco es un `PATCH`: es reservar de
  nuevo, y tiene que volver a pasar por `reservar_clase()` con su candado.
- **Ningún endpoint reimplementa una regla del negocio.** Cuando apareció la
  tentación se extrajo la regla a un lugar compartido: la del cupo contra las
  reservas tomadas vive en `app/lib/clases.js` y la usan el Route Handler y el
  panel. Copiarla habría dejado al estudio con dos reglas de cupo según por
  dónde entre el pedido.
- **El 409 no está en la lista de la materia y hace falta.** "La clase se
  llenó", "ya hay una clase a esa hora" no son datos inválidos ni recursos
  ausentes: el pedido estaba bien y lo que cambió fue el estado del sistema.
- **Un filtro de Supabase sobre una tabla relacionada se descarta en
  silencio** si el join es externo. `GET /reservas?fecha=` devolvía todo como
  si no hubiera filtro hasta que se pidió el join como `clases!inner`. Si se
  agrega un filtro sobre algo que viene de un join, hay que comprobar que
  **filtre**, no que responda 200.
- **La migración de las Server Actions a la API sigue pendiente, y el motivo
  que queda no es de calendario.** Decía "después de Mercado Pago"; Mercado
  Pago ya está hecho. Lo que no caducó: las Server Actions dan **mejora
  progresiva**, y el formulario de reservas funciona con JavaScript apagado,
  verificado. Pasarlas a `fetch` las rompería sin JavaScript. No es "lo mismo
  por otro camino": es una decisión sobre qué se pierde, y hay que tomarla con
  eso a la vista, no como un paso de limpieza.

## Mercado Pago

El recorrido está en `docs/api.md` §14. Acá lo que se va a olvidar.

- **`current_user` dentro de una función `security definer` es el dueño de la
  función, no quien la llama.** Medido contra Postgres 18: fuera de la función
  `current_user` es `service_role`, adentro es `postgres`. Para saber con qué
  rol entró el pedido se usa `current_setting('role', true)`. El guardia de
  `otorgar_creditos()` comparaba `current_user` y por eso **rechazaba al
  webhook**; no se había notado porque las pruebas corrían con sesión de
  administración, donde `es_admin()` devuelve verdadero y el `or` corta antes.
  Tampoco sirve `request.jwt.claim.role`: las claves nuevas (`sb_secret_...`)
  no son JWT, son opacas.
- **`external_reference` y `compras.mp_payment_id` no son lo mismo y no pueden
  serlo.** La primera la elegimos nosotros **antes** de que el pago exista y
  contesta "quién compraba qué"; el segundo lo elige Mercado Pago **después** y
  es el `unique` que da la idempotencia. Por eso existe
  `intenciones_de_pago`: la `external_reference` tiene que apuntar a algo.
- **La intención y la compra no están relacionadas en el esquema.** El vínculo
  existe solo del lado de Mercado Pago. No se puede preguntarle a la base qué
  intenciones terminaron en compra. Relacionarlas obligaría a tocar
  `otorgar_creditos()`, que es la función con la idempotencia probada.
- **El precio sale de la base, nunca del formulario.** Del formulario viaja
  solo el id del paquete. Un precio en un campo oculto se edita y se paga el
  paquete de 12 clases a un peso.
- **`idempotencyKey` no hace nada para preferencias.** Medido: misma clave,
  mismo cuerpo, dos preferencias distintas. Lo que protege de acreditar dos
  veces es el `unique` de `compras.mp_payment_id`.
- **Mercado Pago tiene una clave secreta distinta por modo, y los avisos de
  pagos de cuentas de prueba llegan firmados con la de "Modo de prueba".** No
  es deducible: el pago dice `live_mode: true`, la URL estaba cargada en el
  campo de modo productivo y el evento tildado era el correcto. El síntoma fue
  un **401 en cada aviso**, idéntico a un error de firma propio, y la única
  forma de verlo fue el historial de notificaciones del panel, donde el filtro
  de ambiente decía "Prueba". Por eso el handler acepta las dos:
  `MP_WEBHOOK_SECRET` y `MP_WEBHOOK_SECRET_PRUEBA`. Si alguna vez vuelve a dar
  401 en todo, **mirar el ambiente en el panel antes de revisar el código.**
- **La regla de los códigos del webhook: si reintentar puede arreglarlo, 500;
  si no, 200.** Un 200 apaga los reintentos de Mercado Pago, cualquier otro
  código los enciende. Sin `MP_WEBHOOK_SECRET` se devuelve **500**, no 200:
  un 200 daría por aceptado un aviso que nadie verificó y el pago se perdería
  en silencio. Un 404 de Mercado Pago al consultar el pago **también** es 500,
  porque el aviso llega a veces antes de que el pago se pueda consultar.
- **El `data.id` de la firma va tal cual lo mandó la URL.** El manifest omite
  los pares ausentes, así que completarlo desde el cuerpo —que parece una
  mejora— haría que una firma legítima deje de coincidir.
- **`POST` a una ruta inexistente devuelve 200 en el deploy, no 404**, con el
  HTML del not-found y `x-matched-path: /_not-found`. En local da 404. La
  consecuencia es grave para un webhook: una URL mal escrita en el panel de
  Mercado Pago recibe 200, el aviso se da por entregado y el pago se pierde.
  Para saber si una ruta está tomada hay que mirar `x-matched-path`, no el
  código.
- **Probar un pago exige un usuario comprador de prueba**, en ventana de
  incógnito, con tarjeta de prueba y titular `APRO`. Pagar como invitada o con
  una cuenta real se rechaza con "No pudimos procesar tu pago", y el mensaje no
  dice por qué.

## Pruebas

El recorrido completo está en `docs/pruebas.md`. Acá lo operativo.

- **Hay que verlo fallar alguna vez**, y eso no cambió. Lo que cambió es que
  ahora hay CI: el módulo 14 agregó `.github/workflows/ci.yml`, y **el
  argumento de que no hacía falta estaba mal**. Era cierto de un CI decorativo,
  no de uno que bloquea el merge. Ver la sección "Integración continua".
  Lo que **no** corre en el CI y sigue siendo a mano está en
  `docs/despliegue.md` §11: las E2E, porque escriben en la única base que hay,
  y `probar-preferencia.mjs`, porque le pega a Mercado Pago de verdad.
- **Las E2E van contra el sitio compilado**, no contra `next dev`.
  `playwright.config.js` levanta `npm run build && next start -p 3100` solo.
  `npm run test:e2e`, `test:e2e:ui` para el modo interactivo,
  `test:e2e:informe` para el informe de la última corrida.
- **Las credenciales de administración salen de `.env.local`**, como
  `E2E_ADMIN_EMAIL` y `E2E_ADMIN_PASSWORD`. La cuenta no se puede crear desde
  la prueba: el rol `admin` lo pone una fila de `perfiles` y una cuenta nueva
  nace `cliente`. Si faltan, esa especificación se saltea con el motivo. La
  misma contraseña está en `cuentas-de-prueba.local`: **si se rota, hay que
  cambiarla en los dos**.
- **LAS TRES REGLAS DE DATOS DE LAS E2E**, que están implementadas en
  `e2e/fixtures.js` porque hay **un solo proyecto de Supabase** y las pruebas
  escriben donde escribe el sitio:
  1. **No se toca el catálogo.** `paquetes`, `tipos_clase` e `instructoras`
     solo se leen: un precio cambiado por una prueba queda cambiado.
  2. **Lo que se crea no puede correr el final de la agenda.** Las clases de
     prueba van en una fecha **que ya tiene clases**, a una hora que el estudio
     no usa. Crearlas en 2027 —que es lo que hacía la primera versión— mueve
     `ultimaFecha` y `/reservar` deja avanzar por semanas vacías.
  3. **Lo que se crea, se borra**, en el teardown del fixture.
- **Una cuenta nueva por corrida**, creada con `POST /auth/v1/admin/users` y
  `email_confirm: true`, borrada al terminar. Así funciona igual con "Confirm
  email" activado o apagado, y **no depende de que se pueda mandar un correo**:
  con Resend sin dominio verificado, el correo solo llega a una dirección.
- **Sin reintentos.** `retries: 0`: un reintento convierte una prueba inestable
  en una que "pasa a veces".
- **Los tres motores solo donde pagan**: las pruebas sin estado y las sin
  JavaScript; las que escriben, solo Chromium. Y **WebKit no puede abrir sesión
  contra el sitio local**, porque descarta la cookie `Secure` sobre http: las
  dos pruebas que necesitan sesión se saltean ahí con el motivo medido. No se
  baja `secure` para que pasen.
- **La lista de pantallas del panel está escrita a mano a propósito** en
  `admin.spec.js`, y es la única excepción a "un dato, una fuente" del
  proyecto: **una prueba que se actualiza sola no puede detectar una
  regresión.** Si la lista se leyera del código, agregar una pantalla sin
  protegerla la agregaría también a la prueba y la prueba pasaría.

## Mensajes de contacto

- **`mensajes` no tiene política de INSERT.** Es a propósito, igual que
  `reservas`, `creditos` e `intentos_ingreso`: la clave publishable viaja al
  navegador, así que una política de INSERT para anónimos sería una invitación a
  llenar la tabla con un `curl` en un bucle. La única puerta es
  `enviar_mensaje()`, que tiene el límite adentro.
- **El límite es por correo, cinco por hora, y no por IP.** Limitar por IP frena
  mejor a un bot pero exige **guardar** la IP de cada persona que escribe, y
  este proyecto ya rechazó guardar datos sensibles de más cuando descartó el
  historial de contraseñas. El correo ya está en la fila.
  *Lo que ese límite no hace:* frenar a quien varíe el correo en cada envío.
  Frena el doble clic y el bot perezoso. Lo único que cerraría esa puerta es un
  CAPTCHA, descartado a propósito (ver `docs/seguridad.md`).
- **Los largos están en dos lados que no se pueden importar entre sí:**
  `app/lib/esquemas.js` y la función de la migración 014. Es la única
  duplicación conocida del proyecto, y lo que impide que se separen es la
  sección 8 de `supabase/probar-mensajes.sh`, que **lee las constantes del
  archivo de JavaScript** y prueba la función en los bordes. Si cambia uno de
  los dos, ese arnés falla.
- **`/privacidad` menciona los mensajes de contacto.** Si algún día se empieza a
  guardar la IP o cualquier dato nuevo, esa página tiene que decirlo: hoy afirma
  textualmente que no se guarda la dirección IP.

## Correo

- **No activar "Confirm email" sin un dominio verificado en Resend.** Resend en su
  dominio de prueba (`resend.dev`) solo entrega a la dirección de la cuenta, y con
  la confirmación activada cada alta necesita mandar un correo: el registro se
  rompe para cualquier otra dirección. Medido el 10 de noviembre de 2026, con una
  dirección real: `500 "Error sending confirmation email"`, sin cuenta creada.
- Por eso hoy está **apagado a propósito**, y la fuga de `user_already_exists` en
  el endpoint crudo de Supabase está abierta. Es el canje medido, no un olvido:
  ver `docs/seguridad.md` §2.1.
- **El SMTP incorporado de Supabase no es la salida**: también envía solo a las
  direcciones del equipo del proyecto, y con un límite de 2 por hora.
- La **recuperación de contraseña** depende del mismo correo, así que hoy solo le
  llega a la dirección verificada.
- Cuando algo dependa de que un correo llegue, **se prueba con una dirección
  real**, no se deduce del código. El 7 de noviembre se escribió que el registro
  funcionaba leyendo la redirección de `sesion.js`, y era falso.

## Lo que llega por la URL

- **Un parámetro de la URL no se usa como clave de un objeto.** `MENSAJES[parametros?.error]`
  parece inofensivo y no lo es: una clave como `toString`, `constructor`,
  `valueOf` o `__proto__` devuelve la propiedad **heredada del prototipo** de
  `Object`, casi siempre una función, y una función no se puede renderizar.
  Medido el 7 de noviembre de 2026: **nueve pantallas devolvían 500** con
  `?error=toString` y `/reservar` dibujaba una caja `role="alert"` vacía.
  Se usa `mensajeDe()` de `app/lib/avisos.js`, que mira solo las propiedades
  propias con `Object.hasOwn`.
- Es la misma regla que ya valía para `volver` con `rutaInterna()`. **Todo lo
  que llega por la URL se valida antes de usarlo**, y "usarlo" incluye
  indexar un objeto con eso.

## Si se agrega un endpoint sin sesión

- **La protección de CSRF de Next cubre las Server Actions, no los Route
  Handlers.** Medido con el mismo `Origin` ajeno: `POST /contacto` (acción) da
  500 y `POST /api/v1/mensajes` (handler) daba 201. A los endpoints con sesión
  no les afecta, porque la cookie es `SameSite=Lax` y no viaja en un POST de
  otro sitio; **el expuesto es cualquiera que no pida sesión**.
- Lo que se hace: rechazar `Sec-Fetch-Site: cross-site`, como en
  `app/api/v1/mensajes/route.js`. La pone el navegador, no quien escribe el
  pedido, así que un `curl` o un script pasan —eso es deliberado, y por eso los
  ejemplos de `docs/api.md` siguen valiendo—. Lo que bloquea es un formulario
  de otro dominio haciendo que sus visitantes escriban.

## Limpiar datos de prueba

- **Las clases de prueba van por una lista explícita de ids, no por un
  predicado.** Hasta el 7 de noviembre de 2026 se identificaban por
  `fecha >= '2027-01-01'`, y ese día el seed —que va de `current_date` a
  `current_date + 55`— empezó a generar clases el 2027-01-01: el script se
  habría llevado siete clases reales. El propio archivo había escrito la
  advertencia semanas antes y no sirvió de nada; lo que avisó fue
  `probar-limpieza.sh`.
- El protocolo es: correr la sección 1, **leer** lo que devuelve, y pegar los
  ids en el `declare` de la sección 2. Con la lista vacía el script no borra
  ninguna clase y lo dice.
- **Un riesgo documentado no es un riesgo cubierto.** La diferencia es si hay
  algo que falle cuando ocurra.

## Qué revalidar después de escribir

- **Paquetes** → `/paquetes` y `/`.
- **Créditos y reservas** → nada. Esos datos no se muestran en ninguna página
  pública: los créditos de alguien se ven en su cuenta y en el panel, y las dos
  son dinámicas.
- **Clases** → `revalidatePath('/', 'layout')`, o sea el sitio entero, porque
  `Footer.jsx` deriva el horario de atención de la tabla `clases` con
  `horariosDeAtencion()` y el footer está en el layout raíz. Cancelar la última
  clase de las 7 de un día cambia el pie de `/contacto` y de `/terminos`: eso
  está verificado. Lo que **no** es cierto es que esa llamada sea hoy lo que lo
  hace visible — ver la deuda sobre el caché más abajo.
- Antes de agregar una escritura nueva, buscar quién lee esa tabla. Hoy
  `clases` la leen cuatro: `agendaDeLaSemana()` en `/reservar`, `semanaTipo()`
  en `/horarios` y en la home, `horariosDeAtencion()` en el footer, y el
  tablero.

## Integración continua

- **El pipeline bloquea el merge, no el deploy.** Vercel deploya con su propia
  integración de GitHub, en paralelo al workflow, y los dos escuchan el mismo
  push sin esperarse. Lo que cierra el hueco es la regla de protección de rama
  sobre `main`, con las dos casillas: exigir pull request **y** exigir los
  checks. La segunda sin la primera no sirve, porque un push directo las
  saltea. Está en `docs/despliegue.md` §13, con los nombres exactos de los
  checks.
- **Nada de lo que corre en cada push toca un servicio externo, y hay que
  mantenerlo así.** Es lo que hace que el pipeline no necesite ningún secret.
  Un paso nuevo que precise una credencial va al job manual de E2E, no a los
  tres que corren siempre.
- **El build no puede necesitar la base.** `generateStaticParams` de
  `/clases/[slug]` es lo único del proyecto que consulta Supabase al compilar,
  y devuelve lista vacía si falla. Un build que depende de que un tercero esté
  arriba no compila el día que ese tercero tiene un problema, ni en el CI ni en
  Vercel. No agregar lecturas de datos en tiempo de build.
- **Para comprobar que algo funciona *sin* una configuración, no alcanza con
  sacarla del entorno.** `env -i npm run build` limpia el entorno del proceso
  pero no borra `.env.local` del disco, y Next lo carga por su cuenta. Como ese
  archivo está en `.gitignore`, es invisible en el diff. La forma correcta es un
  árbol con solo los archivos que git versiona:
  `git ls-files -z | rsync -0 --files-from=- -q . /destino/limpio/`.
  Un CI encuentra esta clase de error y una verificación local no.
- **Los arneses derivan su ruta con `$(dirname "$0")`, nunca escrita a mano.**
  Un `P=/Users/...` pasa en una sola máquina del mundo y el CI lo encuentra.
  Y la búsqueda de `initdb` lleva `null_glob` acotado a la función, porque zsh
  —al contrario de bash— aborta cuando un glob no coincide con nada.
- **Playwright y `probar-preferencia.mjs` no corren en cada push**, a propósito:
  el primero escribe en la única base que hay, el segundo le pega a la API de
  Mercado Pago de verdad. `docs/despliegue.md` §11 dice cómo se corren a mano.

## Alcance descartado

Lo que se decidió no hacer, para que no se confunda con un olvido.

- **Paquete "Mes libre"** — 13 de octubre de 2026, migración 008. Era el único
  paquete sin cantidad fija de clases, y obligaba a un caso especial en tres
  lugares: el panel, la reserva y el webhook de Mercado Pago. Con la entrega a
  cuatro semanas se eligió un modelo de créditos coherente antes que dos
  modelos a medias. Si vuelve, no vuelve como un `clases` en null: vuelve como
  su propio concepto, una suscripción con fecha de inicio y de fin.

## Deuda conocida

- La compensación óptica de los títulos depende de la **primera letra** del
  título, no de la página. El valor por defecto (0.07em) sirve para las letras
  de asta recta (N, P, R, H, E).

  **`--compensacion` no se declara en `app/globals.css`:** ahí solo se consume,
  con `var(--compensacion, 0.07em)`. Las dos líneas del CSS que parecen
  declararla están dentro de un comentario. Los overrides reales son un **estilo
  en línea pasado como prop** a `EncabezadoPagina`.

  Hoy hay **tres**, no dos: `/contacto` y `/compra/listo` con `0.02em` —las dos
  empiezan con C— y `/terminos` con `-0.01em`. El tercero entró con Mercado
  Pago, en el módulo 12, y esta nota siguió diciendo dos hasta la auditoría de
  los módulos 6 y 7. **Eso es exactamente el riesgo que esta deuda describe:**
  cada título nuevo que empiece con una letra curva es un override nuevo que
  nadie recuerda. Si un título cambia de nombre, el valor queda mal y nada lo
  avisa: hay que volver a medir el borde visible del primer carácter.

- **Los códigos de estado del 403 no son 403.** Una página sin permiso devuelve
  200 con un mensaje, y una Server Action rechazada por `exigirAdmin()` devuelve
  500, porque corta con un `throw`. Las dos cosas se comportan bien —no se
  renderiza el panel y no se escribe nada— pero el código HTTP miente: 500 dice
  "el servidor se rompió" donde en realidad pasó "no tenés permiso".
  Next 16 tiene `forbidden()` y `forbidden.js`, que devuelven el código
  correcto, pero la documentación de la versión instalada los marca
  `version: experimental` y exigen activar `experimental.authInterrupts`. Se
  decidió no meter un flag experimental a cuatro semanas de la entrega. Cuando
  dejen de ser experimentales, migrar: hoy un monitoreo externo ve errores de
  servidor donde hubo rechazos de permisos.

- Cancelar una clase cambia su estado y **no** libera el horario: el
  `unique (fecha, hora)` sigue valiendo para la fila cancelada, así que no se
  puede crear otra clase ese día a esa hora. Hay que reactivar esa. Es a
  propósito —esa fila tiene reservas colgando— pero sorprende si no se sabe.

- **No hay estado "cargando", y `loading.jsx` NO es la solución barata que
  parece.** Se escribieron cinco —`/paquetes`, `/clases`, `/clases/[slug]`,
  `/horarios`, `/reservar`— y hubo que revertirlos.

  El motivo, medido con una ruta que tarda 1,5 segundos a propósito: con un
  `loading.jsx`, Next **transmite** la respuesta y el contenido real llega por un
  `<script>` en línea que lo inserta. Sin JavaScript ese script no corre, así que
  **la página se queda en "Cargando…" para siempre**. Cambia "no hay señal
  mientras espera" por "nunca se ve el contenido", que es peor.

  Y no lo encontró una revisión: lo encontró **la suite completa**. De a una las
  pruebas pasaban; las 83 juntas dieron 15 fallas, nueve de ellas en pruebas que
  no tienen nada que ver con cargar datos. El `<Suspense>` **solo se activa
  cuando los datos tardan**, así que no se ve en desarrollo ni en una prueba
  aislada: se ve bajo carga.

  Lo que lo desbloquearía no es escribir los archivos, es decidir que el sitio
  puede dejar de funcionar sin JavaScript en las rutas lentas.

- **Hoy no hay caché de datos, y `revalidate = 3600` no hace nada.** Medido
  sobre el sitio compilado y servido con `next start`: una escritura hecha
  directo en la base, sin que ninguna acción llame a `revalidatePath`, ya se ve
  en el pedido siguiente, tanto en el pie de página como en `/paquetes`. Todas
  las rutas son dinámicas porque el header lee cookies, y las lecturas de
  Supabase no entran al Data Cache.
  Las entradas que aparecen en `.next/cache/fetch-cache` después de un build
  son del build, no de lo que se sirve en caliente: **no alcanza con verlas ahí
  para concluir que una página está cacheada.**
  Las llamadas a `revalidatePath` se dejan igual: limpian el Router Cache del
  navegador y son la línea que va a hacer falta el día que algo se cachee de
  verdad. Pero no son lo que hace visible un cambio hoy.

  **Y ahora hay número, que salió del CI de rebote.** Contraprueba en un clon,
  sacando una sola línea —`<Header />` del layout raíz— y compilando con las
  mismas variables: aparecen `flow.html`, `power.html` y `prenatal.html`, el
  resumen muestra la columna `1h` del `revalidate`, y el build pasa de **1
  página estática a 16**. Esa es la medida exacta de lo que cuesta leer cookies
  en el layout raíz. No se cambia: un header que no sabe si hay sesión hay que
  pintarlo en el navegador, o sea `'use client'` y un parpadeo. Lo que estaba
  mal era tener un `revalidate` escrito sin decir que no hace nada.

- **No hay forma de quitar créditos desde el panel.** Se pueden otorgar y nada
  más. Si alguien se equivoca —un doble clic, el paquete equivocado— hoy se
  arregla solo desde el editor SQL de Supabase, borrando las filas de
  `creditos` y la de `compras` que las agrupa. Es una deuda aceptable mientras
  administre una sola persona que puede ver el total antes y después en la
  pantalla, pero quitar créditos no es simétrico a otorgarlos: hay que decidir
  qué pasa si ya se usaron para reservar, y esa decisión todavía no está tomada.

- **`/salud` tarda lo que tarde la base en fallar.** Medido apuntando
  `NEXT_PUBLIC_SUPABASE_URL` a un puerto que rechaza conexiones y
  recompilando: devuelve el 503 correcto, con `Retry-After`, pero después de
  **7,0 segundos**, porque la consulta no tiene tiempo límite. Un monitoreo que
  corte a los 5 segundos va a ver un timeout en vez del 503. Arreglarlo
  requiere un `fetch` propio con `AbortSignal` en el cliente de Supabase, que
  es compartido con todo el sitio: no se toca por un endpoint.

- **El 405 de la API no lleva `Allow`.** La RFC pide que un 405 diga qué
  métodos sí se aceptan. Lo genera Next, no el proyecto, y no la incluye. Se
  podría agregar exportando un `OPTIONS` por ruta; serían once handlers nuevos
  cuyo único efecto es una cabecera.

- **La agenda no se extiende sola, pero ya hay con qué extenderla.** Las clases
  las generó `seed.sql` una vez, ocho semanas, y nada las renueva. Las dos
  formas de agregar semanas, y ninguna es automática:

  1. **`supabase/extender-agenda.sql`**, desde el editor SQL. Es la misma
     consulta de `generate_series` del seed pero **solo sobre `clases`**: no
     toca `instructoras`, `tipos_clase` ni `paquetes`. Eso es lo que la
     distingue de correr el seed, que entra al catálogo con
     `on conflict ... do update` y **revierte** cualquier precio editado desde
     `/admin/paquetes`. Verificado con contraprueba: se editó un precio a 999,
     `extender-agenda` lo dejó, el seed lo pisó. Es idempotente por el
     `on conflict (fecha, hora) do nothing`, así que las clases existentes
     quedan con sus reservas.
  2. **`/admin/clases`**, de a una. Mejor si la grilla de esa semana es
     distinta de la habitual.

  Lo que sigue faltando es que algo **avise** cuando queden pocas semanas. Hoy
  hay que acordarse.

- **El aviso de agenda agotada estaba roto y se arregló.** `ultimaFecha` tomaba
  la última clase de la tabla **sin mirar si ya había pasado**, y como las
  pasadas no se borran nunca era null: `sinAgenda` nunca se encendía y el
  bloque "No hay clases cargadas" —que existe exactamente para ese caso— no se
  podía mostrar nunca. Lo que se iba a ver era la agenda normal con la tira de
  días vacía y sin explicación.

  Arreglado con `.gte('fecha', claveHoy)` en la consulta. Y probado en dos
  niveles, porque uno solo no alcanzaba:
  `supabase/probar-agenda-agotada.sh` demuestra contra Postgres que sobre una
  tabla con solo clases pasadas la consulta con filtro da `NULL` y sin filtro
  da una fecha; `docs/ejemplos/probar-agenda.mjs` demuestra que la función usa
  ese null para poner `sinAgenda`, **y afirma que la consulta siga llevando el
  filtro**, así que si alguien lo saca esa prueba falla.

  De paso, `agendaDeLaSemana()` ahora recibe el cliente por parámetro, como
  `resumenDeCreditos()` y `cupoQueDejaGenteAfuera()`. Era la única que se lo
  creaba adentro, y por eso la única que no se podía probar.

- La validación del cupo contra las reservas ya tomadas se hace en la
  aplicación: se lee la cuenta y después se escribe. Entre las dos cosas
  alguien podría reservar y el cupo quedaría uno por debajo. Con seis lugares y
  una sola persona administrando, la ventana es teórica.
  **Pero la misma carrera, en las reservas, no lo es:** dos personas tomando el
  último lugar al mismo tiempo. Cuando se escriba esa pantalla, la verificación
  y la escritura tienen que ir en una sola sentencia desde el principio, en una
  función `security definer`, no en dos viajes desde el servidor.
