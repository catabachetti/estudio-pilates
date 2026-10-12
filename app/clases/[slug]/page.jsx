import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { clienteSupabase } from '../../lib/supabase'

export const revalidate = 3600

const COLUMNAS =
  'slug, nombre, descripcion_corta, descripcion_larga, nivel, requisito, duracion_min, imagen, imagen_alt, que_llevar'

async function buscarClase(slug) {
  const { data, error } = await clienteSupabase()
    .from('tipos_clase')
    .select(COLUMNAS)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('No se pudo leer la clase de Supabase:', error.message)
  }
  return data
}

// Las tres clases se prerenderizan en el build. Si la base no responde en ese
// momento, la lista queda vacía y Next genera las páginas a demanda: no rompe
// el build.
export async function generateStaticParams() {
  const { data, error } = await clienteSupabase().from('tipos_clase').select('slug')
  if (error) {
    console.error('No se pudieron listar los slugs de las clases:', error.message)
    return []
  }
  return data.map((clase) => ({ slug: clase.slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const clase = await buscarClase(slug)

  if (!clase) {
    return { title: 'Clase no encontrada | ACTIVE' }
  }

  return {
    title: `${clase.nombre} | ACTIVE`,
    description: clase.descripcion_corta,
  }
}

export default async function ClasePage({ params }) {
  const { slug } = await params
  const clase = await buscarClase(slug)

  // Sin respaldo local: si la clase no está, es 404. Da igual si el slug no
  // existe o si la base no respondió, para quien visita el resultado es el
  // mismo y el error ya quedó en el log del servidor.
  if (!clase) {
    notFound()
  }

  const parrafos = (clase.descripcion_larga ?? '').split('\n\n').filter(Boolean)

  return (
    <main>
      <div className="media-ancho">
        <Image
          src={clase.imagen}
          alt={clase.imagen_alt ?? ''}
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
          {parrafos.map((parrafo) => (
            <p key={parrafo.slice(0, 32)}>{parrafo}</p>
          ))}
        </div>

        <dl className="ficha">
          <div className="ficha-item">
            <dt>Duración</dt>
            <dd>{clase.duracion_min} minutos</dd>
          </div>
          <div className="ficha-item">
            <dt>Nivel</dt>
            <dd>{clase.nivel ?? 'Sin nivel'}</dd>
          </div>
          <div className="ficha-item">
            <dt>Requisito</dt>
            <dd>{clase.requisito}</dd>
          </div>
          <div className="ficha-item">
            <dt>Qué llevar</dt>
            <dd>
              <ul className="lista-simple">
                {(clase.que_llevar ?? []).map((cosa) => (
                  <li key={cosa}>{cosa}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>

        <Link href="/reservar" className="boton boton-oscuro">
          Reservar una clase
        </Link>
      </div>
    </main>
  )
}
