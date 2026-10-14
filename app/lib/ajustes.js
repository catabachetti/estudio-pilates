import { clienteSupabase } from './supabase'

// Los ajustes del estudio que se aplican en la base y se muestran en el sitio.
//
// Hoy hay uno solo: las horas de cancelación. Vive en la tabla `ajustes` y no
// en app/datos/sitio.js porque la función cancelar_reserva() lo necesita para
// decidir si devuelve el crédito, y ese número no puede viajar como parámetro:
// quien llamara a la función elegiría 9999 y recuperaría siempre el crédito.
//
// Al estar en la base, el sitio lo lee de ahí en vez de tener una segunda copia
// escrita a mano que se desincronice.
export async function horasDeCancelacion() {
  const { data, error } = await clienteSupabase()
    .from('ajustes')
    .select('valor')
    .eq('clave', 'horas_cancelacion')
    .maybeSingle()

  if (error || !data) {
    console.error(
      'No se pudo leer el ajuste horas_cancelacion:',
      error?.message ?? 'no está la fila'
    )
    // null y no un 6 de consuelo: si no sabemos cuál es la regla, el sitio no
    // la afirma. Inventar un número acá sería prometer algo que la base no va
    // a cumplir al cancelar.
    return null
  }

  return data.valor
}
