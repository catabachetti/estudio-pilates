# Despliegue, DevOps e integración continua

Recorrido del módulo 14. Qué estaba hecho desde septiembre, qué faltaba, y la
parte que no sale de la presentación: lo que este proyecto **midió** sobre su
propio despliegue, incluida una medición anterior que estaba mal hecha y una
afirmación que la primera corrida del pipeline falsificó.

---

## 1. Qué cambia cuando no hay servidor

El modelo tradicional es una máquina encendida: un proceso escuchando en un
puerto, con disco, memoria y un sistema operativo que alguien actualiza. El
modelo serverless es una función que se despierta cuando llega un pedido y se
apaga cuando termina.

Las consecuencias que **este** proyecto sintió, que son las que vale escribir:

| Consecuencia | Dónde se notó acá |
|---|---|
| No hay disco donde guardar nada | Ninguna subida de archivos. Las imágenes son estáticas y viajan en el repositorio |
| No hay proceso vivo entre pedidos | Ningún contador en memoria. El bloqueo progresivo de ingreso guarda los intentos **en la base**, en `intentos_de_ingreso`, no en una variable |
| Arranque en frío | El primer pedido después de un rato tarda más. Con seis lugares por clase y una sola persona administrando, no importa |
| Hay un tiempo máximo por pedido | El webhook de Mercado Pago declara `maxDuration = 15`. Sin eso, el valor por defecto podría cortar una acreditación a mitad de camino |
| Los logs son efímeros | §8 |

La consecuencia de arriba que más decidió código es la segunda. Un contador de
intentos en memoria es lo primero que uno escribe para frenar un ataque de
fuerza bruta, y en serverless no funciona: cada pedido puede caer en otra
instancia, así que el contador arranca en cero cuando conviene al atacante.

---

## 2. El pipeline que ya existía

Desde septiembre: `git push` a `main` → Vercel compila → Vercel despliega. No
hay un paso de deploy escrito por nadie; es la integración de Vercel con GitHub.

Lo que da gratis y conviene saber que es gratis, porque es la mitad del valor de
la plataforma:

- **Un deploy de preview por rama**, con su propia URL. Es lo que hace que
  revisar un pull request sea mirar el sitio y no leer el diff.
- **Rollback** a cualquier deploy anterior, que sigue existiendo en su URL.
- **HTTPS** con certificado de Let's Encrypt, renovado solo. Ver §6.
- **CDN**: los archivos estáticos se sirven desde el borde.

Y lo que **no** da gratis, que es el tema del módulo: no sabe si las pruebas
pasaron. Ver §9.

---

## 3. El caché: lo que este proyecto midió, con número

`app/clases/[slug]/page.jsx` y otras cuatro páginas declaran
`export const revalidate = 3600`. La intención era que el HTML se regenerara una
vez por hora en vez de en cada pedido.

**No hace nada**, y eso ya estaba medido y anotado en CLAUDE.md como deuda. Lo
que faltaba era el número, y la primera corrida del CI lo trajo de rebote.

Dos builds del **mismo** árbol de archivos, la única diferencia son las
variables de entorno:

| | marcador de `/clases/[slug]` | páginas prerenderizadas |
|---|---|---|
| sin variables | `●` (SSG) | **0** |
| con variables | `ƒ` (dinámica) | **0** |

Con las variables, Next trae los tres slugs de la base, intenta
prerenderizarlos, y los degrada a dinámicos igual. Sin variables la lista queda
vacía y el marcador `●` no tiene ninguna página detrás. **Cero en los dos
casos.**

**La contraprueba, que es la que pone el número.** En un clon, sacando una sola
línea —`<Header />` del layout raíz— y compilando con las mismas variables:

```
├ ○ /clases                    1h   1y
├   /clases/[slug]
│ ├ ● /clases/flow             1h   1y
│ ├ ● /clases/power            1h   1y
│ └ ● /clases/prenatal         1h   1y

total de páginas estáticas:  16     (contra 1)
```

Aparecen los tres HTML, aparece la columna `1h` del `revalidate`, y el build
pasa de 1 página estática a 16.

