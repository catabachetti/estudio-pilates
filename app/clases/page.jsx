import Image from 'next/image'
import Link from 'next/link'
import EncabezadoPagina from '../components/EncabezadoPagina'
import { enlaceWhatsapp } from '../datos/sitio'
import { DURACION_CLASE } from '../datos/agenda'
import { clienteSupabase } from '../lib/supabase'

// El catálogo cambia una o dos veces por año, así que la página se genera
// estática. Pero sin revalidate, un fallo de la base durante el build dejaría el
// mensaje de error congelado en el HTML hasta el próximo deploy. Con una hora,
// se recupera sola.
export const revalidate = 3600

export const metadata = {
  title: 'Clases | ACTIVE',
  description:
    'Reformer Flow, Power y Prenatal. Tres clases de pilates reformer en grupos de hasta seis personas.',
}

export default async function ClasesPage() {
  const { data: clases, error } = await clienteSupabase()
    .from('tipos_clase')
    .select('slug, nombre, descripcion_corta, nivel, requisito, imagen, imagen_alt')
    .order('orden')

  // No hay respaldo local a propósito: sería el mismo dato en dos lugares y la
  // desincronización pasaría inadvertida. Si la base no responde, se dice.
  if (error) {
    console.error('No se pudo leer tipos_clase de Supabase:', error.message)
  }

  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Nuestras clases"
          bajada={`Todas duran ${DURACION_CLASE} minutos y se dan en grupos reducidos. Elegí según tu experiencia y el momento que estés atravesando.`}
        />

        {error || !clases?.length ? (
          <CatalogoNoDisponible />
        ) : (
          <div className="clases-filas">
            {clases.map((clase) => (
              <article className="clase-fila" key={clase.slug}>
                <div className="clase-foto">
                  <Image
                    src={clase.imagen}
                    alt={clase.imagen_alt ?? ''}
                    fill
                    sizes="(max-width: 860px) 100vw, 50vw"
                  />
                </div>

                <div className="clase-datos">
                  <h2 className="clase-nombre">{clase.nombre}</h2>
                  <p className="clase-nivel">{clase.nivel ?? clase.requisito}</p>
                  <p className="clase-texto">{clase.descripcion_corta}</p>
                  <Link href={`/clases/${clase.slug}`} className="enlace-subrayado">
                    Ver la clase
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function CatalogoNoDisponible() {
  return (
    <section className="aviso">
      <h2 className="titulo-seccion">No podemos mostrar las clases ahora</h2>
      <p>
        Estamos teniendo un problema para cargar el catálogo. Escribinos y te
        contamos qué clase te conviene según tu experiencia.
      </p>
      <a
        href={enlaceWhatsapp('Hola, quiero saber qué clases tienen disponibles.')}
        className="boton boton-oscuro"
        target="_blank"
        rel="noopener"
        aria-label="Consultar por las clases por WhatsApp"
      >
        Consultar por WhatsApp
      </a>
    </section>
  )
}
