import { manejador, ok } from '../../_lib/errores'
import { exigirSesion } from '../../_lib/sesion'
import { resumenDeCreditos } from '../../../lib/creditos'

// GET /api/v1/creditos
//
// El resumen de quien llama. Usa app/lib/creditos.js, el mismo que /cuenta y
// /admin/creditos: la regla de cuándo un crédito está tomado tiene que ser una
// sola, y ya se desincronizó una vez.
export const GET = manejador(async (request) => {
  const { supabase, usuario } = await exigirSesion(request)

  const resumen = await resumenDeCreditos(supabase, usuario.id)
  if (!resumen) throw new Error('No se pudo leer el resumen de créditos')

  return ok(resumen)
})
