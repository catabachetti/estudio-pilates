import Link from 'next/link'
import EncabezadoPagina from '../components/EncabezadoPagina'
import { ingresar } from '../acciones/sesion'
import { rutaInterna } from '../lib/rutas'

export const metadata = {
  title: 'Ingresar | ACTIVE',
  description: 'Entrá a tu cuenta para reservar clases y ver tus créditos.',
}

// Mensajes en castellano. Las credenciales siempre dan el mismo, exista o no
// ese correo: distinguirlo revelaría quiénes están registradas.
const MENSAJES = {
  credenciales: 'Esas credenciales no son correctas.',
  enlace:
    'Ese enlace no sirve: puede haber vencido o haberse usado antes. Pedí uno nuevo.',
  email: 'Revisá el correo: no parece una dirección válida.',
}

// El aviso de espera dice cuántos segundos faltan, y ese número viaja en la
// URL, así que lo escribe quien quiera. Se lo trata como texto de afuera: si no
// es un entero razonable, se usa el mensaje genérico de credenciales.
function mensajeDeEspera(parametros) {
  const n = Number(parametros?.segundos)
  if (!Number.isInteger(n) || n < 1 || n > 3600) return MENSAJES.credenciales

  const minutos = Math.ceil(n / 60)
  const cuanto = n < 60 ? `${n} segundos` : minutos === 1 ? 'un minuto' : `${minutos} minutos`
  return `Hubo varios intentos fallidos. Probá de nuevo en ${cuanto}.`
}

export default async function IngresarPage({ searchParams }) {
  const parametros = await searchParams
  const error =
    parametros?.error === 'espera'
      ? mensajeDeEspera(parametros)
      : MENSAJES[parametros?.error]
  const confirma = parametros?.estado === 'confirma'

  // El destino se valida también al dibujar el formulario, no solo al recibirlo:
  // así una ruta hostil nunca llega a escribirse en el HTML.
  const volver = rutaInterna(parametros?.volver)

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
          {volver && <input type="hidden" name="volver" value={volver} />}

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

          {/* Sin minLength ni pattern a propósito: las reglas nuevas son más
              estrictas que las de antes, y quien se registró con las viejas
              tiene que poder entrar igual. Quien decide acá es el servidor de
              auth, no el formulario. */}
          <div className="campo">
            <label htmlFor="contrasena">Contraseña</label>
            <input
              type="password"
              id="contrasena"
              name="contrasena"
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="boton boton-oscuro">
            Ingresar
          </button>
        </form>

        <p className="nota">
          ¿Olvidaste tu contraseña?{' '}
          <Link href="/recuperar" className="enlace-subrayado">
            Recuperala
          </Link>
        </p>

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
