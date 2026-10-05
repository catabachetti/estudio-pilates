import Image from 'next/image'
import EncabezadoPagina from '../components/EncabezadoPagina'
import { TELEFONO_WHATSAPP, DIRECCION } from '../datos/contenido'
import { horariosDeAtencion } from '../datos/agenda'

export const metadata = {
  title: 'Contacto | ACTIVE',
  description:
    'Gorriti 4520, Palermo. Escribinos por WhatsApp o por mail para reservar tu primera clase de reformer.',
}

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
        <EncabezadoPagina
          titulo="Contacto"
          bajada="Escribinos y te contamos cuál es la clase que mejor te queda según tu experiencia y tus horarios."
        />

        <div className="contacto-grilla">
          <section>
            <h2 className="bloque-titulo">Dónde estamos</h2>
            <address className="bloque-datos">
              {DIRECCION.calle}, {DIRECCION.barrio}
              <br />
              {DIRECCION.ciudad}
              <br />
              <a href={`https://wa.me/${TELEFONO_WHATSAPP}`}>+54 11 0000 0000</a>
              <br />
              <a href="mailto:hola@activereformer.com">
                hola@activereformer.com
              </a>
            </address>
          </section>

          <section>
            <h2 className="bloque-titulo">Atención</h2>
            <p className="bloque-datos">
              {horariosDeAtencion().map((bloque) => (
                <span key={bloque.dia}>
                  {bloque.dia} de {bloque.desde} a {bloque.hasta}
                  <br />
                </span>
              ))}
              Domingos cerrado
            </p>
          </section>

          <section>
            <h2 className="bloque-titulo">Cómo llegar</h2>
            <p className="bloque-datos">
              Subte línea D, estación Scalabrini Ortiz, a seis cuadras.
              <br />
              Colectivos 15, 39, 55, 140 y 168.
              <br />
              Estacionamiento medido sobre Gorriti.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
