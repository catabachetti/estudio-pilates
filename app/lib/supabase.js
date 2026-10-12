import { createClient } from '@supabase/supabase-js'

// QUÉ CLIENTE USAR
//
// Catálogo público (tipos de clase, paquetes, horarios): `createClient` de
// @supabase/supabase-js, que es lo que hay acá. Son lecturas anónimas, sin
// sesión y sin cookies, y las protege RLS: la clave publishable es pública y
// solo puede leer lo que las políticas permiten leer a cualquiera.
//
// Con sesión (login, reservas, créditos, compras), que llega en E5:
// `createServerClient` de @supabase/ssr. Ese sí guarda la sesión en cookies,
// que es la única forma de que el servidor lea la misma sesión que escribió el
// navegador. El README de @supabase/ssr lo dice explícito: si no necesitás
// acceso a la sesión desde el servidor, no hay razón para usarlo.
export function clienteSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
}
