import Link from 'next/link'
import EncabezadoPagina from '../../components/EncabezadoPagina'

export const metadata = {
  title: 'Compra registrada | ACTIVE',
  // No se indexa: es una pantalla de paso, no un contenido del sitio.
  robots: { index: false, follow: false },
}

// A donde Mercado Pago devuelve a la persona cuando el pago salió bien.
//
// ESTA PÁGINA NO ACREDITA NADA Y NO CONSULTA NADA. Es la trampa del módulo:
// llegar acá no prueba que el pago esté acreditado, solo que el navegador
// volvió. El crédito lo acredita el aviso servidor a servidor, que puede
// llegar antes o después que la persona.
//
// Por eso el texto no dice "ya tenés tus clases": dice que estamos
// acreditando. Afirmar que el crédito está sería afirmar algo que esta página
// no sabe, y si el aviso todavía no llegó, /cuenta mostraría otra cosa.
export default function CompraListoPage() {
  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Compra registrada"
          bajada="El pago salió bien. Estamos acreditando las clases en tu cuenta."
          compensacion="0.02em"
        />

        <section className="aviso">
          <h2 className="titulo-seccion">¿Y ahora?</h2>
          <p>
            La acreditación la confirma Mercado Pago y suele tardar unos
            segundos. Entrá a tu cuenta para ver los créditos y reservar tu
            primera clase.
          </p>
          <p>
            Si pasaron unos minutos y no los ves, escribinos: el pago queda
            registrado igual y lo resolvemos.
          </p>
          <Link href="/cuenta" className="boton boton-oscuro">
            Ir a mi cuenta
          </Link>
        </section>
      </div>
    </main>
  )
}
