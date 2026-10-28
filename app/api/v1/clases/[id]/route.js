import { manejador, ok, noEncontrado } from '../../../_lib/errores'
import { paramsDeRuta } from '../../../_lib/pedido'
import { clienteSupabase } from '../../../../lib/supabase'
import { Uuid } from '../../../../lib/esquemas'
import { sinSegundos } from '../../../../datos/agenda'
import { z } from 'zod'

const Params = z.object({ id: Uuid })

// GET /api/v1/clases/{id}
//
// ROUTE PARAM: acá sí, el id identifica un recurso concreto.
//
// Los lugares libres salen de lugares_disponibles(), que cuenta las reservas
// desde adentro de la base: contarlas desde acá daría siempre cero, porque RLS
// no deja ver las reservas ajenas.
export const GET = manejador(async (request, contexto) => {
  const { id } = await paramsDeRuta(contexto, Params)
  const supabase = clienteSupabase()

  const { data: clase, error } = await supabase
    .from('clases')
    .select('id, fecha, hora, cupo_total, estado, tipos_clase (nombre, duracion_min), instructoras (nombre)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!clase) throw noEncontrado('No existe esa clase.')

  const { data: lugares, error: errorLugares } = await supabase.rpc('lugares_disponibles', {
    p_clase_id: id,
  })
  if (errorLugares) throw errorLugares

  return ok({
    id: clase.id,
    fecha: clase.fecha,
    hora: sinSegundos(clase.hora),
    estado: clase.estado,
    clase: clase.tipos_clase?.nombre ?? null,
    duracion_min: clase.tipos_clase?.duracion_min ?? null,
    instructora: clase.instructoras?.nombre ?? null,
    cupo_total: clase.cupo_total,
    lugares_libres: lugares,
  })
})
