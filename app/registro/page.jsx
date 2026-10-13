import Link from 'next/link'
import EncabezadoPagina from '../components/EncabezadoPagina'
import { registrarse } from '../acciones/sesion'

export const metadata = {
  title: 'Crear cuenta | ACTIVE',
  description: 'Creá tu cuenta para comprar paquetes y reservar tus clases.',
}

const MENSAJES = {
  nombre: 'Escribí tu nombre.',
  email: 'Revisá el correo: no parece una dirección válida.',
  contrasena: 'La contraseña tiene que tener al menos 8 caracteres.',
  // Error genérico: no se dice si el correo ya estaba registrado.
  registro: 'No pudimos crear la cuenta. Probá de nuevo en un rato.',
}

export default async function RegistroPage({ searchParams }) {
  const parametros = await searchParams
  const error = MENSAJES[parametros?.error]

  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Crear cuenta"
          bajada="Con tu cuenta comprás paquetes, reservás turnos y ves cuántos créditos te quedan."
        />

        {error && (
          <p className="mensaje mensaje-error" role="alert">
            {error}
          </p>
        )}

        <form action={registrarse} className="formulario">
          <div className="campo">
            <label htmlFor="nombre">Nombre</label>
            <input
              type="text"
              id="nombre"
              name="nombre"
              autoComplete="name"
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="email">Correo electrónico</label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="contrasena">Contraseña</label>
            <input
              type="password"
              id="contrasena"
              name="contrasena"
              autoComplete="new-password"
              minLength={8}
              required
              aria-describedby="ayuda-contrasena"
            />
            <p id="ayuda-contrasena" className="campo-ayuda">
              Al menos 8 caracteres.
            </p>
          </div>

          <button type="submit" className="boton boton-oscuro">
            Crear cuenta
          </button>
        </form>

        <p className="nota">
          ¿Ya tenés cuenta?{' '}
          <Link href="/ingresar" className="enlace-subrayado">
            Ingresá
          </Link>
        </p>
      </div>
    </main>
  )
}
