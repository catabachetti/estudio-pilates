import Link from 'next/link'
import { navegacion } from '../datos/contenido'

export default function Header() {
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

        <Link href="/reservar" className="boton boton-oscuro">
          Reservar
        </Link>
      </div>
    </header>
  )
}
