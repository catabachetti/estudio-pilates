# Seguridad

Este documento recorre el **módulo 10 de Programación Web** punto por punto y
dice, para cada uno: qué pide la materia, dónde está resuelto en este proyecto,
y **cómo comprobarlo**. La tercera columna es la que importa: una afirmación de
seguridad sin forma de verificarla no vale nada.

Donde algo no está, o no se puede verificar desde acá, lo dice. No hay ningún
punto marcado como resuelto sin la prueba al lado.

Las mediciones se hicieron contra el proyecto de Supabase del estudio entre el
16 y el 19 de octubre de 2026. Las que dependen de la configuración del panel
pueden cambiar si esa configuración cambia.

**Cómo correr las verificaciones:** casi todas necesitan el sitio compilado y
servido, no `next dev`, porque el caché y las cookies se comportan distinto:

```
npm run build && npx next start -p 3001
```

Las cuentas de prueba están en `cuentas-de-prueba.local`, que no va a git.

---

## 1. Autenticación y autorización

**Qué pide.** Distinguir AuthN (¿quién sos?) de AuthO (¿qué podés hacer?), y
que la segunda no ocurra sin la primera.

**Dónde está.** En tres capas, cada una con un trabajo distinto:

| Capa | Qué verifica | Archivo |
| --- | --- | --- |
| Proxy | solo si hay sesión (AuthN) | `proxy.js` |
| Data Access Layer | el rol (AuthO) | `app/lib/autorizacion.js` |
| RLS en Postgres | cada lectura y escritura | `supabase/migraciones/003-politicas.sql` |

El rol **no** se verifica en el layout del panel. La documentación de Next 16
lo desaconseja en `authentication.md`, sección "Layouts and auth checks", con
tres razones; la decisiva es que **las Server Actions no pasan por ningún
layout**. Un panel protegido solo por su layout se edita invocando la acción
directo.

**Cómo se verifica.** Con una sesión de cliente, pedir una acción del panel sin
pasar por la pantalla:

```
POST /admin/paquetes  con $ACTION_ID_<editarPaquete> y una sesión de rol cliente
  -> 500, y el precio en la base no cambia
```

Se hizo también la contraprueba, moviendo la verificación al layout:

| | GET de la página | POST de la acción |
| --- | --- | --- |
| verificación en el DAL | "Sin permiso", 200 | **500, cortado** |
| verificación solo en el layout | "Sin permiso", 200 | **303 → `?error=permiso`** |

En la segunda fila la acción **corre entera** y lo único que frena la escritura
es RLS. Eso coincide con lo que dice la documentación de Next sobre Server
Actions:

> Render-time gating (only rendering a form on an authenticated page) is not a
> security boundary, because requests can be sent without going through the UI.

---

## 2. Registro

**Qué pide.** Correo único, fortaleza de contraseña con indicador visual, y
sanitización de entradas. En el frontend y en el backend.

### 2.1 Correo único

Lo garantiza Supabase. Nuestro formulario **no revela** si una dirección ya
está registrada: el error es siempre el mismo.

**Cómo se verifica.** Registrarse con un correo existente desde el formulario
da el genérico *"No pudimos crear la cuenta"*.

**Limitación medida, y es importante.** Pegándole directo al endpoint de
Supabase la respuesta sí distingue:

```
POST /auth/v1/signup con un correo ya registrado
  -> 422  {"error_code":"user_already_exists","msg":"User already registered"}
```

Ese endpoint es público y alcanzable con la clave publishable, así que la fuga
existe aunque nuestro formulario esté bien hecho. **Se cierra activando "Confirm
email"** en el panel, que hace que Supabase conteste igual exista o no la
cuenta. Hoy está apagado a propósito, para no bloquear las cuentas de prueba
mientras se desarrolla; hay que activarlo antes de la entrega.

### 2.2 Fortaleza de contraseña

Las reglas viven en `app/lib/contrasena.js` y las piden **tres capas**:

1. el `pattern` del navegador — para quien escribe
2. `esValida()` en la Server Action — para nuestro formulario
3. las **Password Requirements de Supabase** — la única que no se puede saltear

Las tres piden lo mismo: mínimo 8, una minúscula, una mayúscula, un dígito y un
símbolo del conjunto que Supabase acepta, que es textual:

