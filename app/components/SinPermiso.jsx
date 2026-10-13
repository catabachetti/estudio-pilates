import Link from 'next/link'

// El caso 403: hay sesión y no alcanza.
//
// No redirige a /ingresar a propósito. Quien ve esto ya está identificado, y
// mandarlo al login lo deja en un círculo: entra con la misma cuenta y vuelve
// a caer acá. Confundir este caso con el 401 es uno de los errores clásicos de
// autorización.
export default function SinPermiso() {
  return (
    <>
      <h1 className="pagina-titulo">Sin permiso</h1>
      <div className="aviso">
        <h2 className="titulo-seccion">Esta sección es del estudio</h2>
        <p>
          Tu cuenta está activa, pero no tiene permisos de administración. Si
          creés que debería tenerlos, pedíselo a quien administra el estudio.
        </p>
        <Link href="/" className="boton boton-oscuro">
          Volver al inicio
        </Link>
      </div>
    </>
  )
}
