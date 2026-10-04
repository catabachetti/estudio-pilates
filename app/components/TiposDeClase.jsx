import Image from 'next/image'
import Link from 'next/link'
import { tiposDeClase } from '../datos/contenido'

export default function TiposDeClase() {
  return (
    <section id="clases" className="paneles-fila">
      {tiposDeClase.map((clase) => (
        <article className="panel parallax" key={clase.slug}>
          <Image
            src={clase.imagen}
            alt={clase.imagenAlt}
            fill
            sizes="(max-width: 860px) 100vw, 33vw"
          />
          <div className="panel-contenido">
            <h2 className="panel-nombre">{clase.nombre}</h2>
            <p className="panel-nivel">{clase.nivel}</p>
            <Link href={`/clases/${clase.slug}`} className="enlace-claro">
              Ver la clase
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}
