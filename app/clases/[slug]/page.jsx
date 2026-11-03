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

// LO UNICO DEL PROYECTO QUE CONSULTA SUPABASE DURANTE LA COMPILACION. Las tres
// clases se prerenderizan acá; todo el resto del sitio es dinámico.
//
// VA ENVUELTO EN try/catch, y no por prolijidad: un build que necesita que un
// servicio externo esté arriba es un build que no compila el día que ese
// servicio tiene un problema. Devolver la lista vacía deja que Next genere las
// tres páginas a demanda, que es lo que ya pasa con cualquier slug que no esté
// en la lista.
//
// El `if (error)` de abajo no alcanzaba, y el comentario que decía que no rompe
// el build era falso: `clienteSupabase()` **tira** cuando falta
// NEXT_PUBLIC_SUPABASE_URL, o sea antes de que haya consulta y por lo tanto
// antes de que haya `error`. Cubría "la base no contesta", no "no hay
// configuración". Medido en un clon sin `.env.local`, que es la única forma de
// medirlo porque ese archivo está ignorado por git: el build cortaba con
// `Error: supabaseUrl is required` en "Collecting page data".
//
// Y EL CANJE QUE PARECIA TENER ESTO, NO EXISTE. Medido: **ni acá ni en
// producción** se prerenderiza ninguna de las tres páginas. El header del
// layout raíz lee cookies, y eso degrada todas las rutas a dinámicas, así que
// con variables Next trae los tres slugs, intenta prerenderizarlos y termina
// sirviéndolos a demanda igual. La única diferencia observable entre un build
// con variables y uno sin ellas es el marcador del resumen: `ƒ` contra `●`, y
// el `●` sin variables no tiene ninguna página detrás.
//
// Contraprueba, en un clon y sacando solo `<Header />` del layout: aparecen
// flow.html, power.html y prenatal.html, el resumen muestra la columna `1h` del
// `revalidate` de arriba, y el build pasa de 1 página estática a 16. Esa es la
// medida exacta de lo que cuesta leer cookies en el layout raíz, y es la deuda
// del caché que CLAUDE.md ya tenía anotada sin número.
export async function generateStaticParams() {
  try {
    const { data, error } = await clienteSupabase().from('tipos_clase').select('slug')
    if (error) {
      console.error('No se pudieron listar los slugs de las clases:', error.message)
      return []
    }
    return data.map((clase) => ({ slug: clase.slug }))
  } catch (falla) {
    console.error('No se pudo consultar Supabase en el build:', falla.message)
    return []
  }
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
