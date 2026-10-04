import Image from 'next/image'
import Link from 'next/link'

export default function Hero() {
  return (
    <section className="hero parallax">
      <Image
        src="/imagenes/hero.jpg"
        alt="Piernas de una mujer apoyadas sobre la barra de un reformer de madera clara"
        fill
        priority
        sizes="100vw"
      />

      <div className="contenedor hero-contenido">
        <h1 className="hero-titulo">
          Movimiento consciente,
          <br />
          cuerpo presente
        </h1>

        <p className="hero-texto">
          Reformer pilates en Palermo. Grupos reducidos, instructoras
          certificadas y una grilla que se adapta a tu semana.
        </p>

        <div className="hero-botones">
          <Link href="/horarios" className="boton boton-oscuro">
            Ver horarios
          </Link>
          <Link href="/paquetes" className="boton boton-claro">
            Comprar paquete
          </Link>
        </div>
      </div>
    </section>
  )
}