```
!@#$%^&*()_+-=[]{};'\:"|<>?,./`~
```

**La tercera manda.** Las reglas se midieron contra Supabase y se copiaron, no
al revés, porque se puede crear una cuenta sin pasar nunca por el formulario.

**Cómo se verifica.**

```
# las tres capas coinciden, 22 casos incluidos los simbolos de borde
node docs/ejemplos/probar-contrasena.mjs

# el servidor rechaza aunque se saltee el navegador
POST /registro con contrasena=abcdefgh  ->  /registro?error=contrasena
```

El script compila el `pattern` igual que el navegador —con la bandera `v`— y
compara contra `esValida()`, caso por caso. Los resultados esperados salieron de
medir contra `/auth/v1/signup`, no de suponerlos.

**Trampa documentada.** El `pattern` se compila con la bandera `v`, que obliga a
escapar `( ) [ ] { } / - |` dentro de una clase de caracteres. Si no compila,
**el navegador no avisa**: deja de validar en silencio. Por eso se comprueba que
compile, no solo que esté escrito.

### 2.3 El indicador visual

`app/components/CampoDeContrasena.jsx` muestra una barra graduada y una lista de
las cinco reglas que se van tildando.

Es **la única excepción** a la regla de cero `'use client'` del proyecto, y
tiene un límite: el medidor es un agregado, no una dependencia.

**Cómo se verifica.** Con JavaScript desactivado en el navegador, el registro se
completa igual y crea la cuenta. Queda el campo con su `pattern`, su `minLength`
y la lista de requisitos; lo único que se pierde es la barra moviéndose.

### 2.4 Sanitización: inyección SQL y XSS

**Inyección SQL.** No hay ni una consulta armada con texto concatenado. Todo
pasa por el cliente de Supabase, que usa PostgREST con parámetros, o por
funciones `plpgsql` con parámetros tipados. Las funciones llevan además
`set search_path = ''`, que evita el secuestro del esquema.

**XSS.** React escapa por omisión todo lo que se interpola en JSX. El proyecto
**no usa `dangerouslySetInnerHTML` en ningún lado**.

**Cómo se verifica.**

```
grep -rn 'dangerouslySetInnerHTML' app/        # no devuelve nada
```

Y que ninguna función `security definer` se quede sin `search_path`:

```
python3 - <<'FIN'
import re, pathlib
for f in sorted(pathlib.Path('supabase/migraciones').glob('*.sql')):
    s = f.read_text(encoding='utf-8')
    for m in re.finditer(r'create (?:or replace )?function\s+([\w.]+)\s*\((.*?)\)(.*?)as \$\$', s, re.S | re.I):
        if 'security definer' in m.group(3).lower():
            print('ok ' if 'search_path' in m.group(3) else 'FALTA', m.group(1))
