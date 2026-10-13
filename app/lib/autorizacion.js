import { cache } from 'react'
import { redirect } from 'next/navigation'
import { clienteConSesion, usuarioActual } from './supabase-sesion'

// Quién está conectado y si es administración. Este archivo es la única
// respuesta a esa pregunta en todo el proyecto.
//
// DÓNDE VA LA VERIFICACIÓN, Y POR QUÉ ACÁ
//
// El plan decía "en el layout de /admin". La documentación de la versión
// instalada de Next dice que no, y da tres razones
// (node_modules/next/dist/docs/01-app/02-guides/authentication.md, "Layouts
// and auth checks"):
//
//   1. Un layout no se vuelve a renderizar al navegar entre páginas que lo
//      comparten, así que la sesión no se revisa en cada cambio de ruta.
//   2. Un layout no decide si el resto de la ruta se renderiza: los segmentos
//      los renderiza el router por su cuenta, y aparecen igual en el payload.
//   3. Las Server Actions no pasan por ningún layout. Tienen su propia entrada.
//
// La tercera es la que importa en este panel. /admin/paquetes edita precios con
// una Server Action; si la única verificación estuviera en el layout, cualquiera
// podría invocar esa acción directo y cambiar los precios sin pasar nunca por
// una página. Por eso la verificación vive acá y la llaman todas las páginas
// y todas las acciones, que es lo que la documentación llama Data Access Layer:
// "the majority of security checks should be performed as close as possible to
// your data source".
//
// Y detrás de todo esto sigue estando RLS, que es la que no se puede saltear:
// aunque alguien llegue a la acción, la base rechaza la escritura si el rol no
// es admin. Son tres capas y cada una cubre una falla distinta de la anterior.

// cache() de React guarda el resultado durante un mismo renderizado: el Header
// y la página preguntan quién está conectado y el servidor de auth se consulta
// una sola vez. No persiste entre pedidos ni se comparte entre personas.
export const sesionAdmin = cache(async () => {
  const usuario = await usuarioActual()
  if (!usuario) return { usuario: null, esAdmin: false }

  const supabase = await clienteConSesion()
  const { data: perfil, error } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', usuario.id)
    .single()

  if (error) {
    // Si el rol no se puede leer, la respuesta es "no". Ante la duda, la
    // verificación tiene que negar, no permitir.
    console.error('No se pudo leer el rol del perfil:', error.message)
    return { usuario, esAdmin: false }
  }

  return { usuario, esAdmin: perfil.rol === 'admin' }
})

// Para las Server Actions. Las dos fallas se tratan distinto a propósito,
// porque son los dos casos que se confunden:
//
//   sin sesión          401: no sabemos quién es. Se lo manda a ingresar y se
//                       guarda a dónde quería ir.
//   sesión sin permiso  403: sabemos quién es y no alcanza. Mandarlo al login
//                       no arregla nada, porque volver a entrar con la misma
//                       cuenta da el mismo resultado.
//
// En una acción el 403 corta con un error y no con un mensaje amable: llegar
// hasta acá sin ser admin significa que alguien se salteó la pantalla, y eso
// no termina en "guardado".
export async function exigirAdmin(volverA) {
  const { usuario, esAdmin } = await sesionAdmin()

  if (!usuario) redirect(`/ingresar?volver=${encodeURIComponent(volverA)}`)
  if (!esAdmin) throw new Error('403 — esta acción necesita rol de administración')

  return usuario
}
