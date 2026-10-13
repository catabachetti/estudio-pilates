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
- Una escritura que RLS rechaza **no devuelve error**: devuelve que no cambió
  ninguna fila. Toda actualización del panel termina en `.select()` para
  distinguir "no tenía permiso" de "guardado".

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

- **La home cachea su catálogo por un año.** `app/page.jsx` no declara
  `revalidate`, así que los `fetch` que hacen sus componentes quedan en el
  Data Cache con `revalidate: 31536000`. Se puede comprobar en
  `.next/cache/fetch-cache` después de un build. Por eso `revalidatePath('/')`
  no es opcional en las acciones del panel: sin esa línea, un precio editado
  aparece en `/paquetes` dentro de la hora, y en la home **nunca**. Cuando el
  panel edite clases o tipos de clase, esas acciones necesitan lo mismo.

- El panel de paquetes edita nombre, precio, clases y vigencia, y activa o
  desactiva. **No** edita `incluye` (la descripción de la tarjeta) ni `orden`.
  Esos dos siguen cambiándose desde Supabase, y como `seed.sql` ya no se puede
  volver a correr, hoy no tienen ninguna interfaz propia. **A resolver junto con
  `/admin/clases`**, que es la misma clase de formulario: campos de texto y un
  número sobre una fila que ya existe.
