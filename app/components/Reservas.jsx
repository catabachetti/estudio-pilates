import Link from 'next/link'
import TablaHorarios from './TablaHorarios'
import { semanaTipo } from '../lib/horarios'

export default async function Reservas() {
  const { bloques, error } = await semanaTipo()

  // En la home, si la grilla no se puede leer, la sección se omite: el resto de
  // la página sigue y /reservar tiene su propio camino.
  if (error || bloques.length === 0) {
    return null
  }

  return (
    <section className="seccion-clara" id="reservas">
      <div className="contenedor">
        <h2 className="titulo-seccion">Reservá tu lugar</h2>
        <p className="texto-seccion">
          Esta es la semana tipo. Para ver la disponibilidad real de cada
          fecha y elegir tu turno, entrá al calendario.
        </p>

        <TablaHorarios bloques={bloques} />

        <p className="llamado">
          <Link href="/reservar" className="boton boton-oscuro">
            Reservar una clase
          </Link>
        </p>
      </div>
    </section>
  )
}
