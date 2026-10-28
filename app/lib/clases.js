// Lo que la API y el panel tienen que decidir igual sobre una clase.
//
// Se extrajo acá cuando apareció el segundo camino de entrada. No es una
// duplicación evitada por prolijidad: si el panel rechazara bajar el cupo por
// debajo de las reservas tomadas y la API lo aceptara, el mismo estudio tendría
// dos reglas distintas según por dónde entre el pedido, y la que vale sería la
// más floja.

// Cuántas reservas confirmadas tiene una clase.
//
// Administración las puede contar porque la política de `reservas` dice
// `using (... or es_admin())`. Devuelve null si la consulta falla: quien llama
// tiene que distinguir "cero reservas" de "no se pudo averiguar".
export async function reservasConfirmadas(supabase, claseId) {
  const { count, error } = await supabase
    .from('reservas')
    .select('*', { count: 'exact', head: true })
    .eq('clase_id', claseId)
    .eq('estado', 'confirmada')

  if (error) {
    console.error('No se pudieron contar las reservas:', error.message)
    return null
  }
  return count ?? 0
}

// ¿Se puede dejar el cupo en este número?
//
// No se puede dejar afuera a alguien que ya reservó. Devuelve el número de
// reservas si NO se puede —para poder decirlo en el mensaje— y null si se
// puede.
//
// DEUDA CONOCIDA, la misma que ya está en CLAUDE.md: esto lee y después
// escribe, en dos viajes. Entre uno y otro alguien podría reservar y el cupo
// quedaría uno por debajo. Con seis lugares y una sola persona administrando,
// la ventana es teórica. No se arregló acá porque arreglarlo de verdad es
// moverlo a una función de la base, como se hizo con reservar_clase().
export async function cupoQueDejaGenteAfuera(supabase, claseId, cupoNuevo) {
  const tomados = await reservasConfirmadas(supabase, claseId)
  if (tomados === null) return { fallo: true }
  return cupoNuevo < tomados ? { tomados } : {}
}
