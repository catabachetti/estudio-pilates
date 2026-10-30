import Link from 'next/link'
import EncabezadoPagina from '../../components/EncabezadoPagina'
import { enlaceWhatsapp } from '../../datos/sitio'

export const metadata = {
  title: 'Pago rechazado | ACTIVE',
  robots: { index: false, follow: false },
}

// Cuando el pago se rechazó o la persona lo canceló.
//
// No se explica el motivo del rechazo porque esta página no lo sabe: el detalle
// lo tiene Mercado Pago, y adivinarlo ("te faltaban fondos") sería inventar.
export default function CompraRechazadaPage() {
  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Pago rechazado"
          bajada="No se completó el pago, así que no se cobró nada y no se acreditaron clases."
        />

        <section className="aviso">
          <h2 className="titulo-seccion">Podés intentar de nuevo</h2>
          <p>
            El motivo lo tiene Mercado Pago, que te lo muestra en el detalle de
            la operación. Suele ser un dato de la tarjeta o un límite del banco.
          </p>
          <Link href="/paquetes" className="boton boton-oscuro">
            Volver a los paquetes
          </Link>
          <a
            href={enlaceWhatsapp('Hola, tuve un problema al pagar un paquete.')}
            className="boton boton-claro"
            target="_blank"
            rel="noopener"
            aria-label="Escribirnos por WhatsApp porque el pago falló"
          >
            Escribirnos
          </a>
        </section>
      </div>
    </main>
  )
}
