import { test, expect } from './fixtures'

// LO QUE VE QUIEN NO INICIO SESION.
//
// Esta especificación corre en los tres motores porque no escribe nada: no hay
// riesgo de que tres navegadores en paralelo se pisen en la base.
//
// Los locators son semánticos —`getByRole`, `getByLabel`— y no clases CSS. No
// es solo estilo: una clase como `.header-enlace` cambia cuando se rediseña el
// header y la prueba se rompe sin que nada se haya roto de verdad. El rol y el
// nombre accesible cambian cuando cambia lo que la página SIGNIFICA, que es
// cuando una prueba tiene que enterarse.
//
// Y hay un resultado en el hecho de que esto se pueda escribir: no hizo falta
// agregar un solo `data-testid`. Si hubiera hecho falta, sería la señal de que
// el HTML no es tan semántico como el proyecto afirma.

test.describe('navegación pública', () => {
  // Caso 1. La prueba de humo: si esto falla, no tiene sentido mirar el resto.
  const secciones = [
    { enlace: 'Clases', ruta: '/clases', titulo: 'Nuestras clases' },
    { enlace: 'Paquetes', ruta: '/paquetes', titulo: 'Paquetes' },
    { enlace: 'Horarios', ruta: '/horarios', titulo: 'Horarios' },
    { enlace: 'Contacto', ruta: '/contacto', titulo: 'Contacto' },
  ]

  for (const { enlace, ruta, titulo } of secciones) {
    test(`el menú lleva a ${ruta} y la página se identifica`, async ({ page }) => {
      await page.goto('/')

      // Dentro del nav principal: el pie repite el mismo menú, así que sin
      // acotar habría dos enlaces con el mismo nombre y el locator sería
      // ambiguo. Que el pie lo repita es una decisión del proyecto, no un
      // error, y la prueba se adapta a eso en vez de pedir que cambie.
      const menu = page.getByRole('navigation', { name: 'Navegación principal' })
      await menu.getByRole('link', { name: enlace }).click()

      await expect(page).toHaveURL(new RegExp(`${ruta}$`))
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(titulo)
    })
  }
})

test.describe('reservar sin sesión', () => {
  // Caso 2. El circuito de `volver`: lo que convierte el login en una
  // redirección abierta si se rompe. `rutaInterna()` lo valida del lado del
  // servidor; esto comprueba que el enlace lo arme bien y que el destino
  // sobreviva al ingreso.
  test('la agenda ofrece ingresar, y guarda a dónde volver', async ({ page }) => {
    await page.goto('/reservar')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reservar')

    // El nombre accesible trae el nombre de la clase y el horario, así que se
    // busca por el prefijo: el seed cambia y el texto exacto con él.
    const ingresar = page
      .getByRole('link', { name: /^Ingresar para reservar / })
      .first()
    await expect(ingresar).toBeVisible()

    await ingresar.click()
    await expect(page).toHaveURL(/\/ingresar\?volver=/)

    // El destino tiene que ser una ruta interna del sitio, no una absoluta.
    const volver = new URL(page.url()).searchParams.get('volver')
    expect(volver).toMatch(/^\/reservar/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ingresar')
  })
})

test.describe('rutas protegidas', () => {
  // Caso 3. 401 y 403 no son lo mismo, que es la distinción que organiza toda
  // la autorización del proyecto. Sin sesión no sabemos quién es: se lo manda
  // a ingresar guardando el destino. Con sesión y sin permiso se muestra "sin
  // permiso" y NO se redirige, porque volver a entrar con la misma cuenta da
  // el mismo resultado.
  //
  // Acá se prueba la mitad del 401; la del 403 necesita sesión y está en
  // admin.spec.js.
  for (const ruta of ['/cuenta', '/cuenta/contrasena']) {
    test(`${ruta} manda a ingresar y guarda el destino`, async ({ page }) => {
      await page.goto(ruta)
      await expect(page).toHaveURL(/\/ingresar\?volver=/)
      expect(new URL(page.url()).searchParams.get('volver')).toBe(ruta)
    })
  }

  test('el panel no se muestra sin sesión', async ({ page }) => {
    const respuesta = await page.goto('/admin')
    // Un navegador pidiendo una página recibe la redirección; lo que no puede
    // pasar es que el panel se renderice.
    await expect(page.getByRole('heading', { name: 'Panel' })).toBeHidden()
    expect(respuesta?.status()).toBeLessThan(400)
    await expect(page).toHaveURL(/\/ingresar/)
  })
})

test.describe('página no encontrada', () => {
  // Caso 4. El 404 propio, que reemplazó al de Next —en inglés y con fondo
  // negro— y que nada cubría.
  test('una ruta inventada da el 404 del sitio, en castellano', async ({ page }) => {
    const respuesta = await page.goto('/esta-ruta-no-existe-nunca')

    expect(respuesta?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'No encontramos esa página'
    )

    // Hereda el layout del sitio: si esto falla, es que dejó de renderizarse
    // dentro del layout raíz y volvió a ser una página suelta.
    await expect(
      page.getByRole('navigation', { name: 'Navegación principal' })
    ).toBeVisible()

    // Y ofrece salidas que existen.
    await page.getByRole('link', { name: 'Volver al inicio' }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})
