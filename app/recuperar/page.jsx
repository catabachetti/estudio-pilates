import Link from 'next/link'
import EncabezadoPagina from '../components/EncabezadoPagina'
import { pedirRecuperacion } from '../acciones/recuperar'

export const metadata = {
  title: 'Recuperar contraseña | ACTIVE',
  description: 'Te mandamos un correo para que elijas una contraseña nueva.',
  robots: { index: false, follow: false },
}

export default async function RecuperarPage({ searchParams }) {
  const parametros = await searchParams
  const enviado = parametros?.estado === 'enviado'

  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Recuperar contraseña"
          bajada="Escribí tu correo y te mandamos un enlace para elegir una contraseña nueva."
        />

        {/* El mismo texto exista o no la cuenta. Decir "no encontramos esa
            dirección" convertiría este formulario en una forma de averiguar
            quién está registrado. */}
        {enviado ? (
          <section className="aviso">
            <h2 className="titulo-seccion">Revisá tu correo</h2>
            <p>
              Si esa dirección tiene una cuenta, te llega un mensaje con un
              enlace para elegir una contraseña nueva. Puede tardar unos
              minutos, y conviene mirar también la carpeta de spam.
            </p>
            <Link href="/ingresar" className="boton boton-oscuro">
              Volver a ingresar
            </Link>
          </section>
        ) : (
          <>
            <form action={pedirRecuperacion} className="formulario">
              <div className="campo">
                <label htmlFor="email">Correo electrónico</label>
                <input type="email" id="email" name="email" autoComplete="email" required />
              </div>

              <button type="submit" className="boton boton-oscuro">
                Mandarme el enlace
              </button>
            </form>

            <p className="nota">
              ¿Te acordaste?{' '}
              <Link href="/ingresar" className="enlace-subrayado">
                Ingresá
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  )
}
