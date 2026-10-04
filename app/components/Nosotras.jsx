import Image from 'next/image'
import Link from 'next/link'
import { instructoras } from '../datos/contenido'

export default function Nosotras() {
  return (
    <section className="nosotras" id="nosotras">
      <div className="nosotras-imagen parallax">
        <Image
          src="/imagenes/estudio-clase.jpg"
          alt="Tres mujeres entrenando en reformers mientras una instructora guía la clase"
          fill
          sizes="(max-width: 860px) 100vw, 50vw"
        />
      </div>

      <div className="nosotras-texto">
        <h2 className="titulo-seccion">Un estudio de seis reformers</h2>
        <p>
          Trabajamos con grupos de hasta seis personas para que la instructora
          pueda corregir a cada una durante toda la clase. Antes de tu primera
          vez hacemos una entrevista corta para saber si tuviste lesiones,
          cirugías o estás embarazada, y adaptar los ejercicios desde el primer
          día.
        </p>
        <p>
          El salón tiene seis reformers Balanced Body, cajas, barras y
          accesorios para trabajo de pies y manos, en una casa reciclada de
          Palermo con vestuario y duchas.
        </p>

        <ul className="instructoras-lista">
          {instructoras.map((instructora) => (
            <li key={instructora.id}>
              <h3 className="instructora-nombre">{instructora.nombre}</h3>
              <p className="instructora-texto">{instructora.especialidad}</p>
            </li>
          ))}
        </ul>

        <Link href="/nosotras" className="enlace-subrayado">
          Conocé el estudio
        </Link>
      </div>
    </section>
  )
}
