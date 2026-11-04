# Pruebas, depuración y calidad

Recorrido del módulo 13. Qué se prueba, con qué, qué **no** se prueba, y lo que
catorce episodios de fallo enseñaron sobre depurar.

---

## 1. QA y QC, y cuál de los dos hizo este proyecto

La materia los separa: **QC** examina el producto terminado para encontrar
fallas, y es reactivo; **QA** mejora el proceso para que las fallas no ocurran,
y es proactivo.

Mirado así, este proyecto es casi todo **QA**, y no por virtud sino por
necesidad: no hay equipo de pruebas, así que lo único que escala es que el
proceso impida el error. Las cuatro prácticas que lo componen no salieron de un
manual, salieron de equivocarse:

| Práctica | De qué episodio salió |
|---|---|
| **Un commit por bloque verificado** | un `git checkout -- .` se llevó tres bloques de trabajo ya verificado. La causa no fue el comando: fue acumular siete bloques sin commitear |
| **Afirmar con `assert`, no imprimir** | un script informó "conectado" sin comprobar la coincidencia, y dos hipótesis se investigaron sobre una premisa falsa |
| **Contraprueba: ver el agujero abierto y cerrado** | un arreglo que solo se prueba arreglado no se distingue de un cambio cosmético |
| **Ningún paso informa "hecho" sin verificar que pasó** | ídem |

**QC también hay**, y es lo que este módulo agrega: las pruebas E2E examinan el
producto armado, y los reportes de bug de la sección 4 documentan fallas
encontradas.

**Por qué invertir en esto en un proyecto de una materia.** La diapositiva 4
habla de costos: un defecto encontrado en producción cuesta mucho más que en
desarrollo. Este proyecto tiene un caso concreto y medible: el guardia de rol
del bug #1 habría significado **cobrar un paquete y no entregarlo**. No se
detectó leyendo el código —el código parecía correcto— sino midiendo.

---

## 2. Qué tipo de prueba hay, y por qué hay tan pocas unitarias

Los números de esta tabla salen de contar el código, no de estimar. Los casos
están enumerados uno por uno en la sección 3.

| Tipo | Dónde | Cuántas |
|---|---|---|
| **Unitarias** | `probar-contrasena.mjs` (22 casos en su tabla), `probar-esquemas.mjs` (11 aserciones), `probar-agenda.mjs` (3 escenarios, 17 aserciones) | 22 + 14 |
| **De integración contra la base** | `probar-reservas.sh` (6), `probar-bloqueo.sh` (9), `probar-acreditacion.sh` (7), `probar-limpieza.sh` (4), `probar-agenda-agotada.sh` (4), `validar-local.sh` (6 secciones) | 36 |
| **De concurrencia** | `probar-reservas.sh`, con **dos transacciones reales** | 1, y es el que importa |
| **De contrato con un tercero** | `probar-webhook.mjs` (13), `probar-webhook-dos-claves.sh` (8), `probar-preferencia.mjs` (3) | 24 |
| **E2E de navegador** | `e2e/*.spec.js` | **76 en total: 74 pasan, 2 se saltean** |

El total de E2E lo informa el propio corredor con `npx playwright test --list`.
Los 76 no son 76 archivos de prueba: son 19 escenarios distintos, y los que no
escriben en la base corren en los tres motores. El total subió de 67 a 76 en el
módulo 14, al agregarse E19: tres anchos por tres motores.

**Las unitarias son pocas a propósito.** Las reglas del negocio de este
proyecto no viven en funciones de JavaScript: viven en funciones de Postgres.
`reservar_clase()` bloquea la fila de la clase con `for update` antes de contar
y toma el crédito con `for update skip locked`. Probar eso unitariamente querría
decir **simular Postgres**, y entonces la prueba mediría el simulador. La única
prueba que vale de una carrera es dos transacciones de verdad peleándose una
fila, y eso es integración.

Lo que sí se presta a unitaria es lo que es cálculo puro: las reglas de la
contraseña, los esquemas de validación, y el armado de la agenda.

**Y no hay medición de cobertura**, por lo mismo: contaría líneas de JavaScript
mientras las reglas están en SQL. Daría un número bajo que no significa nada, o
peor, empujaría a escribir pruebas de lo que no importa para subirlo.

---

## 3. Casos de prueba formales

Formato de la diapositiva 5: **precondiciones, pasos de ejecución, datos de
entrada, resultado esperado**.

**Ninguno de estos casos está inventado.** Cada uno corresponde a un caso que
hoy corre y se puede volver a correr con el comando que encabeza su tabla.

### 3.1 Reservas y concurrencia — `zsh supabase/probar-reservas.sh`

| # | Precondiciones | Pasos | Datos de entrada | Resultado esperado |
|---|---|---|---|---|
| R1 | Una clase con **1 lugar** libre y dos personas con 1 crédito cada una | Abrir **dos transacciones**, las dos llaman a `reservar_clase()` sobre la misma clase, y recién después se hace commit | la misma `clase_id` en las dos | Una devuelve `ok` y la otra `completa`. **Nunca las dos `ok`** |
| R2 | Una persona sin créditos | `reservar_clase()` | clase con lugar | `sin_creditos`, y no se crea reserva |
| R3 | Una persona con una reserva confirmada en esa clase | `reservar_clase()` otra vez | la misma clase | `ya_reservada` |
| R4 | Una reserva en una clase de **mañana**, ventana de 6 horas | `cancelar_reserva()` | la `reserva_id` | `ok` con `credito_devuelto = true`; el `credito_id` se suelta |
| R5 | Una reserva en una clase **dentro de 2 horas** | `cancelar_reserva()` | la `reserva_id` | `ok` con `credito_devuelto = false`; el crédito queda enganchado |
| R6 | Una clase con reservas confirmadas | Pasar la clase a `cancelada` desde el panel | `estado = 'cancelada'` | Un disparador pasa sus reservas a canceladas y **devuelve el crédito sin mirar la ventana**. Al reactivarla, no vuelven |

### 3.2 Bloqueo de ingreso — `zsh supabase/probar-bloqueo.sh`

