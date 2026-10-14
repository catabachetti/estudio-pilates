'use server'

import { redirect } from 'next/navigation'
import { clienteConSesion } from '../lib/supabase-sesion'
import { exigirAdmin } from '../lib/autorizacion'
import { esUuid, esEmail } from '../lib/validacion'

// Buscar a una persona y acreditarle un paquete a mano.
//
// Las dos escrituras pasan por funciones `security definer` de la migración 010,
// que verifican es_admin() adentro. No se usa la clave secreta: `creditos` no
// tiene política de INSERT y la de `compras` exige user_id = auth.uid(), así que
// con la clave publishable esto no se puede hacer de ninguna otra forma.
//
// Acá no hay sinCambios(): estas acciones no hacen update, llaman a funciones
// que devuelven filas. El control es que vengan los datos esperados.

const RUTA = '/admin/creditos'

export async function buscarPersona(formData) {
  await exigirAdmin(RUTA)

  const email = String(formData.get('email') ?? '').trim()
  if (!esEmail(email)) redirect(`${RUTA}?error=email`)

  const supabase = await clienteConSesion()
  const { data, error } = await supabase.rpc('buscar_persona', { p_email: email })

  if (error) {
    console.error('No se pudo buscar la persona:', error.message)
    redirect(`${RUTA}?error=buscar`)
  }

  if (!data || data.length === 0) redirect(`${RUTA}?error=sin-persona`)

  // Solo viaja el id. El correo no va en la URL a propósito: las direcciones
  // terminan en el historial del navegador y en los registros del servidor, y
  // acá no hacen falta para nada. El nombre lo lee la página desde `perfiles`.
  redirect(`${RUTA}?persona=${data[0].id}`)
}

export async function otorgarCreditos(formData) {
  await exigirAdmin(RUTA)

  const persona = String(formData.get('persona') ?? '')
  const paquete = String(formData.get('paquete_id') ?? '')

  if (!esUuid(persona)) redirect(`${RUTA}?error=persona`)
  if (!esUuid(paquete)) redirect(`${RUTA}?error=paquete`)

  const supabase = await clienteConSesion()
  const { data, error } = await supabase.rpc('otorgar_creditos', {
    p_user_id: persona,
    p_paquete_id: paquete,
    // En null porque esta carga es manual, no viene de un pago. El parámetro
    // existe para el webhook de Mercado Pago, que va a pasar el id del pago y
    // así el unique de compras.mp_payment_id impide acreditar dos veces el
    // mismo aviso reintentado.
    p_mp_payment_id: null,
  })

  if (error) {
    console.error('No se pudieron otorgar los créditos:', error.message)
    redirect(`${RUTA}?persona=${persona}&error=otorgar`)
  }

  const resultado = data?.[0]
  if (!resultado) redirect(`${RUTA}?persona=${persona}&error=otorgar`)

  // No se revalida nada: estos datos no se muestran en ninguna página pública.
  // Los créditos de alguien solo se ven en su cuenta y en este panel, y las dos
  // son dinámicas.
  redirect(`${RUTA}?persona=${persona}&estado=otorgado&creditos=${resultado.creditos_creados}`)
}
