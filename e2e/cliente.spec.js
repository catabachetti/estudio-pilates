import { test, expect, acreditar, claseConLugar } from './fixtures'

// EL RECORRIDO DE QUIEN COMPRA Y RESERVA.
//
// Corre solo en Chromium: escribe en la base, y hay un solo proyecto de
// Supabase. El motivo largo está en playwright.config.js.
//
// Cada prueba arranca con una cuenta recién creada, sin créditos ni reservas,
// que se borra al terminar. Así ninguna depende del orden ni de lo que dejó la
// anterior.

test.describe('ingresar', () => {
  // E5. Un requisito de seguridad, no de usabilidad: el mensaje tiene que
  // ser el mismo exista la cuenta o no. Si dijera "esa cuenta no existe",
  // cualquiera podría averiguar quién está registrado probando correos.
  test('con la contraseña mal, el mensaje no dice si el correo existe', async ({
    page,
    cuenta,
  }) => {
    await page.goto('/ingresar')
    await page.getByLabel('Correo electrónico').fill(cuenta.email)
    await page.getByLabel('Contraseña').fill('EstaNoEsLaClave1!')
    await page.getByRole('button', { name: 'Ingresar' }).click()

    const aviso = page.getByRole('alert')
    await expect(aviso).toBeVisible()
    const texto = await aviso.textContent()

    // Lo mismo con un correo que no existe: los dos mensajes tienen que ser
    // idénticos. Comparar los dos es la única forma de probar que no filtra,
    // porque un mensaje solo no dice nada.
    await page.goto('/ingresar')
    await page.getByLabel('Correo electrónico').fill('nadie-aca@ejemplo-de-prueba.invalid')
    await page.getByLabel('Contraseña').fill('EstaNoEsLaClave1!')
    await page.getByRole('button', { name: 'Ingresar' }).click()

    await expect(page.getByRole('alert')).toHaveText(texto.trim())
  })

  // E6. El camino que habilita todo lo demás.
  test('con la contraseña bien, llega a su cuenta', async ({ paginaCliente }) => {
    await paginaCliente.getByRole('link', { name: 'Mi cuenta' }).click()
    await expect(paginaCliente.getByRole('heading', { level: 1 })).toHaveText('Mi cuenta')

    // Recién creada: sin créditos. Es el estado real de cualquiera que se
    // registra y todavía no compró.
    await expect(
      paginaCliente.getByRole('heading', { name: 'Todavía no tenés créditos' })
    ).toBeVisible()
  })
})

test.describe('comprar', () => {
  // E7. El bloque "Te faltan créditos" aparece DESPUES de intentar
  // reservar, no al entrar a la agenda.
  //
  // La primera versión de esta prueba lo buscaba nada más entrar a /reservar y
  // fallaba. El error era de la prueba: `SinCreditos` se renderiza con
  // `?r=sin_creditos`, o sea cuando la Server Action vuelve con ese resultado.
  // Y está bien que sea así: la agenda no consulta los créditos de nadie al
  // cargar, solo la base lo sabe en el momento de reservar.
  //
  // Por eso esta prueba vale más de lo que parecía: recorre el intento
  // completo —acción, función de la base, redirección con el motivo— y no solo
  // un bloque de texto.
  test('al intentar reservar sin créditos, explica qué falta y lleva a los paquetes', async ({
    paginaCliente,
  }) => {
    const clase = await claseConLugar()
    await paginaCliente.goto(`/reservar?dia=${clase.fecha}`)

    await paginaCliente.getByRole('button', { name: /^Reservar / }).first().click()

    await expect(paginaCliente).toHaveURL(/r=sin_creditos/)
    await expect(
      paginaCliente.getByRole('heading', { name: 'Te faltan créditos' })
    ).toBeVisible()

    await paginaCliente.getByRole('link', { name: 'Ver paquetes' }).click()
    await expect(paginaCliente.getByRole('heading', { level: 1 })).toHaveText('Paquetes')
  })

  // E8. LO UNICO VERIFICABLE DEL CHECKOUT.
  //
  // El sitio de Mercado Pago no se automatiza: es de terceros, tiene su propio
  // login, su antifraude y cambia sin avisarnos. Una prueba que intentara pagar
  // ahí sería inestable por motivos que no tienen nada que ver con este
  // proyecto.
  //
  // Lo que sí es nuestro, y es lo que se prueba: que el formulario cree la
  // preferencia y mande a la persona al checkout. Que el pago salga bien ya
  // está verificado por otro camino —se pagó una vez con tarjeta de prueba y
  // el crédito se acreditó— y el aviso de pago tiene sus propias 13 pruebas en
  // docs/ejemplos/probar-webhook.mjs.
  test('el botón de comprar lleva al checkout de Mercado Pago', async ({
    paginaCliente,
  }) => {
    await paginaCliente.goto('/paquetes')

    const comprar = paginaCliente.getByRole('button', { name: /^Comprar el paquete de / })
    await expect(comprar.first()).toBeVisible()

    await comprar.first().click()

    // Se espera la navegación afuera del sitio. Si la preferencia fallara, el
    // sitio redirige a /paquetes?r=mp y esta espera se cae con el motivo a la
    // vista.
    await paginaCliente.waitForURL(/mercadopago\.com/, { timeout: 30_000 })
    expect(paginaCliente.url()).toMatch(/mercadopago\.com/)

    // Y lleva el identificador de la preferencia, que es lo que prueba que la
    // creamos nosotros y no es un enlace suelto.
    //
    // DOS NOMBRES PARA LO MISMO, y lo descubrió esta prueba: verificando con
    // `curl` el redirect era `/checkout/v1/redirect?pref_id=...`, pero el
    // navegador sigue un salto más y termina en
    // `/checkout/v1/payment/redirect/?preference-id=...`. La prueba acepta los
    // dos: cuál use Mercado Pago no es asunto nuestro, que el identificador
    // viaje sí.
    expect(paginaCliente.url()).toMatch(/pref_id=|preference-id=/)
  })
})

