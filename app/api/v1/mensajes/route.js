import {
  manejador,
  creado,
  demasiadosPedidos,
  malPedido,
  sinPermiso,
} from '../../_lib/errores'
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
  // UN NAVEGADOR EN OTRO SITIO NO PUEDE MANDAR ESTO.
  //
  // POR QUE HACE FALTA ACA Y NO EN EL RESTO DE LA API: Next compara el `Origin`
  // con el `Host` y rechaza las discrepancias, pero **eso cubre las Server
  // Actions, no los Route Handlers**. Medido el 7 de noviembre de 2026 con el
  // mismo `Origin: https://sitio-ajeno.example` contra los dos caminos:
  //
  //   POST /contacto        (Server Action)   500, rechazado
  //   POST /api/v1/mensajes (Route Handler)   201, aceptado
  //
  // A los demas endpoints eso no les importa: piden sesion, y la cookie es
  // `SameSite=Lax`, asi que no viaja en un POST de otro sitio. El unico
  // expuesto es este, que es el unico sin sesion.
  //
  // `Sec-Fetch-Site` lo pone el navegador, no quien escribe el pedido, y dice
  // de donde salio: `same-origin`, `same-site`, `none` (una barra de
  // direcciones) o `cross-site`. Solo se rechaza el ultimo.
  //
  // Y NO AFECTA A UN SCRIPT: curl y cualquier cliente que no sea un navegador
  // no mandan esa cabecera, asi que pasan. Por eso los ejemplos de curl de
  // docs/api.md siguen valiendo tal como estan escritos. Lo que bloquea es un
  // formulario alojado en otro dominio haciendo que sus visitantes manden
  // mensajes, que es lo unico que se podia hacer con esto.
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    throw sinPermiso('Este endpoint no acepta pedidos desde otro sitio.')
  }

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
