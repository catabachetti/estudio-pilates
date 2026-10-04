import Link from 'next/link'
import TablaHorarios from '../components/TablaHorarios'

export const metadata = {
  title: 'Horarios | ACTIVE',
  description:
    'Grilla semanal de clases de reformer en Palermo. Turnos de lunes a viernes de 7:00 a 21:00 y sábados por la mañana.',
}

export default function HorariosPage() {
  return (
    <main className="seccion">
      <div className="contenedor">
        <h1 className="pagina-titulo">Horarios</h1>
        <p className="seccion-texto">
          Esta es nuestra semana tipo. Todas las clases duran 50 minutos y son
          de hasta seis personas. Para ver la disponibilidad real de cada fecha,
          entrá al calendario.
        </p>

        <TablaHorarios />

        <p className="llamado">
          <Link href="/reservar" className="boton boton-oscuro">
            Reservar una clase
          </Link>
        </p>
      </div>
    </main>
  )
}
