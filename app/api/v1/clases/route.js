import { manejador, ok } from '../../_lib/errores'
import { paramsDeConsulta } from '../../_lib/pedido'
import { clienteSupabase } from '../../../lib/supabase'
import { FiltroDeClases } from '../../../lib/esquemas'
import { ahoraEnElEstudio, sinSegundos } from '../../../datos/agenda'
import { noEncontrado } from '../../_lib/errores'

// GET /api/v1/clases?fecha=2026-11-03
//
// QUERY PARAM, no route param: la fecha no identifica un recurso, acota una
// colección. `/clases/2026-11-03` diría que la fecha ES el recurso, y el
// recurso es la clase.
//
// NO REIMPLEMENTA NADA. Llama a disponibilidad_del_dia(), la misma función que
// usa /reservar, que ya decide qué clases mostrar —solo las programadas— y
// cuenta los lugares libres sin exponer de quién es cada reserva.
export const GET = manejador(async (request) => {
  const { fecha } = paramsDeConsulta(request, FiltroDeClases)

  // Sin fecha, el día de hoy en el huso del estudio. No el del servidor: en
  // Vercel corre en UTC y a las 22 de Buenos Aires ya seria mañana.
  const dia = fecha ?? ahoraEnElEstudio().clave

  const { data, error } = await clienteSupabase().rpc('disponibilidad_del_dia', {
    p_fecha: dia,
  })

  if (error) throw error

  return ok({
    fecha: dia,
    clases: data.map((c) => ({
      id: c.clase_id,
      hora: sinSegundos(c.hora),
      clase: c.clase,
      instructora: c.instructora,
      cupo_total: c.cupo_total,
      lugares_libres: c.lugares,
    })),
  })
})
