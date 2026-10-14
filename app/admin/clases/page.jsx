import SinPermiso from '../../components/SinPermiso'
import NavegacionDeDia from '../../components/NavegacionDeDia'
import { sesionAdmin } from '../../lib/autorizacion'
import { clienteConSesion } from '../../lib/supabase-sesion'
import { esFecha } from '../../lib/validacion'
import { CUPO_MAXIMO } from '../../datos/sitio'
import { ahoraEnElEstudio, sinSegundos } from '../../datos/agenda'
import {
  crearClase,
  editarClase,
  cambiarEstadoClase,
} from '../../acciones/admin-clases'

const MENSAJES = {
  fecha: 'Revisá la fecha: no parece una fecha válida.',
  hora: 'Revisá la hora: tiene que ser una hora del día, como 07:00.',
  tipo: 'Elegí un tipo de clase.',
  instructora: 'Esa instructora no es válida.',
  cupo: 'El cupo tiene que ser un número entero mayor que cero.',
  ocupada: 'Ya hay una clase ese día a esa hora. Si la habías cancelado, reactivala en vez de crear otra.',
  inexistente: 'El tipo de clase o la instructora que elegiste ya no existen.',
  permiso: 'La base rechazó el cambio: tu cuenta no tiene permiso para editar la agenda.',
  guardar: 'No pudimos guardar el cambio. Probá de nuevo.',
  id: 'No se entendió qué clase había que modificar.',
}

const AVISOS = {
  creada: 'Clase creada. Ya aparece en el sitio.',
  guardada: 'Guardado. El sitio público ya muestra el cambio.',
  cancelada: 'Clase cancelada. Dejó de aparecer en el sitio, y las reservas que tenía siguen en pie.',
  reactivada: 'Clase reactivada. Volvió a aparecer en el sitio.',
}

// El cupo ocupado necesita decir cuántas reservas hay, así que el número viaja
// en la URL. Viene de afuera, así que se lo trata como texto cualquiera: si no
// es un entero razonable, se usa el mensaje genérico.
function mensajeDeError(parametros) {
  if (parametros?.error !== 'cupo-ocupado') return MENSAJES[parametros?.error]

  const n = Number(parametros.reservas)
  if (!Number.isInteger(n) || n < 0 || n > 999) return MENSAJES.guardar

  return `Esa clase ya tiene ${n} ${n === 1 ? 'reserva confirmada' : 'reservas confirmadas'}: el cupo no puede quedar por debajo de ese número. No se puede dejar afuera a alguien que ya reservó.`
}

export default async function AdminClasesPage({ searchParams }) {
  const { esAdmin } = await sesionAdmin()
  if (!esAdmin) return <SinPermiso />

  const parametros = await searchParams
  const fecha = esFecha(parametros?.fecha) ? parametros.fecha : ahoraEnElEstudio().clave
  const error = mensajeDeError(parametros)
  const aviso = AVISOS[parametros?.estado]

  const { clases, tipos, instructoras, falla } = await leerDia(fecha)

  return (
    <>
      <h1 className="pagina-titulo">Clases</h1>
      <p className="seccion-texto">
        Cancelar no borra: la clase deja de aparecer en el sitio y las reservas
        que tenga siguen en pie, a la vista acá abajo.
      </p>

      {error && (
        <p className="mensaje mensaje-error" role="alert">
          {error}
        </p>
      )}

      {aviso && (
        <p className="mensaje" role="status">
          {aviso}
        </p>
      )}

      <NavegacionDeDia base="/admin/clases" fecha={fecha} etiqueta="Navegación por día" />

      {falla ? (
        <div className="aviso">
          <h2 className="titulo-seccion">No pudimos leer la agenda</h2>
          <p>La consulta a la base falló. El motivo quedó en la consola del servidor.</p>
        </div>
      ) : (
        <>
          {clases.length === 0 ? (
            <p className="seccion-texto">No hay clases cargadas para este día.</p>
          ) : (
            <ul className="admin-lista">
              {clases.map((clase) => (
                <Clase
                  key={clase.id}
                  clase={clase}
                  fecha={fecha}
                  tipos={tipos}
                  instructoras={instructoras}
                />
              ))}
            </ul>
          )}

          <NuevaClase fecha={fecha} tipos={tipos} instructoras={instructoras} />
        </>
      )}
    </>
  )
}

