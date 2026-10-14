import SinPermiso from '../../components/SinPermiso'
import { sesionAdmin } from '../../lib/autorizacion'
import { clienteConSesion } from '../../lib/supabase-sesion'
import { esUuid } from '../../lib/validacion'
import { precioEnPesos } from '../../datos/sitio'
import { textoDeFecha } from '../../datos/agenda'
import { resumenDeCreditos } from '../../lib/creditos'
import { buscarPersona, otorgarCreditos } from '../../acciones/admin-creditos'

const MENSAJES = {
  email: 'Revisá el correo: no parece una dirección válida.',
  'sin-persona': 'No hay ninguna cuenta con ese correo. Fijate que la persona se haya registrado.',
  persona: 'No se entendió a quién había que acreditarle el paquete.',
  paquete: 'Elegí un paquete.',
  buscar: 'No pudimos hacer la búsqueda. Probá de nuevo.',
  otorgar: 'No pudimos acreditar el paquete. Probá de nuevo.',
}

export default async function AdminCreditosPage({ searchParams }) {
  const { esAdmin } = await sesionAdmin()
  if (!esAdmin) return <SinPermiso />

  const parametros = await searchParams
  const error = MENSAJES[parametros?.error]
  const otorgados = avisoDeOtorgado(parametros)
  const personaId = esUuid(parametros?.persona) ? parametros.persona : null

  const datos = personaId ? await leerPersona(personaId) : null

  return (
    <>
      <h1 className="pagina-titulo">Créditos</h1>
      <p className="seccion-texto">
        Acreditar un paquete a mano, para una transferencia o un pago en el
        estudio. Cuando esté Mercado Pago, su aviso de pago va a hacer
        exactamente esto mismo.
      </p>

      {error && (
        <p className="mensaje mensaje-error" role="alert">
          {error}
        </p>
      )}

      {otorgados && (
        <p className="mensaje" role="status">
          {otorgados}
        </p>
      )}

      <Busqueda />

      {personaId && datos && <Persona datos={datos} />}
      {personaId && !datos && (
        <div className="aviso">
          <h2 className="titulo-seccion">No pudimos leer esa cuenta</h2>
          <p>La consulta a la base falló. El motivo quedó en la consola del servidor.</p>
        </div>
      )}
    </>
  )
}

function avisoDeOtorgado(parametros) {
  if (parametros?.estado !== 'otorgado') return null
  const n = Number(parametros.creditos)
  if (!Number.isInteger(n) || n < 0 || n > 999) return 'Paquete acreditado.'
  return `Listo: se acreditaron ${n} ${n === 1 ? 'crédito' : 'créditos'}. El total de abajo ya lo incluye.`
}

function Busqueda() {
  return (
    <form action={buscarPersona} className="formulario">
      <div className="campo">
        <label htmlFor="email">Correo de la persona</label>
        <input type="email" id="email" name="email" autoComplete="off" required />
      </div>
      <button type="submit" className="boton boton-oscuro">
        Buscar
      </button>
    </form>
  )
}

// El resumen va ANTES del formulario de acreditar, y se vuelve a mostrar
// después. La carga manual no es idempotente a propósito —dos cargas pueden ser
// dos paquetes legítimos— así que un doble clic accidental tiene que verse en el
// momento: "tenía 4, ahora tiene 12" cuando esperabas 8 salta a la vista.
function Persona({ datos }) {
  const { nombre, resumen, paquetes } = datos

  return (
    <section className="admin-persona">
      <h2 className="seccion-titulo">{nombre ?? 'Sin nombre'}</h2>

      <ul className="admin-numeros">
        <li className="admin-numero">
          <p className="admin-numero-valor">{resumen.disponibles}</p>
          <p className="admin-numero-rotulo">Créditos disponibles</p>
        </li>
        <li className="admin-numero">
          <p className="admin-numero-valor">{resumen.usados}</p>
          <p className="admin-numero-rotulo">Ya usados</p>
        </li>
        <li className="admin-numero">
          <p className="admin-numero-valor">{resumen.vencidos}</p>
          <p className="admin-numero-rotulo">Vencidos</p>
        </li>
      </ul>

      {resumen.porVencimiento.length > 0 && (
        <>
          <h3 className="admin-item-titulo">Cuándo vencen los disponibles</h3>
          <ul className="lista-simple admin-vencimientos">
            {resumen.porVencimiento.map((v) => (
              <li key={v.fecha}>
                {v.cantidad} {v.cantidad === 1 ? 'crédito vence' : 'créditos vencen'} el{' '}
                {textoDeFecha(v.fecha)}
              </li>
            ))}
          </ul>
        </>
      )}

      <form action={otorgarCreditos} className="admin-formulario admin-otorgar">
        <input type="hidden" name="persona" value={datos.id} />

        <div className="campo">
          <label htmlFor="paquete_id">Paquete a acreditar</label>
          <select id="paquete_id" name="paquete_id" required defaultValue="">
            <option value="" disabled>
              Elegí uno
            </option>
            {paquetes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {p.clases} {p.clases === 1 ? 'clase' : 'clases'},{' '}
                {precioEnPesos(p.precio)}, vence en {p.dias_vigencia} días
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="boton boton-oscuro">
          Acreditar
        </button>
      </form>
    </section>
  )
}

// Todo lo que la pantalla muestra de una persona.
async function leerPersona(id) {
  const supabase = await clienteConSesion()

  const [perfil, paquetes] = await Promise.all([
    supabase.from('perfiles').select('nombre').eq('id', id).maybeSingle(),
    supabase
      .from('paquetes')
      .select('id, nombre, clases, precio, dias_vigencia')
      .eq('activo', true)
      .order('orden'),
  ])

  for (const c of [perfil, paquetes]) {
    if (c.error) console.error('Panel de créditos:', c.error.message)
  }
  if (perfil.error || paquetes.error) return null

  // El resumen sale de app/lib/creditos.js, el mismo que usa /cuenta: la regla
  // de cuándo un crédito está tomado tiene que ser una sola. Antes esta
  // pantalla filtraba por reservas confirmadas, y con eso los créditos
  // perdidos por una cancelación tardía volvían a contarse como disponibles.
  const resumen = await resumenDeCreditos(supabase, id)
  if (!resumen) return null

  return {
    id,
    nombre: perfil.data?.nombre ?? null,
    paquetes: paquetes.data,
    resumen,
  }
}
