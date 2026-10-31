import { manejador, malPedido } from '../../_lib/errores'
import { exigirFirma, pagoQuePide, consultarPago, intencionDe, acreditar } from '../../_lib/pago'

// POST /api/webhooks/mercadopago
//
// El aviso de pago de Mercado Pago. Es la ÚNICA cosa que acredita créditos:
// las back_urls son informativas y no escriben nada, porque alguien puede
// cerrar la pestaña justo antes de volver y el pago igual se cobró.
//
// ESTÁ FUERA DE /api/v1 A PROPÓSITO. Los endpoints de /api/v1 son recursos
// nuestros, con un contrato que nosotros versionamos. Acá el contrato es de
// Mercado Pago: la forma del cuerpo, las cabeceras y los códigos que espera
// los decide ellos. Versionarlo con nuestros recursos daría a entender que
// podemos cambiarlo.
//
// EL ORDEN: SE PROCESA Y DESPUÉS SE RESPONDE, al contrario de lo que dice la
// diapositiva 13 ("Responder 200 -> Validar firma -> Consultar pago").
//
// No es por no poder: `after()` existe y es estable en la versión instalada
// (next/server), sirve en Route Handlers y corre incluso si la respuesta
// falló. Se midió y se descartó, porque para un webhook de pagos el orden de
// la diapositiva es incorrecto: los reintentos de Mercado Pago son la ÚNICA
// red de seguridad que hay. Si contestamos 200 y después Supabase no
// responde, Mercado Pago lo da por entregado y no reintenta nunca; un pago
// cobrado queda sin créditos y el único rastro es un console.error.
// Procesando antes, un fallo transitorio devuelve 500 y Mercado Pago
// reintenta.
//
// El canje, dicho: la respuesta tarda lo que tarde acreditar en vez de ser
// inmediata. Lo que SÍ iría en `after()` es el correo al comprador, que si
// falla no hay que reintentar.
//
// LA REGLA DE LOS CÓDIGOS, que es lo que decide si Mercado Pago reintenta:
// si reintentar puede arreglarlo, 500; si no, 200. Un 200 apaga los
// reintentos; cualquier otro código los enciende durante horas.

// El presupuesto de tiempo. Si se agota, la función corta y Mercado Pago
// reintenta, que es seguro: lo que no es seguro es contestar 200 antes de
// haber acreditado.
export const maxDuration = 15

export const POST = manejador(async (request) => {
  // 1. La firma primero, antes de leer el cuerpo y antes de hablar con nadie.
  //    Lanza 401 si no valida, y 500 si falta el secreto.
  const { dataId } = exigirFirma(request)

  // 2. El cuerpo, solo para saber de qué pago habla. No se le cree nada más.
  //
  // Un cuerpo que no es JSON no corta el pedido: el data.id puede venir en la
  // URL, y de hecho es de ahí de donde lo toma la firma. Por eso .catch(null)
  // y no un 400.
  const cuerpo = await request.json().catch(() => null)

  const { tipo, id } = pagoQuePide(cuerpo, dataId)

  // 3. Lo que no es un pago no nos interesa. Mercado Pago manda también avisos
  //    de merchant_order y otros según lo que esté suscripto: contestarles 200
  //    es decirle "recibido, no hace falta reintentar", que es la verdad.
  if (tipo !== 'payment') {
    console.log(`[webhook mp] aviso ignorado, type=${tipo ?? 'sin tipo'}`)
    return recibido({ ignorado: tipo ?? null })
  }

  if (!id) throw malPedido('Falta data.id: no se sabe de qué pago habla el aviso.')

  // 4. El estado real, consultado a la fuente financiera. Si esto falla, el
  //    error sube y el manejador devuelve 500: queremos el reintento.
  const pago = await consultarPago(id)

  // 5. Solo un pago acreditado acredita créditos.
  if (pago.status !== 'approved') {
    // Un reembolso o un contracargo llegan acá. Hoy NO HAY FORMA DE QUITAR
    // CRÉDITOS —es una deuda anotada en CLAUDE.md, y quitarlos no es simétrico
    // a otorgarlos porque hay que decidir qué pasa si ya se usaron para
    // reservar— así que se registra fuerte y se contesta 200: reintentar no
    // va a crear esa función.
    const grave = pago.status === 'refunded' || pago.status === 'charged_back'
    const linea = `[webhook mp] pago ${pago.id} en estado ${pago.status}, no se acredita`
    if (grave) {
      console.error(
        `${linea}. REVISAR A MANO: el crédito, si se acreditó antes, sigue puesto.`
      )
    } else {
      console.log(linea)
    }
    return recibido({ pago: pago.id, estado: pago.status, acreditado: false })
  }

  // 6. Quién compraba qué. Lo dice la external_reference, que es el id de la
  //    intención que anotó iniciarCompra().
  const intencion = await intencionDe(pago.external_reference)

  if (!intencion) {
    // No se acredita a ciegas. Puede ser una preferencia huérfana —creada y
    // con el insert de la intención fallado— o un pago de otra integración.
    // Reintentar no va a hacer aparecer la intención, así que 200 y queda
    // registrado con todo lo necesario para resolverlo a mano.
    console.error(
      `[webhook mp] pago ${pago.id} aprobado SIN INTENCIÓN: ` +
        `external_reference=${pago.external_reference ?? 'vacía'}. No se acreditó nada.`
    )
    return recibido({ pago: pago.id, acreditado: false, motivo: 'sin_intencion' })
  }

  // 7. Acreditar. Idempotente por el unique de compras.mp_payment_id: el
  //    segundo aviso del mismo pago devuelve ya_estaba y no duplica.
  const resultado = await acreditar({ intencion, pagoId: pago.id })

  console.log(
    resultado.yaEstaba
      ? `[webhook mp] pago ${pago.id} ya estaba acreditado (compra ${resultado.compraId})`
      : `[webhook mp] pago ${pago.id} acreditado: ${resultado.creditos} créditos ` +
          `(compra ${resultado.compraId})`
  )

  return recibido({
    pago: pago.id,
    acreditado: true,
    creditos: resultado.creditos,
    ya_estaba: resultado.yaEstaba,
  })
})

// Siempre 200 y siempre con cuerpo, aunque Mercado Pago no lo lea: el cuerpo
// es lo que se ve al probar con curl y lo que dice qué decidió el handler.
function recibido(datos) {
  return Response.json({ datos }, { status: 200 })
}