test.describe('reservar y cancelar', () => {
  // E9. El ciclo completo del negocio, y lo único que prueba que la
  // pantalla refleje lo que la base decidió.
  //
  // Los créditos se acreditan llamando a `otorgar_creditos()`, la MISMA función
  // que usa el webhook, y no insertando filas a mano: si esa función cambiara,
  // esta prueba tiene que cambiar con ella.
  test('reservar aparece en la cuenta, y cancelar a tiempo devuelve el crédito', async ({
    paginaCliente,
    cuenta,
  }) => {
    // ESTA PRUEBA ES LEGITIMAMENTE MAS LENTA que las demás: acredita por RPC,
    // busca una clase con lugar —que son dos consultas más— y después hace
    // cuatro navegaciones con una escritura en cada una. `test.slow()` triplica
    // el tiempo límite.
    //
    // No es un reintento disfrazado. La configuración tiene `retries: 0` a
    // propósito, porque un reintento convierte una prueba inestable en una que
    // "pasa a veces". Esto declara cuánto tarde puede tardar, que es distinto.
    //
    // El motivo concreto: en una corrida de catorce esta prueba agotó los 30
    // segundos, sin error de aserción. No se volvió a reproducir en tres
    // corridas posteriores, así que queda dicho que pasó y no explicado.
    test.slow()

    await acreditar(cuenta.id, 1)

    // Una clase QUE YA EXISTE, con lugar libre y a más de dos días. Crear una
    // movería el final de la agenda: ver la regla 2 en fixtures.js.
    const clase = await claseConLugar()

    {
      await paginaCliente.goto('/cuenta')
      await expect(paginaCliente.getByRole('heading', { name: 'Tus créditos' })).toBeVisible()
      await expect(paginaCliente.getByText('No tenés reservas por delante.')).toBeVisible()

      await paginaCliente.goto(`/reservar?dia=${clase.fecha}`)
      const reservar = paginaCliente.getByRole('button', { name: /^Reservar / })
      await expect(reservar.first()).toBeVisible()
      await reservar.first().click()

      // SE ESPERA EL REDIRECT ANTES DE NAVEGAR, y no es una precaución
      // genérica: el click envía un formulario, o sea una navegación, y un
      // `goto` inmediato puede CANCELAR ese POST en vuelo. Aislada la prueba
      // pasaba; en la suite completa, con la base más cargada, el POST tardaba
      // más y la reserva no llegaba a existir. Esperar el `?r=ok` además afirma
      // que la acción salió bien, que es información que antes no se pedía.
      await expect(paginaCliente).toHaveURL(/r=ok/)

      // La reserva aparece en la cuenta. Esto es lo que ninguna prueba de base
      // de datos puede ver: que la pantalla muestre lo que la base guardó.
      await paginaCliente.goto('/cuenta')
      await expect(
        paginaCliente.getByRole('heading', { name: 'Próximas clases' })
      ).toBeVisible()
      await expect(paginaCliente.getByText('No tenés reservas por delante.')).toBeHidden()

      // Cancelar. La clase es de 2027, así que falta mucho más que la ventana:
      // el crédito tiene que volver. Quién decide eso es `cancelar_reserva()`
      // en la base; acá se comprueba que la pantalla lo diga.
      // El nombre accesible es exactamente "Cancelar", sin el horario: la
      // primera versión buscaba /^Cancelar / —con espacio— y no encontraba
      // nada. Lo dice el botón de app/cuenta/page.jsx.
      await paginaCliente.getByRole('button', { name: 'Cancelar' }).first().click()

      await expect(
        paginaCliente.getByText(/crédito devuelto/)
      ).toBeVisible()
      await expect(paginaCliente.getByText('No tenés reservas por delante.')).toBeVisible()
    }
    // No hay nada que limpiar: la clase ya existía y la reserva cancelada se va
    // con la cuenta, que se borra en el fixture con `on delete cascade`.
  })
})
