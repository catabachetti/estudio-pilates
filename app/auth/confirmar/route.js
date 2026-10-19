import { NextResponse } from 'next/server'
import { clienteConSesion } from '../../lib/supabase-sesion'
import { rutaInterna } from '../../lib/rutas'

// Donde aterriza el enlace del correo de recuperación.
//
// POR QUÉ UN TOKEN Y NO EL ENLACE POR OMISIÓN: @supabase/ssr fuerza
// flowType: "pkce", y en PKCE el enlace trae un `code` que solo se puede
// canjear con un verificador guardado en una cookie del navegador donde se
// pidió la recuperación. Si alguien la pide en la computadora y abre el correo
// en el teléfono, el verificador no está y el canje falla. Que es exactamente
// lo que la gente hace.
//
// Con `token_hash` + verifyOtp no hay verificador: el enlace funciona desde
// cualquier dispositivo. Por eso la plantilla del correo usa {{ .TokenHash }}
// y no {{ .ConfirmationURL }}.

// Solo los dos que usa el proyecto. `recovery` es el de recuperar contraseña;
// `email` es el de confirmar la cuenta, para cuando se active esa opción.
const TIPOS = new Set(['recovery', 'email'])

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const tipo = searchParams.get('type')

  // El destino viaja en el enlace del correo, así que se valida igual que el
  // `volver` del login: sin esto, un enlace armado a mano usaría nuestro
  // dominio para depositar a alguien en otro sitio, y encima con la sesión
  // recién iniciada.
  const volver = rutaInterna(searchParams.get('volver')) ?? '/cuenta'

  if (!tokenHash || !TIPOS.has(tipo)) {
    return NextResponse.redirect(`${origin}/ingresar?error=enlace`)
  }

  const supabase = await clienteConSesion()
  const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash })

  if (error) {
    // Un enlace vencido o ya usado cae acá. No se distingue de uno inventado:
    // decir "este enlace ya se usó" confirmaría que existía.
    console.error('No se pudo validar el enlace del correo:', error.message)
    return NextResponse.redirect(`${origin}/ingresar?error=enlace`)
  }

  return NextResponse.redirect(`${origin}${volver}`)
}
