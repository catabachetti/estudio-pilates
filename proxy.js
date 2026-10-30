import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { opcionesDeCookie } from './app/lib/cookies'

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
            respuesta.cookies.set(name, value, opcionesDeCookie(options))
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
  // ES EL CASO 401: no sabemos quién es. Qué se devuelve depende de quién
  // pregunta, y las dos respuestas son el mismo 401 dicho de dos formas:
  //
  //   un navegador navegando   -> redirección a /ingresar, guardando a dónde
  //                               iba. Devolverle un 401 pelado sería mostrarle
  //                               una pantalla en blanco en vez de la puerta.
  //   cualquier otro cliente   -> 401 de verdad, que es lo que un programa
  //                               espera y lo que dice el módulo 10.
  //
  // Se distingue por la cabecera `Accept`, que es lo que existe para eso. Las
  // navegaciones internas de Next también llevan redirección: piden
  // `text/x-component` y esperan poder seguirla, no un error.
  //
  // DESVÍO CONOCIDO: la RFC 9110 pide que un 401 incluya una cabecera
  // `WWW-Authenticate` con un desafío. Para sesiones por cookie no hay esquema
  // aplicable, así que no se manda ninguna, igual que la mayoría de las
  // aplicaciones con login por formulario. Está anotado en docs/seguridad.md.
  if (!data.user && request.nextUrl.pathname.startsWith('/admin')) {
    if (!quiereUnaPagina(request)) {
      return Response.json(
        { error: 'no_autenticado', mensaje: 'Hace falta iniciar sesión.' },
        { status: 401 }
      )
    }

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

// Si el pedido lo hizo un navegador para mostrar una página, o Next para
// navegar entre páginas. En los dos casos hay a dónde mandar a la persona; en
// el resto, no hay pantalla que mostrar y corresponde el código.
function quiereUnaPagina(request) {
  const acepta = request.headers.get('accept') ?? ''
  return (
    acepta.includes('text/html') ||
    acepta.includes('text/x-component') ||
    request.headers.has('rsc')
  )
}

export const config = {
  // Se saltea los archivos estáticos: refrescar la sesión al pedir una foto no
  // aporta nada y multiplica las llamadas al servidor de auth.
  //
  // Y SE SALTEA api/webhooks, que es el aviso de pago de Mercado Pago. Ese
  // pedido no trae cookies —del otro lado hay un servidor de MP, no un
  // navegador— así que refrescar la sesión es un viaje de red al servidor de
  // auth que nunca va a encontrar nada, en cada notificación, sobre una
  // respuesta que Mercado Pago cronometra y reintenta si tarda.
  matcher: [
    '/((?!api/webhooks|_next/static|_next/image|favicon.svg|icons.svg|imagenes|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)',
  ],
}