| # | Precondiciones | Pasos | Datos de entrada | Resultado esperado |
|---|---|---|---|---|
| B1 | Tabla `intentos_ingreso` vacía | Llamar a `espera_por_fallos()` con 1, 2, 3, … | el contador de fallos | La escalera sube y **se corta en 300 s** |
| B1b | ídem | Llamarla con números altos | 32, 40, 100 fallos | **No desborda.** El techo está en el exponente, no en el resultado: con el techo en el resultado, 32 fallos cortaban con "integer out of range" |
| B2 | — | 5 fallos seguidos desde la misma IP y correo | `(correo, ip)` | Al sexto hay espera pendiente |
| B3 | Una cuenta bloqueada desde una IP | Intentar desde **otra** IP | mismo correo, otra ip | **No** está bloqueada: la clave es `(correo, ip)` |
| B4 | — | Fallar con `  Correo@Ejemplo.COM  ` | mayúsculas y espacios | Cuenta igual que `correo@ejemplo.com` |
| B5 | — | Fallar con un correo que no existe | correo inexistente | Se comporta igual: no revela si la cuenta existe |
| B6 | Una cuenta con fallos acumulados | Entrar bien | credenciales correctas | El registro de fallos se borra |
| B7 | Fallos de hace más de 15 minutos | Consultar la espera | — | Vuelve a cero |
| B8 | — | Leer `intentos_ingreso` con la clave publishable | — | Cero filas: RLS activa y **sin ninguna política** |

### 3.3 Acreditación de créditos — `zsh supabase/probar-acreditacion.sh`

| # | Precondiciones | Pasos | Datos de entrada | Resultado esperado |
|---|---|---|---|---|
| A1 | **Se instala a propósito el guardia viejo** (`current_user`) | `otorgar_creditos()` con rol `service_role` | el del webhook | **Rechaza**: "Solo administración puede otorgar créditos". Es la contraprueba del bug #1 |
| A2 | Guardia de la migración 013 | `otorgar_creditos()` con `service_role` | `user_id`, `paquete_id`, `mp_payment_id` | Acredita: una fila en `compras` y una por clase en `creditos` |
| A3 | ídem | con sesión de **administración** | ídem | Acredita: la otra puerta sigue abierta |
| A4 | ídem | con sesión de **cliente** | ídem | Rechaza por permiso |
| A5 | ídem | con rol `anon` | ídem | **No puede ni invocarla**: privilegio revocado |
| A6 | Un pago ya acreditado | `otorgar_creditos()` con el **mismo** `mp_payment_id` | ídem | `ya_estaba = true`, `creditos_creados = 0`, y el total no se mueve |
| A7 | Dos cuentas con sesión | Insertar una intención con el `user_id` **de la otra** | `user_id` ajeno | RLS la rechaza |

### 3.4 Firma del webhook — `node docs/ejemplos/probar-webhook.mjs`

El HMAC es simétrico, así que el script firma con la misma clave que el handler
y prueba todo **sin deployar y sin pagar nada**.

| # | Precondiciones | Pasos | Datos de entrada | Resultado esperado |
|---|---|---|---|---|
| W1 | Clave configurada | `POST` sin cabecera `x-signature` | — | **401**, y el registro dice `MissingSignatureHeader` |
| W2 | ídem | Firmar con otra clave | clave distinta | **401** `SignatureMismatch` |
| W3 | ídem | Mandar un hash cualquiera | `v1` de 64 ceros | **401** `SignatureMismatch` |
| W4 | ídem | Cabecera sin `ts` ni `v1` | `x-signature: basura` | **401** `MalformedSignatureHeader` |
| W5 | ídem | Cabecera con `v1` y sin `ts` | `v1=...` | **401** `MissingTimestamp` |
| W6 | ídem | `ts` que no es número | `ts=ayer` | **401** `MalformedSignatureHeader` |
| W7 | ídem | `ts` de hace una hora | `ts = ahora - 3600` | **401** `TimestampOutOfTolerance`: la ventana de 300 s |
| W8 | ídem | `ts` del futuro lejano | `ts = ahora + 3600` | **401** igual |
| W9 | ídem | Aviso de otro tipo | `type=merchant_order` | **200**, ignorado antes de escribir nada |
| W10 | ídem | **Firma válida sin `x-request-id`** | se omite la cabecera | Pasa la firma. **Es el caso que prueba la regla de omitir pares del manifest** |
| W11 | ídem | Sin `data.id` en la URL | solo `type=payment` | **400** |
| W12 | ídem | `data.id` de un pago que MP no encuentra | id inventado | **500**, para que MP reintente |
| W13 | **Ninguna clave configurada** | `POST` con cualquier firma | — | **500**, no 200: un 200 daría el aviso por entregado y el pago se perdería |

### 3.5 Las dos claves de Mercado Pago — `zsh docs/ejemplos/probar-webhook-dos-claves.sh`

Ocho pruebas en cuatro configuraciones de claves. La configuración es la
precondición, así que se agrupan por ella.

| # | Precondiciones | Pasos | Resultado esperado |
|---|---|---|---|
| C1 | **Solo la clave productiva** | Firmar con la productiva | 200 |
| C2 | ídem | Firmar con la **de prueba** | **401. Es el estado que perdió un pago real**, reproducido a propósito |
| C3 | **Las dos** | Firmar con la productiva | 200, y el registro dice `modo productivo` |
| C4 | ídem | Firmar con la de prueba | 200, y el registro dice `modo prueba` |
| C5 | ídem | Firmar con una tercera clave | 401 |
| C6 | **Solo la de prueba** | Firmar con la de prueba | 200 |
| C7 | ídem | Firmar con la productiva | 401 |
| C8 | **Ninguna** | Cualquier firma | **500**, no 200 ni 401 |

C5 comprueba además que con las dos claves cargadas el registro **no** diga que
falta configuración: ese aviso es solo para cuando hay una sola.

**Y este arnés fue tipo (a) hasta el módulo 14.** Las cuatro configuraciones
reusaban el puerto 3001, matando al servidor anterior con `lsof`. Donde `lsof`
no está —un runner de CI— no mataba nada, el servidor nuevo no podía tomar el
puerto, y el curl de espera **igual contestaba**, porque contestaba el viejo.
Las cuatro configuraciones se volvían **una**, y el arnés no lo decía.