**Esa es la medida exacta de lo que cuesta leer cookies en el layout raíz.** El
header muestra "Mi cuenta" o "Ingresar" según la sesión, la sesión vive en una
cookie, y leer una cookie hace dinámica la ruta entera. Está en el layout raíz,
así que son **todas** las rutas.

No se cambia, y el motivo no es pereza: un header que no sabe si hay sesión es
un header que hay que pintar en el navegador después de cargar, o sea
`'use client'` y un parpadeo. La decisión de este proyecto es servir HTML
terminado desde el servidor, y esto es el precio. Lo que estaba mal era tener
escrito un `revalidate` que no hace nada sin decir que no hace nada.

---

## 4. Variables de entorno y los tres entornos

| Entorno | Dónde viven las variables | Quién las ve |
|---|---|---|
| Desarrollo | `.env.local`, ignorado por git | Solo esta máquina |
| Preview | Vercel → Settings → Environment Variables | El deploy de cada rama |
| Producción | Las mismas, marcadas para Production | El sitio en vivo |

`.env.local` **nunca llega al deploy**, porque está en `.gitignore` (`*.local`).
Eso no es un descuido que haya que compensar: es la razón por la que las
variables se cargan aparte en el panel.

### Config y Secret, y por qué la publishable va como Config

Vercel deja marcar cada variable como **Secret** (no se puede volver a leer
desde el panel) o como **Config** (se puede).

Las que empiezan con `NEXT_PUBLIC_` van como **Config**, a propósito. Por
definición terminan en el JavaScript que viaja al navegador: cualquiera las lee
con las herramientas de desarrollo. Marcarlas como secreto da una sensación de
protección que no existe, y lo peor de una protección inexistente es que alguien
cuente con ella.

**Lo que protege los datos no es la clave, es RLS.** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
es pública por diseño; si una tabla queda con RLS apagada, esa clave alcanza
para leerla entera. El detalle está en `docs/seguridad.md`.

La clave secreta de Supabase (`sb_secret_...`) sí va como Secret, no lleva
prefijo `NEXT_PUBLIC_`, y el sitio **hoy no la usa**: todas las lecturas
públicas pasan por RLS y lo que administración necesita escribir va por
funciones `security definer`. La usan las pruebas E2E, que no corren en
producción.

### El episodio de la letra que faltaba

Durante el módulo 12, el webhook de Mercado Pago no acreditaba. Dos errores
distintos en las variables, y los dos merecen estar escritos porque son
exactamente lo que la diapositiva 17 llama "variables mal configuradas":

1. **La misma clave pegada en dos variables.** `SUPABASE_SECRET_KEY` y
   `MP_ACCESS_TOKEN` tenían las dos el token de Mercado Pago. Una de las dos
   estaba mal y ninguna de las dos avisaba.
2. **Una variable que perdió una letra.** Quedó `P_ACCESS_TOKEN` en vez de
   `MP_ACCESS_TOKEN`. Next no la encontraba, `process.env.MP_ACCESS_TOKEN` era
   `undefined`, y el código hacía lo que hace con una variable ausente: cortar.

Lo que esto enseña sobre método: **el valor correcto en el nombre equivocado es
indistinguible, desde el código, de la variable ausente.** Y el arreglo se
verificó comparando *hashes* de los cuatro valores, no mirándolos, que es la
forma de confirmar que cuatro variables tienen cuatro contenidos distintos sin
imprimir ninguno.

---

## 5. Qué hace falta para desplegar este proyecto desde cero

El orden importa, porque dos de estos pasos fallan en silencio si se hacen al
revés.

```
1. Importar el repositorio en Vercel
2. Cargar las variables en Settings → Environment Variables
       NEXT_PUBLIC_SUPABASE_URL                  Config
       NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY      Config
       MP_ACCESS_TOKEN                           Secret
       MP_WEBHOOK_SECRET                         Secret
       MP_WEBHOOK_SECRET_PRUEBA                  Secret
3. Deploy
4. En Supabase: Authentication → URL Configuration → Site URL = la URL del deploy
5. En Mercado Pago: la notification_url del webhook = <URL del deploy>/api/webhooks/mercadopago
```

