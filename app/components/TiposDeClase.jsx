import Image from 'next/image'
import Link from 'next/link'
import { clienteSupabase } from '../lib/supabase'

// Los paneles leen de la base, igual que /clases y que el detalle. Mientras
// leían de un archivo, la home y /clases mostraban el mismo dato desde dos
// lugares distintos: cambiar el nombre de una clase en Supabase lo actualizaba
// en una página y no en la otra. Esa desincronización no venía del código
// original, la introdujo la migración a medio hacer.
export default async function TiposDeClase() {
  const { data: clases, error } = await clienteSupabase()
    .from('tipos_clase')
    .select('slug, nombre, requisito, imagen, imagen_alt')
    .order('orden')

  if (error) {
    console.error('No se pudieron leer los tipos de clase de Supabase:', error.message)
  }

  // Si no se pueden leer, la sección se omite: la home sigue en pie y /clases
  // tiene su propio mensaje.
  if (error || !clases?.length) {
    return null
  }

  return (
    <section id="clases" className="paneles-fila">
      {clases.map((clase) => (
        <article className="panel parallax" key={clase.slug}>
          <Image
            src={clase.imagen}
            alt={clase.imagen_alt ?? ''}
            fill
            sizes="(max-width: 860px) 100vw, 33vw"
          />
          <div className="panel-contenido">
            <h2 className="panel-nombre">{clase.nombre}</h2>
            <p className="panel-nivel">{clase.requisito}</p>
            <Link href={`/clases/${clase.slug}`} className="enlace-claro">
              Ver la clase
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}
