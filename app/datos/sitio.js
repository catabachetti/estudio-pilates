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
export const HORAS_CANCELACION = 6
export const DIRECCION = {
  calle: 'Gorriti 4520',
  barrio: 'Palermo',
  ciudad: 'Ciudad de Buenos Aires',
}

export const condiciones = `Los créditos vencen según el paquete que compres y siempre se consume primero el que vence antes. Podés cancelar sin costo hasta ${HORAS_CANCELACION} horas antes de la clase; pasada esa ventana, el crédito se pierde.`

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