Los pasos 4 y 5 son los que fallan en silencio. Un Site URL equivocado manda los
correos de recuperación de contraseña a `localhost:3000`, y la persona recibe un
enlace que no funciona sin que el sitio dé ningún error. Una `notification_url`
equivocada hace que Mercado Pago cobre y nadie acredite el crédito: el pago
aparece aprobado en el panel de Mercado Pago y no pasa nada en el sitio.

---

## 6. Dominios, DNS y SSL

Conceptual, porque **este proyecto no compra un dominio** y la decisión está
abajo.

### Los registros que importan

| Registro | Apunta a | Para qué |
|---|---|---|
| **A** | una dirección IP | El dominio raíz (`ejemplo.com`) |
| **CNAME** | otro nombre | Un subdominio (`www.ejemplo.com` → `cname.vercel-dns.com`) |
| **ALIAS** / **ANAME** | otro nombre, en el raíz | Lo que algunos proveedores ofrecen para esquivar el problema de abajo |

**Un dominio raíz no puede ser un CNAME**, y no es una restricción de Vercel: es
del protocolo. La norma del DNS no permite que un nombre que tiene registros
`SOA` y `NS` —y el raíz de una zona los tiene por definición— tenga además un
`CNAME`. Por eso el raíz se apunta con un `A` a una IP, y los subdominios con
`CNAME` a un nombre.

El problema del `A` en una plataforma como Vercel es que uno queda clavado a una
IP que no controla. `ALIAS`/`ANAME` lo resuelven: se comportan como un `CNAME`
pero el proveedor de DNS resuelve el nombre y devuelve la IP, así que el raíz
sigue teniendo registros válidos. No todos los proveedores lo soportan, y por
eso el `A` sigue siendo la respuesta de libro.

**La propagación** —esas 24 a 48 horas que se citan— es el TTL de los registros
anteriores venciendo en cachés ajenos. Bajar el TTL **antes** de mudar un
dominio es el truco que hace que la mudanza tarde minutos.

### SSL

Vercel emite el certificado con Let's Encrypt y lo renueva solo, para el
subdominio de la plataforma y para un dominio propio. No hay nada que hacer y no
hay nada que recordar, que es la diferencia con administrar un certificado a
mano.

### La decisión: no se compra un dominio

El sitio vive en el subdominio de Vercel. Un dominio propio es un costo anual y
una renovación que alguien tiene que recordar, para un proyecto de materia que
se entrega una vez. El HTTPS ya está y no depende de eso.

Si el estudio decidiera usar el sitio de verdad, el dominio sería lo primero —
una dirección de Vercel en un folleto se lee como provisoria— y el trabajo es
cargar dos registros en el DNS del registrador.

---

## 7. Observabilidad, y dónde no alcanzó

Lo que hay:

- **Logs de función** en el panel de Vercel, por invocación.
- **Cada error devuelve un `id`** a quien lo ve y escribe ese mismo `id` en el
  log del servidor. Así una persona puede decir "me salió el error `a3f9`" y eso
  se busca.
- Los arneses y las pruebas, que son observabilidad antes del hecho.

**Y el caso real donde no alcanzó.** Cuando el webhook de Mercado Pago no
acreditaba, los logs de Vercel fueron lo primero que se miró. Mostraban el aviso
llegando y la firma dando inválida. Lo que **no** mostraban era el dato que
resolvía el problema: **de qué ambiente venía el aviso**, porque Mercado Pago
tiene un secreto de firma distinto para el modo productivo y para el de prueba,
y el aviso no dice en qué modo fue generado.

Ese dato solo estaba en el panel de Mercado Pago. Los logs propios no podían
tenerlo, porque el sistema propio no lo recibe.

**Lo que esto enseña:** la observabilidad propia alcanza hasta el borde del
sistema propio. Un fallo en una integración con un tercero se diagnostica con
los dos paneles abiertos, y el log de uno solo puede señalar con confianza a la
causa equivocada. El arreglo fue aceptar **las dos** claves y registrar con cuál
validó, que es exactamente el dato que faltaba convertido en log:

```
firma válida (modo prueba)
```

---

## 8. Logs efímeros y log drains

Los logs de Vercel se ven en vivo y se guardan poco. Un **log drain** los manda
a un servicio externo que los indexa y los retiene.

