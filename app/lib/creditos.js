import { ahoraEnElEstudio } from '../datos/agenda'

// El resumen de créditos de una persona, que usan /cuenta y /admin/creditos.
//
// LA REGLA DE CUÁNDO UN CRÉDITO ESTÁ TOMADO: lo está si **cualquier** reserva
// lo referencia, sin mirar el estado de esa reserva. No alcanza con mirar las
// confirmadas, y la diferencia no es teórica:
//
//   cancelación a tiempo   la función suelta el credito_id, la reserva queda
//                          sin crédito, y el crédito vuelve a estar libre
//   cancelación tardía     la reserva queda cancelada pero conserva el
//                          credito_id, y por eso el crédito se pierde
//
// Si acá se filtrara por `estado = 'confirmada'`, los créditos perdidos por
// cancelación tardía volverían a contarse como disponibles, y la pantalla
// diría algo que la base no va a respetar al reservar.
export async function resumenDeCreditos(supabase, userId) {
  const { data: creditos, error } = await supabase
    .from('creditos')
    .select('id, vence_el')
    .eq('user_id', userId)
    .order('vence_el')

  if (error) {
    console.error('No se pudieron leer los créditos:', error.message)
    return null
  }

  const tomados = await creditosTomados(supabase, creditos.map((c) => c.id))
  if (tomados === null) return null

  const hoy = ahoraEnElEstudio().clave
  const porFecha = new Map()
  let disponibles = 0
  let vencidos = 0

  for (const c of creditos) {
    if (tomados.has(c.id)) continue
    if (c.vence_el < hoy) {
      vencidos += 1
      continue
    }
    disponibles += 1
    porFecha.set(c.vence_el, (porFecha.get(c.vence_el) ?? 0) + 1)
  }

  return {
    disponibles,
    vencidos,
    usados: tomados.size,
    total: creditos.length,
    porVencimiento: [...porFecha.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fecha, cantidad]) => ({ fecha, cantidad })),
  }
}

async function creditosTomados(supabase, ids) {
  if (ids.length === 0) return new Set()

  const { data, error } = await supabase
    .from('reservas')
    .select('credito_id')
    .in('credito_id', ids)

  if (error) {
    console.error('No se pudieron leer las reservas de esos créditos:', error.message)
    return null
  }
  return new Set(data.map((r) => r.credito_id))
}
