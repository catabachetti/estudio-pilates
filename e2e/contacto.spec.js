import { test, expect, supabase } from './fixtures'

// EL FORMULARIO DE CONTACTO, que es el segundo y último componente de cliente
// del proyecto.
//
// Corre solo en Chromium y tiene su propio archivo por un motivo concreto:
// **escribe en la base.** `anonimo.spec.js` declara en su encabezado que corre
// en los tres motores porque no escribe nada, y meter esto ahí haría falsa esa
// frase y triplicaría las filas creadas sobre la única base que hay.
//
// LOS TRES ESTADOS SE PRUEBAN INTERCEPTANDO LA RUTA, y no esperando que la red
// se porte: `page.route` deja demorar la respuesta para que "Enviando…" sea
// observable, y devolver un 500 para que el estado de error no dependa de que
// algo se rompa de verdad. Sin eso, el estado intermedio pasa tan rápido que la
// prueba lo vería a veces, que es justo lo que `retries: 0` existe para no
// tolerar.

// Un correo propio de cada corrida. Importa por dos cosas: el límite de la
// función es por correo —cinco por hora— así que una dirección fija haría que
// la prueba fallara a la sexta corrida, y la limpieza puede borrar exactamente
// lo que creó.
function correoDePrueba() {
  return `e2e-contacto-${Math.random().toString(36).slice(2, 10)}@ejemplo-de-prueba.invalid`
}

async function borrarMensajesDe(email) {
  await supabase(`/rest/v1/mensajes?email=eq.${encodeURIComponent(email)}`, {
    method: 'DELETE',
  })
}

