// Lo que repiten todas las acciones del panel al recibir un formulario.
//
// Vive en un archivo propio porque son reglas, no detalles de una pantalla: si
// la forma de leer un número de un formulario cambia, tiene que cambiar en un
// solo lugar. Se escribió primero dentro de las acciones de paquetes y se
// extrajo al aparecer las de clases, que necesitaban exactamente lo mismo.

// Los ids viajan en campos ocultos, así que pueden traer cualquier cosa.
// Mandarle basura a Postgres en una columna uuid da un error de tipo, que es
// ruido en los registros por algo que se puede descartar antes.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function esUuid(valor) {
  return UUID.test(String(valor ?? ''))
}

// Number('') devuelve 0 y Number('12 clases') devuelve NaN. Ninguna de las dos
// cosas puede terminar en la base como si fuera un número válido, así que se
// exige que el texto sean solo dígitos antes de convertirlo.
export function aEntero(valor) {
  const texto = String(valor ?? '').trim()
  if (!/^\d+$/.test(texto)) return NaN
  return Number(texto)
}

export function esEnteroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0
}

// Una fecha de formulario: 2026-10-20. Se verifica que exista de verdad, porque
// el formato por sí solo acepta 2026-02-31.
export function esFecha(valor) {
  const texto = String(valor ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false
  const [a, m, d] = texto.split('-').map(Number)
  const f = new Date(a, m - 1, d)
  return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d
}

// Una hora de formulario: 07:00, o 07:00:00 si el navegador agrega segundos.
// Se devuelve siempre normalizada a HH:MM para que la base reciba lo mismo
// venga del navegador que venga.
export function aHora(valor) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(String(valor ?? '').trim())
  return m ? `${m[1]}:${m[2]}` : null
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
