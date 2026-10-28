'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { clienteConSesion } from '../lib/supabase-sesion'
import { exigirAdmin } from '../lib/autorizacion'
import { cupoQueDejaGenteAfuera } from '../lib/clases'
import {
  esUuid,
  aEntero,
  esEnteroPositivo,
  esFecha,
  aHora,
  sinCambios,
  CODIGOS,
} from '../lib/validacion'

// Las cuatro escrituras de la agenda: crear, editar, cancelar y reactivar.
//
// Igual que en paquetes, cada una arranca con exigirAdmin() y vuelve a validar
// todo: una Server Action es una entrada al servidor como cualquier otra, no
// pasa por ningún layout y se puede invocar sin abrir la página.

const RUTA = '/admin/clases'

// QUÉ SE REVALIDA Y POR QUÉ TODO EL SITIO
//
// La tabla `clases` alimenta cuatro cosas:
//   agendaDeLaSemana()    /reservar
//   semanaTipo()          /horarios y la home
//   horariosDeAtencion()  el footer, que está en el layout raíz, o sea en
//                         TODAS las páginas
//   el tablero            /admin
//
// El footer es el que obliga a revalidar todo y no solo las dos páginas de la
// agenda: deriva el horario de atención de la grilla, así que cancelar la
// última clase de las 7 de un día cambia el pie de /contacto y de /terminos.
//
// AHORA BIEN, HOY ESTO NO ES LO QUE HACE QUE EL CAMBIO SE VEA. Está medido: con
// el sitio compilado y servido con `next start`, una escritura hecha directo en
// la base —sin que nadie llame a revalidatePath— ya aparece en la página
// siguiente. Todas las rutas son dinámicas porque el header lee cookies, y las
// lecturas de Supabase no entran al Data Cache: se consultan en cada pedido.
//
// Se deja igual por dos motivos. Uno, limpia el Router Cache del navegador, que
// es lo que podría devolver un payload viejo al navegar del panel al sitio. Y
// dos, el día que algo se cachee de verdad —cacheComponents, o un fetch con
// force-cache— esta línea es la diferencia entre publicar y no publicar, y no
// se va a acordar nadie de agregarla después.
function publicar(fecha) {
  revalidatePath('/', 'layout')
  // Y la pantalla del panel del día que se tocó, que es dinámica pero cuyo
  // payload el navegador puede tener guardado de una navegación anterior.
  revalidatePath(`${RUTA}`)
  if (fecha) revalidatePath(`${RUTA}?fecha=${fecha}`)
}

function volverA(fecha, parametros) {
  const q = new URLSearchParams({ ...(fecha ? { fecha } : {}), ...parametros })
  redirect(`${RUTA}?${q}`)
}

// Traduce lo que devuelve Postgres. Nunca se muestra el mensaje crudo: viene en
// inglés y nombra tablas y restricciones.
function motivoDeBase(error, { alCrear }) {
  if (error.code === CODIGOS.UNICO) return alCrear ? 'ocupada' : 'guardar'
  if (error.code === CODIGOS.AJENA) return 'inexistente'
  if (error.code === CODIGOS.CHEQUEO) return 'cupo'
  return 'guardar'
}

// Los campos que comparten crear y editar. La instructora es opcional: la
// columna admite null y una clase sin instructora asignada es válida.
function leerComunes(formData) {
  const instructora = String(formData.get('instructora_id') ?? '').trim()

  return {
    tipo_clase_id: String(formData.get('tipo_clase_id') ?? '').trim(),
    instructora_id: instructora === '' ? null : instructora,
    cupo_total: aEntero(formData.get('cupo_total')),
  }
}

function validarComunes({ tipo_clase_id, instructora_id, cupo_total }) {
  if (!esUuid(tipo_clase_id)) return 'tipo'
  if (instructora_id !== null && !esUuid(instructora_id)) return 'instructora'
  if (!esEnteroPositivo(cupo_total)) return 'cupo'
  return null
}

