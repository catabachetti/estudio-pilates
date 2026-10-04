import { paquetes, condiciones, precioEnPesos, enlaceWhatsapp } from '../datos/contenido'

export const metadata = {
  title: 'Paquetes | ACTIVE',
  description:
    'Paquetes de 1, 4, 8 y 12 clases y mes libre. Las clases se acreditan en tu cuenta y las usás dentro de su vigencia.',
}

// PROVISORIO HASTA E5: ver el comentario en components/Paquetes.jsx.
export default function PaquetesPage() {
  return (
    <main className="seccion">
      <div className="contenedor">
        <h1 className="pagina-titulo">Paquetes</h1>
        <p className="seccion-texto">
          Comprás las clases y se acreditan en tu cuenta. Reservás el día y el
          horario que quieras mientras tengas créditos disponibles.
        </p>

        <ul className="paquetes-grilla-pagina">
          {paquetes.map((paquete) => (
            <li className="paquete" key={paquete.id}>
              <h2 className="paquete-nombre">{paquete.nombre}</h2>
              <p className="paquete-precio">{precioEnPesos(paquete.precio)}</p>
              <p className="paquete-vigencia">Vence en {paquete.dias} días</p>
              <p className="paquete-incluye">{paquete.incluye}</p>
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

        <section className="condiciones">
          <h2 className="seccion-titulo">Condiciones</h2>
          <ul className="condiciones-lista">
            {condiciones.map((condicion) => (
              <li key={condicion}>{condicion}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
