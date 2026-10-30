import Link from 'next/link'
import EncabezadoPagina from '../../components/EncabezadoPagina'

export const metadata = {
  title: 'Pago en proceso | ACTIVE',
  robots: { index: false, follow: false },
}

// Cuando el pago quedó en proceso: una transferencia, o un cupón para pagar en
// efectivo. No es un rechazo y no hay nada que reintentar.
//
// El crédito aparece cuando Mercado Pago avise que el pago se acreditó, y eso
// puede ser dentro de un rato o dentro de dos días si es un cupón.
export default function CompraPendientePage() {
  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Pago en proceso"
          bajada="Mercado Pago todavía está procesando el pago. No hace falta que hagas nada."
        />

        <section className="aviso">
          <h2 className="titulo-seccion">Qué pasa ahora</h2>
          <p>
            Si pagaste con transferencia o generaste un cupón para pagar en
            efectivo, la acreditación puede tardar. Cuando Mercado Pago lo
            confirme, las clases aparecen solas en tu cuenta: no hay que volver
            a pagar ni avisarnos.
          </p>
          <p>
            No vuelvas a comprar el mismo paquete mientras esperás, porque se
            cobraría dos veces.
          </p>
          <Link href="/cuenta" className="boton boton-oscuro">
            Ir a mi cuenta
          </Link>
        </section>
      </div>
    </main>
  )
}
