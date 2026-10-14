import Link from 'next/link'
import SinPermiso from '../components/SinPermiso'
import { sesionAdmin } from '../lib/autorizacion'
import { clienteConSesion } from '../lib/supabase-sesion'
import { ahoraEnElEstudio } from '../datos/agenda'

export default async function AdminPage() {
  const { esAdmin } = await sesionAdmin()
  if (!esAdmin) return <SinPermiso />

  const numeros = await contar()

  return (
    <>
      <h1 className="pagina-titulo">Panel</h1>
      <p className="seccion-texto">
        Desde acá se edita lo que muestra el sitio. Todo lo que cambies se
        publica al guardar.
      </p>

      <ul className="admin-numeros">
        {numeros.map((dato) => (
          <li className="admin-numero" key={dato.rotulo}>
            <p className="admin-numero-valor">{dato.valor ?? '—'}</p>
            <p className="admin-numero-rotulo">{dato.rotulo}</p>
          </li>
        ))}
      </ul>

      <h2 className="seccion-titulo">Secciones</h2>
      <ul className="admin-tablero">
        <li className="admin-acceso">
          <h3 className="admin-acceso-titulo">
            <Link href="/admin/clases" className="enlace-subrayado">
              Clases
            </Link>
          </h3>
          <p>La agenda de cada día: crear, editar, cancelar y reactivar.</p>
        </li>
        <li className="admin-acceso">
          <h3 className="admin-acceso-titulo">
            <Link href="/admin/reservas" className="enlace-subrayado">
              Reservas
            </Link>
          </h3>
          <p>Quién viene cada día. Solo lectura.</p>
        </li>
        <li className="admin-acceso">
          <h3 className="admin-acceso-titulo">
            <Link href="/admin/paquetes" className="enlace-subrayado">
              Paquetes
            </Link>
          </h3>
          <p>Precios, cantidad de clases, vigencia, y cuáles se ofrecen.</p>
        </li>
        <li className="admin-acceso">
          <h3 className="admin-acceso-titulo">
            <Link href="/admin/creditos" className="enlace-subrayado">
              Créditos
            </Link>
          </h3>
          <p>Acreditar un paquete a mano, para pagos fuera de Mercado Pago.</p>
        </li>
      </ul>
    </>
  )
}

// Los tres números que se pueden sacar con lo que ya existe. Cada consulta pide
// solo la cuenta: `head: true` no trae ninguna fila, así que da igual que haya
// diez reservas o diez mil.
//
// Las reservas y las clases las puede contar porque las políticas de RLS las
// dejan ver a administración (`using (... or es_admin())`). Si en algún momento
// un número aparece en guión es que esa consulta falló, y el motivo queda en la
// consola del servidor.
async function contar() {
  const supabase = await clienteConSesion()
  const desde = ahoraEnElEstudio().clave

  const [paquetes, clases, reservas] = await Promise.all([
    supabase.from('paquetes').select('*', { count: 'exact', head: true }).eq('activo', true),
    supabase
      .from('clases')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'programada')
      .gte('fecha', desde),
    supabase.from('reservas').select('*', { count: 'exact', head: true }).eq('estado', 'confirmada'),
  ])

  for (const consulta of [paquetes, clases, reservas]) {
    if (consulta.error) console.error('Panel, no se pudo contar:', consulta.error.message)
  }

  return [
    { rotulo: 'Paquetes a la venta', valor: paquetes.count },
    { rotulo: 'Clases programadas de hoy en adelante', valor: clases.count },
    { rotulo: 'Reservas confirmadas', valor: reservas.count },
  ]
}
