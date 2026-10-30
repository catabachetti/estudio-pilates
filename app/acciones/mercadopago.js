'use server'

import { redirect } from 'next/navigation'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { clienteConSesion, usuarioActual } from '../lib/supabase-sesion'
import { clienteSupabase } from '../lib/supabase'
import { esUuid } from '../lib/validacion'
import { urlDelSitio } from '../datos/sitio'

// Empezar a comprar un paquete: crea la preferencia en Mercado Pago y manda a
// la persona al Checkout Pro.
//
// ESTO NO ACREDITA NADA. Acá solo se deja anotado quién quiso comprar qué y se
// delega el cobro. El crédito lo acredita el webhook cuando Mercado Pago avisa
// que el pago salió, y nada más. Las `back_urls` son informativas: si alguien
// cierra la pestaña justo antes de volver, el pago igual se cobró y el crédito
// igual tiene que aparecer, y eso solo lo garantiza el aviso servidor a
// servidor.
//
// CHECKOUT PRO POR REDIRECCIÓN, NO EL LADRILLO DE WALLET. El ladrillo necesita
// JavaScript en el navegador, o sea `'use client'`. La redirección no necesita
// nada: este es un formulario común con una Server Action, y funciona con
// JavaScript apagado igual que el resto del sitio.

const RUTA = '/paquetes'

export async function iniciarCompra(formData) {
  const paqueteId = String(formData.get('paquete_id') ?? '')

  // Sin sesión no se compra, pero tampoco se pierde el intento: vuelve a
  // /paquetes después de entrar, por el circuito de `volver` que ya existe.
  const usuario = await usuarioActual()
  if (!usuario) redirect(`/ingresar?volver=${encodeURIComponent(RUTA)}`)

  if (!esUuid(paqueteId)) redirect(`${RUTA}?r=paquete`)

  // EL PRECIO SALE DE LA BASE, NUNCA DEL FORMULARIO.
  //
  // Es el agujero clásico de un carrito: si el precio viajara en un campo
  // oculto, cualquiera lo edita y paga el paquete de 12 clases a un peso.
  // Del formulario llega solo el id, y todo lo demás —precio, nombre,
  // cantidad de clases— se vuelve a leer acá. Lo mismo vale para `activo`:
  // un paquete dado de baja no se puede comprar aunque alguien tenga el id
  // guardado de antes.
  const { data: paquete, error: errorPaquete } = await clienteSupabase()
    .from('paquetes')
    .select('id, nombre, precio, incluye')
    .eq('id', paqueteId)
    .eq('activo', true)
    .single()

  if (errorPaquete || !paquete) redirect(`${RUTA}?r=paquete`)

  // EL ID DE LA INTENCIÓN SE ELIGE ACÁ, ANTES DE ESCRIBIRLA, y el motivo es
  // una decisión del esquema: `intenciones_de_pago` no tiene política de
  // UPDATE a propósito, así que hay una sola escritura y tiene que llevar todo
  // junto, incluido el `preference_id` que todavía no existe. Para eso el
  // orden es: elegir el id, crear la preferencia con ese id como
  // `external_reference`, y recién entonces insertar la fila completa.
  //
  // El canje: si la preferencia se crea y el insert falla, queda una
  // preferencia huérfana en Mercado Pago. Si alguien la pagara, el webhook no
  // encontraría la intención y contestaría 200 dejándolo registrado, que es
  // mejor que acreditar a ciegas.
  const intencionId = crypto.randomUUID()
  const base = urlDelSitio()

  const preferencia = await crearPreferencia({ paquete, usuario, intencionId, base })
  if (!preferencia?.init_point) redirect(`${RUTA}?r=mp`)

  // La intención se escribe CON LA SESIÓN de la persona, no con la clave
  // secreta: así la política `with check (user_id = auth.uid())` es la que
  // decide, y nadie puede anotar una intención a nombre de otro para que el
  // crédito del pago caiga en su cuenta.
  const supabase = await clienteConSesion()
  const { data: fila, error: errorIntencion } = await supabase
    .from('intenciones_de_pago')
    .insert({
      id: intencionId,
      user_id: usuario.id,
      paquete_id: paquete.id,
      preference_id: preferencia.id ?? null,
    })
    .select('id')
    .single()

  // Una escritura que RLS rechaza no devuelve error, devuelve que no cambió
  // ninguna fila: por eso el .select() y por eso se mira `fila`, no solo
  // `errorIntencion`.
  if (errorIntencion || !fila) {
    console.error(
      'No se pudo anotar la intención de pago:',
      errorIntencion?.message ?? 'RLS no dejó escribir'
    )
    redirect(`${RUTA}?r=error`)
  }

  redirect(preferencia.init_point)
}

