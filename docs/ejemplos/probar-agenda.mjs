// Comprueba que el aviso "No hay clases cargadas" pueda aparecer.
//
// EL BUG QUE ESTO PRUEBA. `agendaDeLaSemana()` calculaba `ultimaFecha` con la
// última clase programada de la tabla **sin mirar si ya había pasado**. Como
// las clases pasadas no se borran, esa consulta nunca devolvía null, así que
// `sinAgenda` nunca era true, así que el bloque `AgendaNoDisponible` —que
// existe exactamente para el caso "se agotó la agenda"— no se podía mostrar
// nunca. Lo que se iba a ver el 6 de diciembre era la agenda normal con la
// tira de días vacía y sin ninguna explicación.
//
// POR QUE ESTA PRUEBA ES ASI, Y NO UNA DE NAVEGADOR. El cálculo pasa en el
// servidor, así que `page.clock` de Playwright no sirve: mueve el reloj del
// navegador. Y provocar la condición en Supabase querría decir cancelar todas
// las clases futuras del sitio.
//
// Entonces se prueba en dos niveles, y hacen falta los dos:
//
//   1. Que el filtro haga lo que creemos, contra Postgres de verdad: eso está
//      en supabase/probar-agenda-agotada.sh.
//   2. Que la función USE ese resultado para poner `sinAgenda`, acá, con un
//      cliente de mentira que además registra los filtros que recibió.
//
// El cliente de mentira podría estar mal y dar un falso verde, que es el riesgo
// de cualquier doble. Por eso no solo devuelve datos: **afirma que la consulta
// llevaba el filtro `gte('fecha', hoy)`**. Si mañana alguien lo saca, el nivel
// 1 sigue pasando y este falla.
//
// Uso:  node docs/ejemplos/probar-agenda.mjs
import assert from 'node:assert/strict'
import { agendaDeLaSemana } from '../../app/lib/agenda-db.js'
import { aClave, hoy } from '../../app/datos/agenda.js'

const HOY = aClave(hoy())

// Un cliente que imita lo justo de la interfaz de Supabase que usa
// agendaDeLaSemana, y anota cada filtro.
function clienteDeMentira({ ultima, filas = [], turnos = [] }) {
  const consultas = []

  function constructor(tabla) {
    const registro = { tabla, filtros: [] }
    consultas.push(registro)

    const api = {
      select: () => api,
      eq: (campo, valor) => (registro.filtros.push(['eq', campo, valor]), api),
      gte: (campo, valor) => (registro.filtros.push(['gte', campo, valor]), api),
      lte: (campo, valor) => (registro.filtros.push(['lte', campo, valor]), api),
      order: () => api,
      limit: () => api,
      maybeSingle: async () => ({ data: ultima, error: null }),
      // La segunda consulta se espera directo, sin maybeSingle.
      then: (resolver) => resolver({ data: filas, error: null }),
    }
    return api
  }

  return {
    from: constructor,
    rpc: async () => ({ data: turnos, error: null }),
    consultas,
  }
}

console.log(`=== hoy, en la zona del estudio: ${HOY} ===`)
console.log()

// ---------------------------------------------------------------------------
console.log('--- 1. agenda agotada: la consulta no devuelve nada')
{
  const cliente = clienteDeMentira({ ultima: null })
  const agenda = await agendaDeLaSemana(undefined, cliente)

  assert.equal(agenda.sinAgenda, true, 'con ultimaFecha null tiene que dar sinAgenda')
  assert.equal(agenda.error, null)
  console.log('  sinAgenda: true  ->  /reservar muestra "No hay clases cargadas"')

  // LA AFIRMACION QUE PROTEGE EL ARREGLO: la consulta tiene que haber pedido
  // solo las clases de hoy en adelante.
  const primera = cliente.consultas[0]
  assert.equal(primera.tabla, 'clases')
  const gte = primera.filtros.find(([op, campo]) => op === 'gte' && campo === 'fecha')
  assert.ok(gte, 'la consulta de ultimaFecha NO lleva el filtro gte(fecha): el bug volvió')
  assert.equal(gte[2], HOY, `el filtro tiene que ser gte(fecha, ${HOY}), vino ${gte[2]}`)
  console.log(`  y la consulta pidió gte('fecha', '${HOY}')`)

  const eq = primera.filtros.find(([op, campo]) => op === 'eq' && campo === 'estado')
  assert.equal(eq?.[2], 'programada', 'tiene que filtrar por estado programada')
  console.log("  y eq('estado', 'programada')")
}

// ---------------------------------------------------------------------------
console.log()
console.log('--- 2. agenda con clases por delante: sinAgenda no se enciende')
{
  const dentroDeUnMes = new Date(hoy())
  dentroDeUnMes.setDate(dentroDeUnMes.getDate() + 30)
  const ultimaFecha = aClave(dentroDeUnMes)

  const cliente = clienteDeMentira({
    ultima: { fecha: ultimaFecha },
    filas: [{ fecha: HOY }],
    turnos: [{ clase_id: 'x', hora: '18:00', clase: 'Reformer Flow', lugares_libres: 6 }],
  })
  const agenda = await agendaDeLaSemana(undefined, cliente)

  assert.notEqual(agenda.sinAgenda, true, 'con clases por delante no puede dar sinAgenda')
  assert.equal(agenda.ultimaFecha, ultimaFecha)
  assert.deepEqual(agenda.dias, [HOY])
  assert.equal(agenda.elegido, HOY)
  assert.equal(agenda.turnos.length, 1)
  console.log(`  ultimaFecha: ${ultimaFecha}  dias: ${agenda.dias.length}  turnos: ${agenda.turnos.length}`)
  console.log(`  siguiente: ${agenda.siguiente ?? 'null'}`)
}

// ---------------------------------------------------------------------------
console.log()
console.log('--- 3. el caso del bug: una clase pasada NO alcanza para tener agenda')
{
  // Esto es lo que devolvía la consulta ANTES del arreglo: la última clase de
  // la tabla, aunque fuera de hace un mes. Con el filtro puesto, Postgres ya no
  // la devuelve —eso lo prueba el nivel 1— pero si alguien saca el filtro, la
  // función tiene que seguir siendo honesta con lo que recibe.
  const haceUnMes = new Date(hoy())
  haceUnMes.setDate(haceUnMes.getDate() - 30)
  const pasada = aClave(haceUnMes)

  const cliente = clienteDeMentira({ ultima: { fecha: pasada }, filas: [] })
  const agenda = await agendaDeLaSemana(undefined, cliente)

  // No hay días en la semana, así que no hay nada que elegir ni que mostrar.
  assert.deepEqual(agenda.dias, [])
  assert.equal(agenda.elegido, null)
  assert.equal(agenda.turnos.length, 0)
  // Y no se puede avanzar: el lunes siguiente ya es posterior a la última.
  assert.equal(agenda.siguiente, null)
  console.log('  dias: 0  elegido: null  siguiente: null')
  console.log('  ^ es exactamente la pantalla vacía y sin aviso que el arreglo evita')
}

console.log()
console.log('TODO OK')
