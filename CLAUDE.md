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
  seis situaciones, incluida la carrera con dos transacciones reales.

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

## Alcance descartado

Lo que se decidió no hacer, para que no se confunda con un olvido.

- **Paquete "Mes libre"** — 13 de octubre de 2026, migración 008. Era el único
  paquete sin cantidad fija de clases, y obligaba a un caso especial en tres
  lugares: el panel, la reserva y el webhook de Mercado Pago. Con la entrega a
  cuatro semanas se eligió un modelo de créditos coherente antes que dos
  modelos a medias. Si vuelve, no vuelve como un `clases` en null: vuelve como
  su propio concepto, una suscripción con fecha de inicio y de fin.

## Deuda conocida

- La compensación óptica de los títulos (`--compensacion` en `app/globals.css`)
  depende de la **primera letra** del título, no de la página. El valor por
  defecto (0.07em) sirve para las letras de asta recta (N, P, R, H, E). Hoy hay
  dos overrides: `/contacto` porque empieza con C y `/terminos` porque empieza
  con T. Si esos títulos cambian de nombre, el valor queda mal y nada lo avisa:
  hay que volver a medir el borde visible del primer carácter.

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

- **No hay forma de quitar créditos desde el panel.** Se pueden otorgar y nada
  más. Si alguien se equivoca —un doble clic, el paquete equivocado— hoy se
  arregla solo desde el editor SQL de Supabase, borrando las filas de
  `creditos` y la de `compras` que las agrupa. Es una deuda aceptable mientras
  administre una sola persona que puede ver el total antes y después en la
  pantalla, pero quitar créditos no es simétrico a otorgarlos: hay que decidir
  qué pasa si ya se usaron para reservar, y esa decisión todavía no está tomada.

- La validación del cupo contra las reservas ya tomadas se hace en la
  aplicación: se lee la cuenta y después se escribe. Entre las dos cosas
  alguien podría reservar y el cupo quedaría uno por debajo. Con seis lugares y
  una sola persona administrando, la ventana es teórica.
  **Pero la misma carrera, en las reservas, no lo es:** dos personas tomando el
  último lugar al mismo tiempo. Cuando se escriba esa pantalla, la verificación
  y la escritura tienen que ir en una sola sentencia desde el principio, en una
  función `security definer`, no en dos viajes desde el servidor.
