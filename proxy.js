import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Refresca la sesión antes de que se renderice cada página.
//
// Hace falta porque los tokens de refresco de Supabase son de un solo uso y los
// Server Components pueden leer cookies pero no escribirlas. Sin esto, cuando el
// token vence nadie lo renueva en un lugar donde se puedan guardar las cookies
// nuevas: la persona aparece deslogueada de golpe, y con dos pestañas abiertas
// una de las dos pierde la sesión porque la otra ya consumió el token.
//
// En Next 16 este archivo se llama proxy.js: middleware.js quedó deprecado y
// renombrado, aunque hace exactamente lo mismo.
export async function proxy(request) {
  let respuesta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesAEscribir) {
          for (const { name, value } of cookiesAEscribir) {
            request.cookies.set(name, value)
          }
          respuesta = NextResponse.next({ request })
          for (const { name, value, options } of cookiesAEscribir) {
            respuesta.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // Esta llamada es la que dispara el refresco si el token está por vencer, y
  // además dice si hay alguien conectado.
  const { data } = await supabase.auth.getUser()

  // VERIFICACIÓN OPTIMISTA DEL PANEL
  //
  // Acá se mira una sola cosa: si hay sesión. No se mira el rol, y no es un
  // olvido. La documentación de esta versión de Next pide que el proxy no
  // consulte la base, porque corre en cada pedido, incluidos los que Next hace
  // por adelantado al pasar el mouse por un enlace: una consulta de rol acá se
  // multiplicaría por cada uno de esos pedidos.
  //
  // El rol lo verifica app/lib/autorizacion.js, en cada página y en cada
  // acción. Esto de acá es el filtro barato que evita renderizar el panel para
  // alguien que no entró, y es gratis porque la llamada ya estaba hecha arriba.
  //
  // Es el caso 401: no sabemos quién es. Se lo manda a ingresar con la ruta a
  // la que quería llegar, para devolverlo ahí cuando entre.
  if (!data.user && request.nextUrl.pathname.startsWith('/admin')) {
    const destino = request.nextUrl.pathname + request.nextUrl.search
    const url = request.nextUrl.clone()
    url.pathname = '/ingresar'
    url.search = ''
    url.searchParams.set('volver', destino)

    // Las cookies que se refrescaron arriba se copian a la redirección. Si se
    // devolviera una respuesta nueva y vacía, se perderían y la sesión
    // quedaría a medio renovar.
    const redireccion = NextResponse.redirect(url)
    for (const cookie of respuesta.cookies.getAll()) {
      redireccion.cookies.set(cookie)
    }
    return redireccion
  }

  return respuesta
}

export const config = {
  // Se saltea los archivos estáticos: refrescar la sesión al pedir una foto no
  // aporta nada y multiplica las llamadas al servidor de auth.
  matcher: [
    '/((?!_next/static|_next/image|favicon.svg|icons.svg|imagenes|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)',
  ],
}
