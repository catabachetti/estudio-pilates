import Link from 'next/link'
import { navegacion } from '../datos/sitio'
import { usuarioActual } from '../lib/supabase-sesion'
import { salir } from '../acciones/sesion'

export default async function Header() {
  const usuario = await usuarioActual()
  // El nombre viaja en los metadatos del registro y el trigger lo copia al
  // perfil. Acá alcanza con el de los metadatos: evita una consulta más.
  const nombre = usuario?.user_metadata?.nombre ?? usuario?.email

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
              <span className="header-nombre">{nombre}</span>
              <form action={salir}>
                <button type="submit" className="enlace-subrayado">
                  Salir
                </button>
              </form>
            </>
          ) : (
            <Link href="/ingresar" className="enlace-subrayado">
              Ingresar
            </Link>
          )}

          <Link href="/reservar" className="boton boton-oscuro">
            Reservar
          </Link>
        </div>
      </div>
    </header>
  )
}
