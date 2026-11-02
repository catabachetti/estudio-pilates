// Con qué atributos se escribe la cookie de sesión.
//
// POR QUÉ HACE FALTA ESTO: @supabase/ssr no pone `httpOnly` ni `secure`. No es
// un descuido suyo: la misma librería sirve a aplicaciones donde el navegador
// lee la cookie con createBrowserClient, y ahí `httpOnly` la rompería.
//
// Este proyecto no es una de esas. No tiene ningún createBrowserClient ni
// ningún componente de cliente que necesite leer la sesión: la cookie la lee
// solo el servidor. Así que puede quedar fuera del alcance de JavaScript, que
// es lo que el módulo 10 marca como obligatorio y lo que faltaba.
//
// Vive en un archivo propio porque se escriben cookies en dos lugares —el
// proxy y el cliente con sesión— y los dos tienen que decir lo mismo.
export function opcionesDeCookie(opciones) {
  return {
    ...opciones,

    // Si un XSS llegara a ejecutar código en la página, no puede leer la
    // sesión: document.cookie no la ve. Es la defensa de la que depende que un
    // XSS sea un problema de contenido y no un robo de cuentas.
    httpOnly: true,

    // La cookie no viaja por HTTP sin cifrar. En desarrollo queda apagado
    // porque `next dev` sirve por http.
    //
    // ANTES ESTE COMENTARIO DECIA que con `next start` local tampoco molesta
    // "porque los navegadores igual tratan a localhost como origen seguro".
    // **Eso es falso para WebKit**, y lo encontraron las pruebas de Playwright
    // sin JavaScript. Medido con los tres motores contra `next start` en
    // http://localhost, enviando el formulario de ingreso:
    //
    //   chromium   2 cookies sb- guardadas (las dos Secure)   sesion abierta
    //   firefox    2 cookies sb- guardadas (las dos Secure)   sesion abierta
    //   webkit     0 cookies                                  sesion NO abierta
    //
    // O sea que Chromium y Firefox hacen la excepcion de localhost y WebKit no:
    // descarta una cookie `Secure` que llega por http sin avisar.
    //
    // NO SE TOCA. Bajar `secure` para que una prueba pase seria debilitar la
    // defensa real por comodidad local. La consecuencia esta acotada y dicha:
    // no se puede iniciar sesion con Safari ni con WebKit contra el sitio local
    // servido por http, y las dos pruebas E2E que necesitan sesion se saltean
    // en ese motor con este motivo escrito. En produccion todo es https, asi
    // que ahi no aplica.
    secure: process.env.NODE_ENV === 'production',

    // Viaja en navegaciones normales pero no en pedidos que nacen de otro
    // sitio, que es lo que limita el CSRF. Es lo que ya venía poniendo
    // @supabase/ssr; se deja explícito para que se lea junto con los otros dos.
    sameSite: 'lax',
  }
}
