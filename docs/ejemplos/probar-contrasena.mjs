// Comprueba que las tres capas que validan la contraseña pidan lo mismo.
//
// Las tres son: el `pattern` del navegador, esValida() en la Server Action, y
// las Password Requirements de Supabase. Si una pide algo distinto, alguien
// pasa una y rebota contra otra con un error en inglés.
//
// Los casos de abajo salieron de medir contra Supabase, no de suponer. Los
// resultados esperados son los que devolvio /auth/v1/signup el 19 de octubre
// de 2026, con la opcion "Lowercase, uppercase letters, digits and symbols" y
// minimo 8.
//
// Uso:  node docs/ejemplos/probar-contrasena.mjs
import { esValida, fortalezaDe, reglasDe, PATRON } from '../../app/lib/contrasena.js'

const casos = [
  ['Abcdef1!', true, 'minuscula + mayuscula + digito + simbolo, 8 caracteres'],
  ['Abcdefg1', false, 'sin simbolo'],
  ['abcdef1!', false, 'sin mayuscula'],
  ['ABCDEF1!', false, 'sin minuscula'],
  ['Abcdefg!', false, 'sin digito'],
  ['Abcde1!', false, 'solo 7 caracteres'],
  ['Abcdefg1 ', false, 'el espacio no cuenta como simbolo'],
  ['Abcdefg1ñ', false, 'la enie tampoco'],
  ['Abcdefg1€', false, 'el euro tampoco'],
  ['Abcdefg1[', true, 'corchete'],
  ['Abcdefg1(', true, 'parentesis'],
  ['Abcdefg1{', true, 'llave'],
  ['Abcdefg1/', true, 'barra'],
  ['Abcdefg1-', true, 'guion'],
  ['Abcdefg1|', true, 'pleca'],
  ['Abcdefg1\\', true, 'contrabarra'],
  ['Abcdefg1"', true, 'comilla doble'],
  ['Abcdefg1`', true, 'tilde invertida'],
  ['Mi clave Segura 1!', true, 'con espacios: Supabase pide presencia, no restringe'],
  ['Contrasena Ñ1!aA', true, 'con enie, pero con las cuatro clases'],
  ['aA1!aA1!aA1!', true, '12 caracteres'],
  ['', false, 'vacia'],
]

// El mismo patron que recibe el atributo `pattern`, compilado como lo compila
// el navegador: con la bandera `v`, que es la que obliga a escapar
// ( ) [ ] { } / - | dentro de una clase de caracteres.
const comoElNavegador = new RegExp('^(?:' + PATRON + ')$', 'v')

let fallos = 0
for (const [valor, esperado, etiqueta] of casos) {
  const servidor = esValida(valor)
  const navegador = comoElNavegador.test(valor)
  if (servidor !== esperado || navegador !== esperado) {
    fallos += 1
    console.log(
      `  MAL  ${JSON.stringify(valor)}  (${etiqueta})\n` +
        `       servidor=${servidor}  navegador=${navegador}  esperado=${esperado}`
    )
  }
}

console.log(
  fallos === 0
    ? `Los ${casos.length} casos pasan: la funcion del servidor y el pattern del navegador\ncoinciden entre si, y coinciden con lo que acepta Supabase.`
    : `${fallos} FALLOS de ${casos.length}`
)

console.log('\nEl medidor, a medida que se escribe:')
for (const v of ['', 'a', 'abcdefgh', 'Abcdefgh', 'Abcdefg1', 'Abcdefg1!', 'Abcdefg1!mas']) {
  const f = fortalezaDe(v)
  const faltan = reglasDe(v).filter((r) => !r.cumple).map((r) => r.id)
  console.log(
    `  ${JSON.stringify(v).padEnd(16)} nivel ${f.nivel}/4  ${f.etiqueta.padEnd(14)}` +
      (faltan.length ? ` falta: ${faltan.join(', ')}` : ' completa')
  )
}

process.exit(fallos === 0 ? 0 : 1)
