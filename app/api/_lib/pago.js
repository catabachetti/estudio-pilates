import {
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
  MercadoPagoConfig,
  Payment,
} from 'mercadopago'
import { ErrorDeApi } from './errores'
import { clienteDeServicio } from '../../lib/supabase-servicio'
// esUuid sale de los esquemas, igual que en el resto del proyecto: tener una
// expresion regular propia aca seria una segunda definicion de "que es un
// uuid", y el dia que una cambie nadie se enteraria.
import { esUuid } from '../../lib/validacion'

// LAS PIEZAS DEL AVISO DE PAGO. La ruta las ordena y decide los códigos.
//
// Quien llama acá no es un navegador ni un script con sesión: es un servidor
// de Mercado Pago, que no tiene cuenta en el estudio. Se identifica firmando
// el pedido, que es un tercer mecanismo y no pasa por `clienteDeApi()`.

// Ventana de antigüedad de la firma. Si no se pasa, el validador NO controla
// la antigüedad: una notificación vieja y legítima se podría reenviar para
// siempre.
const TOLERANCIA_SEGUNDOS = 300

// El 401 del webhook NO usa noAutenticado(), por dos motivos.
//
// Uno: noAutenticado() agrega `WWW-Authenticate: Bearer`, y acá sería mentira.
// Mercado Pago no se identifica con un Bearer sino firmando, y no hay nada que
// pueda hacer con ese desafío.
//
// Dos: EL MOTIVO DEL RECHAZO NO VA EN LA RESPUESTA, solo al registro. Decirle
// a quien llama si falló el hash o si el timestamp estaba fuera de ventana le
// da un oráculo: no alcanza para falsificar un HMAC, pero sí para saber qué
// parte del intento estuvo bien. El motivo se registra junto al x-request-id,
// que es con lo que se encuentra la notificación en el panel de Mercado Pago.
const firmaInvalida = () =>
  new ErrorDeApi(401, 'firma_invalida', 'La firma del aviso no es válida.')

// VALIDAR LA FIRMA. Usa el validador oficial del SDK y no una copia hecha a
// mano: la documentación de Mercado Pago ya no publica la plantilla del
// manifest y remite al SDK, así que escribirla de memoria o de un blog es
// escribir una verificación que nadie garantiza.
//
// Lo que el SDK hace adentro, leído de su código:
//   manifest = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
// con los pares ausentes omitidos, HMAC-SHA256 en hex y comparación en tiempo
// constante.
export function exigirFirma(request) {
  const secreto = process.env.MP_WEBHOOK_SECRET

  // SIN SECRETO SE DEVUELVE 500, NO 200 NI 401.
  //
  // Es la decisión que más importa de este archivo. Un 200 daría por aceptado
  // un aviso que nadie verificó y Mercado Pago dejaría de reintentar: un pago
  // cobrado se perdería en silencio. Un 401 diría que la firma está mal,
  // cuando el que está mal es nuestro servidor. Con 500, Mercado Pago
  // reintenta durante horas, que es exactamente el tiempo que hace falta para
  // darse cuenta y cargar la variable.
  if (!secreto) {
    console.error(
      '[webhook mp] FALTA MP_WEBHOOK_SECRET. No se puede verificar el aviso. ' +
        'Se devuelve 500 a propósito para que Mercado Pago reintente y el ' +
        'pago no se pierda. La clave sale del panel: Tus Integraciones -> la ' +
        'aplicación -> Webhooks -> Configurar notificaciones.'
    )
    throw new Error('MP_WEBHOOK_SECRET no configurado')
  }

  const { searchParams } = new URL(request.url)

  // EL data.id VA TAL CUAL LO MANDÓ LA URL, sin buscarlo en el cuerpo si falta.
  // El manifest omite el par cuando el valor no está, así que la firma se
  // calculó con lo que haya en la query: completarlo desde el cuerpo cambiaría
  // el manifest y una firma legítima dejaría de coincidir.
  const dataId = searchParams.get('data.id')

  try {
    WebhookSignatureValidator.validate({
      xSignature: request.headers.get('x-signature'),
      xRequestId: request.headers.get('x-request-id'),
      dataId,
      secret: secreto,
      toleranceSeconds: TOLERANCIA_SEGUNDOS,
    })
  } catch (e) {
    if (e instanceof InvalidWebhookSignatureError) {
      // El motivo va al registro junto con el x-request-id, que es con lo que
      // se encuentra la notificación en el panel de Mercado Pago.
      console.error(
        `[webhook mp] firma rechazada: ${e.reason} (x-request-id: ${e.requestId ?? 'sin'})`
      )
      throw firmaInvalida()
    }
    throw e
  }

  return { dataId }
}

