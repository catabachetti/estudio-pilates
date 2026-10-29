import { manejador, ok, noEncontrado, conflicto, malPedido } from '../../../_lib/errores'
import { paramsDeRuta, cuerpoCrudo } from '../../../_lib/pedido'
import { exigirAdminApi } from '../../../_lib/sesion'
import { clienteSupabase } from '../../../../lib/supabase'
import { Uuid, EdicionDeClase, EstadoDeClase } from '../../../../lib/esquemas'
import { cupoQueDejaGenteAfuera } from '../../../../lib/clases'
import { CODIGOS } from '../../../../lib/validacion'
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

// PATCH /api/v1/clases/{id}
//
// ROUTE PARAM + BODY. Acepta dos formas, porque son dos cambios distintos sobre
// el mismo recurso:
//
//   {"tipo_clase_id":..., "instructora_id":..., "cupo_total":...}
//   {"estado":"cancelada"}  o  {"estado":"programada"}
//
// Cancelar no borra: un disparador de la migración 011 pasa las reservas de esa
// clase a canceladas y les devuelve el crédito. Esa lógica vive en la base y
// acá no se repite ni se menciona dos veces.
export const PATCH = manejador(async (request, contexto) => {
  const { id } = await paramsDeRuta(contexto, Params)
  const { supabase } = await exigirAdminApi(request)

  const crudo = await cuerpoCrudo(request)

  const cambiaEstado = Object.prototype.hasOwnProperty.call(crudo ?? {}, 'estado')
  const datos = cambiaEstado ? EstadoDeClase.parse(crudo) : EdicionDeClase.parse(crudo)

  // No se puede dejar afuera a alguien que ya reservó. La regla vive en
  // app/lib/clases.js, la misma que usa el panel: si acá fuera distinta, el
  // estudio tendría dos reglas según por dónde entre el pedido.
  if (!cambiaEstado) {
    const choque = await cupoQueDejaGenteAfuera(supabase, id, datos.cupo_total)
    if (choque.fallo) throw new Error('No se pudieron contar las reservas')
    if (choque.tomados !== undefined) {
      throw conflicto(
        'cupo_ocupado',
        `Esa clase ya tiene ${choque.tomados} reservas confirmadas: el cupo no puede quedar por debajo.`
      )
    }
  }

  const { data, error } = await supabase
    .from('clases')
    .update(datos)
    .eq('id', id)
    .select('id, fecha, hora, cupo_total, estado')

  if (error) {
    if (error.code === CODIGOS.AJENA) throw malPedido('El tipo de clase o la instructora no existen.')
    throw error
  }

  // Una escritura que RLS rechaza no devuelve error: devuelve cero filas. Acá
  // eso significa que la clase no existe, porque el rol ya se verificó arriba.
  if (data.length === 0) throw noEncontrado('No existe esa clase.')

  const c = data[0]
  return ok({ ...c, hora: sinSegundos(c.hora) })
})
