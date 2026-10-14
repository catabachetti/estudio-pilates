import SinPermiso from '../../components/SinPermiso'
import NavegacionDeDia from '../../components/NavegacionDeDia'
import { sesionAdmin } from '../../lib/autorizacion'
import { clienteConSesion } from '../../lib/supabase-sesion'
import { esFecha } from '../../lib/validacion'
import { ahoraEnElEstudio, sinSegundos } from '../../datos/agenda'

// Solo lectura: esta pantalla no escribe nada. Cancelar una reserva es decisión
// de quien la hizo, y vive en la cuenta de esa persona, no acá.
export default async function AdminReservasPage({ searchParams }) {
  const { esAdmin } = await sesionAdmin()
  if (!esAdmin) return <SinPermiso />

  const parametros = await searchParams
  const fecha = esFecha(parametros?.fecha) ? parametros.fecha : ahoraEnElEstudio().clave

  const { reservas, falla } = await leerReservas(fecha)

  const confirmadas = reservas.filter((r) => r.estado === 'confirmada').length

  return (
    <>
      <h1 className="pagina-titulo">Reservas</h1>
      <p className="seccion-texto">
        Quién viene cada día. Las canceladas quedan a la vista: la reserva no se
        borra, cambia de estado.
      </p>

      <NavegacionDeDia base="/admin/reservas" fecha={fecha} etiqueta="Navegación por día" />

      {falla ? (
        <div className="aviso">
          <h2 className="titulo-seccion">No pudimos leer las reservas</h2>
          <p>La consulta a la base falló. El motivo quedó en la consola del servidor.</p>
        </div>
      ) : reservas.length === 0 ? (
        <p className="seccion-texto">No hay reservas para este día.</p>
      ) : (
        <>
          <p className="seccion-texto">
            {confirmadas} {confirmadas === 1 ? 'reserva confirmada' : 'reservas confirmadas'}
            {reservas.length !== confirmadas &&
              ` y ${reservas.length - confirmadas} cancelada${reservas.length - confirmadas === 1 ? '' : 's'}`}
            .
          </p>

          {/* Las mismas clases que la tabla de /reservar: el estilo de tabla
              vive en .tabla-horarios y .tabla-turnos solo fija los anchos. */}
          <div className="bloque-grilla">
            <table className="tabla-horarios tabla-turnos">
              <caption>Reservas del día</caption>
              <colgroup>
                <col className="col-hora" />
                <col className="col-clase" />
                <col className="col-instructora" />
                <col className="col-cupos" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Hora</th>
                  <th scope="col">Clase</th>
                  <th scope="col">Persona</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {reservas.map((r) => (
                  <tr
                    key={r.id}
                    className={r.estado === 'cancelada' ? 'turno-finalizado' : undefined}
                  >
                    <td>{sinSegundos(r.hora)}</td>
                    <td>{r.clase}</td>
                    <td>{r.persona}</td>
                    <td>{r.estado === 'confirmada' ? 'Confirmada' : 'Cancelada'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

// Son dos consultas y no una, y no es una elección de estilo: PostgREST no
// puede unir `reservas` con `perfiles` porque no hay clave ajena entre ellas.
// `reservas.user_id` apunta a auth.users(id) y `perfiles.id` también, pero no
// hay una entre las dos, así que el embed falla con PGRST200. La alternativa
// sería agregar una segunda clave ajena redundante sobre la misma columna solo
// para que PostgREST tenga por dónde ir.
//
// La primera consulta sí usa embeds, porque reservas -> clases -> tipos_clase
// son claves ajenas de verdad. El `!inner` hace que el filtro por fecha de la
// clase recorte las reservas, y no que devuelva reservas con la clase vacía.
async function leerReservas(fecha) {
  const supabase = await clienteConSesion()

  const { data, error } = await supabase
    .from('reservas')
    .select('id, estado, user_id, clases!inner (fecha, hora, tipos_clase (nombre))')
    .eq('clases.fecha', fecha)

  if (error) {
    console.error('No se pudieron leer las reservas:', error.message)
    return { reservas: [], falla: true }
  }

  const nombres = await nombresDe(supabase, [...new Set(data.map((r) => r.user_id))])

  const reservas = data
    .map((r) => ({
      id: r.id,
      estado: r.estado,
      hora: r.clases.hora,
      clase: r.clases.tipos_clase?.nombre ?? 'Sin tipo',
      persona: nombres.get(r.user_id) ?? 'Sin nombre',
    }))
    .sort((a, b) => a.hora.localeCompare(b.hora) || a.persona.localeCompare(b.persona))

  return { reservas, falla: false }
}

async function nombresDe(supabase, ids) {
  if (ids.length === 0) return new Map()

  const { data, error } = await supabase.from('perfiles').select('id, nombre').in('id', ids)

  if (error) {
    console.error('No se pudieron leer los nombres:', error.message)
    return new Map()
  }
  return new Map(data.map((p) => [p.id, p.nombre]))
}