Falló ruidosamente por casualidad, porque C1 a C8 esperan códigos distintos.
Con dos casos de expectativa igual habría pasado en verde midiendo nada. Ahora
va **un puerto por caso**: no hay nada que matar, y si un servidor no atiende, el
arnés corta. El detalle está en `docs/despliegue.md` §16.

### 3.6 La agenda agotada — dos niveles

El bug: `ultimaFecha` tomaba la última clase de la tabla **sin mirar si ya
había pasado**, así que nunca era null, así que el aviso "No hay clases
cargadas" no se podía mostrar nunca.

| # | Comando | Precondiciones | Pasos | Resultado esperado |
|---|---|---|---|---|
| G1 | `zsh supabase/probar-agenda-agotada.sh` | Agenda del seed, con clases por delante | Comparar la consulta con y sin el filtro | **Dan lo mismo**: por eso el bug era invisible mientras la agenda estuviera viva |
| G2 | ídem | **Todas las clases corridas un año atrás** | ídem | Con filtro: `NULL`. Sin filtro: una fecha pasada. **Es la contraprueba** |
| G3 | ídem | ídem | Contar filas de `clases` | **No está vacía**: es la condición que hacía el aviso imposible |
| G4 | `node docs/ejemplos/probar-agenda.mjs` | Cliente de mentira que devuelve `null` | `agendaDeLaSemana()` | `sinAgenda: true`, **y la consulta llevaba `gte('fecha', hoy)`** |
| G5 | ídem | Cliente con una clase a 30 días | ídem | `sinAgenda` no se enciende, `siguiente` apunta a la semana próxima |
| G6 | ídem | Cliente con una clase de hace un mes | ídem | Días vacíos, `siguiente: null`: la pantalla que el arreglo evita |

**Por qué dos niveles, y por qué prueban cosas distintas a propósito.** El
nivel SQL prueba que el filtro hace lo que creemos, contra Postgres de verdad.
El nivel JavaScript prueba que la función **usa** ese resultado, con un cliente
de mentira que **además afirma que la consulta lleva el filtro**. Si alguien lo
saca mañana, el nivel SQL sigue en verde y el nivel JavaScript falla. Un cliente
de mentira que solo devolviera datos podría dar un falso verde; el que afirma
qué le pidieron, no.

### 3.7 Las pruebas E2E — `npm run test:e2e`

74 pasan y 2 se saltean con motivo. Contra **el sitio compilado**, no `next
dev`: lo recomienda la guía de la versión instalada y es como se verificó todo
el resto del proyecto.

| # | Rol | Precondiciones | Pasos | Resultado esperado |
|---|---|---|---|---|
| E1 | anónimo | — | Desde la home, clic en cada sección del menú | Las 4 cargan con su `h1` |
| E2 | anónimo | Agenda con turnos | Clic en "Ingresar para reservar …" | Va a `/ingresar?volver=`, y el destino es **una ruta interna** |
| E3 | anónimo | — | Pedir `/cuenta` y `/cuenta/contrasena` | **307** a `/ingresar` guardando el destino: es el **401** |
| E4 | anónimo | — | Pedir una ruta inventada | **404** con el 404 propio, en castellano, con el layout del sitio |
| E5 | cliente | Cuenta nueva | Ingresar con la contraseña mal, y después con un correro que no existe | **Los dos mensajes son idénticos**: no revela si la cuenta existe |
| E6 | cliente | ídem | Ingresar bien | Llega a `/cuenta`, y dice "Todavía no tenés créditos" |
| E7 | cliente | Cuenta sin créditos | Intentar reservar | `?r=sin_creditos` y el bloque "Te faltan créditos" con enlace a paquetes |
| E8 | cliente | ídem | Clic en "Comprar el paquete de …" | **Sale del sitio hacia `mercadopago.com`** con el id de la preferencia |
| E9 | cliente | Cuenta con 1 crédito y una clase con lugar a +2 días | Reservar, mirar la cuenta, cancelar | Aparece en "Próximas clases"; al cancelar dice **crédito devuelto** |
| E10 | **cliente** | Cuenta sin rol admin | Pedir las **cinco** pantallas del panel | **"Sin permiso"** en las cinco, y **no** redirige: es el **403** |
| E11 | admin | Credenciales en `.env.local` | Pedir las cinco pantallas | Cargan con su título, y el header ofrece el atajo "Panel" |
| E12 | admin | — | Crear una clase por API y mirar `/reservar` | Aparece en la agenda pública; al borrarla, desaparece |
| E13 | admin | — | Abrir `/admin/paquetes` | Los campos traen los valores de la base, con `maxLength` 60 |
| E14 | **sin JS** | — | Escribir una contraseña fuerte en `/registro` | **El medidor no se mueve**: es el detector de que JavaScript está apagado |
| E15 | **sin JS** | Cuenta nueva | Ingresar por el formulario | Abre sesión. *Se saltea en WebKit: ver 6.3* |
| E16 | **sin JS** | Cuenta con 1 crédito | Reservar y cancelar | Funciona entero. *Se saltea en WebKit* |
| E17 | **sin JS** | — | Abrir `/registro` | El campo trae `minLength`, `pattern`, la lista de reglas y el `<meter>` quieto |
| E18 | **sin JS** | — | Completar el registro | **La cuenta se crea** |
| E19 | anónimo | — | Abrir `/paquetes` a 1280, 1024 y 900px y medir los botones COMPRAR | Los botones de una misma fila **arrancan a la misma altura**, con menos de 0,5px de diferencia |

**Sobre E19, que es la única prueba geométrica de la suite.** Afirma una
relación —los botones de una fila arrancan a la misma altura— y no una imagen.
Una comparación de capturas falla cuando cambia una tipografía o un color, que
no es lo que se quiere saber, y no falla si el bug vuelve en un ancho que la
captura no cubre.

Los tres anchos no son decorativos: la grilla pasa de cuatro a dos columnas en
`max-width: 900px`, así que 900 ya es dos columnas, y **cuál tarjeta descoloca
depende del ancho** —medido, a 1280 es "8 clases" y a 900 pasa a ser "1 clase"—.

