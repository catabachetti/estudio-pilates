import { createClient } from '@supabase/supabase-js'
import { clienteConSesion } from '../../lib/supabase-sesion'
import { noAutenticado, sinPermiso } from './errores'

// QUIÉN LLAMA A LA API, Y CÓMO SE IDENTIFICA.
//
// Hay dos mecanismos y un ayudante solo, porque los clientes son distintos:
//
//   cookie de sesión        un navegador, con `fetch` desde el propio sitio.
//                           Es la misma cookie HttpOnly del resto del proyecto
//                           y el navegador la manda sola.
//
//   Authorization: Bearer   un script, un servicio, una app. No tiene cookies
//                           ni forma de obtenerlas. Manda el mismo JWT que
//                           emite Supabase al iniciar sesión.
//
// Y un tercer caso que no usa ninguno de los dos: **el webhook de Mercado
// Pago**. Los servidores de MP no tienen cuenta en el estudio ni token nuestro;
// se identifican firmando el pedido, que es otro mecanismo y va a vivir en su
// propia ruta cuando llegue ese módulo. No pasa por acá.

// El cliente de Supabase con la identidad de quien llama, venga como venga.
// Importa que la identidad viaje al cliente: RLS decide con `auth.uid()`, así
// que un cliente sin identidad ve lo que ve cualquiera, no lo que ve esa
// persona.
export async function clienteDeApi(request) {
  const cabecera = request.headers.get('authorization') ?? ''
  const [esquema, token] = cabecera.split(' ')

  if (esquema?.toLowerCase() === 'bearer' && token) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
  }

  // Sin cabecera, se usa la cookie. Si tampoco hay cookie, el cliente queda
  // anónimo y `usuario` sale null: eso lo decide quien llame a quienLlama().
  return clienteConSesion()
}

// La identidad de quien llama, o null. No lanza: hay rutas públicas que
// igual quieren saber si hay alguien del otro lado.
export async function quienLlama(request) {
  const supabase = await clienteDeApi(request)
  const { data, error } = await supabase.auth.getUser()
  return { supabase, usuario: error ? null : (data.user ?? null) }
}

// Para las rutas que exigen sesión. Lanza 401 y el manejador lo convierte.
export async function exigirSesion(request) {
  const { supabase, usuario } = await quienLlama(request)
  if (!usuario) throw noAutenticado()
  return { supabase, usuario }
}

// Para las rutas de administración. 401 si no hay sesión, 403 si la hay y no
// alcanza: son dos cosas distintas y la materia marca confundirlas como error.
export async function exigirAdminApi(request) {
  const { supabase, usuario } = await exigirSesion(request)

  const { data: perfil, error } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', usuario.id)
    .single()

  // Si el rol no se puede leer, la respuesta es "no". Ante la duda, negar.
  if (error || perfil?.rol !== 'admin') throw sinPermiso()

  return { supabase, usuario }
}
