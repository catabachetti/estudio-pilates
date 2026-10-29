import { manejador, ok, creado, conflicto, malPedido } from '../../_lib/errores'
import { paramsDeConsulta, cuerpo } from '../../_lib/pedido'
import { exigirAdminApi } from '../../_lib/sesion'
import { clienteSupabase } from '../../../lib/supabase'
import { FiltroDeClases, NuevaClase } from '../../../lib/esquemas'
import { CODIGOS } from '../../../lib/validacion'
import { ahoraEnElEstudio, sinSegundos } from '../../../datos/agenda'

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

// POST /api/v1/clases
//
// BODY: crear no identifica nada por URL todavía, así que los datos van en el
// cuerpo. Solo administración.
export const POST = manejador(async (request) => {
  const { supabase } = await exigirAdminApi(request)
  const datos = await cuerpo(request, NuevaClase)

  const { data, error } = await supabase.from('clases').insert(datos).select('id').single()

  if (error) {
    // El unique (fecha, hora) es la regla de negocio: no hay dos clases a la
    // misma hora. Una clase cancelada sigue ocupando su horario, y eso es a
    // propósito: esa fila tiene reservas colgando.
    if (error.code === CODIGOS.UNICO) {
      throw conflicto(
        'horario_ocupado',
        'Ya hay una clase ese día a esa hora. Si la habías cancelado, reactivala.'
      )
    }
    if (error.code === CODIGOS.AJENA) {
      throw malPedido('El tipo de clase o la instructora no existen.')
    }
    throw error
  }

  return creado({ id: data.id }, `/api/v1/clases/${data.id}`)
})
