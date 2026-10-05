import { grilla } from './contenido'

export const SEMANAS_ABIERTAS = 8
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

export function ultimoDiaAbierto() {
  const fin = hoy()
  fin.setDate(fin.getDate() + SEMANAS_ABIERTAS * 7 - 1)
  return fin
}

// Los turnos salen de la grilla semanal: de lunes a viernes un bloque, los
// sábados otro, los domingos el estudio no abre.
export function turnosDe(fecha) {
  const dia = fecha.getDay()
  if (dia === 0) return []
  return (dia === 6 ? grilla[1] : grilla[0]).turnos
}

export function estaAbierta(fecha) {
  if (turnosDe(fecha).length === 0) return false
  const clave = aClave(fecha)
  return clave >= aClave(hoy()) && clave <= aClave(ultimoDiaAbierto())
}

// Cupos deterministas: la misma fecha y la misma hora dan siempre el mismo
// número, en el servidor y en el navegador. Con Math.random() cada render
// daría otro valor y la página mostraría cupos distintos en cada visita.
function semilla(texto) {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

export function cuposDe(clave, hora) {
  return Math.floor(semilla(`${clave}|${hora}`) * 7)
}

function enMinutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export function clasesDe(clave) {
  const ahora = ahoraEnElEstudio()
  return turnosDe(desdeClave(clave)).map((turno) => ({
    ...turno,
    cupos: cuposDe(clave, turno.hora),
    // Una clase está finalizada solo si es hoy y ya terminó. En los días que
    // vienen no hay clases finalizadas.
    finalizada:
      clave === ahora.clave &&
      enMinutos(turno.hora) + DURACION_CLASE <= ahora.minutos,
  }))
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

export function nombreDeMes(fecha) {
  return `${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`
}

function lunesDe(fecha) {
  const copia = new Date(fecha)
  copia.setDate(copia.getDate() - ((copia.getDay() + 6) % 7))
  return copia
}

// Los seis días que el estudio abre en la semana de esa fecha, sin domingo y
// sin los días que ya pasaron.
export function semanaDe(clave) {
  const lunes = lunesDe(desdeClave(clave))
  const claveHoy = aClave(hoy())
  const dias = []
  for (let i = 0; i < 6; i++) {
    const dia = new Date(lunes)
    dia.setDate(lunes.getDate() + i)
    if (aClave(dia) >= claveHoy) dias.push(dia)
  }
  return dias
}

export function semanaAnterior(clave) {
  const lunes = lunesDe(desdeClave(clave))
  lunes.setDate(lunes.getDate() - 7)
  return lunes
}

export function semanaSiguiente(clave) {
  const lunes = lunesDe(desdeClave(clave))
  lunes.setDate(lunes.getDate() + 7)
  return lunes
}

export function hayAnterior(clave) {
  return lunesDe(desdeClave(clave)) > lunesDe(hoy())
}

export function hasta(fecha) {
  return aClave(fecha) <= aClave(ultimoDiaAbierto())
}

// Primer día con clases de esa semana, para que las flechas siempre lleven a
// una fecha válida y no a una semana vacía.
export function primerDiaDeSemana(fecha) {
  const dias = semanaDe(aClave(fecha))
  const abierto = dias.find((d) => estaAbierta(d))
  return abierto ? aClave(abierto) : aClave(fecha)
}

// La fecha pedida, si es usable. Si no, hoy, y si hoy está cerrado, el
// siguiente día que abra.
export function diaPedido(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const fecha = desdeClave(valor)
    if (!Number.isNaN(fecha.getTime()) && aClave(fecha) >= aClave(hoy()) && hasta(fecha)) {
      return valor
    }
  }
  const cursor = hoy()
  for (let i = 0; i < 7; i++) {
    if (estaAbierta(cursor)) return aClave(cursor)
    cursor.setDate(cursor.getDate() + 1)
  }
  return aClave(hoy())
}

// El horario de atencion no se escribe a mano: sale de la grilla. Abre con la
// primera clase y cierra cuando termina la ultima, redondeado hacia arriba a la
// hora en punto, que es como lo comunica cualquier negocio: la ultima clase
// termina 20:50 y el cartel dice 21:00. Si manana agregan un turno a las 21:00,
// el cierre pasa a 22:00 solo.
export function horariosDeAtencion() {
  return grilla.map((bloque) => {
    const primera = bloque.turnos[0].hora
    const ultima = bloque.turnos[bloque.turnos.length - 1].hora
    const cierre = Math.ceil((enMinutos(ultima) + DURACION_CLASE) / 60) * 60
    return { dia: bloque.dia, desde: primera, hasta: `${cierre / 60}:00` }
  })
}
