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
    // porque `next dev` sirve por http; los navegadores igual tratan a
    // localhost como origen seguro, así que con `next start` local tampoco
    // molesta.
    secure: process.env.NODE_ENV === 'production',

    // Viaja en navegaciones normales pero no en pedidos que nacen de otro
    // sitio, que es lo que limita el CSRF. Es lo que ya venía poniendo
    // @supabase/ssr; se deja explícito para que se lea junto con los otros dos.
    sameSite: 'lax',
  }
}