Y **no** se prueba lo mismo en la home ni en `/clases`, a propósito. En la home
las cuatro tarjetas tienen el mismo contenido, así que los botones alinean
*aunque la regla no esté*: medido, neutralizándola la diferencia sigue en 0. Una
prueba ahí pasaría por el motivo equivocado, que es el tipo (a) de la sección 2.
En `/clases` hay un solo enlace por fila, así que no hay dos que puedan
desalinearse: sería una comprobación que no puede fallar, el tipo (c).

---

## 4. Reportes de bug

Formato de la diapositiva 6. **Severidad y prioridad están separadas a
propósito, y los tres casos tienen perfiles distintos**: si los tres fueran
crítica/crítica, el documento afirmaría que las distingue sin demostrarlo.

### Bug #1 — Un pago aprobado no acredita créditos: el guardia de rol rechaza al webhook

| | |
|---|---|
| **Severidad** | **Crítica.** Se cobra y no se entrega. Es el peor resultado posible de un sistema de pagos |
| **Prioridad** | **Crítica.** Bloquea la función entera; sin esto el módulo de pagos no existe |
| **Entorno** | Supabase, Postgres 18. Migración 010, función `otorgar_creditos()` |
| **Componente** | Base de datos / autorización |

**Pasos para reproducir**

1. Llamar a `otorgar_creditos(user_id, paquete_id, mp_payment_id)` con la
   **clave secreta** de Supabase, que es como lo hace el webhook.
2. Observar la respuesta.

**Resultado esperado:** acredita una fila en `compras` y una por clase en
`creditos`.

**Resultado obtenido:** `ERROR: Solo administración puede otorgar créditos`.

**Evidencia.** `current_user` dentro de una función `security definer` es **el
dueño de la función**, no quien la llama. Medido contra Postgres 18, imitando
cómo PostgREST atiende un pedido con la clave secreta (conecta como
`authenticator` y hace `set local role service_role`):

| Expresión | Fuera de la función | Dentro de `security definer` |
|---|---|---|
| `current_user` | `service_role` | **`postgres`** (el dueño) |
| `session_user` | `authenticator` | `authenticator` |
| `current_setting('role', true)` | `service_role` | **`service_role`** |

**Causa raíz.** El guardia comparaba `current_user = 'service_role'`, así que
esa rama **no se cumplía nunca**.

**Por qué las pruebas no lo detectaron antes.** Las pruebas de idempotencia
corrían con sesión de administración, donde `es_admin()` devuelve verdadero y el
`or` **corta antes** de evaluar la otra condición. La condición que importaba
nunca se ejecutó.

**Corrección.** `current_setting('role', true) = 'service_role'` (migración
013). No se usa `request.jwt.claim.role`, que también mide bien: las claves
nuevas `sb_secret_...` **no son JWT**, son opacas.

**Contraprueba.** `supabase/probar-acreditacion.sh` instala a propósito el
guardia viejo y muestra a `service_role` rechazado, con `current_user` impreso
al lado; después, con el guardia nuevo, lo muestra acreditando.

---

### Bug #2 — `/cuenta` le muestra a administración las reservas de otras personas como propias

| | |
|---|---|
| **Severidad** | **Alta.** Exposición de datos de terceros: nombres, clases y horarios de otras personas en una pantalla que dice "tus reservas" |
| **Prioridad** | **Media.** El alcance es **una sola cuenta**, la de administración, que además es de la dueña del estudio. No hay escalada: una cuenta común no ve nada ajeno |
| **Entorno** | Supabase, RLS. `app/cuenta/page.jsx` |
| **Componente** | Autorización / privacidad |

**Pasos para reproducir**

1. Iniciar sesión con la cuenta de **administración**.
2. Crear reservas con **otra** cuenta cualquiera.
3. Abrir `/cuenta` con la cuenta de administración.

**Datos de entrada:** la cuenta de administración tenía 4 reservas propias; en
la base había 5 en total.

**Resultado esperado:** la pantalla muestra **4**, las propias.

**Resultado obtenido:** mostraba **5**, incluyendo la ajena como si fuera suya.

**Causa raíz.** Las políticas de `reservas`, `creditos`, `compras` y `perfiles`
dicen `user_id = auth.uid() or es_admin()`. Para una cuenta común RLS ya
devuelve solo lo suyo —y de ahí viene la trampa: **parece** que filtrar por
`user_id` es redundante— pero para una cuenta de administración devuelve
**todo**. La consulta de la pantalla no filtraba.

**Corrección.** `.eq('user_id', userId)` explícito, con el comentario al lado
explicando por qué no es redundante.

**Regla que dejó.** Cualquier pantalla "mis cosas" filtra por `user_id` igual,
aunque RLS parezca suficiente. Una política con `or es_admin()` **no filtra por
persona**.

---

### Bug #3 — Un `POST` a una ruta inexistente devuelve 200, así que una URL de webhook mal escrita pierde pagos en silencio

| | |
|---|---|
| **Severidad** | **Crítica.** Pérdida silenciosa de dinero: Mercado Pago recibe 200, da el aviso por entregado y **deja de reintentar** |
| **Prioridad** | **Baja.** La causa no es nuestra: es del framework o del borde de la plataforma. No hay nada que arreglar en este repositorio, solo mitigar |
| **Entorno** | El sitio deployado en Vercel. **No se reproduce en local** con `next start` |
| **Componente** | Enrutamiento / plataforma |

**Pasos para reproducir**

```
curl -s -D - -o /dev/null -X POST https://<dominio>/api/v1/no-existe
curl -s -o /dev/null -w '%{http_code}\n'  https://<dominio>/api/v1/no-existe
```

**Resultado esperado:** 404 en los dos.

**Resultado obtenido:**

```
POST  ->  200   content-type: text/html   x-matched-path: /_not-found
GET   ->  404
```

En local, con `next start`, los cinco verbos dan 404.

**Evidencia adicional.** La documentación de la versión instalada explica el
mecanismo: *"Before streaming starts, Next.js returns a `404` status code. After
streaming starts, the status code remains `200` and the not-found UI renders in
the response."*

**Lo que no se pudo aislar.** Si lo causa la versión o el borde de Vercel. Se
midió la diferencia entre local y deployado; no se probó 16.4.3 detrás de
Vercel con la 16.3.6 al lado.

**Mitigación aplicada**, porque arreglarlo no está en nuestras manos:

