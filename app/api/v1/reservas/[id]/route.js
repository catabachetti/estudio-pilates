import { manejador, ok, noEncontrado, conflicto } from '../../../_lib/errores'
import { paramsDeRuta, cuerpo } from '../../../_lib/pedido'
import { exigirSesion } from '../../../_lib/sesion'
import { Uuid, CambioDeReserva } from '../../../../lib/esquemas'
import { z } from 'zod'

const Params = z.object({ id: Uuid })

// PATCH /api/v1/reservas/{id}   {"estado":"cancelada"}
//
// POR QUÉ PATCH Y NO DELETE, que es lo que uno esperaría de "cancelar":
//
//   1. No se borra nada. La reserva queda con estado 'cancelada' y conserva el
//      historial, que es una decisión del esquema: `reservas` no tiene politica
//      de DELETE en ninguna parte del proyecto.
//   2. Hay una consecuencia que quien llama necesita saber: si el crédito
//      volvió o se perdió, según la ventana de cancelación. Un DELETE devuelve
//      204 sin cuerpo y no tendría dónde decirlo.
//
// En toda esta API no hay un solo DELETE, y es por el dominio: las reservas se
// cancelan, las clases se cancelan, los créditos no se quitan. La única
// política de DELETE del esquema es la de `lista_espera`, que todavía no
// existe. Inventar un endpoint destructivo para completar la tabla de verbos
// seria mentir sobre lo que el sistema hace.
export const PATCH = manejador(async (request, contexto) => {
  const { id } = await paramsDeRuta(contexto, Params)
  const { supabase } = await exigirSesion(request)

  // El esquema solo acepta {"estado":"cancelada"}. Reactivar una reserva no es
  // un PATCH: es reservar de nuevo, y eso vuelve a pasar por reservar_clase()
  // con su candado y su crédito.
  await cuerpo(request, CambioDeReserva)

  const { data, error } = await supabase.rpc('cancelar_reserva', { p_reserva_id: id })
  if (error) throw error

  const fila = data?.[0]
  if (!fila) throw new Error('cancelar_reserva() no devolvió nada')

  // `no_existe` cubre dos casos que la función no distingue a propósito: que la
  // reserva no exista, y que sea de otra persona. Distinguirlos le diría a
  // cualquiera qué ids de reserva son reales.
  if (fila.resultado === 'no_existe') throw noEncontrado('No encontramos esa reserva.')
  if (fila.resultado === 'ya_cancelada')
    throw conflicto('ya_cancelada', 'Esa reserva ya estaba cancelada.')

  return ok({
    id,
    estado: 'cancelada',
    credito_devuelto: fila.credito_devuelto,
  })
})
