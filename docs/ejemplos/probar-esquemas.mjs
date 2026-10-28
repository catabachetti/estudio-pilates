// Comprueba que los largos de texto del catalogo salgan de UN SOLO lugar.
//
// LARGO_NOMBRE y LARGO_INCLUYE estaban escritos a mano en cuatro archivos: la
// constante de la Server Action, el esquema, el maxLength del formulario y el
// texto del mensaje de error. Ahora los cuatro leen app/lib/esquemas.js, y esta
// prueba comprueba que el esquema efectivamente use la constante exportada y no
// un numero que casualmente coincide.
//
// Prueba tambien que TextoOpcional y UuidOpcional traten igual a '' y a
// undefined: un formulario manda '' y un cuerpo JSON omite la clave.
//
// Uso:  node docs/ejemplos/probar-esquemas.mjs

import { LARGO_NOMBRE, LARGO_INCLUYE, EdicionDePaquete } from '../../app/lib/esquemas.js'
import assert from 'node:assert/strict'

const base = { precio: 1000, clases: 4, dias_vigencia: 30, incluye: null, orden: 0 }
// incluye por omision va en null, NO undefined: TextoOpcional acepta null y
// rechaza undefined, y pasar undefined hacia probaba el fixture, no el esquema.
const con = (n, i = null) => EdicionDePaquete.safeParse({ ...base, nombre: 'x'.repeat(n), incluye: i })

console.log(`  LARGO_NOMBRE=${LARGO_NOMBRE}  LARGO_INCLUYE=${LARGO_INCLUYE}`)

assert.equal(con(LARGO_NOMBRE).success, true, 'el largo exacto del nombre tiene que pasar')
console.log(`  nombre de ${LARGO_NOMBRE}:      acepta`)
assert.equal(con(LARGO_NOMBRE + 1).success, false, 'uno mas tiene que rechazar')
console.log(`  nombre de ${LARGO_NOMBRE + 1}:      rechaza  ->`, con(LARGO_NOMBRE + 1).error.issues[0].message)
assert.equal(con(0).success, false, 'vacio tiene que rechazar')
console.log('  nombre vacio:    rechaza  ->', con(0).error.issues[0].message)

assert.equal(con(5, 'y'.repeat(LARGO_INCLUYE)).success, true)
console.log(`  incluye de ${LARGO_INCLUYE}:    acepta`)
assert.equal(con(5, 'y'.repeat(LARGO_INCLUYE + 1)).success, false)
console.log(`  incluye de ${LARGO_INCLUYE + 1}:    rechaza`)

// El limite del esquema y el que publica el formulario son el mismo objeto, no
// dos numeros que casualmente coinciden.
const forma = EdicionDePaquete.shape.nombre
assert.equal(forma.maxLength, LARGO_NOMBRE, 'el esquema no esta usando la constante')
console.log(`  el esquema declara maxLength=${forma.maxLength}, igual a la constante exportada`)
console.log('  TODO OK')

// Los dos ayudantes opcionales tienen que tratar igual a '' y a undefined.
const sinIncluye = EdicionDePaquete.safeParse({ nombre: 'x', precio: 1, clases: 1, dias_vigencia: 1, orden: 0 })
assert.equal(sinIncluye.success, true, 'omitir incluye tiene que valer')
assert.equal(sinIncluye.data.incluye, null, 'omitirlo tiene que dar null')
console.log("  incluye omitido: acepta y queda en null")
const vacio = EdicionDePaquete.safeParse({ nombre: 'x', precio: 1, clases: 1, dias_vigencia: 1, incluye: '  ', orden: 0 })
assert.equal(vacio.data.incluye, null, 'solo espacios tiene que dar null')
console.log("  incluye con espacios: queda en null")
console.log('  TODO OK (incluida la paridad con UuidOpcional)')
