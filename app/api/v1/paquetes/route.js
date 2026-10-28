import { manejador, ok } from '../../_lib/errores'
import { clienteSupabase } from '../../../lib/supabase'

// GET /api/v1/paquetes
//
// Sin parámetros: el catálogo entero son cuatro filas. Paginar algo que nunca
// va a crecer agrega una interfaz que nadie necesita.
export const GET = manejador(async () => {
  const { data, error } = await clienteSupabase()
    .from('paquetes')
    .select('id, nombre, clases, precio, dias_vigencia, incluye')
    .eq('activo', true)
    .order('orden')

  if (error) throw error

  return ok({ paquetes: data })
})
