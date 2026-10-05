import Image from 'next/image'
import Link from 'next/link'
import EncabezadoPagina from '../components/EncabezadoPagina'
import { tiposDeClase, CUPO_MAXIMO } from '../datos/contenido'
import { DURACION_CLASE } from '../datos/agenda'

export const metadata = {
  title: 'Clases | ACTIVE',
  description:
    'Reformer Flow, Power y Prenatal. Tres clases de pilates reformer en grupos de hasta seis personas.',
}

export default function ClasesPage() {
  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Nuestras clases"
          bajada={`Todas duran ${DURACION_CLASE} minutos y se dan en grupos reducidos. Elegí según tu experiencia y el momento que estés atravesando.`}
        />

        <div className="clases-filas">
          {tiposDeClase.map((clase) => (
            <article className="clase-fila" key={clase.slug}>
              <div className="clase-foto">
                <Image
                  src={clase.imagen}
                  alt={clase.imagenAlt}
                  fill
                  sizes="(max-width: 860px) 100vw, 50vw"
                />
              </div>

              <div className="clase-datos">
                <h2 className="clase-nombre">{clase.nombre}</h2>
                <p className="clase-nivel">{clase.nivel ?? clase.requisito}</p>
                <p className="clase-texto">{clase.descripcionCorta}</p>
                <Link href={`/clases/${clase.slug}`} className="enlace-subrayado">
                  Ver la clase
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
