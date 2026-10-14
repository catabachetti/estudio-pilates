import Link from 'next/link'
import { navegacion } from '../datos/sitio'
import { sesionAdmin } from '../lib/autorizacion'
import { salir } from '../acciones/sesion'

export default async function Header() {
  // sesionAdmin() devuelve quién está conectado y si tiene rol de
  // administración. Está envuelta en cache(), así que dentro de una página del
  // panel esta llamada y la de la página son la misma: una consulta, no dos.
  // En una página pública suma una búsqueda por clave primaria en `perfiles`
  // para quien tenga sesión abierta.
  const { usuario, esAdmin } = await sesionAdmin()

  return (
    <header className="header">
      <div className="contenedor header-contenido">
        <Link href="/" className="logo">
          ACTIVE
        </Link>

        <nav aria-label="Navegación principal">
          <ul className="nav-lista">
            {navegacion.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.texto}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-sesion">
          {usuario ? (
            <>
              <Link href="/cuenta" className="header-enlace">
                Mi cuenta
              </Link>

              {/* ESTO NO ES SEGURIDAD, ES COMODIDAD.
                  Esconder el enlace no protege el panel: quien sepa la
                  dirección la escribe igual, y el HTML de esta página lo lee
                  cualquiera. Lo que protege el panel son dos cosas y ninguna
                  está acá: app/lib/autorizacion.js, que verifica el rol en cada
                  página y en cada Server Action, y RLS en Supabase, que rechaza
                  la escritura aunque alguien llegue a la acción. Si algún día
                  este `esAdmin` se borra o queda mal, lo único que pasa es que
                  el atajo deja de verse. */}
              {esAdmin && (
                <Link href="/admin" className="header-enlace">
                  Panel
                </Link>
              )}

              <form action={salir}>
                <button type="submit" className="header-enlace">
                  Salir
                </button>
              </form>
            </>
          ) : (
            <Link href="/ingresar" className="header-enlace">
              Ingresar
            </Link>
          )}
        </div>

        <Link href="/reservar" className="boton boton-oscuro">
          Reservar
        </Link>
      </div>
    </header>
  )
}
