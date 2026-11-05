'use server'

import { redirect } from 'next/navigation'
import { clienteConSesion } from '../lib/supabase-sesion'
import { MensajeDeContacto } from '../lib/esquemas'
import { guardarMensaje } from '../lib/mensajes'

// EL RESPALDO SIN JAVASCRIPT DEL FORMULARIO DE CONTACTO, y no es un extra: es
// la condición que hace admisible que `FormularioDeContacto.jsx` sea un
// componente de cliente. Si el único camino fuera el `fetch`, el JavaScript
// sería funcional y la excepción violaría la regla del proyecto.
//
// Con JavaScript, el `onSubmit` del componente llama a `preventDefault()` y
// esta acción NO corre: el envío va por `POST /api/v1/mensajes`. Medido en Next
// 16.4.3 —con un control sin `preventDefault` que sí la ejecuta— y escrito en
// docs/arquitectura.md.
//
// Sin JavaScript, el navegador postea el formulario acá y esto es lo único que
// pasa.
export async function enviarMensaje(formData) {
  const crudo = {
    nombre: String(formData.get('nombre') ?? ''),
    email: String(formData.get('email') ?? ''),
    mensaje: String(formData.get('mensaje') ?? ''),
  }

  // El MISMO esquema que valida en el navegador y en la API. Acá no se puede
  // mostrar el error por campo —no hay a dónde ponerlo sin estado de cliente—
  // así que vuelve un motivo general por la URL, que es como lo hacen el resto
  // de las pantallas del sitio.
  const r = MensajeDeContacto.safeParse(crudo)
  if (!r.success) redirect('/contacto?m=invalido#contacto')

  const supabase = await clienteConSesion()
  const guardado = await guardarMensaje(r.data, supabase)

  if (!guardado.ok) redirect(`/contacto?m=${guardado.codigo}#contacto`)

  redirect('/contacto?m=ok#contacto')
}
