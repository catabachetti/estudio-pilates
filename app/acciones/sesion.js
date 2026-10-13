'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { clienteConSesion } from '../lib/supabase-sesion'

// Acciones de entrar y salir.
//
// Son Server Actions y los formularios las llaman directo, sin 'use client'.
// Next las envía con mejora progresiva: el formulario anda aunque el navegador
// tenga JavaScript desactivado, y en ese caso `redirect` devuelve un 303.
//
// Los errores no se devuelven como valor, porque mostrarlos así necesitaría
// useActionState, que es un hook de cliente. Van como parámetro en la URL y la
// página los traduce a un mensaje en castellano.

const MINIMO_CONTRASENA = 8

// Validación del lado del servidor. El formulario también valida en el
// navegador, pero eso es para la persona: cualquiera puede saltearlo mandando
// el pedido a mano, así que acá se vuelve a mirar todo.
function validar({ email, contrasena, nombre }) {
  if (nombre !== undefined && nombre.trim().length === 0) return 'nombre'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '')) return 'email'
  if ((contrasena ?? '').length < MINIMO_CONTRASENA) return 'contrasena'
  return null
}

export async function registrarse(formData) {
  const email = String(formData.get('email') ?? '').trim()
  const contrasena = String(formData.get('contrasena') ?? '')
  const nombre = String(formData.get('nombre') ?? '').trim()

  const falla = validar({ email, contrasena, nombre })
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

  if (validar({ email, contrasena })) redirect('/ingresar?error=credenciales')

  const supabase = await clienteConSesion()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: contrasena,
  })

  if (error) {
    console.error('Error al ingresar:', error.message)
    // Siempre el mismo error, exista o no ese correo. Distinguir los casos le
    // diría a cualquiera qué direcciones están registradas en el estudio.
    redirect('/ingresar?error=credenciales')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function salir() {
  const supabase = await clienteConSesion()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
