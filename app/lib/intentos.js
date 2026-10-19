import { headers } from 'next/headers'
import { clienteSupabase } from './supabase'

// El bloqueo progresivo del formulario de ingreso. La lógica vive en las
// funciones de la migración 012; acá solo se las llama.
//
// POR QUÉ LA IP FORMA PARTE DE LA CLAVE: un bloqueo por cuenta sola es una
// forma de dejar a alguien afuera. Quien sepa un correo falla cinco veces a
// propósito y bloquea a esa persona. Con la IP adentro, quien ataca se bloquea
// a sí mismo.

// La IP de quien pide. En Vercel viene en x-forwarded-for, que puede traer una
// cadena de direcciones: la primera es la de origen.
async function ipDeQuienPide() {
  const h = await headers()
  const cadena = h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? ''
  const primera = cadena.split(',')[0].trim()
  return primera || null
}

// Cuántos segundos faltan para poder volver a intentar. Cero si no hay bloqueo.
//
// SI NO SE PUEDE SABER LA IP, NO SE BLOQUEA. Es deliberado: sin IP, la clave
// sería la misma para todo el mundo y un solo atacante dejaría a todas las
// personas afuera. Entre no frenar a quien ataca y frenar a todas, se elige lo
// primero: esto es defensa en profundidad y el límite de Supabase sigue ahí.
export async function esperaPendiente(email) {
  const ip = await ipDeQuienPide()
  if (!ip) return 0

  const { data, error } = await clienteSupabase().rpc('puede_intentar', {
    p_email: email,
    p_ip: ip,
  })

  if (error) {
    console.error('No se pudo consultar el bloqueo:', error.message)
    return 0
  }
  return data ?? 0
}

// Anota un fallo y devuelve la espera que queda impuesta.
export async function anotarFallo(email) {
  const ip = await ipDeQuienPide()
  if (!ip) return 0

  const { data, error } = await clienteSupabase().rpc('registrar_fallo', {
    p_email: email,
    p_ip: ip,
  })

  if (error) {
    console.error('No se pudo registrar el fallo:', error.message)
    return 0
  }
  return data ?? 0
}

export async function olvidarFallos(email) {
  const ip = await ipDeQuienPide()
  if (!ip) return

  const { error } = await clienteSupabase().rpc('limpiar_intentos', {
    p_email: email,
    p_ip: ip,
  })
  if (error) console.error('No se pudieron limpiar los intentos:', error.message)
}
