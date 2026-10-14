import Link from 'next/link'
import { aClave, desdeClave, textoDeFecha } from '../datos/agenda'

// Día anterior / fecha / día siguiente. La usan /admin/clases y /admin/reservas:
// la aritmética de correr un día de a uno se escribe en un lugar solo.
//
// `base` es la ruta a la que vuelve, sin parámetros.
export default function NavegacionDeDia({ base, fecha, etiqueta }) {
  const corrida = (dias) => {
    const f = desdeClave(fecha)
    f.setDate(f.getDate() + dias)
    return aClave(f)
  }

  return (
    <nav className="admin-dia" aria-label={etiqueta}>
      <Link href={`${base}?fecha=${corrida(-1)}`} className="enlace-subrayado">
        Día anterior
      </Link>
      <h2 className="admin-dia-titulo">{textoDeFecha(fecha)}</h2>
      <Link href={`${base}?fecha=${corrida(1)}`} className="enlace-subrayado">
        Día siguiente
      </Link>
    </nav>
  )
}
