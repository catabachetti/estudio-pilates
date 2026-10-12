import { clienteSupabase } from './supabase'
import { aClave, desdeClave, hoy, lunesDe } from '../datos/agenda'

// Toda la agenda de /reservar sale de la tabla `clases`. Nada de grillas
// escritas en el código: si la base tiene clases hasta el 3 de diciembre, la
// tira no puede ofrecer el 10.
//
// Son tres consultas y cada una tiene su motivo:
//   1. hasta qué fecha hay clases cargadas, para saber si existe semana siguiente
//   2. qué días de esta semana tienen clases, para la tira
//   3. los turnos del día elegido con sus lugares libres (la función de la 007)
//
// Si cualquiera falla, se devuelve el error y la página no muestra nada: en esta
// pantalla los números son afirmaciones sobre lugares reales.
export async function agendaDeLaSemana(diaPedido) {
  const supabase = clienteSupabase()
  const claveHoy = aClave(hoy())

  const { data: ultima, error: errorUltima } = await supabase
    .from('clases')
    .select('fecha')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (errorUltima) {
    console.error('No se pudo leer el final de la agenda:', errorUltima.message)
    return { error: errorUltima }
  }

  const ultimaFecha = ultima?.fecha ?? null
  if (!ultimaFecha) {
    return { error: null, sinAgenda: true }
  }

  // La semana que se muestra: la del día pedido si es usable, si no la de hoy.
  const pedido =
    typeof diaPedido === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(diaPedido) &&
    diaPedido >= claveHoy &&
    diaPedido <= ultimaFecha
      ? diaPedido
      : claveHoy

  const lunes = lunesDe(desdeClave(pedido))
  const domingo = new Date(lunes)
  domingo.setDate(domingo.getDate() + 6)
  // Nunca se muestran días pasados, así que la semana arranca en el más tardío
  // entre el lunes y hoy.
  const desde = aClave(lunes) < claveHoy ? claveHoy : aClave(lunes)

  const { data: filas, error: errorDias } = await supabase
    .from('clases')
    .select('fecha')
    .gte('fecha', desde)
    .lte('fecha', aClave(domingo))
    .order('fecha')

  if (errorDias) {
    console.error('No se pudieron leer los días de la semana:', errorDias.message)
    return { error: errorDias }
  }

  const dias = [...new Set(filas.map((f) => f.fecha))]
  const elegido = dias.includes(pedido) ? pedido : (dias[0] ?? null)

  let turnos = []
  if (elegido) {
    const { data, error } = await supabase.rpc('disponibilidad_del_dia', {
      p_fecha: elegido,
    })
    if (error) {
      console.error('No se pudo leer la disponibilidad del día:', error.message)
      return { error }
    }
    turnos = data ?? []
  }

  const lunesAnterior = new Date(lunes)
  lunesAnterior.setDate(lunesAnterior.getDate() - 7)
  const lunesSiguiente = new Date(lunes)
  lunesSiguiente.setDate(lunesSiguiente.getDate() + 7)

  return {
    error: null,
    dias,
    elegido,
    turnos,
    ultimaFecha,
    // Hacia atrás, hasta la semana en curso. Hacia adelante, hasta donde haya
    // clases cargadas: el límite ya no es una constante del código.
    anterior: aClave(lunesAnterior) >= aClave(lunesDe(hoy())) ? aClave(lunesAnterior) : null,
    siguiente: aClave(lunesSiguiente) <= ultimaFecha ? aClave(lunesSiguiente) : null,
  }
}