**Este proyecto no tiene uno**, y el motivo es el volumen: un estudio con seis
lugares por clase no genera un flujo de logs que haga falta indexar. El
reemplazo es el `id` de error de §7, que convierte "buscá en los logs de ayer"
en "buscá este identificador".

Lo que sí habría que poner antes de que el sitio reciba tráfico de verdad: un
drain es también la única forma de tener el log **después** de que pasó algo que
nadie miró en el momento.

---

## 9. CI y CD, y qué bloquea cada cosa

| | Qué hace |
|---|---|
| **CI** — integración continua | Cada cambio se compila y se prueba automáticamente |
| **CD** — despliegue continuo | Cada cambio que pasa llega a producción solo |

La diapositiva 18 dice: *"solo código que pasa tests llega a producción"*. Y acá
está la parte interesante del caso, porque **hasta la regla de §13 eso no era
cierto en este proyecto**, y no por un error de configuración.

**Vercel y GitHub Actions son dos pipelines independientes que escuchan el mismo
`push`.** Ninguno espera al otro. Vercel no sabe que hay un workflow; el
workflow no sabe que hay un deploy.

### La demostración en vivo

No hace falta argumentarlo: la primera corrida del pipeline lo mostró. Corrida
[41653361023](https://github.com/catabachetti/estudio-pilates/actions/runs/41653361023),
commit `ad63b0e`, PR #23. Lo que GitHub tenía reportado sobre ese commit:

```
check runs (GitHub Actions)              statuses (otros servicios)
  estático y unitario        failure       Vercel          success
  reglas de la base          failure
  contrato con Mercado Pago  failure
  E2E contra Supabase        skipped
  Vercel Preview Comments    success
```

Tres checks en rojo, y **Vercel desplegó y reportó éxito**. Ni siquiera son el
mismo canal: Actions reporta *check runs* y Vercel reporta un *commit status*,
que son dos listas distintas de la misma API.

**La precisión que ordena el argumento:** en una rama, lo que Vercel despliega es
un **preview**, no producción. Producción sale de `main`. Así que lo que esa
corrida demuestra no es "el CI en rojo llegó a producción" — demuestra que **los
dos pipelines no se consultan**, y por lo tanto que el único portón que separa un
cambio roto de producción es el **merge**.

Y ese portón, hasta la regla de §13, no existía.

### Por eso lo que se bloquea es el merge, no el deploy

Es la distinción que vale escribir: no se bloquea el deploy, se bloquea el
**merge**. El efecto es el mismo **mientras nadie pueda escribir en `main` por
otro camino**, y por eso prohibir el push directo no es una precaución aparte:
es parte del mecanismo.

### Por qué no se movió el deploy al workflow

La diapositiva 15 describe lo otro: `vercel deploy --prod` en el workflow, con el
token en secrets. Se descartó, y es una decisión de riesgo, no de
desconocimiento:

1. **Reemplaza un pipeline que funciona** por uno sin estrenar, a nueve días de
   la entrega.
2. **Crea un secret con permiso para desplegar a producción.** Hoy ningún secret
   de este repositorio puede tocar el sitio en vivo. Ese sí podría, y un secret
   de ese alcance en un repositorio público es una superficie nueva.

El costo de no hacerlo es el de §9: dos pipelines que no se consultan, cerrado
con la regla de rama en vez de con código.

---

## 10. El pipeline: `.github/workflows/ci.yml`

Cuatro jobs. Los tres primeros corren en cada push a `main` y en cada pull
request; el cuarto solo a mano.

### `calidad` — estático y unitario

`npm ci`, `eslint . --max-warnings 0`, `npm run build`, y las tres pruebas de
nodo (reglas de contraseña, esquemas de validación, armado de la agenda).
Cálculo puro: ninguna toca la red.

### `base` — las reglas del negocio, en Postgres de verdad

Los siete arneses. Levantan un Postgres descartable, corren las doce migraciones
reales y prueban lo que ninguna prueba de interfaz puede ver:

- la **carrera por el último lugar** con dos transacciones concurrentes
- el bloqueo progresivo de ingreso
- la **idempotencia** de la acreditación de créditos
- el orden de borrado de los datos de prueba, con sus dos frenos
- que `extender-agenda.sql` no pise el catálogo

**Es el job que más valor agrega, y el que el plan del módulo 13 descartó sin
medir.** No necesita `npm ci`: solo `psql`, `initdb`, `pg_ctl` y `python3`.

### `webhook` — el contrato con Mercado Pago

Compila, levanta `next start`, y corre los 21 casos de firma del webhook **con
claves inventadas**. El HMAC es simétrico, así que el arnés firma con la misma
clave que el handler: se verifica el contrato completo sin una credencial real y
sin salir a la red.

Y el caso del "pago que Mercado Pago no encuentra" también pasa sin red: sin
`MP_ACCESS_TOKEN`, `consultarPago` corta antes de intentar la llamada y el
handler devuelve el 500 que corresponde.

### `e2e` — a mano, y por un motivo

`if: github.event_name == 'workflow_dispatch'`. Las 67 pruebas de Playwright
**escriben en la única base de datos que hay**: cada corrida crearía cuentas y
reservas en la base del sitio. Lo que lo desbloquearía es un segundo proyecto de
Supabase, que es una decisión aparte.

Si los secrets no están configurados, el job **se saltea con el motivo** en vez
de fallar, porque un fallo acá parecería un bug del sitio. Detalle de
implementación que vale: el `if` de un job **no puede leer el contexto
`secrets`**, así que se comprueba en un paso y se decide con su salida.

### Dos decisiones chicas del YAML

- **`node-version-file: package.json`**, no una versión escrita en el YAML. La
  versión sale de `engines`: una sola fuente, como el resto del proyecto.
- **`npm ci` y no `npm install`.** `ci` instala exactamente lo que dice
  `package-lock.json` y falla si los dos no coinciden, en vez de resolver
  versiones nuevas. Un CI que resuelve versiones nuevas prueba algo distinto de
  lo que se va a desplegar.
- **`concurrency` con `cancel-in-progress`**: si llegan dos pushes seguidos a la
  misma rama, el primero se cancela. Importa si está verde el último.
- **`permissions: contents: read`**. El workflow no escribe en el repositorio ni
  publica nada.

---

## 11. Qué queda afuera, y cómo se corre a mano

| Qué | Por qué queda afuera | Cómo se corre |
|---|---|---|
| Playwright en cada push | Escribe en la única base que hay | `npm run test:e2e`, o el job manual desde la pestaña Actions |
| `probar-preferencia.mjs` | Le pega a la API de Mercado Pago de verdad y crea preferencias. Un CI que depende de un tercero se rompe cuando el tercero tiene un mal día | `node docs/ejemplos/probar-preferencia.mjs` |
| El deploy | Ya lo hace Vercel, §9 | `git push` |

---

## 12. Secrets

**El pipeline que corre en cada push no usa ninguno, y eso es un resultado, no
una omisión:** nada de lo que se ejecuta ahí toca un servicio externo. El build
no necesita la base (§15), los arneses levantan su propio Postgres, y el webhook
se prueba con claves inventadas.

El job manual los usa con la sintaxis que corresponde, `${{ secrets.NOMBRE }}`,
y **sin un solo valor en el YAML**:

```yaml
      - name: la suite
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
          E2E_ADMIN_EMAIL: ${{ secrets.E2E_ADMIN_EMAIL }}
          E2E_ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}
```

Van **por entorno y no a un archivo**: `e2e/fixtures.js` lee `.env.local` y deja
que el entorno del proceso le gane, así que no hace falta escribir ninguna
credencial en disco dentro del runner.

Y la cuenta de administración de las pruebas es una cuenta de prueba
(`...+adminprueba@...`), no la personal. Un secret es un secreto guardado, no un
secreto que deja de importar.

---

## 13. La regla de protección de rama

Dos casillas y ningún código. Es lo que convierte "las pruebas corren" en "solo
código que pasa pruebas llega a producción".

```
Settings → Branches → Add branch protection rule
  Branch name pattern:  main

  [x] Require a pull request before merging
  [x] Require status checks to pass before merging
        buscar y tildar, con estos nombres exactos:
          estático y unitario
          reglas de la base
          contrato con Mercado Pago
```

**Los nombres son los del campo `name:` de cada job, con acento**, no los de la
clave del YAML (`calidad`, `base`, `webhook`). Solo aparecen en el buscador
**después** de que el workflow corrió al menos una vez, porque GitHub ofrece los
checks que ya vio.

**No tildar `E2E contra Supabase (a mano)`.** No corre en los pull requests, así
que exigirlo haría depender el merge de cómo GitHub cuenta un check salteado, y
eso no hace falta averiguarlo.

**La segunda casilla no es un extra: es lo que hace cierta a la primera.** Exigir
los checks sin exigir el pull request no sirve de nada, porque un push directo a
`main` saltea los dos. Por eso prohibir el push directo es parte del mecanismo.

Esta regla la configura la dueña del repositorio; no se puede poner desde el
código.

---

## 14. La contraprueba

*(Pendiente: se completa cuando corra.)*

---

## 15. Los cuatro errores frecuentes de la diapositiva 17

| Error | Pasó acá |
|---|---|
| **Variables de entorno mal configuradas** | **Dos veces.** La misma clave en dos variables, y `P_ACCESS_TOKEN` sin la M. §4 |
| **Olvidar el prefijo `NEXT_PUBLIC_`** | No pasó, y por un motivo escrito: el proyecto tiene la regla de qué va con prefijo y qué no, y la razón —lo que protege es RLS, no la clave— está en `docs/seguridad.md` |
| **No probar el build de producción** | **Pasó, y es el episodio de §16.** Había una medición que decía que el build andaba sin variables y estaba mal hecha |
| **Pipeline sin bloqueo** | **Pasó, y es §9.** Está cerrado por §13 |

Dos de los cuatro pasaron en este proyecto, y los dos los resuelve este módulo.

---

## 16. Apéndice: dos errores de método

Valen escribirlos porque ninguno fue un error de código, y porque los dos son
la misma clase de error: **una medición que no medía lo que decía medir.**

### Primero: el build que "andaba sin variables"

El plan de este módulo afirmaba, como cosa medida:

> `npm run build` **sin ninguna variable de entorno** funciona. Todas las rutas
> son dinámicas y `clienteSupabase()` solo corre al atender un pedido.

La primera corrida del pipeline lo falsificó: dos de los tres jobs cortaron en
`npm run build` con

```
Error: supabaseUrl is required.
    at app/lib/supabase.js:16:10
    at app/clases/[slug]/page.jsx:28:33
> Build error occurred
Error: Failed to collect page data for /clases/[slug]
```

`generateStaticParams` consulta Supabase al compilar. Era la única función del
proyecto que lo hacía, y la afirmación de que ninguna lo hacía era falsa por una.

**Y la medición que la respaldaba estaba mal hecha.** Era:

```sh
env -i PATH="$PATH" HOME="$HOME" npm run build
```

`env -i` limpia el **entorno del proceso**. No borra `.env.local` **del disco**,
y Next lo carga por su cuenta al arrancar. La variable estuvo ahí todo el tiempo.

Lo que lo hace una trampa y no un descuido cualquiera: **`.env.local` está en
`.gitignore`**, así que es invisible en el repositorio y en cualquier revisión
del diff. La única forma de medirlo es un árbol con **solo los archivos que git
versiona**:

```sh
git ls-files -z | rsync -0 --files-from=- -q . /un/directorio/limpio/
cd /un/directorio/limpio && npm ci && npm run build
```

Ahí falló al primer intento.

**La regla:** para comprobar que algo funciona *sin* una configuración, no basta
con quitarla del entorno; hay que comprobarlo donde la configuración no existe.
Un runner limpio es el primer lugar del proyecto donde eso pasa de verdad, y por
eso un CI encuentra esta clase de error y una verificación local no.

Y el segundo fallo de esa corrida fue de la misma familia, más barato:
`probar-extender-agenda.sh` tenía escrito a mano
`P=/Users/catalina/Documents/estudio-pilates/supabase`, mientras los otros seis
arneses derivan la ruta con `$(dirname "$0")`. Pasaba en una sola máquina del
mundo. Después del arreglo se barrió el repositorio entero por rutas absolutas:
ninguna.

**Lo que esa corrida roja demostró de paso**, y que era justamente lo que estaba
en duda: `base` llegó al paso 11, o sea que la búsqueda portable de Postgres
funciona en `ubuntu-latest` y los **seis** arneses anteriores pasaron ahí,
carrera por el último lugar incluida.

### Segundo: un arnés que medía otro servidor

Con el build arreglado, el job del webhook llegó al paso 7 y falló ahí.
`probar-webhook-dos-claves.sh` pasa en esta Mac y fallaba en el runner.

El arnés levanta el sitio cuatro veces, una por combinación de claves, y
**reusaba el puerto 3001**: antes de cada caso buscaba al servidor anterior con
`lsof` para matarlo. Dos problemas, y el segundo no es un problema de CI:

1. **`lsof` no está garantizado en un runner.** En macOS vive en `/usr/sbin`.
2. **Cuando no está, el arnés no se da cuenta.** No mata nada, el `next start`
   nuevo no puede tomar el puerto ocupado... y el curl de espera **igual
   contesta**, porque contesta el servidor **viejo**. El arnés sigue adelante y
   prueba un servidor con otras claves, sin avisar.

Lo segundo es **un arnés que mide otra cosa**, que es el tipo (a) de la
clasificación de `docs/pruebas.md` y el peor tipo de prueba que existe: no da
error, da una respuesta sobre otra pregunta.

**Falló ruidosamente por casualidad**, porque los cuatro casos esperan códigos
distintos. Con dos casos de expectativa igual habría pasado en verde midiendo
nada.

Reproducido escondiendo `/usr/sbin` del `PATH`: el caso A pasa entero y los
otros tres fallan contra las claves del A, cinco casos mal.

**Lo que no se pudo confirmar** es si `ubuntu-latest` trae `lsof`. Los logs del
job piden autenticación y la
[documentación de los runners](https://docs.github.com/en/actions/how-tos/manage-runners/github-hosted-runners/customize-runners)
no publica la lista de paquetes en una página legible desde acá. **El arreglo no
depende de esa respuesta**, y tampoco era instalar `lsof`: ahora va **un puerto
por caso**, no hay nada que matar, y si un servidor no atiende el arnés corta
con el registro a la vista.

### Y lo que apareció al arreglarlo: una espera que nunca tenía éxito

La espera de "servidor listo" era `curl -sf`, y **`-f` hace fallar a curl con
cualquier código HTTP >= 400**. En el CI el sitio corre **sin variables de
Supabase**, así que todas las páginas contestan 500 al atenderse. Medido:

```
curl -sf  contra un servidor que contesta 500   -> 22    (parece caído)
curl -s   contra el mismo                       -> 0     (hay servidor)
curl -s   contra un puerto cerrado              -> 7     (no hay servidor)
```

**Con `-f`, curl confunde "servidor que contesta 500" con "no hay servidor".**

El paso 6 del workflow funcionaba **por suerte**: gastaba los 60 segundos
completos de espera y seguía igual, y el arnés solo necesita que el servidor
atienda, no que devuelva 200. Pero era una inestabilidad esperando el día en que
`next start` tardara más de 60 segundos: los 13 casos fallarían con errores de
conexión, y el síntoma no se parece en nada a la causa.

Los tres `curl -sf` del repositorio eran los de estas dos esperas. Ahora van sin
`-f` y con un freno que corta en vez de seguir.

**El efecto medible del arreglo:** el arnés de las dos claves pasa de gastar 240
segundos de espera inútil a terminar en **4**.

### Lo que las dos comparten

| | La medición decía | Lo que medía de verdad |
|---|---|---|
| El build | "compila sin variables de entorno" | compila con `.env.local`, que `env -i` no borra |
| El arnés | "el servidor de este caso contesta X" | el servidor de un caso anterior contestaba X |
| La espera | "el servidor está listo" | el servidor devuelve menos de 400, que acá nunca pasa |

En los tres casos la comprobación **pasaba**, y pasar era el problema. Lo que
los encontró fue el mismo mecanismo: **un entorno donde los supuestos no se
cumplen**. Un runner limpio no comparte el `.env.local`, ni los binarios de
macOS, ni el servidor de la corrida anterior.

Y eso es la respuesta concreta a para qué sirve un CI cuando uno ya probó todo
en su máquina: **no corre las mismas pruebas, corre las mismas pruebas en otro
lado**, y la diferencia entre los dos lados es donde viven estos errores.
