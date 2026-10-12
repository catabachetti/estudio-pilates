import Link from 'next/link'
import EncabezadoPagina from '../components/EncabezadoPagina'
import TablaHorarios from '../components/TablaHorarios'
import { DURACION_CLASE } from '../datos/agenda'
import { CUPO_MAXIMO, enlaceWhatsapp } from '../datos/sitio'
import { semanaTipo } from '../lib/horarios'

export const metadata = {
  title: 'Horarios | ACTIVE',
  description:
    'Grilla semanal de clases de reformer en Palermo: horarios de lunes a viernes y sábados por la mañana.',
}

// La grilla sale de las clases ya cargadas, así que cambia cuando cambia la
// agenda. Una hora de cache alcanza: la semana tipo no se toca todos los días.
export const revalidate = 3600

export default async function HorariosPage() {
  const { bloques, error } = await semanaTipo()

  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Horarios"
          bajada={`Esta es nuestra semana tipo. Todas las clases duran ${DURACION_CLASE} minutos y son de hasta ${CUPO_MAXIMO} personas. Para ver la disponibilidad real de cada fecha, entrá al calendario.`}
        />

        {error || bloques.length === 0 ? (
          <GrillaNoDisponible />
        ) : (
          <>
            <TablaHorarios bloques={bloques} />

            <p className="llamado">
              <Link href="/reservar" className="boton boton-oscuro">
                Reservar una clase
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function GrillaNoDisponible() {
  return (
    <section className="aviso">
      <h2 className="titulo-seccion">No podemos mostrar los horarios ahora</h2>
      <p>
        Estamos teniendo un problema para cargar la grilla. Escribinos y te
        pasamos los horarios de esta semana.
      </p>
      <a
        href={enlaceWhatsapp('Hola, quiero consultar los horarios de las clases.')}
        className="boton boton-oscuro"
        target="_blank"
        rel="noopener"
        aria-label="Consultar los horarios por WhatsApp"
      >
        Consultar por WhatsApp
      </a>
    </section>
  )
}