// EL CUERPO NO ESTÁ FIRMADO, así que no se le cree nada más que de qué pago
// habla. El estado real se consulta a la API de Mercado Pago, que es la fuente
// financiera. Es el error que la materia marca en la diapositiva 17.
export function pagoQuePide(cuerpo, dataIdDeLaUrl) {
  const tipo = cuerpo?.type ?? cuerpo?.topic ?? null
  const id = dataIdDeLaUrl ?? cuerpo?.data?.id ?? null
  return { tipo, id: id === null ? null : String(id) }
}

export async function consultarPago(id) {
  const token = process.env.MP_ACCESS_TOKEN
  if (!token) throw new Error('MP_ACCESS_TOKEN no configurado')

  const cliente = new MercadoPagoConfig({ accessToken: token })

  let pago
  try {
    pago = await new Payment(cliente).get({ id })
  } catch (e) {
    // UN 404 DE MERCADO PAGO TAMBIÉN DEVUELVE 500, Y ESTO NO ES OBVIO.
    //
    // Por la regla de los códigos ("si reintentar no lo arregla, 200"), un
    // pago que no existe parecería un 200: reintentar no lo va a crear.
    //
    // Pero el aviso llega a veces ANTES de que el pago se pueda consultar, por
    // la demora entre que Mercado Pago lo registra y lo publica en su API. En
    // ese caso el 404 es transitorio y el reintento es justamente lo que lo
    // arregla. Entre dar por procesado un pago que sí existía y reintentar al
    // vacío unas horas, el costo del primer error es un crédito perdido que
    // alguien pagó, y el del segundo son unos pedidos de más.
    //
    // Se distingue en el registro para que un 404 persistente se pueda
    // reconocer sin tener que deducirlo.
    const esNoEncontrado = e?.status === 404 || e?.name === 'MPNotFoundError'
    console.error(
      esNoEncontrado
        ? `[webhook mp] Mercado Pago no encuentra el pago ${id}. Si se repite ` +
            `durante horas, no es demora de replicación: revisar a mano.`
        : `[webhook mp] no se pudo consultar el pago ${id}: ${e?.message ?? e}`
    )
    throw e
  }

  if (!pago?.id) throw new Error(`Mercado Pago no devolvió el pago ${id}`)
  return pago
}

// La intención que armó iniciarCompra(), buscada por lo que Mercado Pago nos
// devolvió en external_reference.
//
// Se lee con la clave de servicio porque acá no hay sesión de nadie. Es solo
// una lectura: la escritura la hace otorgar_creditos().
export async function intencionDe(externalReference) {
  if (!esUuid(externalReference)) return null

  const { data, error } = await clienteDeServicio()
    .from('intenciones_de_pago')
    .select('id, user_id, paquete_id')
    .eq('id', externalReference)
    .maybeSingle()

  // Un fallo de lectura NO es "no existe": si Supabase no responde hay que
  // reintentar, no dar el aviso por procesado.
  if (error) throw new Error(`No se pudo leer la intención: ${error.message}`)
  return data
}

// Acreditar. Una sola llamada a la función de la base, que es idempotente por
// el unique de compras.mp_payment_id: dos avisos del mismo pago acreditan una
// vez. Acá no se cuenta ni se decide nada.
export async function acreditar({ intencion, pagoId }) {
  const { data, error } = await clienteDeServicio().rpc('otorgar_creditos', {
    p_user_id: intencion.user_id,
    p_paquete_id: intencion.paquete_id,
    p_mp_payment_id: String(pagoId),
  })

  if (error) throw new Error(`No se pudo acreditar: ${error.message}`)

  const fila = data?.[0]
  if (!fila) throw new Error('otorgar_creditos no devolvió nada')

  return {
    compraId: fila.compra_id,
    creditos: fila.creditos_creados,
    yaEstaba: fila.ya_estaba,
  }
}

