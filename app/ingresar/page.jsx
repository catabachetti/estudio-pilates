import Link from 'next/link'
import EncabezadoPagina from '../components/EncabezadoPagina'
import { ingresar } from '../acciones/sesion'

export const metadata = {
  title: 'Ingresar | ACTIVE',
  description: 'Entrá a tu cuenta para reservar clases y ver tus créditos.',
}

// Mensajes en castellano. Las credenciales siempre dan el mismo, exista o no
// ese correo: distinguirlo revelaría quiénes están registradas.
const MENSAJES = {
  credenciales: 'Esas credenciales no son correctas.',
  email: 'Revisá el correo: no parece una dirección válida.',
  contrasena: 'La contraseña tiene que tener al menos 8 caracteres.',
}

export default async function IngresarPage({ searchParams }) {
  const parametros = await searchParams
  const error = MENSAJES[parametros?.error]
  const confirma = parametros?.estado === 'confirma'

  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Ingresar"
          bajada="Entrá a tu cuenta para reservar clases y ver tus créditos."
        />

        {confirma && (
          <p className="mensaje" role="status">
            Te mandamos un correo para confirmar tu cuenta. Abrilo y después
            volvé a ingresar.
          </p>
        )}

        {error && (
          <p className="mensaje mensaje-error" role="alert">
            {error}
          </p>
        )}

        <form action={ingresar} className="formulario">
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
              autoComplete="current-password"
              minLength={8}
              required
            />
          </div>

          <button type="submit" className="boton boton-oscuro">
            Ingresar
          </button>
        </form>

        <p className="nota">
          ¿Todavía no tenés cuenta?{' '}
          <Link href="/registro" className="enlace-subrayado">
            Registrate
          </Link>
        </p>
      </div>
    </main>
  )
}
