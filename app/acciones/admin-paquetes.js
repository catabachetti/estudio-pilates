'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { clienteConSesion } from '../lib/supabase-sesion'
import { exigirAdmin } from '../lib/autorizacion'

// Las dos escrituras del panel de paquetes.
//
// Una Server Action es una entrada al servidor como cualquier otra: no pasa por
// ningún layout y se puede invocar sin abrir la página. Por eso las dos
// arrancan con exigirAdmin() y las dos vuelven a validar todo, aunque el
// formulario ya valide en el navegador. Lo del navegador es para la persona que
// escribe; lo de acá es lo único que la base va a creer.

const RUTA = '/admin/paquetes'
const LARGO_NOMBRE = 60

// Los ids vienen de un campo oculto, así que pueden venir con cualquier cosa.
// Mandarle basura a Postgres en una columna uuid da un error de tipo, que es
// ruido en los registros por algo que se puede descartar antes.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Number('') devuelve 0 y Number('12 clases') devuelve NaN. Ninguna de las dos
// cosas puede terminar en la base como si fuera un número válido, así que se
// exige que el texto sean solo dígitos antes de convertirlo.
function aEntero(valor) {
  const texto = String(valor ?? '').trim()
  if (!/^\d+$/.test(texto)) return NaN
  return Number(texto)
}

function esEnteroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0
}

function validar({ nombre, precio, clases, dias_vigencia }) {
  if (nombre.length === 0 || nombre.length > LARGO_NOMBRE) return 'nombre'
  if (!esEnteroPositivo(precio)) return 'precio'
  if (!esEnteroPositivo(clases)) return 'clases'
  if (!esEnteroPositivo(dias_vigencia)) return 'vigencia'
  return null
}

// Las dos páginas públicas que muestran precios. Sin esto, /paquetes seguiría
// sirviendo el precio viejo hasta una hora, porque tiene revalidate = 3600.
function publicar() {
  revalidatePath('/paquetes')
  revalidatePath('/')
}

// Una actualización que RLS rechaza no devuelve error: devuelve que no cambió
// ninguna fila, porque para la política esa fila no existe. Sin pedir de vuelta
// lo actualizado, un rechazo de permisos se vería igual que un "guardado".
function sinCambios(resultado) {
  return !resultado.error && resultado.data?.length === 0
}

export async function editarPaquete(formData) {
  await exigirAdmin(RUTA)

  const id = String(formData.get('id') ?? '')
  if (!UUID.test(id)) redirect(`${RUTA}?error=id`)

  const datos = {
    nombre: String(formData.get('nombre') ?? '').trim(),
    precio: aEntero(formData.get('precio')),
    clases: aEntero(formData.get('clases')),
    dias_vigencia: aEntero(formData.get('dias_vigencia')),
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
    // 23505 es la violación de una restricción unique: ya existe otro paquete
    // con ese nombre, que es unique desde la migración 005.
    redirect(`${RUTA}?error=${resultado.error.code === '23505' ? 'repetido' : 'guardar'}`)
  }

  publicar()
  redirect(`${RUTA}?estado=guardado`)
}

export async function cambiarActivo(formData) {
  await exigirAdmin(RUTA)

  const id = String(formData.get('id') ?? '')
  if (!UUID.test(id)) redirect(`${RUTA}?error=id`)

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
