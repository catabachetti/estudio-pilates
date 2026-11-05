'use client'

// LA TERCERA Y ULTIMA EXCEPCIÓN A "CERO 'use client'", y su argumento no es el
// de las otras dos.
//
// POR QUÉ NO HAY OPCIÓN: la documentación de la versión instalada lo dice en
// ocho lugares de 03-api-reference/03-file-conventions/error.md —"Error
// boundaries must be Client Components"— y no ofrece una variante de servidor.
// `not-found.jsx` sí es un componente de servidor, y por eso el 404 propio se
// pudo hacer sin una línea de JavaScript. Este no.
//
// LO QUE SE MIDIÓ ANTES DE ESCRIBIRLO, con una ruta que revienta a propósito y
// con su control:
//
//                       HTML servido, sin ejecutar JS        con JavaScript
//   sin este archivo    11.574 bytes, ni una palabra         "THIS PAGE COULDN'T
//                                                             LOAD ... ERROR 1090"
//   con este archivo    11.754 bytes, ni una palabra         esta pantalla
//
// O sea que el error boundary se renderiza SOLO en el navegador: el HTML de un
// 500 es un <body> con un <div hidden>, con o sin este archivo.
//
// POR QUÉ ES ADMISIBLE IGUAL, y es un argumento propio: **sin JavaScript no se
// pierde nada**, porque la pantalla ya estaba vacía. Y **nada de lo que una
// persona hace pasa por acá**: esto solo se renderiza DESPUÉS de que algo ya se
// rompió. No es una función, es una red. Las otras dos excepciones se justifican
// distinto —el medidor porque es un agregado, el formulario porque tiene
// respaldo nativo— y la regla de CLAUDE.md tiene las tres ramas escritas.
//
// NO LLEVA useEffect, al contrario que el ejemplo de la documentación, que lo
// usa para registrar el error. Acá no haría falta: el error ya quedó en el
// registro del servidor junto con su `digest`, que es el identificador que se
// muestra abajo. Un registro desde el navegador sería una segunda copia del
// mismo dato y el primer useEffect del proyecto.
//
// `retry` y no `reset`: en esta versión son dos props distintas y la
// documentación recomienda `retry()`, que vuelve a pedir y re-renderiza el
// contenido. `reset()` solo limpia el estado del boundary sin volver a pedir.
export default function Error({ error, retry }) {
  return (
    <main className="seccion">
      <div className="contenedor">
        <section className="aviso">
          <h1 className="pagina-titulo">Algo se rompió de nuestro lado</h1>
          <p>
            No es algo que hayas hecho mal. Ya quedó registrado y lo estamos
            mirando.
          </p>

          {/* EL DIGEST, que es la misma convención que ya usa la API: cada error
              devuelve un identificador que también queda en el registro del
              servidor, así alguien puede decir "me salió este código" y se
              encuentra el error completo sin haberle mostrado nada de adentro.
              Ver app/api/_lib/errores.js. */}
          {error?.digest && (
            <p className="campo-ayuda">
              Si nos escribís, pasanos este código: <code>{error.digest}</code>
            </p>
          )}

          <div className="aviso-acciones">
            {/* `retry()` vuelve a pedir el contenido. Es lo único de esta
                pantalla que necesita JavaScript, y si no lo hay el enlace de al
                lado alcanza para salir. */}
            <button type="button" className="boton boton-oscuro" onClick={() => retry()}>
              Probar de nuevo
            </button>
            <a href="/" className="boton boton-claro">
              Ir al inicio
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
