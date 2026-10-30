// Comprueba que Mercado Pago acepte el cuerpo de la preferencia que arma
// iniciarCompra(), y que devuelva lo que el resto del flujo necesita.
//
// OJO: ESTE SCRIPT LLAMA A LA API DE VERDAD y crea preferencias reales con tu
// MP_ACCESS_TOKEN. No mueve dinero —una preferencia es solo la descripcion de
// un cobro, y caduca sola— pero no es una prueba offline como las otras de
// esta carpeta.
//
// Las back_urls apuntan a una URL inventada a proposito: Mercado Pago no
// valida que exista, pero si rechaza `auto_return` cuando la URL de exito no
// es publica, asi que con localhost esto no se puede probar.
//
// Uso:  node docs/ejemplos/probar-preferencia.mjs

import { MercadoPagoConfig, Preference } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim()
}

const base = 'https://estudio-pilates-prueba.vercel.app'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
const { data: paquete } = await sb.from('paquetes')
  .select('id, nombre, precio, incluye').eq('activo', true).order('orden').limit(1).single()

const intencionId = crypto.randomUUID()
const cliente = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })

const p = await new Preference(cliente).create({
  body: {
    items: [{ id: paquete.id, title: paquete.nombre, description: paquete.incluye ?? undefined,
              quantity: 1, unit_price: paquete.precio, currency_id: 'ARS' }],
    payer: { email: 'prueba@ejemplo.com' },
    back_urls: { success: `${base}/compra/listo`, pending: `${base}/compra/pendiente`, failure: `${base}/compra/rechazada` },
    auto_return: 'approved',
    external_reference: intencionId,
    notification_url: `${base}/api/webhooks/mercadopago`,
    statement_descriptor: 'ACTIVE PILATES',
  },
  requestOptions: { idempotencyKey: intencionId },
})

console.log(`  paquete:             ${paquete.nombre} — $${paquete.precio}`)
console.log(`  preference id:       ${p.id}`)
console.log(`  external_reference:  ${p.external_reference === intencionId ? 'vuelve igual que el que mandamos' : 'NO COINCIDE'}`)
console.log(`  init_point:          ${new URL(p.init_point).origin}${new URL(p.init_point).pathname}`)
console.log(`  sandbox_init_point:  ${p.sandbox_init_point ? new URL(p.sandbox_init_point).origin : '(no vino)'}`)
console.log(`  auto_return:         ${p.auto_return}`)
console.log(`  notification_url:    ${p.notification_url}`)
console.log(`  items:               ${p.items.length}, unit_price=${p.items[0].unit_price}, moneda=${p.items[0].currency_id}`)
console.log(`  back_urls.success:   ${p.back_urls.success}`)

// IDEMPOTENCIA: con la MISMA clave y el MISMO cuerpo, que es la condicion que
// pide. La primera version de esta prueba mandaba un cuerpo distinto en la
// segunda llamada, asi que no probaba nada: un resultado distinto podia ser por
// el cuerpo y no por la clave.
//
// Medido el 30 de octubre de 2026: Mercado Pago devuelve DOS preferencias
// distintas. La idempotencyKey no hace nada para preferencias, y por eso
// iniciarCompra() no la manda.
const clave = crypto.randomUUID()
const cuerpoIgual = {
  items: [{ title: 'Prueba de idempotencia', quantity: 1, unit_price: 100, currency_id: 'ARS' }],
  back_urls: { success: `${base}/compra/listo` },
  external_reference: clave,
  notification_url: `${base}/api/webhooks/mercadopago`,
}
const a = await new Preference(cliente).create({ body: cuerpoIgual, requestOptions: { idempotencyKey: clave } })
const b = await new Preference(cliente).create({ body: cuerpoIgual, requestOptions: { idempotencyKey: clave } })
console.log(`  misma clave, mismo cuerpo: ${a.id === b.id ? 'devuelve la misma -> FUNCIONA' : 'crea otra -> NO funciona, y por eso no se usa'}`)

// De quien es el token: con una cuenta de prueba no se mueve dinero real.
const quien = await (await fetch('https://api.mercadopago.com/users/me', {
  headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
})).json()
console.log(`  el token es de una cuenta de prueba: ${Array.isArray(quien.tags) && quien.tags.includes('test_user')}  (tags: ${JSON.stringify(quien.tags)})`)
