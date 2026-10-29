import { z } from 'zod'
// Con la extension a proposito: Next resuelve './contrasena' igual, pero con
// la extension este modulo tambien se puede importar desde `node` a secas, y
// eso es lo que deja probar los esquemas sin compilar el proyecto
// (docs/ejemplos/probar-esquemas.mjs).
import { esValida, LARGO_MINIMO } from './contrasena.js'

// Los esquemas de validación del proyecto. Esta es la ÚNICA definición de cada
// regla: `app/lib/validacion.js` ya no define nada, solo envuelve lo de acá
// para que las Server Actions sigan llamándolo como siempre.
//
// Los usan los dos caminos de entrada:
//
//   los formularios -> Server Actions -> esquemas
//   la API          -> Route Handlers -> esquemas
//
// Que sean los mismos no es prolijidad: es lo que hace que el panel y la API
// acepten exactamente lo mismo. Dos definiciones de "qué es una fecha válida"
// se separan en cuanto alguien toca una sola.
//
// Zod v4: las formas son `z.email()` y `z.uuid()`, no `z.string().email()` de
// la v3, que sigue andando pero está marcada como heredada.

// ---------------------------------------------------------------------------
// Piezas sueltas
// ---------------------------------------------------------------------------

// Los ids viajan en campos ocultos y en la URL, así que pueden traer cualquier
// cosa. Mandarle basura a Postgres en una columna uuid da un error de tipo, que
// es ruido en los registros por algo que se puede descartar antes.
export const Uuid = z.uuid({ error: 'No es un identificador válido.' })

// z.iso.date() no se conforma con el formato: rechaza 2026-02-31, que existe
// como texto y no como fecha. Antes eso se comprobaba a mano construyendo un
// Date y mirando si se había corrido de mes.
export const Fecha = z.iso.date({ error: 'No es una fecha válida (AAAA-MM-DD).' })

// El navegador manda 07:00, y a veces 07:00:00. Se normaliza a HH:MM para que
// la base reciba siempre lo mismo venga de donde venga.
export const Hora = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/, {
    error: 'No es una hora válida (HH:MM).',
  })
  .transform((v) => v.slice(0, 5))

// No valida que el correo exista, solo que tenga forma de correo. Lo único que
// decide de verdad si un correo es real es mandarle un mensaje.
export const Email = z
  .string()
  .trim()
  .pipe(z.email({ error: 'Revisá el correo: no parece una dirección válida.' }))

// Las reglas viven en app/lib/contrasena.js, que a su vez copia las Password
// Requirements configuradas en Supabase. Acá solo se envuelve: si se
// reescribieran acá, habría dos definiciones de lo mismo otra vez.
export const Contrasena = z.string().refine(esValida, {
  error: `La contraseña necesita al menos ${LARGO_MINIMO} caracteres, una minúscula, una mayúscula, un número y un símbolo.`,
})

// Un formulario manda texto, siempre. `coerce` convierte, y el resto rechaza lo
// que no sea un entero: Number('') da 0 y Number('12 clases') da NaN, y ninguna
// de las dos cosas puede terminar en la base como si fuera un número válido.
export const EnteroPositivo = z.coerce
  .number({ error: 'Tiene que ser un número.' })
  .int({ error: 'Tiene que ser un número entero.' })
  .positive({ error: 'Tiene que ser mayor que cero.' })

// El orden de los paquetes admite cero: es el valor por omisión de la columna y
// significa "sin preferencia".
export const EnteroNoNegativo = z.coerce
  .number({ error: 'Tiene que ser un número.' })
  .int({ error: 'Tiene que ser un número entero.' })
  .min(0, { error: 'No puede ser negativo.' })

// LOS LARGOS DE TEXTO DEL CATALOGO, EN UN SOLO LUGAR.
//
// Estos dos numeros estaban escritos a mano en cuatro archivos: la constante de
// la Server Action, este esquema, el maxLength del formulario y el texto del
// mensaje de error ("no puede pasar de 60 caracteres"). Cuatro copias del mismo
// dato es la manera de que un dia el formulario deje escribir 80 y el servidor
// rechace a los 60 sin que nadie entienda por que.
export const LARGO_NOMBRE = 60
export const LARGO_INCLUYE = 200

export const Texto = (max, etiqueta = 'Este campo') =>
  z
    .string()
    .trim()
    .min(1, { error: `${etiqueta} no puede quedar vacío.` })
    .max(max, { error: `${etiqueta} no puede pasar de ${max} caracteres.` })

// Un campo opcional de formulario llega como '' cuando se deja vacío, que no es
// lo mismo que null para la base: la columna admite null, no cadena vacía.
export const UuidOpcional = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  Uuid.nullable()
)

// Igual que UuidOpcional, y por el mismo motivo: un formulario manda '' cuando
// el campo queda vacio, y un cuerpo JSON directamente omite la clave, que llega
// como undefined. Los dos significan "sin valor" y los dos tienen que terminar
// en null, que es lo que la columna admite.
//
// Antes este trataba '' pero no undefined, al contrario de UuidOpcional. Con
// los endpoints de hoy no se notaba porque ningun cuerpo JSON lleva un texto
// opcional, pero dos ayudantes hermanos que difieren en un caso son una trampa
// para el proximo que use el que no lo cubre.
export const TextoOpcional = (max) =>
  z.preprocess(
    (v) => (v === undefined || (typeof v === 'string' && v.trim() === '') ? null : v),
    z.string().trim().max(max).nullable()
  )

// ---------------------------------------------------------------------------
// Objetos completos
// ---------------------------------------------------------------------------

export const NuevaReserva = z.object({ clase_id: Uuid })

// El único cambio que acepta una reserva es cancelarla. No es un `enum` de dos
// valores a propósito: reactivar una reserva cancelada no es un PATCH, es
// reservar de nuevo, y eso vuelve a pasar por reservar_clase() con su candado.
export const CambioDeReserva = z.object({ estado: z.literal('cancelada') })

export const NuevaClase = z.object({
  fecha: Fecha,
  hora: Hora,
  tipo_clase_id: Uuid,
  instructora_id: UuidOpcional,
  cupo_total: EnteroPositivo,
})

export const EdicionDeClase = z.object({
  tipo_clase_id: Uuid,
  instructora_id: UuidOpcional,
  cupo_total: EnteroPositivo,
})

export const EstadoDeClase = z.object({
  estado: z.enum(['programada', 'cancelada'], { error: 'Estado desconocido.' }),
})

export const EdicionDePaquete = z.object({
  nombre: Texto(LARGO_NOMBRE, 'El nombre'),
  precio: EnteroPositivo,
  clases: EnteroPositivo,
  dias_vigencia: EnteroPositivo,
  incluye: TextoOpcional(LARGO_INCLUYE),
  orden: EnteroNoNegativo,
})

// ---------------------------------------------------------------------------
// Filtros que llegan por la URL
// ---------------------------------------------------------------------------

export const FiltroDeClases = z.object({ fecha: Fecha.optional() })

export const FiltroDeReservas = z.object({
  estado: z.enum(['confirmada', 'cancelada']).optional(),
  fecha: Fecha.optional(),
})
