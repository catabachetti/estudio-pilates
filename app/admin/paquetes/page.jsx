import SinPermiso from '../../components/SinPermiso'
import { sesionAdmin } from '../../lib/autorizacion'
import { clienteConSesion } from '../../lib/supabase-sesion'
import { precioEnPesos } from '../../datos/sitio'
import { editarPaquete, cambiarActivo } from '../../acciones/admin-paquetes'
import { LARGO_NOMBRE, LARGO_INCLUYE } from '../../lib/esquemas'

const MENSAJES = {
  nombre: `El nombre no puede quedar vacío ni pasar de ${LARGO_NOMBRE} caracteres.`,
  precio: 'El precio tiene que ser un número entero mayor que cero, sin puntos ni centavos.',
  clases: 'La cantidad de clases tiene que ser un número entero mayor que cero.',
  vigencia: 'La vigencia tiene que ser un número entero de días mayor que cero.',
  incluye: `La descripción no puede pasar de ${LARGO_INCLUYE} caracteres.`,
  orden: 'El orden tiene que ser un número entero de cero para arriba.',
  repetido: 'Ya hay otro paquete con ese nombre.',
  permiso: 'La base rechazó el cambio: tu cuenta no tiene permiso para editar el catálogo.',
  guardar: 'No pudimos guardar el cambio. Probá de nuevo.',
  id: 'No se entendió qué paquete había que editar.',
}

const AVISOS = {
  guardado: 'Guardado. El sitio público ya muestra el cambio.',
  activado: 'El paquete volvió a aparecer en el sitio.',
  desactivado: 'El paquete dejó de aparecer en el sitio. No se borró nada.',
}

export default async function AdminPaquetesPage({ searchParams }) {
  const { esAdmin } = await sesionAdmin()
  if (!esAdmin) return <SinPermiso />

  const parametros = await searchParams
  const error = MENSAJES[parametros?.error]
  const aviso = AVISOS[parametros?.estado]

  // Acá se piden todos, también los desactivados: el sitio público muestra solo
  // los activos, pero desde el panel hay que poder volver a activarlos.
  const supabase = await clienteConSesion()
  const { data: paquetes, error: errorLectura } = await supabase
    .from('paquetes')
    .select('id, nombre, clases, precio, dias_vigencia, incluye, orden, activo')
    .order('orden')

  if (errorLectura) {
    console.error('No se pudieron leer los paquetes:', errorLectura.message)
  }

  return (
    <>
      <h1 className="pagina-titulo">Paquetes</h1>
      <p className="seccion-texto">
        Lo que guardes acá se ve en el sitio enseguida, sin esperar la hora de
        caché. Desactivar no borra: saca el paquete de la venta y lo deja listo
        para volver.
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

      {errorLectura || !paquetes?.length ? (
        <div className="aviso">
          <h2 className="titulo-seccion">No pudimos leer los paquetes</h2>
          <p>
            La consulta a la base falló. El motivo quedó en la consola del
            servidor.
          </p>
        </div>
      ) : (
        <ul className="admin-lista">
          {paquetes.map((paquete) => (
            <li className="admin-item" key={paquete.id}>
              <div className="admin-item-encabezado">
                <h2 className="admin-item-titulo">{paquete.nombre}</h2>
                <p className="admin-item-estado">
                  {paquete.activo ? 'A la venta' : 'Fuera de venta'}
                  {' · '}
                  {precioEnPesos(paquete.precio)}
                </p>
              </div>

              {/* Un formulario por paquete. Sin 'use client' y sin JavaScript:
                  el navegador manda el POST y la Server Action lo recibe. */}
              <form action={editarPaquete} className="admin-formulario">
                <input type="hidden" name="id" value={paquete.id} />

                <div className="campo">
                  <label htmlFor={`nombre-${paquete.id}`}>Nombre</label>
                  <input
                    type="text"
                    id={`nombre-${paquete.id}`}
                    name="nombre"
                    defaultValue={paquete.nombre}
                    maxLength={LARGO_NOMBRE}
                    required
                  />
                </div>

                <div className="campo">
                  <label htmlFor={`precio-${paquete.id}`}>Precio en pesos</label>
                  <input
                    type="number"
                    id={`precio-${paquete.id}`}
                    name="precio"
                    defaultValue={paquete.precio}
                    min={1}
                    step={1}
                    required
                  />
                </div>

                <div className="campo">
                  <label htmlFor={`clases-${paquete.id}`}>Clases</label>
                  <input
                    type="number"
                    id={`clases-${paquete.id}`}
                    name="clases"
                    defaultValue={paquete.clases}
                    min={1}
                    step={1}
                    required
                  />
                </div>

                <div className="campo">
                  <label htmlFor={`vigencia-${paquete.id}`}>Días de vigencia</label>
                  <input
                    type="number"
                    id={`vigencia-${paquete.id}`}
                    name="dias_vigencia"
                    defaultValue={paquete.dias_vigencia}
                    min={1}
                    step={1}
                    required
                  />
                </div>

                <div className="campo">
                  <label htmlFor={`orden-${paquete.id}`}>Orden</label>
                  <input
                    type="number"
                    id={`orden-${paquete.id}`}
                    name="orden"
                    defaultValue={paquete.orden}
                    min={0}
                    step={1}
                    required
                    aria-describedby={`ayuda-orden-${paquete.id}`}
                  />
                  <p id={`ayuda-orden-${paquete.id}`} className="campo-ayuda">
                    De menor a mayor, como se listan en el sitio.
                  </p>
                </div>

                {/* Ocupa el ancho entero de la grilla: es el único campo de
                    texto largo y en una columna angosta no se puede leer lo
                    que se escribe. */}
                <div className="campo campo-ancho">
                  <label htmlFor={`incluye-${paquete.id}`}>Descripción</label>
                  <textarea
                    id={`incluye-${paquete.id}`}
                    name="incluye"
                    defaultValue={paquete.incluye ?? ''}
                    maxLength={LARGO_INCLUYE}
                    rows={2}
                  />
                  <p className="campo-ayuda">
                    La frase que aparece en la tarjeta, debajo del precio.
                  </p>
                </div>

                <button type="submit" className="boton boton-oscuro">
                  Guardar
                </button>
              </form>

              {/* Separado del otro formulario: son dos decisiones distintas y
                  un botón no puede enviar dos formularios. */}
              <form action={cambiarActivo} className="admin-formulario-corto">
                <input type="hidden" name="id" value={paquete.id} />
                <input type="hidden" name="activo" value={paquete.activo ? 'false' : 'true'} />
                <button type="submit" className="boton boton-claro">
                  {paquete.activo ? 'Sacar de la venta' : 'Poner a la venta'}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
