import { manejador } from '../../_lib/errores'
import { clienteSupabase } from '../../../lib/supabase'

// GET /api/v1/salud
//
// Para monitoreo externo. No es un "recurso" en el sentido REST, y es una
// excepción conocida: la convención manda igual, porque todo servicio de
// uptime espera encontrar algo así.
//
// Comprueba que la base responda, no solo que el servidor esté levantado: una
// aplicación que arranca pero no llega a Supabase está caída para quien la usa.
//
// EL CÓDIGO HTTP TIENE QUE CAMBIAR, NO SOLO EL CUERPO. Un servicio de uptime
// mira el código y nada más: si con la base caída esto devolviera 200 con
// `{"estado":"degradado"}` adentro, el monitoreo diría que todo está bien y la
// única consecuencia de haber comprobado la base sería un campo que nadie lee.
// Por eso el camino degradado devuelve 503.
//
// No usa ok() justamente por eso, y no lanza un ErrorDeApi porque esto no es un
// error de quien llama: la respuesta es informativa y tiene cuerpo propio en
// los dos casos.
export const GET = manejador(async () => {
  const comienzo = Date.now()
  const { error } = await clienteSupabase()
    .from('paquetes')
    .select('id', { count: 'exact', head: true })

  const cuerpo = {
    estado: error ? 'degradado' : 'bien',
    base: error ? 'sin respuesta' : 'responde',
    ms: Date.now() - comienzo,
  }

  return Response.json({ datos: cuerpo }, {
    status: error ? 503 : 200,
    // Un 503 sin Retry-After le dice al monitoreo "volvé cuando quieras", y lo
    // que suele hacer entonces es reintentar en seguida y amplificar la caída.
    headers: error ? { 'Retry-After': '30', 'Cache-Control': 'no-store' } : { 'Cache-Control': 'no-store' },
  })
})
