import { grilla } from './contenido'

export const SEMANAS_ABIERTAS = 8

// Fecha en formato AAAA-MM-DD, siempre en horario local y sin pasar por UTC,
// porque toISOString() corre el dia hacia atras en Argentina.
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
  const ahora = new Date()
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
}

export function ultimoDiaAbierto() {
  const fin = hoy()
  fin.setDate(fin.getDate() + SEMANAS_ABIERTAS * 7 - 1)
  return fin
}

// Los turnos de una fecha salen de la grilla semanal: de lunes a viernes va un
// bloque, los sabados otro y los domingos el estudio no abre.
export function turnosDe(fecha) {
  const dia = fecha.getDay()
  if (dia === 0) return []
  const bloque = dia === 6 ? grilla[1] : grilla[0]
  return bloque.turnos
}

export function estaAbierta(fecha) {
  if (turnosDe(fecha).length === 0) return false
  const clave = aClave(fecha)
  return clave >= aClave(hoy()) && clave <= aClave(ultimoDiaAbierto())
}

// Cupos deterministas: el mismo dia y la misma hora dan siempre el mismo
// numero, en el servidor y en el navegador. Con Math.random() cada render
// daria otro valor y la pagina mostraria cupos distintos en cada visita.
function semilla(texto) {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

export function cuposDe(clave, hora) {
  const valor = semilla(`${clave}|${hora}`)
  // Reparte entre 0 y 6, con mas probabilidad de que queden pocos lugares.
  return Math.floor(valor * 7)
}

export function clasesDe(clave) {
  const fecha = desdeClave(clave)
  return turnosDe(fecha).map((turno) => ({
    ...turno,
    cupos: cuposDe(clave, turno.hora),
  }))
}

const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function nombreDeMes(anio, mes) {
  return `${NOMBRES_MES[mes]} de ${anio}`
}

export function textoDeFecha(clave) {
  const fecha = desdeClave(clave)
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  return `${dias[fecha.getDay()]} ${fecha.getDate()} de ${NOMBRES_MES[fecha.getMonth()]}`
}

// Semanas del mes, cada una con siete casillas de lunes a domingo.
export function semanasDelMes(anio, mes) {
  const primero = new Date(anio, mes, 1)
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const corrimiento = (primero.getDay() + 6) % 7
  const casillas = []
  for (let i = 0; i < corrimiento; i++) casillas.push(null)
  for (let d = 1; d <= diasEnMes; d++) casillas.push(new Date(anio, mes, d))
  while (casillas.length % 7 !== 0) casillas.push(null)
  const semanas = []
  for (let i = 0; i < casillas.length; i += 7) semanas.push(casillas.slice(i, i + 7))
  return semanas
}

export function claveDeMes(anio, mes) {
  return `${anio}-${String(mes + 1).padStart(2, '0')}`
}

export function mesPedido(valor) {
  const referencia = hoy()
  if (typeof valor === 'string' && /^\d{4}-\d{2}$/.test(valor)) {
    const [a, m] = valor.split('-').map(Number)
    const pedido = new Date(a, m - 1, 1)
    const minimo = new Date(referencia.getFullYear(), referencia.getMonth(), 1)
    if (pedido >= minimo) return { anio: a, mes: m - 1 }
  }
  return { anio: referencia.getFullYear(), mes: referencia.getMonth() }
}
