import Image from 'next/image'
import EncabezadoPagina from '../components/EncabezadoPagina'
import FormularioDeContacto from '../components/FormularioDeContacto'
import { DIRECCION } from '../datos/sitio'
import { MOTIVOS, TEXTO_OK } from '../lib/mensajes'

export const metadata = {
  title: 'Contacto | ACTIVE',
  description:
    'Gorriti 4520, Palermo. Escribinos por WhatsApp o por mail para reservar tu primera clase de reformer.',
}

const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${DIRECCION.calle}, ${DIRECCION.barrio}, ${DIRECCION.ciudad}`
)}`

// EL RESULTADO DEL ENVÍO SIN JAVASCRIPT. La Server Action redirige acá con
// `?m=`, y esto es lo único que informa cuando no hay JavaScript: con
// JavaScript el formulario muestra sus tres estados y nunca navega.
//
// Los textos salen de `MOTIVOS` y `TEXTO_OK`, los mismos que usa la API. No se
// escriben de nuevo acá.
function AvisoDelEnvio({ m }) {
  if (!m) return null

  if (m === 'ok') {
    return (
      <p className="mensaje" role="status">
        {TEXTO_OK}
      </p>
    )
  }

  const texto =
    m === 'invalido'
      ? 'Revisá los datos: falta algo o no tiene el formato esperado.'
      : (MOTIVOS[m] ?? 'No pudimos enviar tu mensaje. Probá de nuevo.')

  return (
    <p className="mensaje mensaje-error" role="alert">
      {texto}
    </p>
  )
}

export default async function ContactoPage({ searchParams }) {
  // En Next 16 searchParams es una Promise, igual que params.
  const parametros = await searchParams

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

        {/* E3. El aviso de abajo es para el camino SIN JavaScript; con
            JavaScript el formulario muestra sus propios tres estados y esta
            página no se vuelve a pedir. */}
        <AvisoDelEnvio m={parametros?.m} />
        <FormularioDeContacto />

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