FIN
```

Las 13 funciones del proyecto lo fijan. **No sirve contar con `grep`**: la
cadena `security definer` aparece también en los comentarios que explican el
patrón, y da tres de más.

Y en el navegador: pedir `/ingresar?error=<script>alert(1)</script>` muestra el
texto, no ejecuta nada. Varias pantallas reciben números por la URL —los
segundos de espera, la cantidad de reservas— y todas los validan como enteros
con rango antes de mostrarlos.

---

## 3. Login y rate limiting

**Qué pide.** Login sobre HTTPS y bloqueo temporal tras varios fallos.

### 3.1 Lo que trae Supabase, medido

| Qué | Resultado |
| --- | --- |
| Corta en | el intento **35**, a los 9,5 segundos |
| Alcance | **por IP**, compartido entre cuentas |
| Duración | ~10 segundos |

**No es lo que pide la materia.** Es anti-inundación, no bloqueo por cuenta: a
tres intentos por segundo nunca se activa. Y como es por IP compartida, al
bloquearse, **otra cuenta distinta con su contraseña correcta también recibió
429** — o sea que sirve para dejar afuera a terceros.

### 3.2 Lo que se agregó

`supabase/migraciones/012-intentos-de-ingreso.sql`: bloqueo progresivo con
clave **(correo, IP)**.

```
fallos 1-4  ->   0 s        fallo 8   -> 240 s
fallo  5    ->  30 s        fallo 9+  -> 300 s (tope)
fallo  6    ->  60 s
fallo  7    -> 120 s
```

**La IP forma parte de la clave a propósito.** Un bloqueo por cuenta sola es una
forma de dejar a alguien afuera: quien sepa un correo falla cinco veces y lo
bloquea. Con la IP adentro, quien ataca se bloquea a sí mismo.

**Cómo se verifica.**

```
zsh supabase/probar-bloqueo.sh
```

Y desde el formulario, con la cabecera `X-Forwarded-For`:

```
intentos 1 a 4 -> error=credenciales
intento 5      -> error=espera&segundos=30
misma cuenta desde otra IP -> entra normalmente
entrar bien borra el contador
```

**Lo que este control NO hace.** Vive en nuestra aplicación. El endpoint
`/auth/v1/token` es público, así que quien quiera saltear el formulario lo
saltea. Protege el formulario, no el endpoint.

### 3.3 HTTPS

En desarrollo el sitio corre por HTTP en localhost, que los navegadores tratan
como origen seguro. En producción, Vercel sirve solo por HTTPS y redirige el
tráfico HTTP. La cookie lleva `Secure`, así que **no viaja por una conexión sin
cifrar** aunque alguien lo intente.

---

## 4. Hashing y salting

**Qué pide.** Nunca texto plano. Bcrypt o Argon2, con salt único por usuario.

**Dónde está.** Lo hace Supabase: las contraseñas viven en `auth.users`, una
tabla del esquema de autenticación que **nuestra aplicación nunca lee ni
escribe**. El proyecto no tiene una sola línea que manipule contraseñas: se
mandan a `signUp`, `signInWithPassword` y `updateUser`, y nada más.

**Cómo se verifica.** En el editor SQL de Supabase:

```sql
select substring(encrypted_password, 1, 7) as prefijo, length(encrypted_password)
from auth.users limit 3;
```

El prefijo `$2a$10$` es el identificador de bcrypt con su factor de costo.

Y la demostración del salt, que es la diapositiva 8 hecha consulta: crear dos
cuentas **con la misma contraseña** y comparar.

```sql
select count(*) as cuentas, count(distinct encrypted_password) as hashes_distintos
from auth.users;
```

Si los hashes fueran iguales para contraseñas iguales, no habría salt.

> **No verificado desde acá.** Estas dos consultas necesitan el editor SQL del
> panel: el esquema `auth` no se expone por la API REST, y el proyecto no usa la
> clave secreta. Quedan escritas para correrlas a mano.

---

## 5. Sesiones y cookies

**Qué pide.** Resolver el problema de HTTP sin estado, con `HttpOnly` y
`Secure`.

**Dónde está.** Cookie de sesión manejada por `@supabase/ssr`, con los atributos
fijados en `app/lib/cookies.js`.

**Cómo se verifica.**

```
curl -s -D - -o /dev/null -F '$ACTION_ID_<ingresar>=' \
  -F 'email=...' -F 'contrasena=...' http://localhost:3001/ingresar | grep -i set-cookie
```

Resultado actual:

```
sb-<proyecto>-auth-token.0
Path=/  Max-Age=34560000  Secure  HttpOnly  SameSite=lax
```

Y la prueba que importa, en la consola del navegador con sesión iniciada:

```js
document.cookie   // no muestra la cookie de sesion
```

**Esto estaba mal y se arregló.** `@supabase/ssr` no pone `httpOnly` ni
`secure`, porque la misma librería sirve a aplicaciones donde el navegador lee
la cookie con `createBrowserClient`. Este proyecto no es una de esas —cero
`createBrowserClient`, cero `'use client'` que la necesite— y eso se verificó
antes de cambiarlo.

**Sobre el `Max-Age` de 400 días.** No es un descuido. Lo largo es la vida de la
*cookie*, que guarda el token de refresco; el JWT de adentro dura 60 minutos y
el proxy lo renueva en cada pedido. Es la decisión de Supabase para que no haya
que volver a entrar cada hora.

**`SameSite=Lax`** limita el CSRF: la cookie viaja en navegaciones normales pero
no en pedidos que nacen de otro sitio.

---

## 6. JWT

**Qué pide.** Entender las tres partes y no poner datos sensibles en el payload.

**Cómo se verifica.** Decodificar el payload, que está en base64 y **no
cifrado**:

```
curl -s -X POST "$URL/auth/v1/token?grant_type=password" -H "apikey: $CLAVE" \
  -H 'Content-Type: application/json' -d '{"email":"...","password":"..."}' \
