import { manejador, creado, demasiadosPedidos, malPedido } from '../../_lib/errores'
import { clienteDeApi } from '../../_lib/sesion'
import { MensajeDeContacto } from '../../../lib/esquemas'
import { cuerpo } from '../../_lib/pedido'
import { guardarMensaje } from '../../../lib/mensajes'

// POST /api/v1/mensajes
//
// SIN SESIÓN A PROPÓSITO, y es el único POST de la API que no la pide: un
// formulario de contacto es para quien todavía no tiene cuenta. Lo que lo
// protege no es la autenticación, es el límite por correo que vive adentro de
// `enviar_mensaje()` — ver la migración 014, que también explica lo que ese
// límite NO hace.
//
// Es el endpoint que usa el formulario de /contacto cuando hay JavaScript. Es
// también el primero de la API que un consumidor propio llama de verdad: el
// resto sigue siendo el ejercicio que docs/api.md §1 declara.
export const POST = manejador(async (request) => {
  const datos = await cuerpo(request, MensajeDeContacto)

  // El cliente de la API, no el de sesión: así `auth.uid()` queda con la
  // persona cuando el pedido trae cookie o Bearer, y en null cuando no.
  const supabase = await clienteDeApi(request)
  const guardado = await guardarMensaje(datos, supabase)

  if (!guardado.ok) {
    // 429 y no 400: el pedido estaba bien, lo que falló es cuántos van. Un 400
    // le diría a quien llama que corrija los datos, y los datos estaban bien.
    if (guardado.codigo === 'demasiados') throw demasiadosPedidos(guardado.mensaje, 3600)
    throw malPedido(guardado.mensaje)
  }

  // Sin `Location`: no hay un GET de un mensaje. La tabla no es legible más que
  // para administración, así que devolver una URL que nadie puede pedir sería
  // mentir en una cabecera.
  return creado({ enviado: true })
})
