'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { clienteConSesion } from '../lib/supabase-sesion'
import { exigirAdmin } from '../lib/autorizacion'
import {
  esUuid,
  aEntero,
  esEnteroPositivo,
  sinCambios,
  CODIGOS,
} from '../lib/validacion'

// Las dos escrituras del panel de paquetes.
//
// Una Server Action es una entrada al servidor como cualquier otra: no pasa por
// ningún layout y se puede invocar sin abrir la página. Por eso las dos
// arrancan con exigirAdmin() y las dos vuelven a validar todo, aunque el
// formulario ya valide en el navegador. Lo del navegador es para la persona que
// escribe; lo de acá es lo único que la base va a creer.

const RUTA = '/admin/paquetes'
const LARGO_NOMBRE = 60
const LARGO_INCLUYE = 200

function validar({ nombre, precio, clases, dias_vigencia, incluye, orden }) {
  if (nombre.length === 0 || nombre.length > LARGO_NOMBRE) return 'nombre'
  if (!esEnteroPositivo(precio)) return 'precio'
  if (!esEnteroPositivo(clases)) return 'clases'
  if (!esEnteroPositivo(dias_vigencia)) return 'vigencia'
  if (incluye !== null && incluye.length > LARGO_INCLUYE) return 'incluye'
  // El orden sí admite cero: es el valor por omisión de la columna y significa
  // "sin preferencia". Por eso no usa esEnteroPositivo.
  if (!Number.isInteger(orden) || orden < 0) return 'orden'
  return null
}

// Las dos páginas públicas que muestran precios.
//
// Medido: hoy el precio nuevo se ve igual sin esta llamada, porque las dos
// rutas son dinámicas y leen Supabase en cada pedido. El `revalidate = 3600`
// de /paquetes no alcanza a estas lecturas. Se deja porque limpia el Router
// Cache del navegador y porque es la línea que va a hacer falta el día que
// algo se cachee de verdad. El motivo está largo en app/acciones/admin-clases.js.
function publicar() {
  revalidatePath('/paquetes')
  revalidatePath('/')
}

export async function editarPaquete(formData) {
  await exigirAdmin(RUTA)

  const id = String(formData.get('id') ?? '')
  if (!esUuid(id)) redirect(`${RUTA}?error=id`)

  const incluye = String(formData.get('incluye') ?? '').trim()

  const datos = {
    nombre: String(formData.get('nombre') ?? '').trim(),
    precio: aEntero(formData.get('precio')),
    clases: aEntero(formData.get('clases')),
    dias_vigencia: aEntero(formData.get('dias_vigencia')),
    // La columna admite null, y un texto vacío no es lo mismo que "sin
    // descripción": la tarjeta pregunta si hay algo, no si está en blanco.
    incluye: incluye === '' ? null : incluye,
    orden: aEntero(formData.get('orden')),
  }

  const falla = validar(datos)
  if (falla) redirect(`${RUTA}?error=${falla}`)

  const supabase = await clienteConSesion()
  const resultado = await supabase
    .from('paquetes')
    .update(datos)
    .eq('id', id)
    .select('id')

  if (sinCambios(resultado)) redirect(`${RUTA}?error=permiso`)

  if (resultado.error) {
    console.error('No se pudo editar el paquete:', resultado.error.message)
    // Si viola el unique de nombre, ya existe otro paquete así llamado. Es
    // unique desde la migración 005.
    redirect(
      `${RUTA}?error=${resultado.error.code === CODIGOS.UNICO ? 'repetido' : 'guardar'}`
    )
  }

  publicar()
  redirect(`${RUTA}?estado=guardado`)
}

export async function cambiarActivo(formData) {
  await exigirAdmin(RUTA)

  const id = String(formData.get('id') ?? '')
  if (!esUuid(id)) redirect(`${RUTA}?error=id`)

  // El campo oculto trae el valor nuevo, no el actual: así la acción no tiene
  // que volver a leer la fila para saber qué hacer.
  const activo = formData.get('activo') === 'true'

  const supabase = await clienteConSesion()
  const resultado = await supabase
    .from('paquetes')
    .update({ activo })
    .eq('id', id)
    .select('id')

  if (sinCambios(resultado)) redirect(`${RUTA}?error=permiso`)

  if (resultado.error) {
    console.error('No se pudo cambiar el estado del paquete:', resultado.error.message)
    redirect(`${RUTA}?error=guardar`)
  }

  publicar()
  redirect(`${RUTA}?estado=${activo ? 'activado' : 'desactivado'}`)
}