| python3 -c "import sys,json,base64; t=json.load(sys.stdin)['access_token']; \
print(json.loads(base64.urlsafe_b64decode(t.split('.')[1]+'==')))"
```

Resultado actual:

```
alg = ES256          exp - iat = 3600 s (una hora)
claims: aal, amr, app_metadata, aud, email, exp, iat, is_anonymous, iss,
        phone, role, session_id, sub, user_metadata
```

**No hay contraseña ni hash en el payload**, que es lo que la diapositiva 12
marca como error. Sí hay correo, y eso es consciente: el payload está codificado,
no cifrado, así que cualquiera con el token lo lee. No se agregó nada más.

**El rol de la aplicación no viaja en el JWT.** El `role: authenticated` es el
rol de Postgres, no el del estudio. Que alguien sea administración se decide
leyendo `perfiles.rol` en cada pedido: un JWT se emite una vez y vive una hora,
así que si el rol viajara ahí, quitarle permisos a alguien tardaría hasta una
hora en tener efecto.

---

## 7. RBAC

**Qué pide.** Permisos por rol, no por usuario.

**Dónde está.** `perfiles.rol`, con dos valores: `cliente` y `admin`. La
función `public.es_admin()` lo consulta, y la usan tanto las políticas de RLS
como el código.

**Nadie puede darse permisos a sí mismo.** La migración 003 hace:

```sql
revoke update on public.perfiles from authenticated;
grant update (nombre, telefono) on public.perfiles to authenticated;
```

**Cómo se verifica.** Con el token de una cuenta cliente:

```
PATCH /rest/v1/perfiles?id=eq.<propio>  {"rol":"admin"}
  -> 403  42501  "permission denied for table perfiles"
