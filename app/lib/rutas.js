// Validación de la ruta de retorno después de ingresar.
//
// POR QUÉ EXISTE: cuando alguien sin sesión entra a /admin/clases, el proxy lo
// manda a /ingresar?volver=/admin/clases y al entrar lo devuelve ahí. Ese
// parámetro viaja en la URL, así que lo escribe quien quiera.
//
// Sin esta función, un enlace a /ingresar?volver=https://sitio-falso.com
// convierte el login del estudio en un trampolín: la persona ve el dominio
// real, escribe su contraseña, y el sitio la deposita en una copia del estudio
// que le pide los datos otra vez. Se llama redirección abierta y es una de las
// formas más baratas de robar credenciales, porque el único dominio que la
// víctima mira es el verdadero.
//
// La regla: solo rutas de este sitio. Devuelve null si no lo es, y quien
// llama decide a dónde mandar en ese caso.

const LARGO_MAXIMO = 512

export function rutaInterna(valor) {
  if (typeof valor !== 'string' || valor.length > LARGO_MAXIMO) return null

  // Los navegadores borran los caracteres de control antes de interpretar una
  // URL. Si no se borran acá también, "/\thttp://..." pasa la validación como
  // texto y después el navegador lo lee como otra cosa.
  //
  // eslint avisa de los caracteres de control en la expresión regular, y acá
  // están a propósito: son justo lo que hay que borrar.
  // eslint-disable-next-line no-control-regex
  const limpio = valor.replace(/[\u0000-\u001f\u007f]/g, '')

  // Tiene que empezar con una sola barra.
  //   "//sitio-falso.com"  es una URL de otro dominio escrita sin protocolo,
  //                        y el navegador la sigue igual
  //   "/\sitio-falso.com"  hace lo mismo en varios navegadores
  //   "https://..."        no empieza con barra, queda afuera sola
  if (!limpio.startsWith('/')) return null
  if (limpio.startsWith('//') || limpio.startsWith('/\\')) return null

  // Sin barras invertidas ni espacios en ninguna posición: no aparecen en
  // ninguna ruta de este sitio y son el material de los casos de arriba.
  if (/[\\\s]/.test(limpio)) return null

  return limpio
}
