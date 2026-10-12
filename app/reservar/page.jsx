import Link from 'next/link'
import EncabezadoPagina from '../components/EncabezadoPagina'
import { enlaceWhatsapp, HORAS_CANCELACION, CUPO_MAXIMO } from '../datos/sitio'
import {
  aClave,
  desdeClave,
  diaCorto,
  estaFinalizada,
  rangoDeSemana,
  textoDeFecha,
} from '../datos/agenda'
import { agendaDeLaSemana } from '../lib/agenda-db'

// Sin revalidate a propósito: los cupos cambian con cada reserva, así que una
// página cacheada aunque sea un minuto ya está mintiendo. Esta es la única
// pantalla del sitio donde los números son afirmaciones verificables.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Reservar | ACTIVE',
  description:
    'Elegí el día y el horario de tu clase de reformer. La disponibilidad es la real de cada fecha.',
}

export default async function ReservarPage({ searchParams }) {
  const parametros = await searchParams
  const agenda = await agendaDeLaSemana(parametros?.dia)

  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Reservar"
          bajada="Elegí el día y después el horario que te quede cómodo. Para reservar necesitás un paquete activo."
        />

        {agenda.error || agenda.sinAgenda ? (
          <AgendaNoDisponible sinAgenda={agenda.sinAgenda} />
        ) : (
          <>
            <TiraDeDias agenda={agenda} />
            <ClasesDelDia clave={agenda.elegido} turnos={agenda.turnos} />
          </>
        )}
      </div>
    </main>
  )
}

function TiraDeDias({ agenda }) {
  const fechas = agenda.dias.map(desdeClave)

  return (
    <nav className="tira" aria-label="Días de la semana">
      <div className="tira-barra">
        {agenda.anterior ? (
          <Link href={`/reservar?dia=${agenda.anterior}`} rel="prev">
            <span aria-hidden="true">←</span> Semana anterior
          </Link>
        ) : (
          <span className="apagado">
            <span aria-hidden="true">←</span> Semana anterior
          </span>
        )}

        <p className="tira-rango">{rangoDeSemana(fechas)}</p>

        {agenda.siguiente ? (
          <Link href={`/reservar?dia=${agenda.siguiente}`} rel="next">
            Semana siguiente <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className="apagado">
            Semana siguiente <span aria-hidden="true">→</span>
          </span>
        )}
      </div>

      <ul className="tira-dias">
        {agenda.dias.map((clave) => {
          const fecha = desdeClave(clave)
          const esElegido = clave === agenda.elegido
          return (
            <li key={clave}>
              <Link
                href={`/reservar?dia=${clave}`}
                className={`tira-dia${esElegido ? ' tira-dia-elegido' : ''}`}
                aria-current={esElegido ? 'date' : undefined}
              >
                <span className="tira-dia-nombre">{diaCorto(fecha)}</span>
                <span className="tira-dia-numero">{fecha.getDate()}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function ClasesDelDia({ clave, turnos }) {
  if (!clave || turnos.length === 0) {
    return (
      <section className="dia-detalle">
        <h2 className="titulo-seccion">Sin clases</h2>
        <p className="nota">Esta semana no hay clases cargadas.</p>
      </section>
    )
  }

  return (
    <section className="dia-detalle">
      <h2 className="titulo-seccion">{textoDeFecha(clave)}</h2>
      <div className="bloque-grilla">
        <table className="tabla-horarios tabla-turnos">
          <caption>Turnos y disponibilidad</caption>
          <colgroup>
            <col className="col-hora" />
            <col className="col-clase" />
            <col className="col-instructora" />
            <col className="col-cupos" />
            <col className="col-reserva" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Hora</th>
              <th scope="col">Clase</th>
              <th scope="col">Instructora</th>
              <th scope="col">Cupos</th>
              <th scope="col">Reserva</th>
            </tr>
          </thead>
          <tbody>
            {turnos.map((turno) => {
              const hora = sinSegundos(turno.hora)
              const finalizada = estaFinalizada(clave, hora)
              return (
                <tr key={turno.clase_id} className={finalizada ? 'turno-finalizado' : undefined}>
                  <th scope="row">{hora}</th>
                  <td>{turno.clase}</td>
                  <td>{turno.instructora ?? 'A confirmar'}</td>
                  <td>
                    {finalizada && 'Finalizada'}
                    {!finalizada && turno.lugares === 0 && 'Sin cupo'}
                    {!finalizada && turno.lugares === 1 && '1 lugar disponible'}
                    {!finalizada && turno.lugares > 1 && `${turno.lugares} lugares disponibles`}
                  </td>
                  <td>
                    {finalizada ? '' : (
                      <AccionDeTurno turno={turno} hora={hora} clave={clave} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// PROVISORIO HASTA E5: la reserva todavía no se guarda en ningún lado, así que
// el botón abre WhatsApp con la clase y la fecha ya escritas. Cuando exista el
// formulario contra la base de datos, esto pasa a ser un submit.
function AccionDeTurno({ turno, hora, clave }) {
  const cuando = `el ${textoDeFecha(clave)} a las ${hora}`
  const hayLugar = turno.lugares > 0
  const mensaje = hayLugar
    ? `Hola, quiero reservar ${turno.clase} ${cuando}.`
    : `Hola, quiero anotarme en la lista de espera de ${turno.clase} ${cuando}.`
  const texto = hayLugar ? 'Reservar' : 'Lista de espera'

  return (
    <a
      href={enlaceWhatsapp(mensaje)}
      className="enlace-tabla"
      target="_blank"
      rel="noopener"
      aria-label={`${texto} ${turno.clase} ${cuando}, por WhatsApp`}
    >
      {texto}
    </a>
  )
}

// Acá no hay aviso suave ni tira a medias: si no se puede leer la
// disponibilidad, no se ofrece ningún botón de reservar. Mostrar cupos que no
// podemos verificar sería mentirle a alguien que está por reservar un lugar.
function AgendaNoDisponible({ sinAgenda }) {
  return (
    <section className="aviso">
      <h2 className="titulo-seccion">
        {sinAgenda ? 'No hay clases cargadas' : 'No podemos mostrar la disponibilidad'}
      </h2>
      <p>
        {sinAgenda
          ? 'Todavía no está publicada la agenda de los próximos días.'
          : 'No estamos pudiendo consultar los lugares libres, así que preferimos no mostrar horarios que no podemos confirmar.'}{' '}
        Escribinos y te decimos qué turnos quedan.
      </p>
      <a
        href={enlaceWhatsapp('Hola, quiero reservar una clase. ¿Qué turnos tienen disponibles?')}
        className="boton boton-oscuro"
        target="_blank"
        rel="noopener"
        aria-label="Consultar los turnos disponibles por WhatsApp"
      >
        Consultar por WhatsApp
      </a>
      <p className="nota">
        Las clases son de hasta {CUPO_MAXIMO} personas y se pueden cancelar sin
        costo hasta {HORAS_CANCELACION} horas antes.
      </p>
    </section>
  )
}

// La base devuelve "07:00:00"; en pantalla va "7:00".
function sinSegundos(hora) {
  const [h, m] = hora.split(':')
  return `${Number(h)}:${m}`
}
