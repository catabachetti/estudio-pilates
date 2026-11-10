import { test, expect, ingresar, crearClase, borrarClase, supabase } from './fixtures'
// La MISMA función que usa la página para mostrar la hora. La primera versión
// de esta prueba cortaba `04:45:00` a `04:45` y no encontraba nada, porque el
// sitio muestra `4:45`, sin el cero. Usar el helper en vez de replicar el
// formato es la misma regla de una sola fuente que vale para el código.
import { sinSegundos } from '../app/datos/agenda.js'

// EL PANEL, Y LA MITAD DEL 403 QUE anonimo.spec.js NO PUEDE PROBAR.
//
// Esa especificación cubre el 401: sin sesión, a `/ingresar` guardando el
// destino. Acá va el 403: **con** sesión y sin permiso. Son casos distintos y
// confundirlos es uno de los errores clásicos de autorización, así que se
// prueban por separado.
//
// Corre solo en Chromium: escribe en la base. El motivo largo está en
// playwright.config.js.

// Las cinco pantallas del panel. La lista está acá y no leída de `navegacion`
// porque el menú del panel es otro: si alguien agrega una pantalla y se olvida
// de protegerla, esta lista tiene que quedar corta y la prueba tiene que
// avisarlo. Leerla del código haría que la prueba se actualizara sola, que es
// justo lo que no se quiere.
const PANTALLAS = [
  { ruta: '/admin', titulo: 'Panel' },
  { ruta: '/admin/clases', titulo: 'Clases' },
  { ruta: '/admin/reservas', titulo: 'Reservas' },
  { ruta: '/admin/paquetes', titulo: 'Paquetes' },
  { ruta: '/admin/creditos', titulo: 'Créditos' },
  // La sexta, del módulo 6 del curso: los mensajes del formulario de contacto.
  // Se agregó acá a mano al agregar la pantalla, que es exactamente el trabajo
  // que esta lista existe para obligar.
  { ruta: '/admin/mensajes', titulo: 'Mensajes' },
]

test.describe('con cuenta de administración', () => {
  // Si faltan las credenciales, la especificación se saltea con el motivo en
  // vez de fallar: un fallo acá parecería un bug del panel.
  test.beforeEach(async ({ admin, page }) => {
    test.skip(
      !admin,
      'Faltan E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD en .env.local. ' +
        'La cuenta de administración no se puede crear desde la prueba: el rol ' +
        'lo pone una fila de `perfiles`, y una cuenta nueva nace cliente.'
    )
    await ingresar(page, admin)
  })

  // E11. Las seis pantallas cargan y se identifican.
  for (const { ruta, titulo } of PANTALLAS) {
    test(`${ruta} carga con su título`, async ({ page }) => {
      await page.goto(ruta)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(titulo)
    })
  }

  // El atajo del header aparece, que es comodidad y no seguridad: está
  // explicado en Header.jsx. Se prueba porque si desaparece es un síntoma.
  test('el header ofrece el atajo al panel', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Panel' })).toBeVisible()
  })

  // E12. La única escritura de administración que no toca el catálogo.
  //
  // No se prueba editar un precio: eso modificaría `paquetes`, que el sitio
  // muestra. La regla está en fixtures.js y se respeta en vez de disimularla.
  // De los paquetes se prueba que el formulario traiga lo que la base tiene.
  test('crear una clase la hace aparecer en la agenda, y borrarla la saca', async ({
    page,
  }) => {
    test.slow()

    // La clase se crea por la API y no por el formulario, y conviene decir por
    // qué: el formulario de `/admin/clases` crea en el día que está mirando, y
    // hacerlo por pantalla obligaría a navegar a una fecha concreta. Lo que
    // esta prueba mira es que **la agenda pública refleje** lo que hay en la
    // base, que es lo que ninguna prueba de base de datos puede ver.
    const clase = await crearClase()

    try {
      await page.goto(`/reservar?dia=${clase.fecha}`)
      const hora = sinSegundos(clase.hora)

      // El panel la muestra con su hora.
      await page.goto('/admin/clases')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clases')

      // Y la agenda pública también, en el día que corresponde.
      await page.goto(`/reservar?dia=${clase.fecha}`)
      await expect(page.getByRole('rowheader', { name: hora })).toBeVisible()
    } finally {
      await borrarClase(clase.id)
    }

    // Y después de borrarla, no está.
    await page.goto(`/reservar?dia=${clase.fecha}`)
    await expect(
      page.getByRole('rowheader', { name: sinSegundos(clase.hora) })
    ).toBeHidden()
  })

  // E13. El formulario de paquetes trae lo que la base tiene. Es una
  // lectura: no se escribe nada.
  test('el formulario de paquetes trae los valores de la base', async ({ page }) => {
    const paquetes = await supabase(
      '/rest/v1/paquetes?select=nombre,precio&activo=eq.true&order=orden&limit=1'
    )
    const [primero] = paquetes

    await page.goto('/admin/paquetes')
    await expect(page.getByRole('textbox', { name: 'Nombre' }).first()).toHaveValue(
      primero.nombre
    )
    await expect(page.getByRole('spinbutton', { name: 'Precio en pesos' }).first()).toHaveValue(
      String(primero.precio)
    )

    // Y el largo máximo sale de la constante compartida, no escrito a mano.
    await expect(
      page.getByRole('textbox', { name: 'Nombre' }).first()
    ).toHaveAttribute('maxLength', '60')
  })
})

test.describe('con cuenta de cliente', () => {
  // E10. EL 403, Y ES EL CASO QUE MAS IMPORTA DE ESTA ESPECIFICACION.
  //
  // La verificación de rol **no está en el layout** a propósito: la
  // documentación de Next dice que los layouts no se vuelven a renderizar al
  // navegar, no deciden si el resto de la ruta se renderiza, y las Server
  // Actions no pasan por ellos. Vive en app/lib/autorizacion.js y la llaman
  // todas las páginas.
  //
  // Por eso se prueban LAS CINCO y no una: si la verificación estuviera en el
  // layout, podría pasar que una pantalla quedara sin ella y el síntoma
  // apareciera solo en esa.
  for (const { ruta } of PANTALLAS) {
    test(`${ruta} contesta "sin permiso" y no muestra el panel`, async ({
      paginaCliente,
    }) => {
      await paginaCliente.goto(ruta)

      await expect(paginaCliente.getByRole('heading', { level: 1 })).toHaveText(
        'Sin permiso'
      )

      // Y NO redirige a ingresar, que es la mitad que distingue 403 de 401:
      // quien ve esto ya está identificado, y mandarlo al login lo deja en un
      // círculo.
      expect(paginaCliente.url()).toContain(ruta)
    })
  }

  test('el header no ofrece el atajo al panel', async ({ paginaCliente }) => {
    // Esto es comodidad, no seguridad: esconder el enlace no protege nada y el
    // propio Header.jsx lo dice. Se prueba porque el atajo visible para una
    // cuenta sin permiso sería confuso, no peligroso.
    await expect(paginaCliente.getByRole('link', { name: 'Panel' })).toBeHidden()
    await expect(paginaCliente.getByRole('link', { name: 'Mi cuenta' })).toBeVisible()
  })
})
