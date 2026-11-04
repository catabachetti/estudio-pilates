import SinPermiso from '../../components/SinPermiso'
import { sesionAdmin } from '../../lib/autorizacion'
import { clienteConSesion } from '../../lib/supabase-sesion'
import { fechaYHoraDelEstudio } from '../../datos/agenda'

// Los mensajes del formulario de contacto. Solo lectura.
//
// POR QUÉ EXISTE ESTA PANTALLA: sin ella la tabla `mensajes` sería de solo
// escritura y la única forma de leerla sería el editor SQL de Supabase. Un
// formulario de contacto cuyos mensajes nadie puede leer desde el sitio no está
// terminado.
//
// Y NO HACE FALTA FILTRAR POR `user_id` ACÁ, al contrario que en /cuenta: estos
// mensajes no son "los míos", son todos, y la política de la tabla ya dice
// `es_admin()`. La regla de CLAUDE.md sobre filtrar igual aplica a las
// pantallas de "mis cosas", donde una cuenta de administración vería lo ajeno
// como propio. Acá verlo todo es el punto.
export default async function AdminMensajesPage() {
  const { esAdmin } = await sesionAdmin()
  if (!esAdmin) return <SinPermiso />

  const supabase = await clienteConSesion()
  const { data, error } = await supabase
    .from('mensajes')
    .select('id, nombre, email, mensaje, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('No se pudieron leer los mensajes:', error.message)
  }

  const mensajes = data ?? []

  return (
    <>
      <h1 className="pagina-titulo">Mensajes</h1>
      <p className="seccion-texto">
        Lo que llega por el formulario de <code>/contacto</code>. Los últimos
        cien, del más nuevo al más viejo.
      </p>

      {error ? (
        <div className="aviso">
          <h2 className="titulo-seccion">No pudimos leer los mensajes</h2>
          <p>La consulta a la base falló. El motivo quedó en la consola del servidor.</p>
        </div>
      ) : mensajes.length === 0 ? (
        <p className="seccion-texto">Todavía no llegó ningún mensaje.</p>
      ) : (
        <ul className="mensajes-lista">
          {mensajes.map((m) => (
            <li key={m.id}>
              <article className="mensaje-recibido">
                <h2 className="mensaje-recibido-de">
                  {m.nombre}{' '}
                  {/* El correo es un enlace: responder es lo primero que se
                      hace con un mensaje de contacto. */}
                  <a href={`mailto:${m.email}`}>{m.email}</a>
                </h2>
                <p className="mensaje-recibido-fecha">
                  <time dateTime={m.created_at}>{fechaYHoraDelEstudio(m.created_at)}</time>
                </p>
                {/* `white-space: pre-line` en el CSS: quien escribió puso saltos
                    de línea y perderlos cambia el texto. */}
                <p className="mensaje-recibido-texto">{m.mensaje}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
