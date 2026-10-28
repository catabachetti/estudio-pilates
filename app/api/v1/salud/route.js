import { manejador, ok } from '../../_lib/errores'
import { clienteSupabase } from '../../../lib/supabase'

// GET /api/v1/salud
//
// Para monitoreo externo. No es un "recurso" en el sentido REST, y es una
// excepción conocida: la convención manda igual, porque todo servicio de
// uptime espera encontrar algo así.
//
// Comprueba que la base responda, no solo que el servidor esté levantado: una
// aplicación que arranca pero no llega a Supabase está caída para quien la usa.
export const GET = manejador(async () => {
  const comienzo = Date.now()
  const { error } = await clienteSupabase()
    .from('paquetes')
    .select('id', { count: 'exact', head: true })

  return ok({
    estado: error ? 'degradado' : 'bien',
    base: error ? 'sin respuesta' : 'responde',
    ms: Date.now() - comienzo,
  })
})
