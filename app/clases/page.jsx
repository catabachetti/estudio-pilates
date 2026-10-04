import Link from 'next/link'
import { tiposDeClase } from '../datos/contenido'

export const metadata = {
  title: 'Clases | ACTIVE',
  description:
    'Reformer Flow, Power y Prenatal. Tres clases de pilates reformer en grupos de hasta seis personas.',
}

export default function ClasesPage() {
  return (
    <main className="seccion">
      <div className="contenedor">
        <h1 className="pagina-titulo">Nuestras clases</h1>
        <p className="seccion-texto">
          Todas duran 50 minutos y se dan en grupos de hasta seis personas.
          Elegí según tu experiencia y el momento que estés atravesando.
        </p>

        <div className="clases-grilla">
          {tiposDeClase.map((clase) => (
            <article className="clase" key={clase.slug}>
              <h2 className="clase-nombre">{clase.nombre}</h2>
              <p className="clase-texto">{clase.descripcionCorta}</p>
              <p className="clase-nivel">{clase.nivel}</p>
              <Link href={`/clases/${clase.slug}`} className="enlace-subrayado">
                Ver la clase
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
