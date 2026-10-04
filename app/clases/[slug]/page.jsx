import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { tiposDeClase, buscarClase } from '../../datos/contenido'

export function generateStaticParams() {
  return tiposDeClase.map((clase) => ({ slug: clase.slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const clase = buscarClase(slug)

  if (!clase) {
    return { title: 'Clase no encontrada | ACTIVE' }
  }

  return {
    title: `${clase.nombre} | ACTIVE`,
    description: clase.descripcionCorta,
  }
}

export default async function ClasePage({ params }) {
  const { slug } = await params
  const clase = buscarClase(slug)

  if (!clase) {
    notFound()
  }

  return (
    <main>
      <div className="media-ancho">
        <Image
          src={clase.imagen}
          alt={clase.imagenAlt}
          fill
          sizes="100vw"
        />
      </div>

      <div className="contenedor detalle seccion">
        <Link href="/clases" className="enlace-volver">
          Volver a clases
        </Link>

        <h1 className="pagina-titulo">{clase.nombre}</h1>

        <div className="detalle-cuerpo">
          {clase.descripcionLarga.map((parrafo) => (
            <p key={parrafo.slice(0, 32)}>{parrafo}</p>
          ))}
        </div>

        <dl className="ficha">
          <div className="ficha-item">
            <dt>Duración</dt>
            <dd>{clase.duracion}</dd>
          </div>
          <div className="ficha-item">
            <dt>Nivel</dt>
            <dd>{clase.nivel}</dd>
          </div>
          <div className="ficha-item">
            <dt>Qué llevar</dt>
            <dd>{clase.queLlevar.join(', ')}</dd>
          </div>
        </dl>

        <Link href="/horarios" className="boton boton-oscuro">
          Ver horarios
        </Link>
      </div>
    </main>
  )
}
