// Guardar un mensaje de contacto.
//
// POR QUÉ ESTO EXISTE Y NO SE ESCRIBE EN CADA PUERTA: el mensaje entra por dos
// lados —la Server Action del formulario y `POST /api/v1/mensajes`— y la regla
// del proyecto es que la API no reimplemente nada. Si cada una llamara al RPC
// por su cuenta, el día que cambie el nombre de un parámetro una de las dos
// quedaría rota y la otra no.
//
// El cliente llega por parámetro, como en `agendaDeLaSemana()` y
// `resumenDeCreditos()`: la Server Action usa el de sesión y el Route Handler
// el suyo. Importa que sea el de sesión cuando hay una, porque la función de la
// base guarda `auth.uid()` en `user_id`.

// Lo que puede contestar `enviar_mensaje()`. Los textos son los que ve la
// persona; el código es el que viaja por la API.
//
// EXPORTADO PORQUE LO LEEN TRES SUPERFICIES: este módulo para la respuesta de
// la API, `FormularioDeContacto.jsx` para el estado de cliente, y
// `app/contacto/page.jsx` para el camino sin JavaScript, donde el motivo llega
// por `?m=`. Escribir los mismos textos en tres lados es exactamente la
// duplicación que el proyecto prohíbe desde septiembre.
//
// Este archivo no importa nada, así que el componente de cliente lo puede
// importar sin arrastrar nada del servidor.
export const MOTIVOS = {
  nombre_invalido: 'Revisá el nombre.',
  email_invalido: 'Revisá el correo.',
  mensaje_invalido: 'Revisá el mensaje.',
  demasiados:
    'Ya mandaste varios mensajes en la última hora. Esperá un rato o escribinos por WhatsApp.',
}

export const TEXTO_OK = 'Listo, recibimos tu mensaje. Te respondemos a la brevedad.'

// Devuelve { ok: true } o { ok: false, codigo, mensaje }.
export async function guardarMensaje({ nombre, email, mensaje }, supabase) {
  const { data, error } = await supabase.rpc('enviar_mensaje', {
    p_nombre: nombre,
    p_email: email,
    p_mensaje: mensaje,
  })

  if (error) {
    console.error('No se pudo guardar el mensaje de contacto:', error.message)
    return { ok: false, codigo: 'error', mensaje: 'No pudimos guardar tu mensaje.' }
  }

  // La función devuelve una tabla de una fila con una columna `resultado`.
  const resultado = data?.[0]?.resultado ?? 'error'
  if (resultado === 'ok') return { ok: true }

  return {
    ok: false,
    codigo: resultado,
    mensaje: MOTIVOS[resultado] ?? 'No pudimos guardar tu mensaje.',
  }
}