1. Para saber si una ruta está tomada se mira **`x-matched-path`**, no el código
   de estado. Está escrito en `docs/api.md` §11 y en el procedimiento de carga
   de la URL en el panel de Mercado Pago.
2. **Tener una página de 404 propia no lo arregla** y queda dicho, porque invita
   a pensar que sí: `app/not-found.jsx` cambia el **cuerpo** de la respuesta, no
   el código.

---

## 5. Testing exploratorio

La diapositiva 7 lo define como una técnica no estructurada donde la
experiencia guía la búsqueda, útil en flujos poco documentados, y que encuentra
bugs que las pruebas rígidas pasan por alto.

**Este proyecto es casi todo eso, y `docs/prompts.md` es su registro.** Los
catorce episodios de la sección 7 no salieron de una suite: salieron de medir
algo, ver un número raro y tirar del hilo. Tres ejemplos de la última ronda:

- **El bug de la agenda agotada** apareció porque, antes de escribir una prueba
  que iba a crear clases en 2027, se midió hasta dónde dejaba avanzar la
  agenda. Ninguna prueba lo buscaba.
- **Las dos claves de Mercado Pago** aparecieron mirando el historial del panel
  de un tercero, que es el único lugar donde el dato existía.
- **La cookie `Secure` en WebKit** apareció porque la suite corría en tres
  motores y uno falló.

**Y tiene el límite que la diapositiva no menciona:** lo exploratorio no se
puede repetir. Cada hallazgo de esos terminó convertido en una prueba
automática justamente por eso — el valor de explorar es encontrar, el de
automatizar es que no vuelva.

---

## 6. Playwright

### 6.1 Por qué automatizar, y contra qué

La diapositiva 13 habla de regresión: que lo nuevo no rompa lo que andaba.
Este proyecto tiene el caso exacto, y es de esta misma ronda: **arreglar el bug
de la agenda rompió una prueba E2E que pasaba**, y la prueba lo avisó en 30
segundos. Sin la suite, el síntoma habría aparecido en producción.

Lo que Playwright agrega sobre los arneses que ya existían es **lo que ninguno
podía ver**: que una persona con un navegador pueda hacer el recorrido. Un
arnés de Postgres prueba que `reservar_clase()` respeta el cupo; ninguno prueba
que la pantalla muestre la reserva después.

**Auto-waiting** (diapositiva 14): Playwright comprueba que el elemento sea
visible y esté habilitado antes de actuar, así que no hay esperas fijas. En toda
la suite no hay un solo `waitForTimeout`. Las dos esperas explícitas que hay son
`waitForURL` contra `mercadopago.com` —navegación a otro dominio— y nada más.

### 6.2 Anatomía, y por qué locators semánticos

La diapositiva 15 muestra `getByRole` y `getByText` en vez de clases CSS. Acá
eso no es estilo, es lo que hace que la prueba falle **cuando tiene que
fallar**: `.header-enlace` cambia cuando se rediseña el header, y el rol con su
nombre accesible cambia cuando cambia lo que la página **significa**.

**No hizo falta agregar un solo `data-testid`**, y eso es un resultado: cada
página tiene un `h1` único, los campos tienen `<label htmlFor>` y los botones
dinámicos tienen `aria-label` con el nombre y el horario. Si hubiera hecho
falta, sería la señal de que el HTML no es tan semántico como el proyecto
afirma.

Un detalle de esa ronda: una prueba buscaba el horario `04:45` y el sitio
muestra `4:45`. Se arregló **importando `sinSegundos()`**, la misma función que
usa la página, en vez de replicar el formato.

### 6.3 La excepción a "un dato, una fuente"

Y acá va una excepción deliberada a la regla que organiza todo el proyecto.

Las cinco pantallas del panel están **escritas a mano** en `admin.spec.js`, no
leídas de la navegación del panel. Eso duplica un dato, que es exactamente lo
que el proyecto prohíbe en el código.

**El motivo es preciso: una prueba que se actualiza sola no puede detectar una
regresión.** Si la lista se leyera del código, agregar una pantalla sin
protegerla la agregaría también a la prueba, la prueba la recorrería, y pasaría.
Escrita a mano, la lista queda corta y la prueba avisa.

**La regla de la fuente única aplica al código, no a lo que el código afirma
sobre sí mismo.** Una prueba es una afirmación independiente: si sale del mismo
lugar que lo que verifica, no verifica nada.

### 6.4 Los tres motores, solo donde pagan

Las pruebas **sin estado** —navegación, rutas protegidas, 404— y las **sin
JavaScript** corren en Chromium, Firefox y WebKit. Las que escriben en la base
corren solo en Chromium, y el motivo no es el tiempo: **hay un solo proyecto de
Supabase**, así que tres navegadores creando clases en paralelo chocarían contra
el `unique (fecha, hora)`.

**Y pagó.** Dos pruebas sin JavaScript fallaron **solo en WebKit**, y la causa
no era del sitio:

| motor | cookies `sb-` guardadas | sesión |
|---|---|---|
| chromium | 2 (las dos `Secure`) | abre |
| firefox | 2 (las dos `Secure`) | abre |
| **webkit** | **0** | **no abre** |

La cookie de sesión lleva `Secure`, que es correcto, y `next start` sirve por
http. Chromium y Firefox hacen la excepción de localhost; **WebKit descarta la
cookie sin avisar.**

El comentario de `app/lib/cookies.js` afirmaba lo contrario —*"los navegadores
igual tratan a localhost como origen seguro"*— y era **falso**. Eso no lo
encuentra nadie leyendo el código.

**No se bajó `secure`.** Debilitar una defensa real por comodidad local es el
canje equivocado. Se saltean las dos pruebas que necesitan sesión, **solo en
WebKit**, con el motivo medido escrito en el `skip`. En producción todo es
https, así que ahí no aplica.

### 6.5 Sin reintentos

`retries: 0` a propósito. Un reintento convierte una prueba inestable en una
que "pasa a veces", que es justo lo que no conviene enterarse tarde.

Hubo una inestabilidad: la prueba de reservar y cancelar agotó los 30 segundos
en una corrida de catorce, **sin error de aserción**, y no se reprodujo en tres
corridas posteriores. Lleva `test.slow()` —hace cinco viajes a Supabase y cuatro
navegaciones— con el motivo escrito y aclarando que no es un reintento
disfrazado. **Queda dicha y no explicada**, que es más honesto que taparla. Si
vuelve, se investiga con la traza.