// Separada porque `redirect()` lanza una excepción para funcionar, y envolverla
// en el try/catch de abajo haría que el catch se la coma y la redirección nunca
// pase. Acá adentro no hay ningún redirect.
async function crearPreferencia({ paquete, usuario, intencionId, base }) {
  const token = process.env.MP_ACCESS_TOKEN
  if (!token) {
    console.error('Falta MP_ACCESS_TOKEN. Va en .env.local y en Vercel como Secret.')
    return null
  }

  const cliente = new MercadoPagoConfig({ accessToken: token })

  try {
    const { id, init_point } = await new Preference(cliente).create({
      body: {
        items: [
          {
            id: paquete.id,
            title: paquete.nombre,
            description: paquete.incluye ?? undefined,
            quantity: 1,
            // Entero en pesos: así está la columna y así lo valida el panel,
            // sin puntos ni centavos.
            unit_price: paquete.precio,
            currency_id: 'ARS',
          },
        ],
        payer: { email: usuario.email },
        back_urls: {
          success: `${base}/compra/listo`,
          pending: `${base}/compra/pendiente`,
          failure: `${base}/compra/rechazada`,
        },
        // Mercado Pago rechaza `auto_return` si la URL de éxito no es pública,
        // y en localhost no lo es. Sin esto, probar en la máquina devuelve un
        // error de validación que parece un problema del cuerpo.
        ...(base.startsWith('https://') ? { auto_return: 'approved' } : {}),
        // EL PUENTE. Es lo único que elegimos nosotros antes de que el pago
        // exista y que Mercado Pago nos devuelve después, así que es con lo
        // que el webhook sabe a quién y qué paquete acreditar.
        external_reference: intencionId,
        notification_url: `${base}/api/webhooks/mercadopago`,
        statement_descriptor: 'ACTIVE PILATES',
      },
      // NO SE MANDA idempotencyKey, Y ESTO SE MIDIÓ.
      //
      // El SDK la acepta y parecía la defensa natural contra un doble clic,
      // pero para preferencias no hace nada: con la misma clave y el mismo
      // cuerpo, Mercado Pago devolvió dos preferencias distintas. Se comprueba
      // con docs/ejemplos/probar-preferencia.mjs. Dejarla puesta habría sido
      // una protección aparente, que es peor que ninguna.
      //
      // QUÉ PROTEGE DE VERDAD CONTRA ACREDITAR DOS VECES: el `unique` de
      // compras.mp_payment_id. Dos preferencias no son dos cobros; si alguien
      // hace doble clic, termina con dos checkouts abiertos y paga uno. Y si
      // llegara a pagar los dos, son dos pagos de verdad, con dos
      // mp_payment_id distintos, y acreditar los dos es lo correcto.
    })

    return { id, init_point }
  } catch (e) {
    // El SDK tira errores con la respuesta de Mercado Pago adentro. Va completo
    // al registro del servidor y a la pantalla no llega nada: puede traer datos
    // de la cuenta del estudio.
    console.error('Mercado Pago no aceptó la preferencia:', e?.message ?? e)
    if (e?.cause) console.error('  detalle:', JSON.stringify(e.cause))
    return null
  }
}
