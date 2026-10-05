import Link from 'next/link'
import EncabezadoPagina from '../components/EncabezadoPagina'
import TablaHorarios from '../components/TablaHorarios'
import { DURACION_CLASE } from '../datos/agenda'
import { CUPO_MAXIMO } from '../datos/contenido'

export const metadata = {
  title: 'Horarios | ACTIVE',
  description:
    'Grilla semanal de clases de reformer en Palermo: horarios de lunes a viernes y sábados por la mañana.',
}

export default function HorariosPage() {
  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Horarios"
          bajada={`Esta es nuestra semana tipo. Todas las clases duran ${DURACION_CLASE} minutos y son de hasta ${CUPO_MAXIMO} personas. Para ver la disponibilidad real de cada fecha, entrá al calendario.`}
        />

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
