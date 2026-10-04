import Link from 'next/link'
import { enlaceWhatsapp } from '../datos/contenido'
import {
  aClave,
  claveDeMes,
  clasesDe,
  estaAbierta,
  hoy,
  mesPedido,
  nombreDeMes,
  semanasDelMes,
  textoDeFecha,
  SEMANAS_ABIERTAS,
} from '../datos/agenda'

export const metadata = {
  title: 'Reservar | ACTIVE',
  description:
    'Elegí el día y el horario de tu clase de reformer. Agenda abierta con ocho semanas de anticipación.',
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default async function ReservarPage({ searchParams }) {
  const parametros = await searchParams
  const { anio, mes } = mesPedido(parametros?.mes)
  const diaElegido =
    typeof parametros?.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parametros.dia)
      ? parametros.dia
      : null

  const hoyClave = aClave(hoy())
  const esteMes = claveDeMes(anio, mes)
  const anterior = new Date(anio, mes - 1, 1)
  const siguiente = new Date(anio, mes + 1, 1)
  const primeroDeEsteMes = new Date(hoy().getFullYear(), hoy().getMonth(), 1)
  const hayAnterior = anterior >= primeroDeEsteMes

  return (
    <main className="seccion">
      <div className="contenedor">
        <h1 className="pagina-titulo">Reservar</h1>
        <p className="seccion-texto">
          La agenda está abierta {SEMANAS_ABIERTAS} semanas. Elegí un día con
          clases y después el horario que te quede cómodo.
        </p>

        <div className="calendario">
          <div className="calendario-barra">
            {hayAnterior ? (
              <Link
                href={`/reservar?mes=${claveDeMes(anterior.getFullYear(), anterior.getMonth())}`}
                className="calendario-flecha"
                rel="prev"
              >
                <span aria-hidden="true">←</span> Mes anterior
              </Link>
            ) : (
              <span className="calendario-flecha apagada">
                <span aria-hidden="true">←</span> Mes anterior
              </span>
            )}

            <Link
              href={`/reservar?mes=${claveDeMes(siguiente.getFullYear(), siguiente.getMonth())}`}
              className="calendario-flecha"
              rel="next"
            >
              Mes siguiente <span aria-hidden="true">→</span>
            </Link>
          </div>

          <table className="calendario-tabla">
            <caption>{nombreDeMes(anio, mes)}</caption>
            <thead>
              <tr>
                {DIAS.map((dia) => (
                  <th scope="col" key={dia}>
                    {dia}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {semanasDelMes(anio, mes).map((semana, i) => (
                <tr key={i}>
                  {semana.map((fecha, j) => {
                    if (!fecha) return <td key={j} className="dia-vacio" />
                    const clave = aClave(fecha)
                    const abierta = estaAbierta(fecha)
                    const esHoy = clave === hoyClave
                    const elegido = clave === diaElegido
                    return (
                      <td
                        key={j}
                        className={`dia${elegido ? ' dia-elegido' : ''}`}
                        aria-current={esHoy ? 'date' : undefined}
                      >
                        {abierta ? (
                          <Link href={`/reservar?mes=${esteMes}&dia=${clave}`}>
                            {fecha.getDate()}
                          </Link>
                        ) : (
                          <span className="dia-cerrado">{fecha.getDate()}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {diaElegido && <ClasesDelDia clave={diaElegido} />}
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
      <table className="tabla-horarios">
        <caption>Turnos y disponibilidad</caption>
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
            <tr key={clase.hora}>
              <th scope="row">{clase.hora}</th>
              <td>{clase.clase}</td>
              <td>{clase.instructora}</td>
              <td>
                {clase.cupos === 0 && 'Sin cupo'}
                {clase.cupos === 1 && '1 lugar disponible'}
                {clase.cupos > 1 && `${clase.cupos} lugares disponibles`}
              </td>
              <td>
                <AccionDeTurno clase={clase} clave={clave} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

// PROVISORIO HASTA E5: la reserva todavia no se guarda en ningun lado, asi que
// el boton abre WhatsApp con la clase y la fecha ya escritas. Cuando exista el
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
