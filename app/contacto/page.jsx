import Image from 'next/image'
import EncabezadoPagina from '../components/EncabezadoPagina'
import { DIRECCION } from '../datos/contenido'

export const metadata = {
  title: 'Contacto | ACTIVE',
  description:
    'Gorriti 4520, Palermo. Escribinos por WhatsApp o por mail para reservar tu primera clase de reformer.',
}

const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${DIRECCION.calle}, ${DIRECCION.barrio}, ${DIRECCION.ciudad}`
)}`

export default function ContactoPage() {
  return (
    <main>
      <div className="media-ancho">
        <Image
          src="/imagenes/contacto.jpg"
          alt="Mostrador de recepción de madera clara con toallas dobladas y una planta"
          fill
          sizes="100vw"
        />
      </div>

      <div className="contenedor seccion">
        {/* el título empieza con C: ver la compensación óptica en globals.css */}
        <EncabezadoPagina
          titulo="Contacto"
          compensacion="0.02em"
          bajada="Escribinos y te contamos cuál es la clase que mejor te queda según tu experiencia y tus horarios. La dirección, los horarios y el teléfono están al pie de la página."
        />

        {/* E3: acá va el formulario de contacto con validación y fetch.
            Hasta entonces, la conversación arranca por WhatsApp. */}

        <section>
          <h2 className="bloque-titulo">Cómo llegar</h2>
          <p className="bloque-datos">
            Subte línea D, estación Scalabrini Ortiz, a seis cuadras.
            <br />
            Colectivos 15, 39, 55, 140 y 168.
            <br />
            Estacionamiento medido sobre {DIRECCION.calle.split(' ')[0]}.
          </p>

          <p className="llamado">
            <a
              href={mapa}
              className="enlace-subrayado"
              target="_blank"
              rel="noopener"
              aria-label={`Ver ${DIRECCION.calle}, ${DIRECCION.barrio} en Google Maps`}
            >
              Ver en el mapa
            </a>
          </p>
        </section>
      </div>
    </main>
  )
}
