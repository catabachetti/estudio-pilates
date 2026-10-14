'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { clienteConSesion, usuarioActual } from '../lib/supabase-sesion'
import { esUuid, esFecha } from '../lib/validacion'

// Reservar y cancelar. Las dos son una sola llamada a una función de la base:
// toda la verificación y la escritura pasan adentro de esa función, en una sola
// transacción con la fila de la clase bloqueada. Acá no se cuenta nada ni se
// decide nada, porque contar desde el servidor y escribir después es
// exactamente la carrera que la función existe para evitar.
//
// Ver supabase/migraciones/011-reservar.sql para el razonamiento completo.

// Las páginas son dinámicas, así que hoy el dato nuevo se ve sin esto. Se deja
// por lo mismo que en el resto del panel: limpia el Router Cache del navegador
// y es la línea que va a hacer falta el día que algo se cachee. El motivo largo
// está en app/acciones/admin-clases.js.
function publicar(dia) {
  revalidatePath('/cuenta')
  revalidatePath('/reservar')
  if (dia) revalidatePath(`/reservar?dia=${dia}`)
}

export async function reservarClase(formData) {
  const clase = String(formData.get('clase_id') ?? '')
  const diaCrudo = String(formData.get('dia') ?? '')
  const dia = esFecha(diaCrudo) ? diaCrudo : null
  const volver = dia ? `/reservar?dia=${dia}` : '/reservar'

  // Sin sesión no se reserva, pero tampoco se pierde el intento: vuelve al
  // mismo día después de entrar, por el circuito de `volver` que ya existe.
  const usuario = await usuarioActual()
  if (!usuario) redirect(`/ingresar?volver=${encodeURIComponent(volver)}`)

  if (!esUuid(clase)) redirect(`${volver}${dia ? '&' : '?'}r=error`)

  const supabase = await clienteConSesion()
  const { data, error } = await supabase.rpc('reservar_clase', { p_clase_id: clase })

  if (error) {
    console.error('No se pudo reservar:', error.message)
    redirect(`${volver}${dia ? '&' : '?'}r=error`)
  }

  const resultado = data?.[0]?.resultado ?? 'error'

  if (resultado === 'ok') publicar(dia)

  redirect(`${volver}${dia ? '&' : '?'}r=${resultado}`)
}

export async function cancelarReserva(formData) {
  const reserva = String(formData.get('reserva_id') ?? '')

  const usuario = await usuarioActual()
  if (!usuario) redirect('/ingresar?volver=%2Fcuenta')

  if (!esUuid(reserva)) redirect('/cuenta?r=error')

  const supabase = await clienteConSesion()
  const { data, error } = await supabase.rpc('cancelar_reserva', {
    p_reserva_id: reserva,
  })

  if (error) {
    console.error('No se pudo cancelar:', error.message)
    redirect('/cuenta?r=error')
  }

  const fila = data?.[0]
  if (!fila) redirect('/cuenta?r=error')

  if (fila.resultado === 'ok') publicar(null)

  // Se avisa si el crédito volvió o se perdió: es la consecuencia que a la
  // persona le importa, y la decidió la base, no esta pantalla.
  redirect(
    fila.resultado === 'ok'
      ? `/cuenta?r=cancelada&credito=${fila.credito_devuelto ? 'devuelto' : 'perdido'}`
      : `/cuenta?r=${fila.resultado}`
  )
}
