'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { clienteConSesion } from '../lib/supabase-sesion'
import { rutaInterna } from '../lib/rutas'
import { esEmail } from '../lib/validacion'
import { esValida } from '../lib/contrasena'
import { esperaPendiente, anotarFallo, olvidarFallos } from '../lib/intentos'

// Acciones de entrar y salir.
//
// Son Server Actions y los formularios las llaman directo, sin 'use client'.
// Next las envía con mejora progresiva: el formulario anda aunque el navegador
// tenga JavaScript desactivado, y en ese caso `redirect` devuelve un 303.
//
// Los errores no se devuelven como valor, porque mostrarlos así necesitaría
// useActionState, que es un hook de cliente. Van como parámetro en la URL y la
// página los traduce a un mensaje en castellano.

// Validación del lado del servidor para el REGISTRO. El formulario también
// valida en el navegador, pero eso es para la persona: cualquiera puede
// saltearlo mandando el pedido a mano, así que acá se vuelve a mirar todo.
//
// Las reglas salen de app/lib/contrasena.js, que copia las Password
// Requirements configuradas en Supabase. Las tres capas piden lo mismo para que
// nadie pase una y rebote contra otra con un error en inglés.
function validarRegistro({ email, contrasena, nombre }) {
  if (nombre.trim().length === 0) return 'nombre'
  if (!esEmail(email)) return 'email'
  if (!esValida(contrasena)) return 'contrasena'
  return null
}

// AL INGRESAR NO SE VALIDA LA FORTALEZA, y es a propósito. Las reglas de hoy
// son más estrictas que las de ayer: quien se registró antes tiene una
// contraseña que ya no pasaría, y rechazarla acá la dejaría afuera de su propia
// cuenta sin siquiera consultar a Supabase. Además le diría a cualquiera cuál
// es la política vigente. Lo único que se mira es que haya algo que mandar;
// quién decide es el servidor de auth.
function validarIngreso({ email, contrasena }) {
  if (!esEmail(email)) return 'credenciales'
  if (contrasena.length === 0) return 'credenciales'
  return null
}

export async function registrarse(formData) {
  const email = String(formData.get('email') ?? '').trim()
  const contrasena = String(formData.get('contrasena') ?? '')
  const nombre = String(formData.get('nombre') ?? '').trim()

  const falla = validarRegistro({ email, contrasena, nombre })
  if (falla) redirect(`/registro?error=${falla}`)

  const supabase = await clienteConSesion()
  const { data, error } = await supabase.auth.signUp({
    email,
    password: contrasena,
    // El perfil lo crea un trigger en la base, que lee este nombre de
    // raw_user_meta_data. Si no viaja acá, el perfil se crea sin nombre.
    options: { data: { nombre } },
  })

  if (error) {
    // El mensaje de Supabase no se muestra: viene en inglés y a veces dice si
    // el correo ya existe, que es justo lo que no queremos revelar.
    console.error('Error al registrar:', error.message)
    redirect('/registro?error=registro')
  }

  // Si el proyecto pide confirmar el correo, signUp no devuelve sesión: la
  // persona todavía no está adentro y tiene que abrir el mail.
  if (!data.session) {
    redirect('/ingresar?estado=confirma')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function ingresar(formData) {
  const email = String(formData.get('email') ?? '').trim()
  const contrasena = String(formData.get('contrasena') ?? '')

  // A dónde volver después de entrar. Viene de un campo oculto que a su vez
  // viene de la URL, así que lo escribe quien quiera: rutaInterna() lo rechaza
  // si no es una ruta de este sitio, y en ese caso se vuelve al inicio.
  // Sin esa validación, /ingresar?volver=https://sitio-falso.com usaría el
  // login del estudio para depositar a la persona en una copia del sitio.
  const volver = rutaInterna(formData.get('volver'))

  // Si la contraseña está mal hay que volver al formulario, y el destino tiene
  // que seguir viajando: si no, quien se equivoca una vez pierde a dónde iba.
  const alFormulario = (motivo) => {
    const parametros = new URLSearchParams({ error: motivo })
    if (volver) parametros.set('volver', volver)
    redirect(`/ingresar?${parametros}`)
  }

  if (validarIngreso({ email, contrasena })) alFormulario('credenciales')

  // Bloqueo progresivo tras varios fallos desde esta IP para este correo. Se
  // consulta ANTES de preguntarle a Supabase: si hay que esperar, no se gasta
  // un intento contra el servidor de auth.
  //
  // El mensaje es el mismo exista o no la cuenta, porque la tabla que lo decide
  // no sabe nada de cuentas: solo cuenta intentos.
  const aEsperar = (segundos) => {
    const parametros = new URLSearchParams({ error: 'espera', segundos: String(segundos) })
    if (volver) parametros.set('volver', volver)
    redirect(`/ingresar?${parametros}`)
  }

  const espera = await esperaPendiente(email)
  if (espera > 0) aEsperar(espera)

  const supabase = await clienteConSesion()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: contrasena,
  })

  if (error) {
    console.error('Error al ingresar:', error.message)
    const nuevaEspera = await anotarFallo(email)

    // Siempre el mismo error, exista o no ese correo. Distinguir los casos le
    // diría a cualquiera qué direcciones están registradas en el estudio.
    if (nuevaEspera > 0) aEsperar(nuevaEspera)
    alFormulario('credenciales')
  }

  // Entrar bien borra los fallos: nadie arrastra sus errores.
  await olvidarFallos(email)

  revalidatePath('/', 'layout')
  redirect(volver ?? '/')
}

export async function salir() {
  const supabase = await clienteConSesion()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
