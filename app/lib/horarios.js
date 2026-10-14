import { clienteSupabase } from './supabase'
import { aClave, desdeClave, hoy, sinSegundos } from '../datos/agenda'

const DIAS_A_MIRAR = 14

// La tabla `clases` guarda clases concretas con fecha; /horarios muestra una
// semana tipo. Para pasar de una cosa a la otra, se traen los próximos 14 días
// y se colapsan por (bloque, hora). Catorce y no siete porque garantizan al
// menos dos de cada día de la semana: si un día puntual falta, la hora no se
// pierde de la grilla.
//
// El supuesto es que todos los días hábiles tienen la misma grilla. Hoy es
// cierto, pero la tabla permite que no lo sea, así que se verifica: si una misma
// (bloque, hora) aparece con dos tipos de clase distintos, la semana tipo deja
// de describir la realidad y queda registrado en el log.
export async function semanaTipo() {
  const desde = hoy()
  const hasta = new Date(desde)
  hasta.setDate(hasta.getDate() + DIAS_A_MIRAR - 1)

  const { data, error } = await clienteSupabase()
    .from('clases')
    .select('fecha, hora, tipos_clase (nombre, duracion_min)')
    // Las canceladas no entran en la semana tipo: la clase sigue existiendo en
    // la base por sus reservas, pero el estudio ya no la da.
    .eq('estado', 'programada')
    .gte('fecha', aClave(desde))
    .lte('fecha', aClave(hasta))
    .order('fecha')
    .order('hora')

  if (error) {
    console.error('No se pudo leer la grilla de Supabase:', error.message)
    return { bloques: [], error }
  }

  const porBloque = new Map()
  const choques = []

  for (const clase of data) {
    const dia = desdeClave(clase.fecha).getDay()
    if (dia === 0) continue
    const bloque = dia === 6 ? 'Sábados' : 'Lunes a viernes'
    const hora = sinSegundos(clase.hora)
    const nombre = clase.tipos_clase?.nombre ?? ''

    if (!porBloque.has(bloque)) porBloque.set(bloque, new Map())
    const turnos = porBloque.get(bloque)

    const existente = turnos.get(hora)
    if (!existente) {
      turnos.set(hora, {
        hora,
        clase: nombre,
        duracionMin: clase.tipos_clase?.duracion_min ?? null,
        duracion: `${clase.tipos_clase?.duracion_min ?? ''} minutos`,
      })
    } else if (existente.clase !== nombre) {
      choques.push(`${bloque} ${hora}: ${existente.clase} y ${nombre}`)
    }
  }

  if (choques.length > 0) {
    console.error(
      'La grilla dejó de ser regular, la semana tipo no la describe bien:',
      choques.join(' | ')
    )
  }

  const orden = ['Lunes a viernes', 'Sábados']
  const bloques = orden
    .filter((dia) => porBloque.has(dia))
    .map((dia) => ({
      dia,
      turnos: [...porBloque.get(dia).values()].sort(
        (a, b) => enMinutos(a.hora) - enMinutos(b.hora)
      ),
    }))

  return { bloques, error: null }
}

function enMinutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

// El horario de atención no se escribe a mano ni sale de una grilla en el
// código: se deduce de las clases cargadas. Abre con la primera y cierra cuando
// termina la última, redondeado hacia arriba a la hora en punto, que es como lo
// comunica cualquier negocio: la última clase termina 20:50 y el cartel dice 21.
export async function horariosDeAtencion() {
  const { bloques, error } = await semanaTipo()
  if (error || bloques.length === 0) {
    return { horarios: [], error: error ?? null }
  }

  const horarios = bloques.map((bloque) => {
    const primera = bloque.turnos[0]
    const ultima = bloque.turnos[bloque.turnos.length - 1]
    const fin = enMinutos(ultima.hora) + (ultima.duracionMin ?? 0)
    const cierre = Math.ceil(fin / 60) * 60
    return { dia: bloque.dia, desde: primera.hora, hasta: `${cierre / 60}:00` }
  })

  return { horarios, error: null }
}