**Y hubo un "pasa a veces" de verdad, encontrado en el módulo 14 y arreglado.**
E2 —el circuito de `volver`— pedía el día por defecto de `/reservar`, que es
**hoy**. La página oculta los turnos que ya pasaron, así que después de la
última clase del día la tabla de hoy queda vacía: sin turnos, sin "lista de
espera" y sin el aviso de agenda agotada, porque la agenda no está agotada.

Medido: un martes a las **23:34**, con las siete clases del día (07 a 20) ya
pasadas, E2 fallaba **en los tres motores**. El mismo día a otra hora pasaba. No
era un bug del sitio ni de la prueba: era una **precondición no declarada**, y
la escondía la hora a la que uno corriera la suite.

El arreglo no fue fijar un día ni reintentar: la prueba **recorre la tira de
días**, que la página arma solo con los días que tienen clases, hasta encontrar
uno que ofrezca reservar, y si ninguno lo ofrece falla diciendo que es la
precondición y no el circuito de `volver`. Verificado a las 23:35, o sea en la
condición exacta que la rompía: 74 pasan, 2 se saltean.

Lo que esto confirma sobre `retries: 0`: con un reintento, esta prueba habría
fallado y vuelto a fallar —no es intermitente dentro de una corrida, es
dependiente de la hora— así que el reintento no la habría tapado. Lo que la
tapaba era correr la suite siempre de día.

### 6.6 Codegen y Trace Viewer

La diapositiva 16: `codegen` graba clics y los traduce a código; el Trace Viewer
graba capturas antes y después de cada acción, el DOM y la red.

**Codegen se usó para descubrir los locators** de las pantallas con sesión, y
después se reescribieron a mano: lo que genera usa el primer selector que
encuentra, que a veces es una clase. Sirve para explorar, no para entregar.

**El Trace Viewer está configurado en `retain-on-failure`**, junto con captura y
video. No en `on`: grabar siempre hace la corrida más lenta y llena el disco con
trazas de pruebas que pasaron. Cada vez que se corrió una contraprueba en este
módulo, el fallo dejó los cuatro artefactos:

```
test-results/<prueba>/test-failed-1.png
test-results/<prueba>/video.webm
test-results/<prueba>/trace.zip
test-results/<prueba>/error-context.md

npx playwright show-trace test-results/<prueba>/trace.zip
```

Eso es también la respuesta a la diapositiva 6 cuando pide capturas en los
reportes de bug: **las genera la suite al fallar**, sin que nadie se acuerde de
sacarlas.

---

## 7. Depuración

### 7.1 Qué herramienta para qué fallo

| Tipo de fallo | Herramienta | Caso real de este proyecto |
|---|---|---|
| comportamiento HTTP, códigos, autorización | `curl -w '%{http_code}'` y las cabeceras | los 11 endpoints por 3 identidades; el `x-matched-path` que destapó el bug #3 |
| lógica de la base, RLS | Postgres descartable con las migraciones de verdad | las políticas que faltaban en `creditos` |
| **concurrencia** | **dos transacciones reales, con `commit` retrasado** | la carrera por el último lugar |
| el rol con el que entra un pedido | una función que devuelve `current_user`, `session_user` y `current_setting('role')` | el bug #1 |
| fallos del servidor sin pantalla | `console.error` con un id que **también se devuelve** | el 401 del webhook |
| layout y CSS | protocolo de Chrome: `setDeviceMetricsOverride`, `getBoundingClientRect` | la alineación del header |
| el límite servidor/cliente | `npm run build` **como prueba** | `import 'server-only'` fallando a propósito |
| código muerto | `eslint` | un `CUPO_MAXIMO` importado y no usado |
| diferencias entre navegadores | la misma suite en tres motores | la cookie `Secure` en WebKit |
| **el ambiente de un tercero** | **el panel del tercero** | el filtro que decía "Prueba" |

La última fila es la que más cuesta aprender. **Había un dato que ninguna
herramienta nuestra podía ver**, y no por falta de instrumentación: del lado
nuestro, un aviso firmado con la otra clave es **indistinguible de uno
falsificado**, y tiene que serlo. El 401 era correcto; lo que faltaba era la
pregunta "¿de qué ambiente viene?".

### 7.2 Call Stack, Scope y `console.log`: lo que aplica acá y lo que no

La diapositiva 9 dice que *"depender exclusivamente de `console.log` es una
práctica primitiva"* y propone el Call Stack y el Scope. **Las dos cosas son
ciertas y las dos hablan de depurar JavaScript de navegador con DevTools.**

Este proyecto tiene **un solo componente de cliente**: el medidor de fortaleza
de contraseña. Todo lo demás son Server Components y Server Actions. Así que el
Call Stack y el Scope de DevTools aplican a **alrededor del 1% del código**, y
decirlo es más honesto que fingir que se usaron.

**Dónde sí se usaron, que es el único lugar donde se podían usar:** el medidor.
Los breakpoints de `Sources` sirvieron para ver el estado del `useState` mientras
se escribía, y confirmar que `fortalezaDe()` devolvía el nivel esperado en los
bordes.

**Y el webhook usa `console.error` a propósito, no por pereza.** Una función que
le responde a un servidor de Mercado Pago no tiene DevTools, no tiene dónde
poner un breakpoint y no tiene a nadie mirando cuando falla. Lo que sí tiene es
un registro, y lo que lo hace útil no es que exista sino **cómo está armado**:

- el motivo del rechazo va al registro y **no** a la respuesta, porque decirle
  a quien llama si falló el hash o el timestamp le da un oráculo
- lleva el `x-request-id`, que es con lo que se encuentra esa notificación
  **en el panel de Mercado Pago**
- cada error devuelve un `id` al cliente **y** lo registra, así que alguien
  puede decir "me dio error ab93befb" y se encuentra el error completo sin
  haberle mostrado nada de adentro

Eso no es un `console.log` suelto: es la única ventana que existe hacia un
proceso que corre sin nadie delante.

### 7.3 Las otras técnicas de las diapositivas 8 a 11

