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
  // El texto dice exactamente lo que el sistema comprueba, ni más ni menos.
  // NO decir "ya usaste esa contraseña" ni "no podés repetir una anterior",
  // aunque sea lo que dicen otros sitios: Supabase compara contra la
  // contraseña ACTUAL y nada más, no contra un historial. Ese texto afirmaría
  // una protección que no existe.
  repetida: 'La contraseña nueva tiene que ser distinta de la actual.',
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