function Clase({ clase, fecha, tipos, instructoras }) {
  const cancelada = clase.estado === 'cancelada'

  return (
    <li className={`admin-item${cancelada ? ' admin-item-cancelado' : ''}`}>
      <div className="admin-item-encabezado">
        <h3 className="admin-item-titulo">
          {sinSegundos(clase.hora)} · {clase.tipos_clase?.nombre ?? 'Sin tipo'}
        </h3>
        <p className="admin-item-estado">
          {cancelada ? 'Cancelada' : 'Programada'}
          {' · '}
          {clase.instructoras?.nombre ?? 'Sin instructora'}
          {' · '}
          {textoDeOcupacion(clase, cancelada)}
        </p>
      </div>

      <form action={editarClase} className="admin-formulario">
        <input type="hidden" name="id" value={clase.id} />
        <input type="hidden" name="fecha" value={fecha} />

        <SelectorDeTipo clase={clase} tipos={tipos} />
        <SelectorDeInstructora clase={clase} instructoras={instructoras} />

        <div className="campo">
          <label htmlFor={`cupo-${clase.id}`}>Cupo</label>
          <input
            type="number"
            id={`cupo-${clase.id}`}
            name="cupo_total"
            defaultValue={clase.cupo_total}
            min={1}
            step={1}
            required
          />
        </div>

        <button type="submit" className="boton boton-oscuro">
          Guardar
        </button>
      </form>

      <form action={cambiarEstadoClase} className="admin-formulario-corto">
        <input type="hidden" name="id" value={clase.id} />
        <input type="hidden" name="fecha" value={fecha} />
        <input type="hidden" name="estado" value={cancelada ? 'programada' : 'cancelada'} />
        <button type="submit" className="boton boton-claro">
          {cancelada ? 'Reactivar' : 'Cancelar clase'}
        </button>
      </form>
    </li>
  )
}

// En una clase cancelada no hay lugares tomados: el disparador de la migración
// 011 pasó sus reservas a canceladas y les devolvió el crédito. Pero esas
// personas tenían un lugar y hay que avisarles, así que el número no puede
// desaparecer de la pantalla: se muestra cuántas reservas quedaron liberadas.
// Los nombres están en /admin/reservas, que lista también las canceladas.
function textoDeOcupacion(clase, cancelada) {
  if (clase.reservas === null) {
    return `cupo ${clase.cupo_total}, no se pudieron contar las reservas`
  }

  if (cancelada) {
    return clase.liberadas === 0
      ? 'no tenía reservas'
      : `${clase.liberadas} ${clase.liberadas === 1 ? 'reserva quedó liberada' : 'reservas quedaron liberadas'}`
  }

  return `${clase.reservas} de ${clase.cupo_total} ${clase.reservas === 1 ? 'lugar tomado' : 'lugares tomados'}`
}

