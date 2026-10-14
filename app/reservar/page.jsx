import Link from 'next/link'
import EncabezadoPagina from '../components/EncabezadoPagina'
import { enlaceWhatsapp, CUPO_MAXIMO } from '../datos/sitio'
import {
  desdeClave,
  diaCorto,
  estaFinalizada,
  rangoDeSemana,
  sinSegundos,
  textoDeFecha,
} from '../datos/agenda'
import { agendaDeLaSemana } from '../lib/agenda-db'
import { horasDeCancelacion } from '../lib/ajustes'
import { usuarioActual } from '../lib/supabase-sesion'
import { reservarClase } from '../acciones/reservas'

// Lo que puede contestar reservar_clase(), traducido. `sin_creditos` no está
// acá: no es un error de la persona sino un estado normal, y se muestra como un
// bloque aparte que explica qué hacer.
const RESULTADOS = {
  ok: { tono: 'bien', texto: 'Listo, tu lugar está reservado. Lo ves en Mi cuenta.' },
  completa: { tono: 'mal', texto: 'Esa clase se llenó mientras elegías. Probá con otro horario.' },
  ya_reservada: { tono: 'mal', texto: 'Ya tenías reservada esa clase.' },
  ya_paso: { tono: 'mal', texto: 'Esa clase ya empezó.' },
  no_disponible: { tono: 'mal', texto: 'Esa clase ya no está disponible.' },
  error: { tono: 'mal', texto: 'No pudimos reservar. Probá de nuevo.' },
}

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
  const [agenda, usuario, horas] = await Promise.all([
    agendaDeLaSemana(parametros?.dia),
    usuarioActual(),
    horasDeCancelacion(),
  ])

  const resultado = RESULTADOS[parametros?.r]
  const sinCreditos = parametros?.r === 'sin_creditos'

  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Reservar"
          bajada="Elegí el día y después el horario que te quede cómodo. Para reservar necesitás un paquete activo."
        />

        {resultado && (
          <p
            className={resultado.tono === 'bien' ? 'mensaje' : 'mensaje mensaje-error'}
            role={resultado.tono === 'bien' ? 'status' : 'alert'}
          >
            {resultado.texto}
          </p>
        )}

        {sinCreditos && <SinCreditos />}

        {agenda.error || agenda.sinAgenda ? (
          <AgendaNoDisponible sinAgenda={agenda.sinAgenda} horas={horas} />
        ) : (
          <>
            <TiraDeDias agenda={agenda} />
            <ClasesDelDia
              clave={agenda.elegido}
              turnos={agenda.turnos}
              usuario={usuario}
              horas={horas}
            />
          </>
        )}
      </div>
    </main>
  )
}

// No es un error: es que todavía no compró. Por eso no sale como mensaje rojo
// sino como un bloque que explica qué falta y lleva a comprarlo.
function SinCreditos() {
  return (
    <section className="aviso">
      <h2 className="titulo-seccion">Te faltan créditos</h2>
      <p>
        Cada clase que reservás usa un crédito, y ahora mismo no te queda
        ninguno disponible. Comprá un paquete y volvé a este horario: el lugar
        se reserva en el momento.
      </p>
      <Link href="/paquetes" className="boton boton-oscuro">
        Ver paquetes
      </Link>
    </section>
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

function ClasesDelDia({ clave, turnos, usuario, horas }) {
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
                      <AccionDeTurno
                        turno={turno}
                        hora={hora}
                        clave={clave}
                        usuario={usuario}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Acá y no solo en el bloque de error: el momento de enterarse de que se
          puede cancelar sin costo es antes de reservar, no cuando algo falla.
          La frase se arma entera en una expresión para que, cuando el ajuste no
          se pueda leer, no quede un espacio suelto antes del punto. */}
      <p className="nota">
        {typeof horas === 'number'
          ? `Cada reserva usa un crédito. Podés cancelar sin costo hasta ${horas} horas antes de la clase; pasada esa ventana, el crédito se pierde.`
          : 'Cada reserva usa un crédito.'}
      </p>
    </section>
  )
}

// El botón reserva de verdad. Sin JavaScript también: es un formulario que
// manda un POST a una Server Action, que a su vez llama a reservar_clase().
//
// Los lugares que muestra esta tabla pueden estar desactualizados por segundos,
// y está bien: el número de acá es informativo y el que decide es el de la
// base, adentro de la transacción. Si la clase se llenó mientras alguien
// elegía, la función contesta 'completa' y la página lo dice.
function AccionDeTurno({ turno, hora, clave, usuario }) {
  const cuando = `el ${textoDeFecha(clave)} a las ${hora}`

  if (turno.lugares === 0) {
    return (
      <a
        href={enlaceWhatsapp(
          `Hola, quiero anotarme en la lista de espera de ${turno.clase} ${cuando}.`
        )}
        className="enlace-tabla"
        target="_blank"
        rel="noopener"
        aria-label={`Anotarme en la lista de espera de ${turno.clase} ${cuando}, por WhatsApp`}
      >
        Lista de espera
      </a>
    )
  }

  // Sin sesión no se puede reservar, pero el intento no se pierde: después de
  // entrar vuelve a este mismo día.
  if (!usuario) {
    return (
      <Link
        href={`/ingresar?volver=${encodeURIComponent(`/reservar?dia=${clave}`)}`}
        className="enlace-tabla"
        aria-label={`Ingresar para reservar ${turno.clase} ${cuando}`}
      >
        Ingresar
      </Link>
    )
  }

  return (
    <form action={reservarClase}>
      <input type="hidden" name="clase_id" value={turno.clase_id} />
      <input type="hidden" name="dia" value={clave} />
      <button
        type="submit"
        className="enlace-tabla"
        aria-label={`Reservar ${turno.clase} ${cuando}`}
      >
        Reservar
      </button>
    </form>
  )
}

// Acá no hay aviso suave ni tira a medias: si no se puede leer la
// disponibilidad, no se ofrece ningún botón de reservar. Mostrar cupos que no
// podemos verificar sería mentirle a alguien que está por reservar un lugar.
function AgendaNoDisponible({ sinAgenda, horas }) {
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
      {/* La frase se arma entera en una expresión y no partida en el JSX: con
          el condicional suelto, cuando no hay horas que mostrar queda un
          espacio antes del punto ("personas ."). */}
      <p className="nota">
        {typeof horas === 'number'
          ? `Las clases son de hasta ${CUPO_MAXIMO} personas y se pueden cancelar sin costo hasta ${horas} horas antes.`
          : `Las clases son de hasta ${CUPO_MAXIMO} personas.`}
      </p>
    </section>
  )
}