export async function crearClase(formData) {
  await exigirAdmin(RUTA)

  const fecha = String(formData.get('fecha') ?? '').trim()
  const hora = aHora(formData.get('hora'))
  const comunes = leerComunes(formData)

  if (!esFecha(fecha)) volverA(null, { error: 'fecha' })
  if (!hora) volverA(fecha, { error: 'hora' })

  const falla = validarComunes(comunes)
  if (falla) volverA(fecha, { error: falla })

  const supabase = await clienteConSesion()
  const resultado = await supabase
    .from('clases')
    .insert({ fecha, hora, ...comunes })
    .select('id')

  if (sinCambios(resultado)) volverA(fecha, { error: 'permiso' })

  if (resultado.error) {
    console.error('No se pudo crear la clase:', resultado.error.message)
    volverA(fecha, { error: motivoDeBase(resultado.error, { alCrear: true }) })
  }

  publicar(fecha)
  volverA(fecha, { estado: 'creada' })
}

export async function editarClase(formData) {
  await exigirAdmin(RUTA)

  const id = String(formData.get('id') ?? '')
  const fecha = String(formData.get('fecha') ?? '').trim()
  if (!esUuid(id)) volverA(esFecha(fecha) ? fecha : null, { error: 'id' })

  const comunes = leerComunes(formData)
  const falla = validarComunes(comunes)
  if (falla) volverA(fecha, { error: falla })

  const supabase = await clienteConSesion()

  // No se puede dejar gente afuera de una clase que ya reservó. Esta cuenta se
  // lee y después se escribe, así que entre las dos cosas alguien podría
  // reservar y el cupo quedaría uno abajo. Está anotado como deuda: con seis
  // lugares y una sola persona administrando, la ventana es teórica. Cuando
  // existan las reservas, esa misma carrera sí importa y la verificación y la
  // escritura van a tener que ir en una sola sentencia.
  const choque = await cupoQueDejaGenteAfuera(supabase, id, comunes.cupo_total)
  if (choque.fallo) volverA(fecha, { error: 'guardar' })
  if (choque.tomados !== undefined) {
    volverA(fecha, { error: 'cupo-ocupado', reservas: String(choque.tomados) })
  }

  const resultado = await supabase
    .from('clases')
    .update(comunes)
    .eq('id', id)
    .select('id')

  if (sinCambios(resultado)) volverA(fecha, { error: 'permiso' })

  if (resultado.error) {
    console.error('No se pudo editar la clase:', resultado.error.message)
    volverA(fecha, { error: motivoDeBase(resultado.error, { alCrear: false }) })
  }

  publicar(fecha)
  volverA(fecha, { estado: 'guardada' })
}

// Cancelar y reactivar son la misma escritura con distinto valor, pero van
// separadas: el formulario manda el estado nuevo y la acción no tiene que leer
// la fila para saber qué hacer.
export async function cambiarEstadoClase(formData) {
  await exigirAdmin(RUTA)

  const id = String(formData.get('id') ?? '')
  const fecha = String(formData.get('fecha') ?? '').trim()
  const estado = String(formData.get('estado') ?? '')

  if (!esUuid(id)) volverA(esFecha(fecha) ? fecha : null, { error: 'id' })
  if (estado !== 'programada' && estado !== 'cancelada') {
    volverA(fecha, { error: 'guardar' })
  }

  const supabase = await clienteConSesion()
  const resultado = await supabase
    .from('clases')
    .update({ estado })
    .eq('id', id)
    .select('id')

  if (sinCambios(resultado)) volverA(fecha, { error: 'permiso' })

  if (resultado.error) {
    console.error('No se pudo cambiar el estado de la clase:', resultado.error.message)
    volverA(fecha, { error: 'guardar' })
  }

  publicar(fecha)
  volverA(fecha, { estado: estado === 'cancelada' ? 'cancelada' : 'reactivada' })
}
