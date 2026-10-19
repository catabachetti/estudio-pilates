'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { clienteConSesion, usuarioActual } from '../lib/supabase-sesion'
import { esEmail } from '../lib/validacion'
import { esValida } from '../lib/contrasena'

// Pedir el correo de recuperación.
//
// LA RESPUESTA ES SIEMPRE LA MISMA, pase lo que pase. Si se distinguiera el
// caso "esa cuenta no existe" del caso "te mandamos el correo", el formulario
// se convertiría en una forma de averiguar quién está registrado en el estudio,
// que es justo lo que el resto del proyecto evita.
//
// Eso incluye los errores de infraestructura: si el envío falla, Supabase
// devuelve 500 y acá igual se contesta lo mismo. Durante las pruebas apareció
// justamente eso: con el correo roto, una cuenta registrada daba 500 y una
// inexistente daba 200, o sea que un problema de configuración se había
// convertido en una fuga de información.
export async function pedirRecuperacion(formData) {
  const email = String(formData.get('email') ?? '').trim()

  if (esEmail(email)) {
    const supabase = await clienteConSesion()
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      // Queda en el registro del servidor, no en la pantalla.
      console.error('No se pudo enviar el correo de recuperación:', error.message)
    }
  }

  redirect('/recuperar?estado=enviado')
}

// Elegir la contraseña nueva. Sirve para los dos casos: quien llegó por el
// enlace del correo y quien simplemente quiere cambiarla estando conectada.
export async function cambiarContrasena(formData) {
  const usuario = await usuarioActual()
  if (!usuario) redirect('/ingresar?volver=%2Fcuenta%2Fcontrasena')

  const contrasena = String(formData.get('contrasena') ?? '')

  // Las mismas cinco reglas que el registro, de la misma fuente.
  if (!esValida(contrasena)) redirect('/cuenta/contrasena?error=contrasena')

  const supabase = await clienteConSesion()
  const { error } = await supabase.auth.updateUser({ password: contrasena })

  if (error) {
    console.error('No se pudo cambiar la contraseña:', error.message)

    // Supabase rechaza repetir la contraseña que ya se tenía, y ese caso pasa
    // seguido: alguien que llega por el correo escribe la que recuerda. Sin
    // este mensaje queda un "no pudimos" genérico que no dice qué arreglar.
    const repetida = error.code === 'same_password'
    redirect(`/cuenta/contrasena?error=${repetida ? 'repetida' : 'guardar'}`)
  }

  revalidatePath('/', 'layout')
  // El parámetro es `r` porque es el que lee /cuenta. Con `estado` el aviso
  // no aparecía: se cambiaba la contraseña y la pantalla no decía nada.
  redirect('/cuenta?r=contrasena')
}
