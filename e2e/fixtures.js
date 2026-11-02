import { test as base, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

// LO QUE LAS PRUEBAS NECESITAN ANTES DE EMPEZAR, y las reglas que las hacen
// seguras de correr contra la base de verdad.
//
// HAY UN SOLO PROYECTO DE SUPABASE. No existe una base de pruebas, así que
// estas pruebas escriben donde escribe el sitio. De ahí salen tres reglas, y
// están acá y no en un documento porque son lo que este archivo implementa:
//
//   1. NUNCA SE MODIFICA EL CATALOGO. `paquetes`, `tipos_clase` e
//      `instructoras` solo se leen. Un precio cambiado por una prueba queda
//      cambiado para el sitio.
//   2. LO QUE SE CREA NO PUEDE CORRER EL FINAL DE LA AGENDA.
//
//      La primera versión de esto creaba las clases en 2027, porque es el rango
//      que supabase/limpiar-datos-de-prueba.sql reserva para datos de prueba.
//      **Estaba mal, y se midió.** `agendaDeLaSemana()` calcula hasta dónde se
//      puede avanzar con la fecha de la ÚLTIMA clase programada de la tabla:
//
//        siguiente: aClave(lunesSiguiente) <= ultimaFecha ? ... : null
//
//      Una clase en 2027 corre ese final a 2027, y /reservar deja avanzar
//      semana por semana por treinta y cinco semanas vacías. Medido contra el
//      sitio: con clases de prueba en 2027 se podía llegar al 2026-12-14,
//      pasando el final real de la agenda, que es el 2026-12-05.
//
//      Así que las clases de prueba se crean EN UNA FECHA QUE YA TIENE CLASES,
//      a una hora que el estudio no usa. Así `ultimaFecha` no se mueve y el
//      sitio no cambia.
//   3. LO QUE SE CREA, SE BORRA. En el teardown de cada fixture.

// Las variables salen de .env.local a mano: el proceso de Playwright no es
// Next y no las carga solo.
function entorno() {
  const vars = {}
  try {
    for (const linea of readFileSync('.env.local', 'utf8').split('\n')) {
      const i = linea.indexOf('=')
      if (i > 0) vars[linea.slice(0, i).trim()] = linea.slice(i + 1).trim()
    }
  } catch {
    // Sin .env.local se usa lo que haya en el entorno del proceso.
  }
  return { ...vars, ...process.env }
}

const env = entorno()
const URL_SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE_SECRETA = env.SUPABASE_SECRET_KEY

// LA CLAVE SECRETA SE USA ACA Y SOLO ACA.
//
// Este archivo corre en el proceso de pruebas, no en el navegador: la clave no
// viaja a ninguna página. Es la misma distinción que hace
// app/lib/supabase-servicio.js con `import 'server-only'`, pero acá no hay
// forma de que un componente la importe por error, porque e2e/ no es parte del
// paquete del sitio.
async function supabase(ruta, opciones = {}) {
  const r = await fetch(`${URL_SUPABASE}${ruta}`, {
    ...opciones,
    headers: {
      apikey: CLAVE_SECRETA,
      Authorization: `Bearer ${CLAVE_SECRETA}`,
      'Content-Type': 'application/json',
      ...(opciones.headers ?? {}),
    },
  })
  const texto = await r.text()
  const cuerpo = texto ? JSON.parse(texto) : null
  if (!r.ok) {
    throw new Error(`Supabase ${r.status} en ${ruta}: ${JSON.stringify(cuerpo)}`)
  }
  return cuerpo
}

// UNA CUENTA POR CORRIDA, CREADA POR LA API DE ADMINISTRACION.
//
// Las otras dos opciones se descartaron por motivos concretos:
//
//   reutilizar una cuenta fija   el estado se arrastra entre corridas: una
//                               prueba que reserva deja la clase ocupada para
//                               la siguiente, y la suite empieza a fallar por
//                               orden de ejecución.
//
//   registrarse por el          docs/seguridad.md §15 tiene pendiente activar
//   formulario                  "Confirm email". Hoy el registro deja la cuenta
//                               usable al instante; el día que se active deja
//                               de hacerlo y toda la suite se cae de golpe. Y
//                               Resend solo envía a una dirección verificada,
//                               así que el correo no se puede leer.
//
// `email_confirm: true` crea la cuenta ya confirmada y sin mandar correo, así
// que esto funciona igual con Confirm email activado o apagado.
async function crearCuenta() {
  const marca = randomUUID().slice(0, 8)
  const email = `e2e-${marca}@ejemplo-de-prueba.invalid`
  // La contraseña cumple las tres capas de app/lib/contrasena.js: mínimo 8, una
  // minúscula, una mayúscula, un dígito y un símbolo.
  const password = `Prueba${marca}1!`

  const usuario = await supabase('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true }),
  })

  return { id: usuario.id, email, password }
}

async function borrarCuenta(id) {
  // Las reservas y los créditos cuelgan de auth.users con `on delete cascade`,
  // así que borrar la cuenta se lleva lo que creó. Las clases no: esas se
  // borran aparte, porque no son de nadie.
  await supabase(`/auth/v1/admin/users/${id}`, { method: 'DELETE' })
}

// Acredita créditos llamando a la MISMA función que usa el webhook. No se
// insertan filas a mano: si `otorgar_creditos()` cambiara, la prueba tiene que
// cambiar con ella.
async function acreditar(userId, cantidadDeClases = 1) {
  const paquetes = await supabase(
    `/rest/v1/paquetes?select=id,clases&activo=eq.true&clases=eq.${cantidadDeClases}&limit=1`
  )
  if (!paquetes.length) {
    throw new Error(`No hay paquete activo de ${cantidadDeClases} clase(s)`)
  }

  const filas = await supabase('/rest/v1/rpc/otorgar_creditos', {
    method: 'POST',
    body: JSON.stringify({
      p_user_id: userId,
      p_paquete_id: paquetes[0].id,
      p_mp_payment_id: `e2e-${randomUUID()}`,
    }),
  })

  const creados = filas?.[0]?.creditos_creados
  if (!creados) throw new Error(`otorgar_creditos no acreditó nada: ${JSON.stringify(filas)}`)
  return creados
}

