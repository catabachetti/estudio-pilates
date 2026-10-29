import { manejador, ok, creado, conflicto, noEncontrado } from '../../_lib/errores'
import { paramsDeConsulta, cuerpo } from '../../_lib/pedido'
import { exigirSesion } from '../../_lib/sesion'
import { NuevaReserva, FiltroDeReservas } from '../../../lib/esquemas'
import { sinSegundos } from '../../../datos/agenda'

// CÓMO SE TRADUCE EL RESULTADO DE reservar_clase() A HTTP.
//
// La función de la base devuelve una palabra. Acá no se decide nada: se traduce.
// Toda la lógica —el candado sobre la fila de la clase, el crédito que vence
// primero, el `skip locked`— vive en la migración 011 y corre en una sola
// transacción. Repetir cualquier parte de eso acá seria volver a abrir la
// carrera que esa funcion existe para cerrar.
const COMO_HTTP = {
  completa: () => conflicto('clase_completa', 'Esa clase ya no tiene lugares.'),
  ya_reservada: () => conflicto('ya_reservada', 'Ya tenías reservada esa clase.'),
  sin_creditos: () =>
    conflicto('sin_creditos', 'No te quedan créditos disponibles. Comprá un paquete.'),
  ya_paso: () => conflicto('clase_pasada', 'Esa clase ya empezó.'),
  no_disponible: () => noEncontrado('Esa clase no está disponible.'),
}

// GET /api/v1/reservas?estado=confirmada
//
// Devuelve las de quien llama. El filtro por `user_id` es explícito y NO es
// redundante: la política de `reservas` dice `user_id = auth.uid() or
// es_admin()`, así que para una cuenta de administración RLS devolvería las de
// todo el mundo. Esa confusión ya se arregló una vez en /cuenta.
export const GET = manejador(async (request) => {
  const { supabase, usuario } = await exigirSesion(request)
  const { estado, fecha } = paramsDeConsulta(request, FiltroDeReservas)

  // `clases!inner` y no `clases`: con el join externo, filtrar por la fecha de
  // la clase no se puede, y el filtro se descartaria en silencio. Es inner y no
  // cambia nada mas porque `reservas.clase_id` es una clave ajena obligatoria:
  // no hay reserva sin clase.
  let consulta = supabase
    .from('reservas')
    .select('id, estado, clases!inner (id, fecha, hora, estado, tipos_clase (nombre))')
    .eq('user_id', usuario.id)

  if (estado) consulta = consulta.eq('estado', estado)
  if (fecha) consulta = consulta.eq('clases.fecha', fecha)

  const { data, error } = await consulta
  if (error) throw error

  return ok({
    reservas: data.map((r) => ({
      id: r.id,
      estado: r.estado,
      clase: {
        id: r.clases.id,
        fecha: r.clases.fecha,
        hora: sinSegundos(r.clases.hora),
        estado: r.clases.estado,
        nombre: r.clases.tipos_clase?.nombre ?? null,
      },
    })),
  })
})

// POST /api/v1/reservas
//
// BODY: el cuerpo lleva la estructura. Crear una reserva no se identifica por
// URL —todavía no existe— así que el dato va adentro.
export const POST = manejador(async (request) => {
  const { supabase } = await exigirSesion(request)
  const { clase_id } = await cuerpo(request, NuevaReserva)

  const { data, error } = await supabase.rpc('reservar_clase', { p_clase_id: clase_id })
  if (error) throw error

  const { resultado, reserva_id } = data?.[0] ?? {}

  if (resultado !== 'ok') {
    const construir = COMO_HTTP[resultado]
    if (!construir) throw new Error(`reservar_clase() devolvió algo inesperado: ${resultado}`)
    throw construir()
  }

  // 201 con Location, que es lo que corresponde al crear un recurso.
  return creado({ id: reserva_id, estado: 'confirmada' }, `/api/v1/reservas/${reserva_id}`)
})
