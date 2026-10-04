import Image from 'next/image'
import { paquetes, precioEnPesos, enlaceWhatsapp } from '../datos/contenido'

// PROVISORIO HASTA E5: sin checkout todavia, el boton abre WhatsApp diciendo
// que paquete eligio la persona. Despues sera el paso previo al pago.
export default function Paquetes() {
  return (
    <section className="paquetes-seccion parallax" id="paquetes">
      <Image
        src="/imagenes/estudio.jpg"
        alt="Sala del estudio con cuatro reformers alineados junto a ventanales"
        fill
        sizes="100vw"
      />

      <div className="contenedor paquetes-contenido">
        <h2 className="titulo-claro">Comprá las clases que necesitás</h2>
        <p className="texto-claro">
          Se acreditan en tu cuenta y las usás cuando quieras, dentro de la
          vigencia de cada paquete.
        </p>

        <ul className="paquetes-grilla">
          {paquetes.map((paquete) => (
            <li className="paquete" key={paquete.id}>
              <h3 className="paquete-nombre">{paquete.nombre}</h3>
              <p className="paquete-precio">{precioEnPesos(paquete.precio)}</p>
              <p className="paquete-vigencia">Vence en {paquete.dias} días</p>
              <a
                href={enlaceWhatsapp(
                  `Hola, quiero consultar por el paquete de ${paquete.nombre.toLowerCase()}.`
                )}
                className="boton boton-oscuro"
                target="_blank"
                rel="noopener"
                aria-label={`Consultar por el paquete de ${paquete.nombre.toLowerCase()} por WhatsApp`}
              >
                Consultar
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