test.describe('el formulario de contacto', () => {
  // Caso 16. El camino completo con JavaScript: validación en el cliente,
  // `fetch` a la API, y los tres estados.
  test('valida, envía por fetch y muestra los tres estados', async ({ page }) => {
    const email = correoDePrueba()
    const pedidos = []
    page.on('request', (r) => {
      if (r.method() === 'POST') {
        pedidos.push({ url: r.url(), accion: !!r.headers()['next-action'] })
      }
    })

    // Se demora la respuesta medio segundo para que el estado intermedio sea
    // observable sin carreras.
    await page.route('**/api/v1/mensajes', async (ruta) => {
      await new Promise((r) => setTimeout(r, 500))
      await ruta.continue()
    })

    await page.goto('/contacto')

    // Los avisos se buscan DENTRO de la región del formulario. `getByRole`
    // suelto encuentra además el `__next-route-announcer__` de Next, que es un
    // `div role="alert"` vacío: con dos coincidencias, Playwright corta por
    // modo estricto. Scoping en vez de `.first()`, que dependería del orden.
    const formulario = page.getByRole('region', { name: 'Escribinos' })

    const nombre = page.getByLabel('Nombre')
    const correo = page.getByLabel('Correo electrónico')
    const mensaje = page.getByLabel('Mensaje')
    const enviar = page.getByRole('button', { name: /^Enviar mensaje$|^Enviando/ })

    // 1. LA VALIDACION DEL CLIENTE CORTA ANTES DE SALIR A LA RED. Es la mitad
    // de "validación robusta": que el error se vea sin gastar un viaje.
    await nombre.fill('Ana')
    await correo.fill(email)
    await mensaje.fill('corto')
    await enviar.click()

    await expect(page.getByText(/al menos 10 caracteres/)).toBeVisible()
    expect(
      pedidos.filter((p) => p.url.includes('/api/v1/mensajes')),
      'con el mensaje demasiado corto no tiene que haber salido ningún pedido'
    ).toHaveLength(0)

    // 2. AHORA BIEN: los tres estados.
    await mensaje.fill('Hola, quiero saber si hay lugar los martes a la tarde.')
    await enviar.click()

    // enviando
    await expect(page.getByRole('button', { name: /Enviando/ })).toBeVisible()
    // listo
    await expect(formulario.getByRole('status')).toContainText(/recibimos tu mensaje/)
    // y el campo quedó limpio, que es lo que dice que el envío terminó
    await expect(mensaje).toHaveValue('')

    // 3. EL FETCH FUE EL CAMINO, Y LA SERVER ACTION NO CORRIO. Es la
    // comprobación de que `preventDefault()` frena el `action`: si no lo
    // frenara, acá habría dos POST y el mensaje se guardaría dos veces.
    const aLaApi = pedidos.filter((p) => p.url.includes('/api/v1/mensajes'))
    const aLaAccion = pedidos.filter((p) => p.accion)
    expect(aLaApi, 'tiene que haber ido un POST a la API').toHaveLength(1)
    expect(aLaAccion, 'la Server Action NO tiene que haberse invocado').toHaveLength(0)

    // 4. Y LLEGO A LA BASE una sola vez.
    const filas = await supabase(
      `/rest/v1/mensajes?select=nombre,mensaje&email=eq.${encodeURIComponent(email)}`
    )
    expect(filas).toHaveLength(1)
    expect(filas[0].nombre).toBe('Ana')

    await borrarMensajesDe(email)
  })

  // Caso 18. EL ENDURECIMIENTO CONTRA UN FORMULARIO DE OTRO SITIO.
  //
  // `POST /api/v1/mensajes` es el único endpoint de la API sin sesión, y por eso
  // el único donde la protección de CSRF de Next no alcanza: esa protección
  // compara `Origin` con `Host` y **cubre las Server Actions, no los Route
  // Handlers**. Medido: el mismo `Origin` ajeno daba 500 contra la acción y 201
  // contra el handler.
  //
  // Se rechaza `Sec-Fetch-Site: cross-site`, que es la cabecera que pone el
  // navegador y dice de dónde salió el pedido. Un script no la manda, así que
  // los ejemplos de curl de docs/api.md siguen valiendo.
  test('rechaza un pedido que venga de otro sitio, y acepta el resto', async ({
    page,
  }) => {
    const email = correoDePrueba()
    const cuerpo = {
      nombre: 'Prueba cross-site',
      email,
      mensaje: 'un mensaje para comprobar el endurecimiento del endpoint',
    }

    const cruzado = await page.request.post('/api/v1/mensajes', {
      headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' },
      data: cuerpo,
    })
    expect(cruzado.status(), 'un pedido cross-site tiene que dar 403').toBe(403)

    // Y NADA SE ESCRIBIO, que es lo que de verdad importa del rechazo.
    const tras403 = await supabase(
      `/rest/v1/mensajes?select=id&email=eq.${encodeURIComponent(email)}`
    )
    expect(tras403, 'el pedido rechazado no tiene que haber escrito').toHaveLength(0)

    // EL CONTROL: sin esa cabecera el mismo pedido entra. Sin esto, un 403 para
    // todo también pasaría esta prueba.
    const propio = await page.request.post('/api/v1/mensajes', {
      headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' },
      data: cuerpo,
    })
    expect(propio.status(), 'un pedido del propio sitio tiene que entrar').toBe(201)

    await borrarMensajesDe(email)
  })

  // Caso 17. El tercer estado, forzado. Sin esto, "error" sería una rama que
  // nunca se ejecuta: el tipo (c) de docs/pruebas.md.
  test('si la API falla, lo dice y no se pierde lo escrito', async ({ page }) => {
    await page.route('**/api/v1/mensajes', (ruta) =>
      ruta.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { codigo: 'error_interno', mensaje: 'Algo falló de nuestro lado.', id: 'x' },
        }),
      })
    )

    await page.goto('/contacto')
    await page.getByLabel('Nombre').fill('Ana')
    await page.getByLabel('Correo electrónico').fill(correoDePrueba())
    await page.getByLabel('Mensaje').fill('Un mensaje que el servidor va a rechazar.')
    await page.getByRole('button', { name: 'Enviar mensaje' }).click()

    await expect(
      page.getByRole('region', { name: 'Escribinos' }).getByRole('alert')
    ).toContainText(/Algo falló/)

    // LO QUE SE ESCRIBIO NO SE PIERDE, que es la diferencia con una navegación:
    // si el envío falla, el texto sigue en el campo para reintentar.
    await expect(page.getByLabel('Mensaje')).toHaveValue(
      'Un mensaje que el servidor va a rechazar.'
    )
  })
})
