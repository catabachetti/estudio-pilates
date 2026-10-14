export const DURACION_CLASE = 50

// El estudio está en Buenos Aires, pero el servidor que renderiza puede estar
// en cualquier huso (Vercel corre en UTC). Si comparáramos contra la hora del
// servidor, a las 6 de la mañana en Buenos Aires serían las 9 UTC y las clases
// de 7 y 8 aparecerían finalizadas sin haber empezado. Por eso la hora sale
// siempre de Intl con la zona fija del estudio, no de new Date() a secas.
const ZONA = 'America/Argentina/Buenos_Aires'

export function ahoraEnElEstudio() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const v = Object.fromEntries(partes.map((p) => [p.type, p.value]))
  return {
    clave: `${v.year}-${v.month}-${v.day}`,
    minutos: Number(v.hour) * 60 + Number(v.minute),
  }
}

export function aClave(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

export function desdeClave(clave) {
  const [a, m, d] = clave.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function hoy() {
  return desdeClave(ahoraEnElEstudio().clave)
}

function enMinutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export function textoDeFecha(clave) {
  const f = desdeClave(clave)
  return `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`
}

// La base devuelve "07:00:00" y en pantalla se lee mejor "7:00". Vive acá,
// con el resto del formato de fechas y horas, porque lo usan la grilla pública
// y el panel: la forma de escribir una hora se decide en un solo lugar.
export function sinSegundos(hora) {
  const [h, m] = hora.split(':')
  return `${Number(h)}:${m}`
}

export function diaCorto(fecha) {
  return DIAS_CORTOS[fecha.getDay()]
}

// "5 oct a 10 oct 2026", o con los dos meses si la semana los cruza.
export function rangoDeSemana(dias) {
  if (dias.length === 0) return ''
  const desde = dias[0]
  const hasta = dias[dias.length - 1]
  const inicio = `${desde.getDate()} ${MESES_CORTOS[desde.getMonth()]}`
  const fin = `${hasta.getDate()} ${MESES_CORTOS[hasta.getMonth()]}`
  return `${inicio} a ${fin} ${hasta.getFullYear()}`
}

export function lunesDe(fecha) {
  const copia = new Date(fecha)
  copia.setDate(copia.getDate() - ((copia.getDay() + 6) % 7))
  return copia
}


// Cuántos minutos faltan para que empiece una clase. Negativo si ya empezó.
// Sale del reloj del estudio y no del servidor, igual que estaFinalizada: en
// Vercel el servidor corre en UTC y daría tres horas de diferencia.
export function minutosHasta(clave, hora) {
  const ahora = ahoraEnElEstudio()
  const dias =
    (desdeClave(clave) - desdeClave(ahora.clave)) / (1000 * 60 * 60 * 24)
  return dias * 24 * 60 + enMinutos(hora) - ahora.minutos
}

// Una clase está finalizada solo si es hoy y ya terminó. En los días que vienen
// no hay clases finalizadas. La hora sale de ahoraEnElEstudio, no del reloj del
// servidor, que en Vercel corre en UTC.
export function estaFinalizada(clave, hora) {
  const ahora = ahoraEnElEstudio()
  if (clave !== ahora.clave) return false
  return enMinutos(hora) + DURACION_CLASE <= ahora.minutos
}
