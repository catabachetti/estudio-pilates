import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cliente para todo lo que necesite saber quién está conectado.
//
// La diferencia con clienteSupabase() de supabase.js no es cosmética: este
// guarda la sesión en cookies, que es lo único que permite que el servidor lea
// la misma sesión que escribió el navegador. El otro sirve para el catálogo
// público, donde no hay nadie conectado.
//
// En Next 16 cookies() es asíncrona, por eso el await.
export async function clienteConSesion() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesAEscribir) {
          try {
            for (const { name, value, options } of cookiesAEscribir) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Un Server Component puede leer cookies pero no escribirlas. Acá
            // no es un error: el proxy ya refrescó la sesión antes de renderizar
            // y escribió las cookies nuevas. Este catch existe para que leer la
            // sesión desde una página no reviente.
          }
        },
      },
    }
  )
}

// Quién está conectado, o null.
//
// getUser() y no getSession(): getSession lee la cookie y confía en lo que dice,
// getUser la valida contra el servidor de auth. Para decidir qué mostrar o qué
// permitir, la diferencia importa: una cookie se puede falsificar.
export async function usuarioActual() {
  const supabase = await clienteConSesion()
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user ?? null
}
