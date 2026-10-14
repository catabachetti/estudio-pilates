import Link from 'next/link'
import { redirect } from 'next/navigation'
import EncabezadoPagina from '../components/EncabezadoPagina'
import { clienteConSesion, usuarioActual } from '../lib/supabase-sesion'
import { resumenDeCreditos } from '../lib/creditos'
import { horasDeCancelacion } from '../lib/ajustes'
import { minutosHasta, sinSegundos, textoDeFecha } from '../datos/agenda'
import { cancelarReserva } from '../acciones/reservas'

export const metadata = {
  title: 'Mi cuenta | ACTIVE',
  description: 'Tus créditos y tus reservas.',
  robots: { index: false, follow: false },
}

const MENSAJES = {
  cancelada: null, // se arma aparte, porque depende del crédito
  ya_cancelada: 'Esa reserva ya estaba cancelada.',
  no_existe: 'No encontramos esa reserva.',
  error: 'No pudimos hacer el cambio. Probá de nuevo.',
}

export default async function CuentaPage({ searchParams }) {
  const usuario = await usuarioActual()
  // Caso 401: no sabemos quién es. Se lo manda a ingresar y vuelve acá.
  if (!usuario) redirect('/ingresar?volver=%2Fcuenta')

  const parametros = await searchParams
  const aviso = avisoDeCancelacion(parametros)
  const error = MENSAJES[parametros?.r]

  const supabase = await clienteConSesion()
  const [creditos, reservas, horas] = await Promise.all([
    resumenDeCreditos(supabase, usuario.id),
    leerReservas(supabase, usuario.id),
    horasDeCancelacion(),
  ])

  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Mi cuenta"
          bajada="Tus créditos y tus reservas. Desde acá cancelás si no vas a poder venir."
        />

        {aviso && (
          <p className="mensaje" role="status">
            {aviso}
          </p>
        )}

        {error && (
          <p className="mensaje mensaje-error" role="alert">
            {error}
          </p>
        )}

        <Creditos resumen={creditos} />
        <Reservas reservas={reservas} horas={horas} />
      </div>
    </main>
  )
}

function avisoDeCancelacion(parametros) {
  if (parametros?.r !== 'cancelada') return null
  return parametros.credito === 'devuelto'
    ? 'Reserva cancelada y crédito devuelto. Ya lo podés usar en otra clase.'
    : 'Reserva cancelada. Como faltaba menos que la ventana de cancelación, el crédito se usó igual.'
}

function Creditos({ resumen }) {
  if (!resumen) {
    return (
      <section className="aviso">
        <h2 className="titulo-seccion">No pudimos leer tus créditos</h2>
        <p>Probá de nuevo en un rato.</p>
      </section>
    )
  }

  if (resumen.total === 0) {
    return (
      <section className="aviso">
        <h2 className="titulo-seccion">Todavía no tenés créditos</h2>
        <p>
          Cada clase que reserves usa un crédito. Elegí un paquete y empezá a
          reservar.
        </p>
        <Link href="/paquetes" className="boton boton-oscuro">
          Ver paquetes
        </Link>
      </section>
    )
  }

  return (
    <section className="cuenta-bloque">
      <h2 className="seccion-titulo">Tus créditos</h2>

      <p className="cuenta-numero">
        {resumen.disponibles}{' '}
        <span>{resumen.disponibles === 1 ? 'disponible' : 'disponibles'}</span>
      </p>

      {resumen.porVencimiento.length > 0 && (
        <ul className="lista-simple cuenta-vencimientos">
          {resumen.porVencimiento.map((v) => (
            <li key={v.fecha}>
              {v.cantidad} {v.cantidad === 1 ? 'vence' : 'vencen'} el {textoDeFecha(v.fecha)}
            </li>
          ))}
        </ul>
      )}

      <p className="nota">
        {resumen.usados} {resumen.usados === 1 ? 'usado' : 'usados'} ·{' '}
        {resumen.vencidos} {resumen.vencidos === 1 ? 'vencido' : 'vencidos'}
      </p>

      {resumen.disponibles === 0 && (
        <Link href="/paquetes" className="boton boton-oscuro">
          Comprar más
        </Link>
      )}
    </section>
  )
}

