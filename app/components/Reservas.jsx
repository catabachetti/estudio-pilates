import Link from 'next/link'
import TablaHorarios from './TablaHorarios'

export default function Reservas() {
  return (
    <section className="seccion-clara" id="reservas">
      <div className="contenedor">
        <h2 className="titulo-seccion">Reservá tu lugar</h2>
        <p className="texto-seccion">
          Esta es la semana tipo. Para ver la disponibilidad real de cada
          fecha y elegir tu turno, entrá al calendario.
        </p>

        <TablaHorarios />

        <p className="llamado">
          <Link href="/reservar" className="boton boton-oscuro">
            Reservar una clase
          </Link>
        </p>
      </div>
    </section>
  )
}
