import { test, expect, acreditar, claseConLugar, supabase } from './fixtures'

// SIN JAVASCRIPT. ES LA AFIRMACION CENTRAL DEL PROYECTO Y HASTA HOY SE
// VERIFICABA A MANO, desactivándolo en el navegador.
//
// Todo el sitio son Server Components y Server Actions, con **una sola**
// excepción de `'use client'`: el medidor de fortaleza de contraseña. La
// promesa es que con JavaScript apagado el sitio funciona igual, y que lo único
// que se pierde es la barra moviéndose.
//
// Esta especificación corre en los TRES motores, y acá el multinavegador sí
// paga: lo que se prueba es el comportamiento **nativo** del navegador al
// enviar un formulario, que es precisamente lo que puede diferir entre
// Chromium, Firefox y WebKit. En el resto de las pruebas la lógica corre en el
// servidor y los tres hacen lo mismo.
//
// `javaScriptEnabled` se fija por contexto y no se puede cambiar después, así
// que está en los proyectos de playwright.config.js y no acá dentro.

test.describe('el sitio se recorre sin JavaScript', () => {
  // PRIMERO: CONFIRMAR QUE DE VERDAD ESTA APAGADO.
  //
  // Sin esto, toda la especificación podría estar corriendo CON JavaScript y
  // pasar igual, que es el falso verde más fácil de no ver: una suite llamada
  // "sin JavaScript" que en realidad lo tiene prendido.
  //
  // Y EL DETECTOR OBVIO NO SIRVE, medido: `page.evaluate(() => 1)` **funciona**
  // con `javaScriptEnabled: false`, porque Playwright lo ejecuta por el
  // protocolo de depuración y no por la página. Si se usara eso como detector
  // —al revés— la conclusión habría sido "JavaScript está prendido" y se
  // habría perseguido un problema que no existe.
  //
  // El detector que sí sirve es de COMPORTAMIENTO, y usa la única pieza de
  // cliente que hay: el medidor de contraseña. Con JavaScript, escribir en el
  // campo mueve el `<meter>` por el `onChange`; sin JavaScript queda en el
  // valor que vino del servidor. Que el proyecto tenga un solo componente de
  // cliente lo convierte en un detector exacto.
  test('JavaScript está realmente apagado', async ({ page }) => {
    await page.goto('/registro')

    const medidor = page.getByRole('meter', { name: 'Fortaleza de la contraseña' })
    const antes = await medidor.getAttribute('value')

    // Una contraseña que cumple las cuatro reglas: con JavaScript el medidor
    // tendría que llegar al máximo.
    await page.getByLabel('Contraseña', { exact: true }).fill('Abcdefg1!mas')

    const despues = await medidor.getAttribute('value')
    expect(
      despues,
      `el medidor pasó de ${antes} a ${despues}: el onChange corrió, o sea que ` +
        'este contexto tiene JavaScript prendido y la especificación no prueba ' +
        'lo que dice probar'
    ).toBe(antes)
  })

  test('la navegación y el contenido andan', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

    const menu = page.getByRole('navigation', { name: 'Navegación principal' })
    await menu.getByRole('link', { name: 'Paquetes' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Paquetes')

    // Los precios salen de la base y se renderizan en el servidor: tienen que
    // estar en el HTML, no pintados después.
    await expect(page.getByRole('button', { name: /^Comprar el paquete de / }).first()).toBeVisible()
  })
})

test.describe('ingresar sin JavaScript', () => {
  // Caso 12. El formulario de ingreso es un POST común a una Server Action.
  // Sin JavaScript, el navegador lo envía solo y Next lo atiende igual.
  test('el formulario de ingreso funciona y abre sesión', async ({
    page,
    cuenta,
    browserName,
  }) => {
    // WEBKIT NO PUEDE ABRIR SESION CONTRA EL SITIO LOCAL, y no es un bug del
    // sitio: la cookie de sesión lleva `Secure` —que es lo correcto— y
    // `next start` sirve por http. Chromium y Firefox hacen la excepción de
    // localhost y guardan la cookie igual; WebKit la descarta sin avisar.
    //
    // Medido con los tres motores enviando este mismo formulario:
    //   chromium  2 cookies sb- guardadas, sesión abierta
    //   firefox   2 cookies sb- guardadas, sesión abierta
    //   webkit    0 cookies,               sesión NO abierta
    //
    // Se saltea en vez de bajar `secure`, que seria debilitar la defensa real
    // por comodidad local. El detalle está en app/lib/cookies.js. En producción
    // todo es https, así que ahí no aplica.
    test.skip(
      browserName === 'webkit',
      'WebKit descarta la cookie Secure sobre http://localhost, así que no hay ' +
        'sesión posible contra el sitio local. Ver app/lib/cookies.js.'
    )

    await page.goto('/ingresar')
    await page.getByLabel('Correo electrónico').fill(cuenta.email)
    await page.getByLabel('Contraseña').fill(cuenta.password)
    await page.getByRole('button', { name: 'Ingresar' }).click()

    // La sesión quedó abierta: el header cambia.
    await expect(page.getByRole('link', { name: 'Mi cuenta' })).toBeVisible()

    await page.goto('/cuenta')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mi cuenta')
  })

  test('con la contraseña mal, el mensaje aparece igual', async ({ page, cuenta }) => {
    await page.goto('/ingresar')
    await page.getByLabel('Correo electrónico').fill(cuenta.email)
    await page.getByLabel('Contraseña').fill('EstaNoEsLaClave1!')
    await page.getByRole('button', { name: 'Ingresar' }).click()

    // El mensaje de error viaja en el HTML de la redirección, no lo pinta nadie
    // en el navegador.
    await expect(page.getByRole('alert')).toBeVisible()
  })
})

test.describe('reservar sin JavaScript', () => {
  // Caso 13. La Server Action por POST de formulario, que es el camino de
  // mejora progresiva. Es la prueba que más vale de esta especificación: una
  // reserva es una escritura con un candado en la base, y funciona sin una
  // línea de JavaScript en el navegador.
  test('se puede reservar y cancelar', async ({ page, cuenta, browserName }) => {
    // WEBKIT NO PUEDE ABRIR SESION CONTRA EL SITIO LOCAL, y no es un bug del
    // sitio: la cookie de sesión lleva `Secure` —que es lo correcto— y
    // `next start` sirve por http. Chromium y Firefox hacen la excepción de
    // localhost y guardan la cookie igual; WebKit la descarta sin avisar.
    //
    // Medido con los tres motores enviando este mismo formulario:
    //   chromium  2 cookies sb- guardadas, sesión abierta
    //   firefox   2 cookies sb- guardadas, sesión abierta
    //   webkit    0 cookies,               sesión NO abierta
    //
    // Se saltea en vez de bajar `secure`, que seria debilitar la defensa real
    // por comodidad local. El detalle está en app/lib/cookies.js. En producción
    // todo es https, así que ahí no aplica.
    test.skip(
      browserName === 'webkit',
      'WebKit descarta la cookie Secure sobre http://localhost, así que no hay ' +
        'sesión posible contra el sitio local. Ver app/lib/cookies.js.'
    )

    test.slow()

    await acreditar(cuenta.id, 1)
    const clase = await claseConLugar()

    await page.goto('/ingresar')
    await page.getByLabel('Correo electrónico').fill(cuenta.email)
    await page.getByLabel('Contraseña').fill(cuenta.password)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('link', { name: 'Mi cuenta' })).toBeVisible()

    await page.goto(`/reservar?dia=${clase.fecha}`)
    await page.getByRole('button', { name: /^Reservar / }).first().click()

    await page.goto('/cuenta')
    await expect(page.getByRole('heading', { name: 'Próximas clases' })).toBeVisible()

    await page.getByRole('button', { name: 'Cancelar' }).first().click()
    await expect(page.getByText(/crédito devuelto/)).toBeVisible()
  })
})

