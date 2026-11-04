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
    const ofertas = page.getByRole('link', { name: /^Ingresar para reservar / })

    // EL DIA POR DEFECTO ES HOY, Y DE NOCHE HOY NO TIENE TURNOS. La página
    // oculta los turnos que ya pasaron, así que después de la última clase del
    // día la tabla de hoy queda vacía —sin turnos, sin "lista de espera" y sin
    // el aviso de agenda agotada, porque la agenda no está agotada—.
    //
    // Medido: un martes a las 23:34, con las siete clases del día (07 a 20) ya
    // pasadas, esta prueba fallaba en los tres motores. El mismo día a otra
    // hora pasaba. Era un "pasa a veces", que es justo lo que `retries: 0`
    // existe para no esconder, y lo escondía la hora a la que uno la corriera.
    //
    // Así que se recorre la tira de días, que la página arma SOLO con los días
    // que tienen clases. Los días salen de los <li> de la tira: es lo que los
    // distingue de los enlaces de semana anterior y siguiente, que viven en un
    // <div> al lado. Se leen los href primero y se navega con goto en vez de
    // hacer clic, para no depender de cuándo termina cada navegación.
    const dias = page
      .getByRole('navigation', { name: 'Días de la semana' })
      .getByRole('listitem')
      .getByRole('link')

    const cuantos = await dias.count()
    const rutas = []
    for (let i = 0; i < cuantos; i++) rutas.push(await dias.nth(i).getAttribute('href'))

    for (const ruta of rutas) {
      if (await ofertas.count()) break
      await page.goto(ruta)
    }

    const ingresar = ofertas.first()
    await expect(
      ingresar,
      `ninguno de los ${cuantos} días de la semana ofrece reservar. Es una ` +
        'precondición de este caso: o la agenda se agotó, o todas las clases ' +
        'están completas. No es un bug del circuito de `volver`.'
    ).toBeVisible()

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

test.describe('los botones de Comprar quedan al pie de su tarjeta', () => {
  // Caso 15. LA UNICA PRUEBA GEOMETRICA DE LA SUITE, y conviene decir por qué
  // existe y por qué está escrita así.
  //
  // El bug: el botón COMPRAR de "8 clases" quedaba más abajo que los otros
  // tres, porque esa tarjeta tiene una línea más de descripción. La causa
  // estaba a dos módulos de distancia: `margin-top: auto` tiene que ir en el
  // hijo directo del flex, y en `/paquetes` el botón va envuelto en un
  // `<form>` —uno por paquete, porque la compra es un POST a una Server Action
  // y es lo que la hace funcionar sin JavaScript—, así que el hijo del flex es
  // el form y el `auto` del botón empujaba dentro de él, donde no hay alto de
  // sobra. En la home el mismo `margin-top: auto` sí funciona, porque ahí la
  // tarjeta termina en un `<a class="boton">`.
  //
  // POR QUE NO UNA COMPARACION DE CAPTURAS: una imagen falla cuando cambia una
  // tipografía, un color o el ancho de un borde, que no es lo que se quiere
  // saber, y no falla si el bug vuelve en un ancho que la captura no cubre. Lo
  // que se afirma acá es una relación geométrica —los botones de una misma fila
  // arrancan a la misma altura— que sobrevive a un rediseño y se rompe
  // exactamente cuando vuelve el bug.
  //
  // LOS LOCATORS SIGUEN SIENDO SEMANTICOS, que es la regla de este archivo: los
  // botones salen de su rol y su nombre accesible, y la fila sale de los `<li>`
  // que contienen uno. Lo único geométrico es la medición. No hizo falta un
  // `data-testid`.
  //
  // LOS TRES ANCHOS NO SON DECORATIVOS. La grilla pasa de 4 a 2 columnas en
  // `max-width: 900px`, así que 900 ya es dos columnas y no cuatro. Y cuál
  // tarjeta descoloca depende del ancho: medido, a 1280 la que difiere es
  // "8 clases" y a 900 pasa a ser "1 clase". Un solo ancho dejaría la mitad del
  // comportamiento sin mirar.
  //
  // Y NO SE PRUEBA LA HOME, a propósito. Ahí las cuatro tarjetas tienen el
  // mismo contenido —nombre, precio y vigencia, sin descripción variable— así
  // que los botones alinean **aunque la regla no esté**: medido, neutralizando
  // el `margin-top: auto` la diferencia sigue siendo 0. Una prueba ahí pasaría
  // por el motivo equivocado, que es el tipo (a) de la clasificación de
  // docs/pruebas.md. Tampoco se prueba `/clases`: son filas de foto + datos con
  // un solo enlace cada una, así que no hay dos que puedan desalinearse, y eso
  // sería una comprobación que no puede fallar.
  const ANCHOS = [1280, 1024, 900]

  for (const ancho of ANCHOS) {
    test(`alineados a ${ancho}px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 1000 })
      await page.goto('/paquetes')

      const comprar = page.getByRole('button', { name: /^Comprar el paquete de / })
      const tarjetas = page.getByRole('listitem').filter({ has: comprar })

      const cuantas = await tarjetas.count()
      expect(cuantas, 'no se encontró ninguna tarjeta de paquete').toBeGreaterThan(1)

      // Se miden la tarjeta y su botón juntos: la FILA sale de la tarjeta
      // —la grilla las estira todas al mismo alto, que es cosa del
      // `align-items: stretch` y no de la regla que se está probando— y la
      // afirmación es sobre el botón.
      const medidas = []
      for (let i = 0; i < cuantas; i++) {
        const tarjeta = tarjetas.nth(i)
        medidas.push({
          tarjeta: await tarjeta.boundingBox(),
          boton: await tarjeta.getByRole('button').boundingBox(),
        })
      }

      // Dos tarjetas están en la misma fila si sus rectángulos se solapan
      // verticalmente. No se asume la cantidad de columnas, así que el mismo
      // caso sirve para la grilla de cuatro y para la de dos.
      const filas = []
      for (const m of medidas.sort((a, b) => a.tarjeta.y - b.tarjeta.y)) {
        const fila = filas.find((f) =>
          f.some(
            (o) =>
              m.tarjeta.y < o.tarjeta.y + o.tarjeta.height &&
              o.tarjeta.y < m.tarjeta.y + m.tarjeta.height
          )
        )
        if (fila) fila.push(m)
        else filas.push([m])
      }

      for (const [i, fila] of filas.entries()) {
        const tops = fila.map((m) => m.boton.y)
        const diferencia = Math.max(...tops) - Math.min(...tops)
        expect(
          diferencia,
          `a ${ancho}px, los ${fila.length} botones de la fila ${i + 1} arrancan en ` +
            `${tops.map((t) => t.toFixed(2)).join(', ')}, o sea que se separan ` +
            `${diferencia.toFixed(2)}px. Volvió el bug del botón que no se ancla al ` +
            'pie de la tarjeta: revisar que `.paquete > form` siga teniendo ' +
            '`margin-top: auto` en app/globals.css.'
        ).toBeLessThan(0.5)
      }
    })
  }
})
