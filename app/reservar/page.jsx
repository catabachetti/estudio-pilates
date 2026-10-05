import Link from 'next/link'
import EncabezadoPagina from '../components/EncabezadoPagina'
import { enlaceWhatsapp, HORAS_CANCELACION, CUPO_MAXIMO } from '../datos/contenido'
import {
  aClave,
  clasesDe,
  diaCorto,
  diaPedido,
  estaAbierta,
  hasta,
  hayAnterior,
  primerDiaDeSemana,
  rangoDeSemana,
  semanaAnterior,
  semanaDe,
  semanaSiguiente,
  textoDeFecha,
  SEMANAS_ABIERTAS,
} from '../datos/agenda'

export const metadata = {
  title: 'Reservar | ACTIVE',
  description:
    'Elegí el día y el horario de tu clase de reformer. Agenda abierta con ocho semanas de anticipación.',
}

export default async function ReservarPage({ searchParams }) {
  const parametros = await searchParams
  const elegido = diaPedido(parametros?.dia)
  const dias = semanaDe(elegido)
  const anterior = semanaAnterior(elegido)
  const siguiente = semanaSiguiente(elegido)

  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Reservar"
          bajada="Elegí el día y después el horario que te quede cómodo. Para reservar necesitás un paquete activo."
        />

        <nav className="tira" aria-label="Días de la semana">
          <div className="tira-barra">
            {hayAnterior(elegido) ? (
              <Link href={`/reservar?dia=${primerDiaDeSemana(anterior)}`} rel="prev">
                <span aria-hidden="true">←</span> Semana anterior
              </Link>
            ) : (
              <span className="apagado">
                <span aria-hidden="true">←</span> Semana anterior
              </span>
            )}

            <p className="tira-rango">{rangoDeSemana(dias)}</p>

            {hasta(siguiente) ? (
              <Link href={`/reservar?dia=${primerDiaDeSemana(siguiente)}`} rel="next">
                Semana siguiente <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <span className="apagado">
                Semana siguiente <span aria-hidden="true">→</span>
              </span>
            )}
          </div>

          <ul className="tira-dias">
            {dias.map((dia) => {
              const clave = aClave(dia)
              const abierto = estaAbierta(dia)
              const esElegido = clave === elegido
              return (
                <li key={clave}>
                  {abierto ? (
                    <Link
                      href={`/reservar?dia=${clave}`}
                      className={`tira-dia${esElegido ? ' tira-dia-elegido' : ''}`}
                      aria-current={esElegido ? 'date' : undefined}
                    >
                      <span className="tira-dia-nombre">{diaCorto(dia)}</span>
                      <span className="tira-dia-numero">{dia.getDate()}</span>
                    </Link>
                  ) : (
                    <span className="tira-dia tira-dia-cerrado">
                      <span className="tira-dia-nombre">{diaCorto(dia)}</span>
                      <span className="tira-dia-numero">{dia.getDate()}</span>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <ClasesDelDia clave={elegido} />
      </div>
    </main>
  )
}

function ClasesDelDia({ clave }) {
  const clases = clasesDe(clave)

  if (clases.length === 0) {
    return (
      <section className="dia-detalle">
        <h2 className="titulo-seccion">{textoDeFecha(clave)}</h2>
        <p className="nota">Ese día el estudio no abre.</p>
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
            {clases.map((clase) => (
              <tr key={clase.hora} className={clase.finalizada ? 'turno-finalizado' : undefined}>
                <th scope="row">{clase.hora}</th>
                <td>{clase.clase}</td>
                <td>{clase.instructora}</td>
                <td>
                  {clase.finalizada && 'Finalizada'}
                  {!clase.finalizada && clase.cupos === 0 && 'Sin cupo'}
                  {!clase.finalizada && clase.cupos === 1 && '1 lugar disponible'}
                  {!clase.finalizada && clase.cupos > 1 && `${clase.cupos} lugares disponibles`}
                </td>
                <td>{clase.finalizada ? '' : <AccionDeTurno clase={clase} clave={clave} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// PROVISORIO HASTA E5: la reserva todavía no se guarda en ningún lado, así que
// el botón abre WhatsApp con la clase y la fecha ya escritas. Cuando exista el
// formulario contra la base de datos, esto pasa a ser un submit.
function AccionDeTurno({ clase, clave }) {
  const cuando = `el ${textoDeFecha(clave)} a las ${clase.hora}`
  const hayLugar = clase.cupos > 0
  const mensaje = hayLugar
    ? `Hola, quiero reservar ${clase.clase} ${cuando}.`
    : `Hola, quiero anotarme en la lista de espera de ${clase.clase} ${cuando}.`
  const texto = hayLugar ? 'Reservar' : 'Lista de espera'

  return (
    <a
      href={enlaceWhatsapp(mensaje)}
      className="enlace-tabla"
      target="_blank"
      rel="noopener"
      aria-label={`${texto} ${clase.clase} ${cuando}, por WhatsApp`}
    >
      {texto}
    </a>
  )
}
