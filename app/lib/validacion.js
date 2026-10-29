import {
  Uuid,
  Fecha,
  Hora,
  Email,
  EnteroPositivo,
} from './esquemas'

// Ayudantes sobre los esquemas, para las Server Actions.
//
// ESTE ARCHIVO YA NO DEFINE NADA. Las reglas viven en app/lib/esquemas.js y acá
// solo se envuelven con la forma que las acciones del panel vienen usando:
// funciones que devuelven true/false o un valor convertido.
//
// Se mantuvieron los nombres a propósito. Lo que importaba era que no quedaran
// dos definiciones de "qué es una fecha válida" —una acá y otra en la API—, y
// eso se resuelve con que los dos caminos partan del mismo esquema. Cambiarle
// el nombre a nueve lugares no agregaba nada y sí agregaba riesgo.
//
// Pendiente anotado en CLAUDE.md: que las acciones validen el formulario entero
// con un esquema de objeto en vez de campo por campo. Es mejor estilo, pero no
// arregla ninguna duplicación, así que no corre apuro.

export function esUuid(valor) {
  return Uuid.safeParse(valor).success
}

// Devuelve NaN cuando no es un entero, que es lo que esperan quienes ya la
// usan: comprueban con esEnteroPositivo() después.
export function aEntero(valor) {
  const r = z_entero(valor)
  return r === null ? NaN : r
}

function z_entero(valor) {
  const texto = String(valor ?? '').trim()
  // Se exige que el texto sean solo dígitos ANTES de convertir: coerce aceptaría
  // '12.0', ' 12 ' y '1e2', y en un formulario eso es un error de tipeo, no un
  // número. El esquema valida el resultado.
  if (!/^\d+$/.test(texto)) return null
  const r = EnteroPositivo.safeParse(texto)
  return r.success ? r.data : Number(texto)
}

export function esEnteroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0
}

export function esFecha(valor) {
  return Fecha.safeParse(typeof valor === 'string' ? valor.trim() : valor).success
}

export function aHora(valor) {
  const r = Hora.safeParse(valor)
  return r.success ? r.data : null
}

export function esEmail(valor) {
  return Email.safeParse(valor).success
}

// UNA ESCRITURA RECHAZADA POR RLS NO DEVUELVE ERROR: devuelve que no modificó
// ninguna fila, porque para la política esa fila no existe. Sin pedir de vuelta
// lo actualizado con .select(), un rechazo de permisos se ve exactamente igual
// que un guardado exitoso.
export function sinCambios(resultado) {
  return !resultado.error && resultado.data?.length === 0
}

// Los códigos que devuelve Postgres y que el panel sabe explicar. El resto cae
// en un mensaje genérico: mostrar el texto crudo de la base filtra nombres de
// tablas y restricciones a la pantalla.
export const CODIGOS = {
  UNICO: '23505', // viola un unique
  AJENA: '23503', // viola una clave ajena
  CHEQUEO: '23514', // viola un check
}
