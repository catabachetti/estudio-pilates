import Link from 'next/link'
import EncabezadoPagina from './components/EncabezadoPagina'
import { navegacion } from './datos/sitio'

export const metadata = {
  title: 'Página no encontrada | ACTIVE',
  // No se indexa: no es contenido del sitio, es la respuesta a una dirección
  // que no existe. Next ya inyecta su propio noindex en el 404, y esto lo deja
  // dicho también acá para que no dependa de ese detalle.
  robots: { index: false, follow: false },
}

// La página de 404 del sitio.
//
// Antes de que existiera este archivo salía la de Next: en inglés, con fondo
// negro y sin el header ni el footer. Alcanzaba para desarrollar y no para
// entregar.
//
// NO LLEVA 'use client' Y NO HACE FALTA NINGÚN CÓDIGO PARA EL DISEÑO: este
// archivo se renderiza dentro del layout raíz, así que hereda el header, el
// footer, la fuente y globals.css igual que cualquier página. Por eso es tan
// corto.
//
// EL CÓDIGO HTTP LO PONE NEXT, no este archivo: un GET a una ruta que no existe
// devuelve 404 y esta página en el cuerpo. Lo que sí está medido y anotado en
// docs/api.md §11 es que un POST a una ruta inexistente devuelve 200 en el
// deploy, y eso no lo arregla tener una página propia.
//
// Los enlaces salen de `navegacion` y no escritos a mano: si mañana cambia el
// menú, esta página no queda ofreciendo una sección que ya no existe.
export default function NoEncontrada() {
  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="No encontramos esa página"
          bajada="La dirección puede estar mal escrita, o la página pudo haber cambiado de lugar."
        />

        <section className="aviso">
          <h2 className="titulo-seccion">¿Buscabas algo de esto?</h2>
          <ul className="lista-simple">
            {navegacion.map(({ href, texto }) => (
              <li key={href}>
                <Link href={href}>{texto}</Link>
              </li>
            ))}
            <li>
              <Link href="/reservar">Reservar una clase</Link>
            </li>
            <li>
              <Link href="/cuenta">Mi cuenta</Link>
            </li>
          </ul>
          <Link href="/" className="boton boton-oscuro">
            Volver al inicio
          </Link>
        </section>
      </div>
    </main>
  )
}
