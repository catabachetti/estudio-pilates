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

  // Esta llamada es la que dispara el refresco si el token está por vencer.
  // No se usa el resultado acá: solo importa que las cookies queden al día.
  await supabase.auth.getUser()

  return respuesta
}

export const config = {
  // Se saltea los archivos estáticos: refrescar la sesión al pedir una foto no
  // aporta nada y multiplica las llamadas al servidor de auth.
  matcher: [
    '/((?!_next/static|_next/image|favicon.svg|icons.svg|imagenes|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)',
  ],
}
