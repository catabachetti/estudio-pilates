// Prueba el webhook de Mercado Pago SIN DEPLOYAR Y SIN PAGAR NADA.
//
// La idea: la firma la calculamos nosotros con la misma clave secreta que el
// handler, porque el HMAC es simétrico. Así se puede probar todo el camino de
// verificación contra localhost, que es la parte que no hace falta que Mercado
// Pago ejecute de verdad.
//
// Lo único que NO se puede probar así es la consulta del pago: eso necesita un
// payment_id real del sandbox, que sale de pagar una vez con tarjeta de prueba
// en un preview de Vercel. Con ese id, este script lo puede reenviar cuantas
// veces quiera con firmas nuevas.
//
// Uso:
//   MP_WEBHOOK_SECRET=lo-que-sea node docs/ejemplos/probar-webhook.mjs
//   PAGO=123456789 node docs/ejemplos/probar-webhook.mjs    (con un pago real)
//
// El servidor tiene que estar levantado CON LA MISMA clave:
//   MP_WEBHOOK_SECRET=lo-que-sea npx next start -p 3001
import { createHmac } from 'node:crypto'

const URL_BASE = process.env.URL_BASE ?? 'http://localhost:3001'
const RUTA = '/api/webhooks/mercadopago'
const SECRETO = process.env.MP_WEBHOOK_SECRET
const PAGO = process.env.PAGO ?? '1234567890'

if (!SECRETO) {
  console.error('Falta MP_WEBHOOK_SECRET. Poné cualquier valor, pero el mismo que el servidor.')
  process.exit(1)
}

// El manifest, igual que lo arma el SDK: los pares ausentes se omiten y el
// punto y coma final va siempre.
function firmar({ dataId, requestId, ts, secreto = SECRETO }) {
  const partes = []
  if (dataId) partes.push(`id:${dataId}`)
  if (requestId) partes.push(`request-id:${requestId}`)
  partes.push(`ts:${ts}`)
  const manifest = partes.join(';') + ';'
  return createHmac('sha256', secreto).update(manifest).digest('hex')
}

const ahora = () => Math.floor(Date.now() / 1000)

async function avisar({
  nombre,
  dataId = PAGO,
  tipo = 'payment',
  ts = ahora(),
  requestId = crypto.randomUUID(),
  firma,          // undefined => se calcula; null => no se manda el header
  firmaCruda,     // el valor literal del header x-signature, sin envolverlo
  sinRequestId = false,
  cuerpo,
  esperado,
}) {
  const url = new URL(RUTA, URL_BASE)
  if (dataId !== undefined && dataId !== null) url.searchParams.set('data.id', dataId)
  if (tipo) url.searchParams.set('type', tipo)

  const cabeceras = { 'Content-Type': 'application/json' }
  // Sin x-request-id a proposito en un caso: el manifest omite el par cuando
  // el valor no esta, asi que la firma se calcula sin el y tiene que validar
  // igual. Es la regla del SDK que mas facil se rompe al copiarla a mano.
  if (!sinRequestId) cabeceras['x-request-id'] = requestId

  if (firmaCruda !== undefined) {
    cabeceras['x-signature'] = firmaCruda
  } else if (firma !== null) {
    const v1 = firma ?? firmar({ dataId, requestId: sinRequestId ? undefined : requestId, ts })
    cabeceras['x-signature'] = `ts=${ts},v1=${v1}`
  }

  const r = await fetch(url, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify(cuerpo ?? { action: 'payment.updated', type: tipo, data: { id: dataId } }),
  })

  const texto = await r.text()
  let detalle = texto.slice(0, 74)
  try {
    const j = JSON.parse(texto)
    detalle = JSON.stringify(j.datos ?? j.error).slice(0, 74)
  } catch { /* el not-found devuelve HTML */ }

  const ok = esperado === undefined || r.status === esperado
  console.log(
    `  ${ok ? 'ok ' : 'MAL'}  ${nombre.padEnd(42)} ${r.status}` +
      `${esperado !== undefined && !ok ? ` (esperaba ${esperado})` : ''}  ${detalle}`
  )
  return { status: r.status, ok }
}

console.log(`=== contra ${URL_BASE}${RUTA} ===`)
console.log()
console.log('--- la firma: lo que tiene que rechazar')
const fallos = []
fallos.push(await avisar({ nombre: 'sin header x-signature', firma: null, esperado: 401 }))
fallos.push(await avisar({ nombre: 'firma con otra clave', firma: firmar({ dataId: PAGO, requestId: 'x', ts: ahora(), secreto: 'otra-clave' }), esperado: 401 }))
fallos.push(await avisar({ nombre: 'firma alterada', firma: 'f'.repeat(64), esperado: 401 }))
fallos.push(await avisar({ nombre: 'hash incorrecto', firma: 'f'.repeat(63) + 'e', esperado: 401 }))
fallos.push(await avisar({ nombre: 'header sin ts ni v1', firmaCruda: 'esto-no-es-una-firma', esperado: 401 }))
fallos.push(await avisar({ nombre: 'header con v1 pero sin ts', firmaCruda: 'v1=' + 'a'.repeat(64), esperado: 401 }))
fallos.push(await avisar({ nombre: 'ts que no es un numero', firmaCruda: 'ts=ayer,v1=' + 'a'.repeat(64), esperado: 401 }))
fallos.push(await avisar({ nombre: 'ts de hace una hora (replay)', ts: ahora() - 3600, esperado: 401 }))
fallos.push(await avisar({ nombre: 'ts del futuro lejano', ts: ahora() + 3600, esperado: 401 }))

console.log()
console.log('--- la firma vale, y despues se decide')
fallos.push(await avisar({ nombre: 'type=merchant_order (se ignora)', tipo: 'merchant_order', esperado: 200 }))
// Sin x-request-id: el manifest queda "id:<...>;ts:<...>;" y tiene que validar.
// Si validara mal, este caso daria 401 en vez de 500.
fallos.push(await avisar({ nombre: 'firma valida SIN x-request-id', sinRequestId: true, esperado: 500 }))
fallos.push(await avisar({ nombre: 'sin data.id', dataId: null, tipo: 'payment', cuerpo: { type: 'payment' }, esperado: 400 }))

console.log()
console.log('--- un pago que Mercado Pago no encuentra')
console.log('    (500 a proposito: el aviso puede llegar antes de que el pago se')
console.log('     pueda consultar, y ahi el reintento es lo que lo arregla)')
fallos.push(await avisar({ nombre: `pago inexistente (${PAGO})`, esperado: 500 }))

console.log()
const malos = fallos.filter((f) => !f.ok).length
console.log(malos === 0 ? 'TODO OK' : `${malos} caso(s) MAL`)
process.exit(malos === 0 ? 0 : 1)
