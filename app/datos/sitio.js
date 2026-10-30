// Constantes y textos del sitio que no viven en la base.
//
// Acá queda únicamente lo que no tiene tabla: el menú, las preguntas
// frecuentes, los datos de contacto del estudio y las reglas de negocio que el
// sitio afirma por escrito. El catálogo (clases, paquetes, instructoras,
// horarios) salió de este archivo y hoy se consulta a Supabase.
//
// Si algo de acá se vuelve editable desde el panel de administración, deja de
// pertenecer a este archivo y pasa a ser una tabla.

// Datos del estudio que se afirman en varias páginas. Viven acá una sola vez
// para que no puedan contradecirse entre sí.
export const CUPO_MAXIMO = 6
export const DIRECCION = {
  calle: 'Gorriti 4520',
  barrio: 'Palermo',
  ciudad: 'Ciudad de Buenos Aires',
}

// Las horas de cancelación ya no son una constante de este archivo: viven en
// la tabla `ajustes` porque la función cancelar_reserva() de la base las
// necesita para decidir si devuelve el crédito, y tenerlas también acá sería el
// mismo número escrito a mano en dos lugares. Se leen con horasDeCancelacion()
// de app/lib/ajustes.js y se pasan a esta función.
//
// Si el ajuste no se pudo leer, el texto sale sin la frase de cancelación en
// vez de afirmar una regla inventada.
export function condicionesCon(horas) {
  const base =
    'Los créditos vencen según el paquete que compres y siempre se consume primero el que vence antes.'

  if (typeof horas !== 'number') return base

  return `${base} Podés cancelar sin costo hasta ${horas} horas antes de la clase; pasada esa ventana, el crédito se pierde.`
}

export const navegacion = [
  { href: '/clases', texto: 'Clases' },
  { href: '/paquetes', texto: 'Paquetes' },
  { href: '/horarios', texto: 'Horarios' },
  { href: '/contacto', texto: 'Contacto' },
]

// El pie repite el menu principal y suma las dos secciones que no entran
// arriba, para que ninguna pagina quede sin un enlace que llegue a ella.
export const navegacionPie = [
  ...navegacion,
  { href: '/nosotras', texto: 'Nosotras' },
  { href: '/preguntas', texto: 'Preguntas' },
]

export const preguntas = [
  {
    pregunta: '¿Necesito experiencia previa?',
    respuesta:
      'Para Reformer Flow no, es la clase con la que empieza la mayoría. Reformer Power sí pide experiencia, porque asume que ya conocés el equipo. Si venís de otro estudio, tomá una Flow primero para que la instructora vea cómo te movés.',
  },
  {
    pregunta: '¿Qué llevo a la clase?',
    respuesta:
      'Medias antideslizantes, que son obligatorias, una botella de agua y ropa cómoda que te permita moverte. Toallas hay en el estudio.',
  },
  {
    pregunta: '¿Cuántas personas hay por clase?',
    respuesta:
      'Seis como máximo, porque tenemos seis reformers. Es el límite que nos permite corregir a cada persona durante toda la clase.',
  },
  {
    pregunta: '¿Puedo cancelar una reserva?',
    respuesta:
      'Sí, hasta 6 horas antes del horario de la clase y el crédito vuelve a tu cuenta sin costo. Si cancelás después de esa ventana, o si no venís, el crédito se descuenta igual.',
  },
  {
    pregunta: '¿Los créditos vencen?',
    respuesta:
      'Sí, cada paquete tiene su vigencia en días corridos y empieza a correr el día de la compra: 30 días para una clase, 60 para cuatro, 90 para ocho y 120 para doce. Cuando tenés créditos de distintos paquetes se usa primero el que vence antes.',
  },
  {
    pregunta: '¿Puedo hacer pilates embarazada?',
    respuesta:
      'Sí, con la clase Reformer Prenatal y con autorización de tu obstetra. Adaptamos los ejercicios al trimestre en el que estés y evitamos las posiciones contraindicadas.',
  },
]

// PROVISORIO HASTA E5: mientras no exista el formulario de reserva contra la
// base de datos, las acciones del sitio (reservar, lista de espera, consultar
// un paquete) abren WhatsApp con el mensaje ya escrito, para no perder lo que
// la persona eligio. Cuando E5 este listo, esto se reemplaza por el formulario
// y el numero queda solo como contacto.
// LA URL BASE DEL SITIO, EN UN SOLO LUGAR.
//
// La necesitan dos cosas de Mercado Pago que tienen que apuntar al mismo sitio:
// las `back_urls` de la preferencia, a donde vuelve la persona después de
// pagar, y la `notification_url`, a donde Mercado Pago manda el aviso de pago.
// Escribirla a mano en los dos lados es la forma de que un día apunten a
// deploys distintos.
//
// Sale del entorno y no de una constante porque cambia según dónde corra:
//
//   produccion en Vercel  VERCEL_PROJECT_PRODUCTION_URL, el dominio de verdad
//   preview en Vercel     VERCEL_URL, la URL de ese deploy puntual, que es la
//                         que hace falta para que Mercado Pago pueda llamar
//                         durante las pruebas
//   acá, en tu máquina    localhost
//
// Ninguna lleva el prefijo NEXT_PUBLIC_, así que esto solo se puede leer en el
// servidor. No importa: las dos cosas que la usan corren en el servidor.
//
// SITIO_URL está primero para poder forzarla a mano. Hace falta porque Mercado
// Pago no acepta `http://localhost` en las back_urls: para probar el checkout
// de verdad hay que apuntar a una URL pública, y esa es la perilla.
export function urlDelSitio() {
  if (process.env.SITIO_URL) return process.env.SITIO_URL

  const produccion = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (process.env.VERCEL_ENV === 'production' && produccion) {
    return `https://${produccion}`
  }

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`

  return 'http://localhost:3000'
}

export const MAIL = 'activepilatesref@gmail.com'

export const TELEFONO_WHATSAPP = '5491100000000'

export function enlaceWhatsapp(mensaje) {
  return `https://wa.me/${TELEFONO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`
}

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function precioEnPesos(valor) {
  return formatoPrecio.format(valor)
}