function Reservas({ reservas, horas }) {
  if (!reservas) {
    return (
      <section className="aviso">
        <h2 className="titulo-seccion">No pudimos leer tus reservas</h2>
        <p>Probá de nuevo en un rato.</p>
      </section>
    )
  }

  const { proximas, pasadas } = reservas

  return (
    <>
      <section className="cuenta-bloque">
        <h2 className="seccion-titulo">Próximas clases</h2>

        {proximas.length === 0 ? (
          <p className="seccion-texto">
            No tenés reservas por delante.{' '}
            <Link href="/reservar" className="enlace-subrayado">
              Reservar una clase
            </Link>
          </p>
        ) : (
          <ul className="lista-simple cuenta-reservas">
            {proximas.map((r) => (
              <Proxima key={r.id} reserva={r} horas={horas} />
            ))}
          </ul>
        )}
      </section>

      {pasadas.length > 0 && (
        <section className="cuenta-bloque">
          <h2 className="seccion-titulo">Historial</h2>
          <ul className="lista-simple cuenta-reservas">
            {pasadas.map((r) => (
              <li key={r.id} className="cuenta-reserva cuenta-reserva-pasada">
                <p className="cuenta-reserva-cuando">
                  {textoDeFecha(r.fecha)} a las {sinSegundos(r.hora)}
                </p>
                <p className="nota">
                  {r.clase} · {r.etiqueta}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function Proxima({ reserva, horas }) {
  // Si falta menos que la ventana, cancelar cuesta el crédito. Se avisa ANTES
  // de apretar, no después: la persona tiene que poder decidir sabiendo.
  const pierdeElCredito =
    typeof horas === 'number' &&
    minutosHasta(reserva.fecha, reserva.hora) <= horas * 60

  return (
    <li className="cuenta-reserva">
      <div>
        <p className="cuenta-reserva-cuando">
          {textoDeFecha(reserva.fecha)} a las {sinSegundos(reserva.hora)}
        </p>
        <p className="nota">{reserva.clase}</p>
      </div>

      <form action={cancelarReserva} className="cuenta-cancelar">
        <input type="hidden" name="reserva_id" value={reserva.id} />

        <p className="nota">
          {pierdeElCredito
            ? 'Si cancelás ahora, el crédito se pierde.'
            : typeof horas === 'number'
              ? `Cancelás sin costo hasta ${horas} horas antes.`
              : 'Cancelás desde acá.'}
        </p>

        <button type="submit" className="boton boton-claro">
          Cancelar
        </button>
      </form>
    </li>
  )
}

// EL FILTRO POR user_id NO ES REDUNDANTE, aunque lo parezca. La política de
// `reservas` dice `user_id = auth.uid() or es_admin()`: para una cuenta
// cualquiera RLS ya devuelve solo las suyas, pero para una cuenta de
// administración devuelve las de todo el mundo, y esta pantalla pasaría a
// mostrarle a quien administra las reservas ajenas como si fueran propias.
//
// Se descubrió probando con la cuenta de admin: tenía cuatro reservas y la
// pantalla le mostraba cinco.
async function leerReservas(supabase, userId) {
  const { data, error } = await supabase
    .from('reservas')
    .select('id, estado, clases (fecha, hora, estado, tipos_clase (nombre))')
    .eq('user_id', userId)

  if (error) {
    console.error('No se pudieron leer las reservas:', error.message)
    return null
  }

  const proximas = []
  const pasadas = []

  for (const r of data) {
    const fila = {
      id: r.id,
      fecha: r.clases.fecha,
      hora: r.clases.hora,
      clase: r.clases.tipos_clase?.nombre ?? 'Clase',
      etiqueta: etiquetaDe(r),
    }

    const porDelante = minutosHasta(fila.fecha, fila.hora) > 0
    const vigente = r.estado === 'confirmada' && r.clases.estado === 'programada'

    if (porDelante && vigente) proximas.push(fila)
    else pasadas.push(fila)
  }

  proximas.sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))
  pasadas.sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`))

  return { proximas, pasadas }
}

function etiquetaDe(r) {
  if (r.clases.estado === 'cancelada') return 'La clase se canceló'
  if (r.estado === 'cancelada') return 'Cancelada'
  return 'Asististe'
}
