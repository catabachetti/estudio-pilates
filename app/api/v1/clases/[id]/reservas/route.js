import { manejador, ok, noEncontrado } from '../../../../_lib/errores'
import { paramsDeRuta } from '../../../../_lib/pedido'
import { exigirAdminApi } from '../../../../_lib/sesion'
import { Uuid } from '../../../../../lib/esquemas'
import { z } from 'zod'

const Params = z.object({ id: Uuid })

// GET /api/v1/clases/{id}/reservas
//
// RECURSO ANIDADO: las reservas DE esa clase. Es la forma REST de expresar la
// pertenencia, y evita tener que inventar algo como /admin/reservas?clase=,
// que mezclaria un rol en la URL con un filtro.
//
// Solo administración: quien reserva ve las suyas en /api/v1/reservas.
export const GET = manejador(async (request, contexto) => {
  const { id } = await paramsDeRuta(contexto, Params)
  const { supabase } = await exigirAdminApi(request)

  const { data: clase, error: errorClase } = await supabase
    .from('clases')
    .select('id, fecha, hora, estado, cupo_total')
    .eq('id', id)
    .maybeSingle()

  if (errorClase) throw errorClase
  if (!clase) throw noEncontrado('No existe esa clase.')

  const { data, error } = await supabase
    .from('reservas')
    .select('id, estado, user_id')
    .eq('clase_id', id)

  if (error) throw error

  // PostgREST no puede unir `reservas` con `perfiles`: no hay clave ajena entre
  // ellas. Las dos apuntan a auth.users(id), pero no una a la otra. Por eso son
  // dos consultas, igual que en /admin/reservas.
  const ids = [...new Set(data.map((r) => r.user_id))]
  const nombres = new Map()

  if (ids.length > 0) {
    const { data: perfiles, error: errorPerfiles } = await supabase
      .from('perfiles')
      .select('id, nombre')
      .in('id', ids)
    if (errorPerfiles) throw errorPerfiles
    for (const p of perfiles) nombres.set(p.id, p.nombre)
  }

  return ok({
    clase: { id: clase.id, fecha: clase.fecha, estado: clase.estado, cupo_total: clase.cupo_total },
    reservas: data.map((r) => ({
      id: r.id,
      estado: r.estado,
      persona: nombres.get(r.user_id) ?? null,
    })),
  })
})
