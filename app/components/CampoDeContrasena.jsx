'use client'

import { useState } from 'react'
import { LARGO_MINIMO, PATRON, fortalezaDe, reglasDe } from '../lib/contrasena'

// LA ÚNICA EXCEPCIÓN A "CERO 'use client'" DEL PROYECTO, y tiene un límite
// estricto: el medidor es un agregado, no una dependencia. Nada funcional pasa
// por acá.
//
// Si el navegador no ejecuta JavaScript, este componente igual se renderiza en
// el servidor y lo que queda es un campo de contraseña normal con su `pattern`,
// su `minLength` y la lista de requisitos a la vista. Lo único que se pierde es
// la barra moviéndose. Quien valida sigue siendo, en este orden: el `pattern`
// del navegador, esValida() en la Server Action, y las Password Requirements
// de Supabase, que es la única que no se puede saltear.
//
// Va sin `value` controlado a propósito: con defaultValue el input es HTML
// común y escribir funciona aunque React nunca hidrate. El estado existe solo
// para pintar la barra.
export default function CampoDeContrasena({
  id = 'contrasena',
  name = 'contrasena',
  autoComplete = 'new-password',
  etiqueta = 'Contraseña',
}) {
  const [valor, setValor] = useState('')
  const fuerza = fortalezaDe(valor)
  const reglas = reglasDe(valor)
  const idReglas = `${id}-reglas`

  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>

      <input
        type="password"
        id={id}
        name={name}
        autoComplete={autoComplete}
        minLength={LARGO_MINIMO}
        pattern={PATRON}
        required
        defaultValue=""
        onChange={(e) => setValor(e.target.value)}
        aria-describedby={idReglas}
      />

      {/* <meter> y no un div con ancho: es el elemento que HTML tiene para
          "una medida dentro de un rango conocido", y los lectores de pantalla
          lo anuncian como tal. Sin JavaScript queda en cero y no estorba. */}
      <div className="fortaleza">
        <meter
          className="fortaleza-barra"
          min={0}
          max={4}
          low={2}
          high={3}
          optimum={4}
          value={fuerza.nivel}
          aria-label="Fortaleza de la contraseña"
        />
        <span className="fortaleza-texto" aria-live="polite">
          {fuerza.etiqueta}
        </span>
      </div>

      {/* La lista se renderiza siempre, con JavaScript o sin él: es la que dice
          qué se pide. Las marcas de cumplido son lo único que necesita JS. */}
      <ul className="reglas" id={idReglas}>
        {reglas.map((r) => (
          <li key={r.id} className={r.cumple ? 'regla regla-ok' : 'regla'}>
            <span aria-hidden="true">{r.cumple ? '✓' : '·'}</span> {r.texto}
          </li>
        ))}
      </ul>
    </div>
  )
}