**Rubber duck.** La diapositiva lo plantea como explicarle el código a un objeto
inanimado para reevaluar supuestos implícitos. Acá el pato es
**`docs/prompts.md`**, y no es una metáfora: varios hallazgos aparecieron
mientras se escribía la explicación, no mientras se leía el código. El caso más
claro es el del comentario que justificaba el orden equivocado: el argumento
estaba ahí desde el principio y **se vio mal al tener que escribir por qué era
correcto**. Escribir obliga a nombrar los dos lados de una referencia; leer
permite quedarse con el primero.

**Análisis del flujo de ejecución**, que la diapositiva describe como
identificar el instante exacto en que un valor se volvió `null`. El bug de la
agenda es el caso inverso y por eso costó verlo: el problema era **un valor que
nunca se volvía `null` cuando tenía que volverse**. `ultimaFecha` siempre traía
una fecha, así que la rama del aviso era inalcanzable. Un `null` que no aparece
no deja rastro en ninguna traza: se encuentra preguntándose "¿cuándo tendría que
ser null?" y comprobando que no puede.

**DevTools → Elements.** Se usó para lo que la diapositiva dice, modificar el
DOM y el CSS de forma efímera, en el único lugar donde tiene sentido acá: la
alineación del header. Probar `align-items` y los márgenes en vivo y medir con
`getBoundingClientRect()` evita un ciclo de editar, compilar y mirar por cada
valor. Lo que se aprendió es que **la medición hay que hacerla con el protocolo
y no a ojo**: el fallo 4 de la bitácora es una medición de contraste que leyó el
header en vez del panel.

**DevTools → Network.** Es la que más sirvió, y está en la tabla de 7.4: tres de
los hallazgos tenían el dato en una cabecera y en ningún otro lado.

**Breakpoints condicionales y logpoints.** Aplican al medidor de contraseña, que
es el único JavaScript de navegador del proyecto. Un logpoint en el `onChange`
—que inyecta el mensaje sin tocar el archivo— sirvió para ver qué nivel
devolvía `fortalezaDe()` en los bordes sin agregar y después borrar
`console.log`. Un breakpoint condicional no hizo falta: no hay bucles en el
cliente.

**Y lo que no se usó, dicho:** `Paso Into` y `Paso Out` sobre código del
servidor. Los Server Components y las Server Actions corren en Node, no en el
navegador, así que no aparecen en `Sources`. Depurarlos es lo de 7.1: `curl`,
`psql` y un registro con identificador.

### 7.4 Los errores frecuentes de la diapositiva 12, medidos

| Error que marca la diapositiva | Cómo apareció acá |
|---|---|
| **Asumir sin verificar** | es el patrón de la sección 7.5, catorce veces |
| **Abuso de `console.log`** | el caso del webhook es el contrario: ahí es la única herramienta posible, y lo que importa es qué registra |
| **Ignorar el scope** | no apareció: con un solo componente de cliente, casi no hay scope de navegador donde equivocarse |
| **No revisar Network cuando el problema es una petición fallida** | apareció **tres veces**, y las tres el dato estaba en una cabecera: el `x-matched-path` del bug #3, el `Set-Cookie` que WebKit descartaba, y el `www-authenticate` que faltaba en el 401 |

### 7.5 El patrón que más apareció: la herramienta de medición mintiendo

**Catorce instancias documentadas**, y agrupan en cuatro tipos. La clasificación
es el aporte de esta sección, porque **cada tipo se detecta distinto**.

#### (a) La herramienta mide otra cosa que la que se cree

- **Fallo 1:** `chrome --headless --window-size=420,900` **no aplica el ancho al
  layout**: maqueta a un ancho por omisión y recorta la imagen. Se informó un
  desborde que nunca existió.
- **Fallo 4:** la medición de contraste dio `1,00:1`. El header es pegajoso y
  tapaba las cajas medidas, así que se comparaba el texto contra el crema del
  header.
- **Fallo 13:** "24 enlaces de día" cuando el HTML tiene 48. La regex contaba
  cada fecha una vez y Next emite cada enlace dos veces.
- **`page.evaluate` con JavaScript desactivado** *(nuevo)*: **funciona igual**,
  porque Playwright lo ejecuta por el protocolo de depuración y no por la
  página. Era el detector obvio de "¿está apagado?" y mide otra cosa.

**Cómo se detectan: por un valor imposible.** `1,00:1` es el valor exacto de dos
colores idénticos; ningún diseño da eso por casualidad.

Y el caso de `page.evaluate` agrega algo: **escrito al revés habría afirmado
algo falso.** Si el detector hubiera sido "si `evaluate` funciona, JavaScript
está prendido", la conclusión habría sido que el contexto estaba mal
configurado, y el paso siguiente habría sido perseguir un problema inexistente.
Se cazó antes de que engañara a nadie.

#### (b) La preparación de la prueba falla en silencio

- **El `sinCambios` mordiendo al arnés:** un `PATCH` a `creditos` para vencer
  los créditos afectó **cero filas** —no hay política de UPDATE— y devolvió
  200. La reserva siguiente salió `ok` y parecía que `reservar_clase()` estaba
  rota.
- **Los tres `PATCH` con 308:** el `POST` previo había devuelto 409, el id vino
  vacío, las URLs quedaron con barra final y Next respondió 308. Las tres
  pruebas **se ejecutaron, no fallaron, y no probaron nada**.

**Cómo se detectan: exigiendo que el paso previo haya hecho algo**, no que haya
devuelto 200. Un 200 de PostgREST no dice que algo cambió.

#### (c) La prueba no puede fallar

- **La firma simétrica conmigo misma:** se verificó la clave de Vercel firmando
  con la clave de `.env.local` y recibiendo 200. Eso demostraba que los dos
  lados tenían el mismo valor, **no** que ese valor fuera el que Mercado Pago
  usa. Una clave equivocada pero consistente pasa esa prueba.
- **La `idempotencyKey` probada con otro cuerpo:** el resultado distinto podía
  ser por el cuerpo y no por la clave.
- **El freno de limpieza afirmando el código de salida** en vez del mensaje: el
  script cortaba por un error de columna varias líneas antes de llegar al
  `raise`, y la prueba decía "frenó bien".