// Una clase nueva en la ULTIMA fecha que ya tiene clases, a una hora que el
// estudio no usa. Ver la regla 2: la fecha no puede ser posterior al final de
// la agenda o el sitio deja avanzar por semanas vacías.
async function crearClase() {
  const [tipo] = await supabase('/rest/v1/tipos_clase?select=id&limit=1')
  const [ultima] = await supabase(
    '/rest/v1/clases?select=fecha&estado=eq.programada&order=fecha.desc&limit=1'
  )
  if (!ultima) throw new Error('No hay clases en la agenda: ¿se corrió el seed?')

  // Minuto al azar dentro de una hora que el estudio no usa (04:00), para que
  // dos corridas no choquen contra el `unique (fecha, hora)`.
  const minuto = String(Math.floor(Math.random() * 60)).padStart(2, '0')
  const fila = await supabase('/rest/v1/clases', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      fecha: ultima.fecha,
      hora: `04:${minuto}`,
      tipo_clase_id: tipo.id,
      cupo_total: 6,
    }),
  })
  return fila[0]
}

// Una clase QUE YA EXISTE, con lugar libre y lo bastante lejos como para que
// cancelarla devuelva el crédito.
//
// Se busca una existente en vez de crear una: crear mueve el final de la
// agenda (regla 2) y además la prueba de reservar tiene que correr sobre lo
// que el sitio realmente ofrece, no sobre una fila fabricada a medida.
//
// Más de dos días por delante: la ventana de cancelación son 6 horas, así que
// con dos días de margen el crédito vuelve sin depender de a qué hora se corra
// la prueba.
async function claseConLugar() {
  const dentroDeDosDias = new Date()
  dentroDeDosDias.setDate(dentroDeDosDias.getDate() + 2)
  const desde = dentroDeDosDias.toISOString().slice(0, 10)

  const clases = await supabase(
    `/rest/v1/clases?select=id,fecha,hora,cupo_total&estado=eq.programada` +
      `&fecha=gte.${desde}&order=fecha,hora&limit=40`
  )

  for (const clase of clases) {
    const tomadas = await supabase(
      `/rest/v1/reservas?select=id&clase_id=eq.${clase.id}&estado=eq.confirmada`
    )
    if (tomadas.length < clase.cupo_total) return clase
  }

  throw new Error(`No hay ninguna clase con lugar libre desde ${desde}`)
}

async function borrarClase(id) {
  // `clases` no tiene política de DELETE para nadie —es a propósito, está en
  // CLAUDE.md— así que esto solo funciona con la clave secreta, que saltea RLS.
  await supabase(`/rest/v1/clases?id=eq.${id}`, { method: 'DELETE' })
}

// INGRESAR POR EL FORMULARIO, no inyectando la cookie.
//
// Se podría armar la cookie de sesión desde un token y ahorrarse el viaje. No
// se hace: el formulario de ingreso es uno de los caminos que estas pruebas
// tienen que cubrir, y una sesión inyectada probaría que el resto funciona con
// una cookie que nadie verificó que el sitio sepa emitir.
async function ingresar(page, { email, password }) {
  await page.goto('/ingresar')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  // El destino por omisión del ingreso es la home.
  await expect(page.getByRole('link', { name: 'Mi cuenta' })).toBeVisible()
}

// EL `{}` VACIO DE ABAJO ES OBLIGATORIO, NO UN DESCUIDO.
//
// Playwright analiza los nombres destructurados del primer parámetro para saber
// de qué fixtures depende cada uno. Si no se destructura, se niega a arrancar:
//
//   First argument must use the object destructuring pattern: _sinFixtures
//
// Estos dos fixtures no dependen de ninguno, así que el patrón queda vacío. Y
// eslint marca eso con `no-empty-pattern`, que en general tiene razón: un `{}`
// vacío suele ser un destructurado que quedó a medio escribir.
//
// Acá las dos reglas se contradicen y gana el framework, porque su requisito no
// es negociable. Se desactiva la regla solo en este bloque y con el motivo
// escrito, en vez de bajarla en toda la configuración.
/* eslint-disable no-empty-pattern */
export const test = base.extend({
  // Una cuenta de cliente recién creada, sin créditos ni reservas, borrada al
  // terminar.
  cuenta: async ({}, usar) => {
    const cuenta = await crearCuenta()
    await usar(cuenta)
    await borrarCuenta(cuenta.id)
  },

  // La misma cuenta, pero ya con sesión abierta en el navegador.
  paginaCliente: async ({ page, cuenta }, usar) => {
    await ingresar(page, cuenta)
    await usar(page)
  },

  // La cuenta de administración NO se crea: el rol `admin` lo pone una fila de
  // `perfiles`, y una cuenta nueva nace `cliente`. Sus credenciales salen del
  // entorno para que no entren a git, y si no están la especificación se
  // saltea con un motivo en vez de fallar.
  admin: async ({}, usar) => {
    await usar(
      env.E2E_ADMIN_EMAIL && env.E2E_ADMIN_PASSWORD
        ? { email: env.E2E_ADMIN_EMAIL, password: env.E2E_ADMIN_PASSWORD }
        : null
    )
  },
})

/* eslint-enable no-empty-pattern */

export { expect, acreditar, crearClase, claseConLugar, borrarClase, ingresar, supabase }