test.describe('el medidor de contraseña: la única excepción', () => {
  // Caso 14. ESTE ES EL CASO QUE JUSTIFICA LA EXCEPCION DE 'use client'.
  //
  // CLAUDE.md dice que el medidor es un agregado y no una dependencia: con
  // JavaScript apagado el componente se renderiza en el servidor y queda un
  // campo normal con su `pattern`, su `minLength` y la lista de requisitos a la
  // vista, y lo único que se pierde es la barra moviéndose.
  //
  // Hasta hoy eso era una afirmación verificada a mano una vez. Acá se mide.
  test('queda un campo normal con sus reglas a la vista', async ({ page }) => {
    await page.goto('/registro')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crear cuenta')

    const contrasena = page.getByLabel('Contraseña', { exact: true })
    await expect(contrasena).toBeVisible()

    // LO QUE SOBREVIVE SIN JAVASCRIPT: los dos atributos que validan del lado
    // del navegador. Si faltaran, el campo aceptaría cualquier cosa y la única
    // defensa quedaría en el servidor.
    await expect(contrasena).toHaveAttribute('minLength', '8')
    const pattern = await contrasena.getAttribute('pattern')
    expect(pattern, 'el campo tiene que traer su pattern desde el servidor').toBeTruthy()

    // La lista de requisitos se renderiza en el servidor, así que está a la
    // vista aunque nadie pueda ver la barra moverse.
    await expect(page.getByText(/8 caracteres/)).toBeVisible()

    // Y el medidor también está en el HTML, solo que quieto. Se comprueba que
    // exista con su nombre accesible: lo que se pierde es el movimiento, no el
    // elemento.
    await expect(page.getByRole('meter', { name: 'Fortaleza de la contraseña' })).toBeVisible()
  })

  test('el registro se completa y crea la cuenta', async ({ page }) => {
    test.slow()

    // Un correo propio de esta prueba: la cuenta la crea el FORMULARIO, no el
    // fixture, porque lo que se prueba es justamente que el registro funcione
    // sin JavaScript.
    const marca = Math.random().toString(36).slice(2, 10)
    const email = `e2e-sinjs-${marca}@ejemplo-de-prueba.invalid`
    const password = `Prueba${marca}1!`

    await page.goto('/registro')
    await page.getByLabel('Nombre').fill('Prueba Sin JavaScript')
    await page.getByLabel('Correo electrónico').fill(email)
    await page.getByLabel('Contraseña', { exact: true }).fill(password)
    await page.getByRole('button', { name: /Crear/ }).click()

    // Con "Confirm email" apagado el registro deja la sesión abierta; con él
    // activado manda a /ingresar?estado=confirma. Las dos son correctas, y lo
    // que esta prueba afirma es lo invariante: **la cuenta se creó**. Afirmar
    // una de las dos pantallas haría que la prueba se rompiera el día que se
    // active la opción, que es un pendiente de docs/seguridad.md §15.
    const usuarios = await supabase(
      `/auth/v1/admin/users?filter=${encodeURIComponent(email)}`
    )
    const creada = (usuarios.users ?? []).find((u) => u.email === email)
    expect(creada, `el registro sin JavaScript no creó la cuenta ${email}`).toBeTruthy()

    // Y se limpia, que es la regla 3.
    await supabase(`/auth/v1/admin/users/${creada.id}`, { method: 'DELETE' })
  })
})
