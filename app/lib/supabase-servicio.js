// Lo primero del archivo, y no es decorativo: si alguien importa este módulo
// desde un componente de cliente, el build FALLA nombrando el archivo.
//
// Sin esta línea el fallo sería silencioso y peor: SUPABASE_SECRET_KEY no lleva
// el prefijo NEXT_PUBLIC_, así que en el navegador llega como `undefined`, el
// cliente se construye igual sin quejarse, y revienta recién al usarse, con un
// error de autenticación que no dice nada sobre la causa real.
//
// No se usan las Taint APIs de React, que harían algo parecido: la
// documentación de la versión instalada las marca `experimental` y exigen
// activar `experimental.taint`. Es la misma decisión que se tomó con
// `forbidden()`, y por el mismo motivo.
import 'server-only'

import { createClient } from '@supabase/supabase-js'

// EL TERCER CLIENTE DE SUPABASE DEL PROYECTO, Y EL ÚNICO QUE SALTEA RLS.
//
//   supabase.js          clave publishable, sin sesión. Catálogo público.
//   supabase-sesion.js   clave publishable + cookies. Lo que hace cada persona.
//   este                 clave secreta, sin sesión.   Solo el webhook de pagos.
//
// POR QUÉ HACE FALTA UNO NUEVO. El webhook de Mercado Pago llega sin cookies y
// sin token: del otro lado hay un servidor de MP, que no tiene cuenta en el
// estudio. Con la clave publishable, `auth.uid()` es null y RLS no le deja leer
// la intención de pago ni invocar `otorgar_creditos()`.
//
// LO QUE ESTA CLAVE ES. `service_role` tiene el atributo BYPASSRLS: las
// políticas no se evalúan, directamente no corren. Así que acá no hay red de
// contención abajo, y es la única parte del proyecto donde eso es cierto.
// Todo lo que se escriba con este cliente tiene que pasar por una función
// `security definer` que verifique adentro quién llama —hoy
// `otorgar_creditos()`— y no por un `.insert()` suelto.
//
// LO QUE NO SE HACE CON ESTA CLAVE: nada que una sesión pueda hacer. Si una
// pantalla necesita leer o escribir algo de una persona, usa
// supabase-sesion.js y RLS decide. Esta clave existe para el único caso donde
// no hay persona.
export function clienteDeServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.SUPABASE_SECRET_KEY

  // Falta la clave: se corta acá con un mensaje que dice qué falta. Sin esto,
  // createClient acepta `undefined` y el error aparece después, en la primera
  // consulta, como un 401 de Supabase que parece un problema de permisos.
  if (!url || !clave) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY. ' +
        'La secreta va en .env.local, y en Vercel como Secret, nunca con el ' +
        'prefijo NEXT_PUBLIC_.'
    )
  }

  return createClient(url, clave, {
    auth: {
      // Las tres apagadas porque acá no hay sesión de nadie que mantener. Con
      // `persistSession` prendido, el cliente intentaría guardar una sesión en
      // un almacenamiento que en el servidor no existe, y entre dos pedidos
      // del webhook podría arrastrar estado que no le corresponde.
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}