```

Medido. El rol solo se cambia desde el editor SQL.

---

## 8. ABAC

**No se usa, y no hace falta.** ABAC resuelve reglas que dependen de la hora,
la ubicación o el dispositivo. Acá los permisos dependen solo del rol y de ser
dueño del dato.

Dicho eso, las políticas de RLS tienen algo de control por atributo: `user_id =
auth.uid()` no mira un rol sino una relación entre quien pide y el dato pedido.

---

## 9. Middleware

**Qué pide.** Una aduana que intercepte antes de llegar a la ruta.

**Dónde está.** `proxy.js` — en Next 16 `middleware.js` quedó deprecado y
renombrado.

Hace dos cosas: refresca la sesión, y para `/admin/*` hace una **verificación
optimista** de si hay sesión. **No consulta el rol**, porque la documentación de
Next pide no consultar la base en el proxy: corre en cada pedido, incluidos los
que Next hace por adelantado al pasar el mouse por un enlace.

> While Proxy can be useful for initial checks, it should not be your only line
> of defense in protecting your data.

---

## 10. Códigos HTTP

**Qué pide.** 401 cuando no hay sesión, 403 cuando hay sesión sin permisos, y
no confundirlos.

**La distinción está implementada**, que es lo que la materia marca como error:

- **Sin sesión** → se redirige a `/ingresar` guardando el destino.
- **Con sesión, sin permiso** → se muestra "Sin permiso" y **no** se redirige al
  login, porque volver a entrar con la misma cuenta da el mismo resultado.

### 10.1 El 401, con el código correcto

El proxy responde según quién pregunta:

| Cliente | Respuesta |
| --- | --- |
| navegador (`Accept: text/html`) | 307 → `/ingresar?volver=...` |
| navegación interna de Next | 307 → `/ingresar?volver=...` |
| cliente de API | **401** con cuerpo JSON |

**Desvío conocido, y su límite.** La RFC 9110 pide que un 401 incluya una
cabecera `WWW-Authenticate` con un desafío. Para sesiones por cookie no hay
esquema aplicable, así que **el sitio** no manda ninguna, igual que la mayoría
de las aplicaciones con login por formulario. Está documentado en el código.

**La API sí la manda**, y no es una inconsistencia: `/api/v1` acepta
`Authorization: Bearer` como mecanismo de primera clase, así que existe un
esquema que nombrar, y sin la cabecera un cliente que recibe 401 no tiene de
dónde deducir cómo identificarse. Medido: `GET /api/v1/reservas` sin
credenciales y con un token inválido devuelven
`WWW-Authenticate: Bearer realm="api", charset="UTF-8"`. El 403 no la lleva en
ningún caso, porque quien llama ya está identificado y repetir el desafío lo
invitaría a reintentar lo mismo. El detalle está en `docs/api.md` §6.

### 10.2 El 403 numérico: probado y descartado

Hoy la página "Sin permiso" devuelve **200**, no 403. No es por no saber cómo:
se implementó, se midió y se descartó con el resultado en la mano.

Next 16 tiene `forbidden()` y `app/forbidden.jsx`, que devuelven un 403 real.
Se probó en una rama con la versión de Next pinchada a `16.3.6` exacta:

| | código | con JavaScript | sin JavaScript |
| --- | --- | --- | --- |
| hoy, `return <SinPermiso />` | 200 | página correcta | **página correcta** |
| `forbidden()` | **403** | página correcta | **página en blanco** |

El contenido de `forbidden.jsx` viaja solo en el payload RSC. Confirmado por
`curl`: el cuerpo HTML entre el header y el footer viene vacío.

**Por qué se descartó.** El proyecto está construido entero sobre mejora
progresiva, y este sería el único lugar donde eso se rompe. El costo lo paga
justo quien más necesita leer el mensaje. Además `forbidden()` figura como
`version: experimental` y su bandera `authInterrupts` como `version: canary`.

---

## 11. Los errores frecuentes de la diapositiva 17

| Error | Estado | Verificación |
| --- | --- | --- |
| Contraseñas en texto plano | **resuelto** (Supabase) | prefijo `$2a$10$` en `auth.users` |
| Sin salt | **resuelto** (Supabase) | hashes distintos con contraseñas iguales |
| HTTP en vez de HTTPS | **resuelto** en producción | Vercel fuerza HTTPS; la cookie lleva `Secure` |
| Sin `HttpOnly` / `Secure` | **resuelto** | `document.cookie` no la ve |
| Datos sensibles en el JWT | **resuelto** | el payload no tiene contraseña ni hash |
| Sin rate limiting | **resuelto** | `probar-bloqueo.sh` y la prueba del formulario |
| Confundir 401 con 403 | **resuelto en la lógica**, parcial en el código HTTP | ver 10.2 |

---

## 12. Mapa de rutas

La actividad del final del módulo: qué pide cada ruta y qué devuelve.

| Ruta | Sesión | Rol | sin sesión | cliente | admin | API sin sesión |
| --- | --- | --- | --- | --- | --- | --- |
| `/`, `/clases`, `/paquetes`, `/horarios` | no | — | 200 | 200 | 200 | 200 |
| `/reservar` | no para ver | — | 200 | 200 | 200 | 200 |
| `/recuperar` | no | — | 200 | 200 | 200 | 200 |
| `/cuenta` | **sí** | cualquiera | 307 | 200 | 200 | 307 |
| `/cuenta/contrasena` | **sí** | cualquiera | 307 | 200 | 200 | 307 |
| `/admin` y sus cinco pantallas | **sí** | **admin** | 307 | 200 + "Sin permiso" | 200 | **401** |

Y los endpoints de `/api/v1`, que devuelven JSON y por eso no redirigen nunca:

| Ruta | Sesión | Rol | sin sesión | cliente | admin |
| --- | --- | --- | --- | --- | --- |
| `GET /api/v1/salud`, `/paquetes`, `/clases`, `/clases/{id}` | no | — | 200 | 200 | 200 |
| `GET /api/v1/reservas`, `/creditos` | **sí** | cualquiera | **401** | 200 | 200 |
| `POST /api/v1/reservas`, `PATCH /api/v1/reservas/{id}` | **sí** | cualquiera | **401** | pasa | pasa |
| `POST /api/v1/clases`, `PATCH /api/v1/clases/{id}` | **sí** | **admin** | **401** | **403** | 200/201 |
| `GET /api/v1/clases/{id}/reservas` | **sí** | **admin** | **401** | **403** | 200 |

"pasa" y no un número porque ahí la autorización no es lo único que decide: en
la medición, una cuenta de administración reservando una clase que ya tenía
tomada y sin créditos propios recibió **409**, y un `PATCH` sobre una reserva
inexistente recibió **404**. Las dos son respuestas correctas y ninguna es un
rechazo de permisos — que es justamente lo que esta tabla mide. Lo importante
es que la columna "sin sesión" diga 401 y que las dos cuentas con sesión pasen
el control de identidad; lo que venga después lo decide el estado del sistema,
y eso está medido caso por caso en `docs/api.md` §13.

La diferencia con la tabla de arriba es la que pide el módulo: una **página**
sin sesión redirige a `/ingresar` guardando el destino, porque hay una persona
mirando a quien conviene llevar al login. Un **endpoint** devuelve 401 con un
cuerpo JSON, porque del otro lado hay un programa y un 307 a una pantalla de
login no le sirve de nada. Y el 403 de la API **sí es un 403 numérico**, no un
200 con un mensaje: la deuda de §10.2 es de las páginas, no de la API.

Medido con el sitio compilado. Las Server Actions del panel exigen rol en cada
llamada, independientemente de la pantalla: una acción invocada directo con
sesión de cliente corta con error y no escribe nada.

---

## 13. Lo que aporta el framework

Next 16 trae protecciones que el módulo da por tarea del programador y que acá
ya vienen hechas. Están documentadas en `server-actions.md` de la versión
instalada:

- **CSRF.** El `Origin` del pedido se compara con el `Host`. Las discrepancias
  se rechazan.
- **Límite de tamaño**, 1MB por acción.
- **Identificadores de acción cifrados** en compilación, y las acciones sin usar
  se eliminan del paquete del navegador, así que no quedan como endpoints
  públicos.
- **Cifrado de las variables capturadas** por acciones en línea.

Con la advertencia que la propia documentación subraya, y que este proyecto
verificó por su cuenta antes de leerla:

> Framework protections are not a substitute for application-level checks.

---

## 14. Limitaciones conocidas

Lo que no está resuelto, con su motivo. Ninguna es un olvido.

**CAPTCHA: descartado a propósito.** Supabase soporta hCaptcha y Turnstile
nativamente, y sería **el único control de esta lista que Supabase aplica en su
propio endpoint**, o sea el único que no se puede saltear salteando nuestra
aplicación. Se descartó porque el widget es JavaScript de terceros que tiene que
correr en el navegador: convertiría `/ingresar` y `/registro` en páginas de
cliente, justo las dos que hoy funcionan sin JavaScript. El ataque que previene
—registro automatizado masivo— no es el riesgo de un estudio de seis reformers.

**"Prevent use of leaked passwords" no está disponible.** Esa opción compara
contra HaveIBeenPwned y es **exclusiva del plan Pro de Supabase**. Con el plan
gratuito no se puede activar. Es una limitación del plan, no del código.

**El envío de correos llega a una sola dirección.** Resend está configurado y
funciona, pero sin un dominio propio verificado solo envía a la dirección
registrada en la cuenta. Textual de Resend:

> The resend.dev domain is for testing and can only send to your own email
> address.

Por eso las cuentas de prueba con `+alias` no pueden recibir correos. Es una
limitación de la configuración, no del código: con un dominio verificado se
envía a cualquiera.

**No hay historial de contraseñas.** Supabase rechaza poner la contraseña que ya
está puesta, y compara **solo contra la actual**. Los textos de la pantalla
dicen exactamente eso y no "ya usaste esa contraseña", que afirmaría una
protección que no existe. Impedir el reúso de verdad requeriría guardar los
hashes viejos, con su propio costo.

**El bloqueo de ingreso protege el formulario, no el endpoint.** Ver 3.2.

**La fuga de `user_already_exists` sigue abierta** hasta que se active "Confirm
email". Ver 2.1.

---

## 15. Pendientes antes de la entrega

**Bloqueante: `Site URL` tiene que volver a la de Vercel.** Hoy está en
`http://localhost:3000` para poder probar la recuperación. Si se entrega así,
**el correo de recuperación manda a cada persona a su propia computadora**,
donde no hay nada escuchando. El flujo se ve roto y el motivo no es evidente
mirando el código.

**Activar "Confirm email"**, que cierra la fuga de 2.1 y hace falta igual para
un sitio real.

---

## Apéndice: un error de método que vale registrar

Durante este trabajo se concluyó que `/paquetes` y la home servían datos
cacheados, a partir de las entradas que aparecen en `.next/cache/fetch-cache`
después de un build. **Era falso.** Esas entradas las escribe el *build*, no el
servidor en caliente; una escritura hecha directo en la base, sin que nadie
llamara a `revalidatePath`, ya se veía en el pedido siguiente.

Se había tomado un artefacto de compilación como evidencia del comportamiento en
ejecución. La corrección está en `CLAUDE.md` y en `docs/prompts.md`.

Viene al caso acá porque es el mismo error que este documento intenta evitar:
**afirmar una propiedad del sistema sin haberla visto ocurrir.**