- **`grep -c 'security definer'`** dio 16 contra 13 reales: contaba los
  comentarios. Casi se informaron tres funciones "vulnerables".
- **El comentario que justificaba el orden equivocado** *(nuevo)*. Esto no es
  una prueba, pero funcionó como una: el `delete` llevaba al lado el argumento
  *"los créditos antes, que son los que referencian la compra"*, que es
  **verdadero** y mira una sola de las dos puntas. **Un `delete` sin explicación
  invita a revisar el orden; uno con un argumento correcto al lado invita a
  confiar.** Quien lo lee verifica que el argumento sea cierto, comprueba que
  sí, y sigue. Es el tipo (c) fuera de una suite.

**Cómo se detectan: con contraprueba.** Reproducir el estado roto a propósito y
comprobar que la prueba lo ve. De ahí viene esa costumbre en este proyecto, y
los arneses que la aplican lo dicen en su encabezado.

Dos ejemplos de esta ronda, y **prueban cosas distintas**:

- Al arnés de limpieza se le invirtió el orden de los `delete` y cortó con
  `reservas_credito_id_fkey`. **Antes del caso nuevo, pasaba.**
- Al detector de JavaScript se le prendió JavaScript y el medidor pasó de 0 a 4,
  fallando con el mensaje que explicaba qué significaba.

Y una contraprueba de otra clase, que vale distinguir: en `extender-agenda.sql`
se editó un precio a 999, se corrió el extensor y siguió en 999; se corrió el
seed y lo pisó a 18000. **Eso no prueba que el archivo funcione: prueba que la
afirmación de su encabezado es cierta.** Es la diferencia entre documentar y
demostrar.

#### (d) El informe afirma más que la medición

- **El reporte falso:** un script imprimió "sesion.js conectado al bloqueo" sin
  afirmar la coincidencia. No había coincidido. Dos hipótesis se investigaron
  sobre una premisa falsa.
- **El `fetch-cache` como prueba de caché:** las entradas que aparecen en
  `.next/cache/fetch-cache` después de un build son **del build**, no de lo que
  se sirve en caliente. Se tomó un artefacto de compilación como evidencia de
  comportamiento en ejecución.
- **Una sonda de Python con `b'\n'` mal escapado** informó cero saltos de línea
  en un archivo que tenía tres.
- **zsh no divide `$1` en palabras:** `env $1` recibió dos asignaciones como una
  sola, y el caso "las dos claves cargadas" dio 401 en todo. Habría parecido que
  la función nueva no servía.
- **El comentario de la cookie** *(nuevo)*: afirmaba que los navegadores tratan
  a localhost como origen seguro. Era una afirmación sin medición, y WebKit la
  desmiente.

**Cómo se detectan: con una contraprueba independiente, hecha por otro camino.**
Lo del caché se resolvió escribiendo directo en la base sin llamar a
`revalidatePath` y viendo que el cambio aparecía igual.

### 7.6 La regla que sale de los catorce

**Una comprobación que no puede fallar no comprueba nada.**

De ahí las dos costumbres del proyecto: **afirmar con `assert` en vez de
imprimir**, y **reproducir el estado roto antes de dar un arreglo por bueno**.
Y de ahí la excepción de 6.3: una prueba que se actualiza sola es el caso límite
de una comprobación que no puede fallar.

---

## 8. Lo que no está cubierto

| Qué | Por qué |
|---|---|
| **El checkout de Mercado Pago adentro** | Sitio de terceros con su propio login y antifraude. Se prueba que salimos hacia ahí; lo de adentro se verificó a mano una vez y quedó el `payment_id` para reenviar avisos |
| **El camino de un pago aprobado, automatizado** | Necesita un `payment_id` real del sandbox. Se hizo a mano y quedó documentado; el reenvío sí está automatizado |
| **La escritura del catálogo desde el panel** | Modificaría `paquetes`, que el sitio muestra. Hay un solo proyecto de Supabase. Se prueban las **lecturas** del formulario |
| **El `Site URL` de Supabase** | Ninguna API lo expone. La única comprobación posible es mirar el panel |
| **Ingresar en WebKit contra el sitio local** | La cookie `Secure` sobre http. Ver 6.4 |
| **Comparación visual de capturas** | E19 prueba una relación geométrica, no la apariencia. Un cambio de color, de tipografía o de espaciado no lo detecta nada automático: eso sigue siendo testing exploratorio, sección 5 |
| **Integración continua** | Ya no: el módulo 14 agregó `.github/workflows/ci.yml`, y el argumento de que no hacía falta **estaba mal** —era cierto de un CI decorativo, no de uno que bloquea el merge—. Las E2E son lo único que **no** corre ahí, porque escriben en la única base que hay: van en un job manual. Ver `docs/despliegue.md` |
| **Cobertura** | Ver sección 2 |

---

## 9. Cómo se corre todo

```
# estático
npx eslint . --max-warnings 0 && npm run build

# unitarias
node docs/ejemplos/probar-contrasena.mjs
node docs/ejemplos/probar-esquemas.mjs
node docs/ejemplos/probar-agenda.mjs

# integración contra un Postgres descartable
zsh supabase/validar-local.sh
zsh supabase/probar-reservas.sh
zsh supabase/probar-bloqueo.sh
zsh supabase/probar-acreditacion.sh
zsh supabase/probar-limpieza.sh
zsh supabase/probar-agenda-agotada.sh
zsh supabase/probar-extender-agenda.sh

# contrato con Mercado Pago
MP_WEBHOOK_SECRET=cualquier-cosa npx next start -p 3001 &
MP_WEBHOOK_SECRET=cualquier-cosa node docs/ejemplos/probar-webhook.mjs
zsh docs/ejemplos/probar-webhook-dos-claves.sh
node docs/ejemplos/probar-preferencia.mjs   # llama a la API de verdad

# E2E
npm run test:e2e
npm run test:e2e:ui         # modo interactivo
npm run test:e2e:informe    # el informe HTML de la última corrida
```

Ninguno pide confirmación ni toca producción, con dos excepciones dichas:
`probar-preferencia.mjs` llama a la API de Mercado Pago, y las E2E escriben en
el único Supabase que hay —bajo las tres reglas de `e2e/fixtures.js`: no tocar
el catálogo, no correr el final de la agenda, y borrar lo que crean.
