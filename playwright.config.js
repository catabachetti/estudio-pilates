import { defineConfig, devices } from '@playwright/test'

// CONTRA EL SITIO COMPILADO, NO CONTRA `next dev`.
//
// Lo recomienda la guía de la versión instalada
// (node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md:
// "We recommend running your tests against your production code to more
// closely resemble how your application will behave") y además es como se
// verificó todo el resto del proyecto. En desarrollo hay recompilación,
// overlays de error y tiempos distintos: una prueba que pasa ahí no dice nada
// de lo que se entrega.
//
// `webServer` se encarga de levantarlo. `reuseExistingServer` en local evita
// recompilar en cada corrida si ya hay uno escuchando.
const PUERTO = 3100
const BASE = `http://localhost:${PUERTO}`

export default defineConfig({
  testDir: './e2e',

  // Una corrida que depende del orden de los archivos es una corrida que
  // miente. Cada especificación prepara lo que necesita.
  fullyParallel: false,

  // LAS PRUEBAS CON ESTADO CORREN DE A UNA, y esto no es una precaución
  // genérica: hay UN SOLO proyecto de Supabase, así que dos trabajadores en
  // paralelo escribirían en la misma base. Dos corridas creando clases en el
  // mismo horario chocan contra el `unique (fecha, hora)`, y dos reservando la
  // misma clase se pelean el cupo. La carrera por el último lugar ya está
  // probada donde corresponde —en la base, con dos transacciones reales, en
  // supabase/probar-reservas.sh— y no es lo que estas pruebas miden.
  workers: 1,

  // Sin reintentos a propósito. Un reintento convierte una prueba inestable en
  // una prueba que "pasa a veces", y eso es justo lo que no se quiere saber
  // tarde. Si algo falla de forma intermitente, es un hallazgo.
  retries: 0,

  // Prohíbe que un `test.only` olvidado deje la suite verde con tres casos.
  forbidOnly: true,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: BASE,

    // TRACE VIEWER. Graba cada acción con captura antes y después, el DOM y la
    // red, y se abre con `npx playwright show-trace`. Es la herramienta que
    // reemplaza al "agregá un console.log y volvé a correr": el fallo ya quedó
    // grabado y se recorre hacia atrás.
    //
    // `retain-on-failure` y no `on`: grabar siempre hace la corrida más lenta y
    // llena el disco con trazas de pruebas que pasaron.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Español, que es el idioma del sitio: así los mensajes del navegador y el
    // formato de fecha coinciden con lo que ve una persona.
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
  },

  projects: [
    // LOS TRES MOTORES, pero solo donde pueden dar distinto.
    //
    // Lo que varía entre navegadores en este sitio es el layout y el
    // comportamiento nativo de los formularios, no la lógica: la lógica corre
    // en el servidor. Así que las pruebas sin estado —navegación, rutas
    // protegidas, el 404— corren en los tres, y las que escriben en la base
    // corren solo en Chromium, porque multiplicarlas por tres multiplicaría
    // las escrituras sobre la única base que hay.
    {
      name: 'anonimo-chromium',
      testMatch: /anonimo\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'anonimo-firefox',
      testMatch: /anonimo\.spec\.js/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'anonimo-webkit',
      testMatch: /anonimo\.spec\.js/,
      use: { ...devices['Desktop Safari'] },
    },

    // SIN JAVASCRIPT, en los tres motores. Acá el multinavegador sí paga: lo
    // que se prueba es el comportamiento NATIVO del navegador al enviar un
    // formulario, que es precisamente lo que puede diferir entre motores.
    //
    // `javaScriptEnabled` se fija por contexto y no se puede cambiar después,
    // así que va como proyecto y no dentro de un test.
    {
      name: 'sin-js-chromium',
      testMatch: /sin-javascript\.spec\.js/,
      use: { ...devices['Desktop Chrome'], javaScriptEnabled: false },
    },
    {
      name: 'sin-js-firefox',
      testMatch: /sin-javascript\.spec\.js/,
      use: { ...devices['Desktop Firefox'], javaScriptEnabled: false },
    },
    {
      name: 'sin-js-webkit',
      testMatch: /sin-javascript\.spec\.js/,
      use: { ...devices['Desktop Safari'], javaScriptEnabled: false },
    },

    // Con estado: una sola vez, en Chromium.
    {
      name: 'cliente',
      testMatch: /cliente\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin',
      testMatch: /admin\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npm run build && npx next start -p ${PUERTO}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    // El build tarda; el arranque no. 5 minutos cubre los dos sin quedarse
    // esperando para siempre si algo se rompió.
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
