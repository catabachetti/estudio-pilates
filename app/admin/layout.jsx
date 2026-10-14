import Link from 'next/link'
import { sesionAdmin } from '../lib/autorizacion'

export const metadata = {
  title: 'Panel | ACTIVE',
  // El panel no es contenido público: que no aparezca en buscadores.
  robots: { index: false, follow: false },
}

// Este layout pone el marco y nada más. La verificación que decide si se puede
// entrar está en cada página y en cada acción, por las razones que explica
// app/lib/autorizacion.js.
//
// Acá se consulta sesionAdmin() para una sola cosa: no dibujar un menú de
// administración a alguien que no lo puede usar. Es decoración, no seguridad, y
// no cuesta una consulta extra porque cache() la comparte con la página.
export default async function AdminLayout({ children }) {
  const { esAdmin } = await sesionAdmin()

  return (
    <main className="seccion">
      <div className="contenedor">
        {esAdmin && (
          <nav className="admin-nav" aria-label="Secciones del panel">
            <ul className="admin-nav-lista">
              <li>
                <Link href="/admin">Tablero</Link>
              </li>
              <li>
                <Link href="/admin/clases">Clases</Link>
              </li>
              <li>
                <Link href="/admin/reservas">Reservas</Link>
              </li>
              <li>
                <Link href="/admin/paquetes">Paquetes</Link>
              </li>
              <li>
                <Link href="/admin/creditos">Créditos</Link>
              </li>
            </ul>
          </nav>
        )}

        {children}
      </div>
    </main>
  )
}
