import { redirect } from 'next/navigation'
import EncabezadoPagina from '../../components/EncabezadoPagina'
import CampoDeContrasena from '../../components/CampoDeContrasena'
import { usuarioActual } from '../../lib/supabase-sesion'
import { cambiarContrasena } from '../../acciones/recuperar'

export const metadata = {
  title: 'Cambiar contraseña | ACTIVE',
  robots: { index: false, follow: false },
}

const MENSAJES = {
  contrasena:
    'La contraseña necesita al menos 8 caracteres, una minúscula, una mayúscula, un número y un símbolo.',
  repetida: 'Esa es la contraseña que ya tenías. Elegí una distinta.',
  guardar:
    'No pudimos cambiar la contraseña. Si llegaste desde un correo viejo, pedí un enlace nuevo.',
}

export default async function CambiarContrasenaPage({ searchParams }) {
  // Acá se llega de dos formas: por el enlace del correo, que deja la sesión
  // iniciada antes de redirigir, o estando conectada y queriendo cambiarla.
  // Las dos necesitan sesión, así que el control es el mismo.
  const usuario = await usuarioActual()
  if (!usuario) redirect('/ingresar?volver=%2Fcuenta%2Fcontrasena')

  const parametros = await searchParams
  const error = MENSAJES[parametros?.error]

  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Elegí una contraseña"
          bajada="Va a reemplazar la que tenías. Después seguís con la sesión abierta."
        />

        {error && (
          <p className="mensaje mensaje-error" role="alert">
            {error}
          </p>
        )}

        <form action={cambiarContrasena} className="formulario">
          <CampoDeContrasena etiqueta="Contraseña nueva" />

          <button type="submit" className="boton boton-oscuro">
            Guardar
          </button>
        </form>
      </div>
    </main>
  )
}
