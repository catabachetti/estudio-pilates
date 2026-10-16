// Las reglas de la contraseña, en un solo lugar.
//
// Las valida tres capas y las tres tienen que pedir EXACTAMENTE lo mismo, o
// alguien pasa una y rebota contra otra con un error en inglés:
//
//   1. el navegador, con el `pattern` de abajo        -> para quien escribe
//   2. la Server Action, con esValida()               -> nuestro formulario
//   3. Supabase, con sus Password Requirements        -> la unica que no se
//                                                        puede saltear
//
// La tercera manda, porque el endpoint /auth/v1/signup es publico y alcanzable
// con la clave publishable: se puede crear una cuenta sin pasar nunca por
// nuestro formulario. Por eso este archivo copia su regla, no al reves.
//
// Medido contra el proyecto el 16 de octubre de 2026, con la opcion
// "Lowercase, uppercase letters, digits and symbols" y minimo 8. El mensaje de
// error de Supabase lista los cuatro conjuntos que exige, y el de simbolos es
// este, textual:
//
//   !@#$%^&*()_+-=[]{};'\:"|<>?,./`~
//
// Supabase pide PRESENCIA de los cuatro conjuntos, no restringe el resto: una
// contraseña con espacios o con eñe se acepta si ademas tiene las cuatro.

export const LARGO_MINIMO = 8

// Cuidado al tocar esto: el atributo `pattern` se compila con la bandera `v` en
// los navegadores actuales, y esa bandera OBLIGA a escapar ( ) [ ] { } / - |
// dentro de una clase de caracteres. Si queda mal escapado, el navegador
// descarta el pattern en silencio y deja de validar sin avisar.
export const PATRON =
  "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*\\(\\)_+\\-=\\[\\]\\{\\};'\\\\:\"\\|<>?,.\\/`~]).{8,}"

const SIMBOLOS = /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/

// Qué cumple y qué no, para que la pantalla pueda decir cuál falta en vez de
// un "algo falta" generico.
export function reglasDe(clave) {
  const c = String(clave ?? '')
  return [
    { id: 'largo', texto: `Al menos ${LARGO_MINIMO} caracteres`, cumple: c.length >= LARGO_MINIMO },
    { id: 'minuscula', texto: 'Una minúscula', cumple: /[a-z]/.test(c) },
    { id: 'mayuscula', texto: 'Una mayúscula', cumple: /[A-Z]/.test(c) },
    { id: 'digito', texto: 'Un número', cumple: /[0-9]/.test(c) },
    { id: 'simbolo', texto: 'Un símbolo, como ! @ # $ %', cumple: SIMBOLOS.test(c) },
  ]
}

export function esValida(clave) {
  return reglasDe(clave).every((r) => r.cumple)
}

// El grado para el medidor. No es una medida de entropia: es cuantas de las
// reglas estan cumplidas, mas un escalon por largo. Alcanza para orientar a
// quien escribe, que es para lo que sirve un medidor.
export function fortalezaDe(clave) {
  const c = String(clave ?? '')
  if (c.length === 0) return { nivel: 0, etiqueta: '' }

  const cumplidas = reglasDe(c).filter((r) => r.cumple).length

  if (c.length < LARGO_MINIMO) return { nivel: 1, etiqueta: 'Muy corta' }
  if (cumplidas < 4) return { nivel: 1, etiqueta: 'Débil' }
  if (cumplidas === 4) return { nivel: 2, etiqueta: 'Le falta poco' }
  if (c.length < 12) return { nivel: 3, etiqueta: 'Bien' }
  return { nivel: 4, etiqueta: 'Muy buena' }
}