function SelectorDeTipo({ clase, tipos }) {
  return (
    <div className="campo">
      <label htmlFor={`tipo-${clase.id}`}>Tipo</label>
      <select
        id={`tipo-${clase.id}`}
        name="tipo_clase_id"
        defaultValue={clase.tipo_clase_id}
        required
      >
        {tipos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>
    </div>
  )
}

function SelectorDeInstructora({ clase, instructoras }) {
  return (
    <div className="campo">
      <label htmlFor={`instructora-${clase.id}`}>Instructora</label>
      <select
        id={`instructora-${clase.id}`}
        name="instructora_id"
        defaultValue={clase.instructora_id ?? ''}
      >
        {/* La columna admite null: una clase sin instructora asignada es
            válida y tiene que poder volver a quedar sin ninguna. */}
        <option value="">Sin asignar</option>
        {instructoras.map((i) => (
          <option key={i.id} value={i.id}>
            {i.nombre}
          </option>
        ))}
      </select>
    </div>
  )
}

function NuevaClase({ fecha, tipos, instructoras }) {
  return (
    <section className="admin-nueva">
      <h2 className="seccion-titulo">Agregar una clase</h2>

      <form action={crearClase} className="admin-formulario">
        <div className="campo">
          <label htmlFor="nueva-fecha">Fecha</label>
          <input type="date" id="nueva-fecha" name="fecha" defaultValue={fecha} required />
        </div>

        <div className="campo">
          <label htmlFor="nueva-hora">Hora</label>
          <input type="time" id="nueva-hora" name="hora" required />
        </div>

        <div className="campo">
          <label htmlFor="nueva-tipo">Tipo</label>
          <select id="nueva-tipo" name="tipo_clase_id" required defaultValue="">
            <option value="" disabled>
              Elegí uno
            </option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="nueva-instructora">Instructora</label>
          <select id="nueva-instructora" name="instructora_id" defaultValue="">
            <option value="">Sin asignar</option>
            {instructoras.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="nueva-cupo">Cupo</label>
          <input
            type="number"
            id="nueva-cupo"
            name="cupo_total"
            defaultValue={CUPO_MAXIMO}
            min={1}
            step={1}
            required
          />
        </div>

        <button type="submit" className="boton boton-oscuro">
          Crear clase
        </button>
      </form>
    </section>
  )
}

// Todo lo que la pantalla necesita de la base.
//
// Las clases del día traen también las canceladas: el sitio público las
// esconde, pero el panel tiene que poder reactivarlas.
async function leerDia(fecha) {
  const supabase = await clienteConSesion()

  const [clases, tipos, instructoras] = await Promise.all([
    supabase
      .from('clases')
      .select('id, hora, cupo_total, estado, tipo_clase_id, instructora_id, tipos_clase (nombre), instructoras (nombre)')
      .eq('fecha', fecha)
      .order('hora'),
    supabase.from('tipos_clase').select('id, nombre').order('nombre'),
    supabase.from('instructoras').select('id, nombre').eq('activa', true).order('nombre'),
  ])

  for (const consulta of [clases, tipos, instructoras]) {
    if (consulta.error) console.error('Panel de clases:', consulta.error.message)
  }

  if (clases.error || tipos.error || instructoras.error) {
    return { clases: [], tipos: [], instructoras: [], falla: true }
  }

  return {
    clases: await conReservas(supabase, clases.data),
    tipos: tipos.data,
    instructoras: instructoras.data,
    falla: false,
  }
}

// Cuántas reservas confirmadas tiene cada clase del día, en una sola consulta.
// Admin las puede leer porque la política de `reservas` dice
// `using (... or es_admin())`. Una consulta por clase daría el mismo resultado
// y siete viajes a la base para un día normal.
async function conReservas(supabase, clases) {
  if (clases.length === 0) return []

  // Se traen las dos: las confirmadas son los lugares tomados, y las canceladas
  // son, en una clase cancelada, las personas a las que hay que avisarles.
  const { data, error } = await supabase
    .from('reservas')
    .select('clase_id, estado')
    .in('clase_id', clases.map((c) => c.id))

  if (error) {
    console.error('No se pudieron contar las reservas:', error.message)
    // Se devuelve la lista igual: no saber cuántas reservas hay no es motivo
    // para esconder la agenda entera. El número queda en null y se nota.
    return clases.map((c) => ({ ...c, reservas: null, liberadas: null }))
  }

  const confirmadas = new Map()
  const canceladas = new Map()
  for (const r of data) {
    const donde = r.estado === 'confirmada' ? confirmadas : canceladas
    donde.set(r.clase_id, (donde.get(r.clase_id) ?? 0) + 1)
  }

  return clases.map((c) => ({
    ...c,
    reservas: confirmadas.get(c.id) ?? 0,
    liberadas: canceladas.get(c.id) ?? 0,
  }))
}
