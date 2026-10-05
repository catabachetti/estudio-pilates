import Image from 'next/image'
import EncabezadoPagina from '../components/EncabezadoPagina'
import { instructoras } from '../datos/contenido'

export const metadata = {
  title: 'El estudio | ACTIVE',
  description:
    'Un estudio de reformer en Palermo con grupos de hasta seis personas, instructoras certificadas y equipamiento Balanced Body.',
}

export default function NosotrasPage() {
  return (
    <main>
      <div className="media-ancho">
        <Image
          src="/imagenes/estudio.jpg"
          alt="Sala del estudio con cuatro reformers alineados junto a ventanales"
          fill
          sizes="100vw"
        />
      </div>

      <div className="contenedor seccion">
        <EncabezadoPagina titulo="El estudio" />

        <div className="texto-largo">
          <p>
            ACTIVE nació en 2022 con una idea simple: que entrenar en reformer
            no tenga que ser una clase masiva donde nadie te mira. Trabajamos
            con grupos de hasta seis personas para que la instructora pueda
            corregir a cada una durante toda la hora.
          </p>
          <p>
            Todas nuestras instructoras están certificadas y se forman de
            manera continua. Antes de tu primera clase hacemos una entrevista
            corta para saber si tuviste lesiones, cirugías o estás embarazada,
            y así adaptar los ejercicios desde el primer día.
          </p>
          <p>
            El salón tiene seis reformers Balanced Body, cajas, barras y
            accesorios para trabajo de pies y manos. Es un espacio luminoso,
            con vestuario y duchas, en una casa reciclada de Palermo.
          </p>
        </div>

        <section className="instructoras">
          <h2 className="seccion-titulo">Quiénes dan las clases</h2>
          <ul className="instructoras-lista">
            {instructoras.map((instructora) => (
              <li className="instructora" key={instructora.id}>
                <h3 className="instructora-nombre">{instructora.nombre}</h3>
                <p className="instructora-texto">{instructora.especialidad}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
