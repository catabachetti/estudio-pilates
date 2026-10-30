import EncabezadoPagina from '../components/EncabezadoPagina'
import { condicionesCon, precioEnPesos, enlaceWhatsapp } from '../datos/sitio'
import { horasDeCancelacion } from '../lib/ajustes'
import { clienteSupabase } from '../lib/supabase'
import { iniciarCompra } from '../acciones/mercadopago'

// Lo que puede salir mal al empezar una compra. El detalle técnico va al
// registro del servidor; acá se dice qué pasó y, cuando corresponde, que no se
// cobró nada: es lo primero que alguien se pregunta.
const MENSAJES = {
  paquete: 'Ese paquete ya no está disponible. Elegí otro de la lista.',
  mp: 'No pudimos abrir el pago. Probá de nuevo en un rato. No se cobró nada.',
  error:
    'Algo falló de nuestro lado antes de llevarte a pagar. No se cobró nada: probá de nuevo.',
}

export const revalidate = 3600

export const metadata = {
  title: 'Paquetes | ACTIVE',
  description:
    'Paquetes de 1, 4, 8 y 12 clases. Las clases se acreditan en tu cuenta y las usás dentro de su vigencia.',
}

export default async function PaquetesPage({ searchParams }) {
  // En Next 16 searchParams es una Promise, igual que params.
  const parametros = await searchParams
  // `error` ya lo usa la consulta de abajo para el fallo de lectura: este es
  // otro, el del intento de compra que volvió con ?r=.
  const errorDeCompra = MENSAJES[parametros?.r]

  const horas = await horasDeCancelacion()

  const { data: paquetes, error } = await clienteSupabase()
    .from('paquetes')
    .select('id, nombre, clases, precio, dias_vigencia, incluye')
    .eq('activo', true)
    .order('orden')

  if (error) {
    console.error('No se pudieron leer los paquetes de Supabase:', error.message)
  }

  return (
    <main className="seccion">
      <div className="contenedor">
        <EncabezadoPagina
          titulo="Paquetes"
          bajada="Comprás las clases y se acreditan en tu cuenta. Reservás el día y el horario que quieras mientras tengas créditos disponibles."
        />

        {errorDeCompra && (
          <p className="mensaje mensaje-error" role="alert">
            {errorDeCompra}
          </p>
        )}

        {error || !paquetes?.length ? (
          <PaquetesNoDisponibles />
        ) : (
          <ul className="paquetes-grilla-pagina">
            {paquetes.map((paquete) => (
              <li className="paquete" key={paquete.id}>
                <h2 className="paquete-nombre">{paquete.nombre}</h2>
                <p className="paquete-precio">{precioEnPesos(paquete.precio)}</p>
                <p className="paquete-vigencia">
                  Vence en {paquete.dias_vigencia} días
                </p>
                <p className="paquete-incluye">{paquete.incluye}</p>
                {/* Un formulario por paquete, con el id como único dato que
                    viaja. El precio NO va acá: lo vuelve a leer de la base la
                    Server Action, porque un precio en un campo oculto se edita
                    y se paga el paquete de 12 clases a un peso.

                    Sin 'use client' y sin JavaScript: es un POST común a una
                    Server Action, y Mercado Pago se abre por redirección. */}
                <form action={iniciarCompra}>
                  <input type="hidden" name="paquete_id" value={paquete.id} />
                  <button
                    type="submit"
                    className="boton boton-oscuro"
                    aria-label={`Comprar el paquete de ${paquete.nombre.toLowerCase()}`}
                  >
                    Comprar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <section className="condiciones">
          <h2 className="seccion-titulo">Condiciones</h2>
          <p className="seccion-texto">{condicionesCon(horas)}</p>
        </section>
      </div>
    </main>
  )
}

function PaquetesNoDisponibles() {
  return (
    <section className="aviso">
      <h2 className="titulo-seccion">No podemos mostrar los precios ahora</h2>
      <p>
        Estamos teniendo un problema para cargar los paquetes. Escribinos y te
        pasamos los precios y las vigencias.
      </p>
      <a
        href={enlaceWhatsapp('Hola, quiero consultar por los paquetes de clases.')}
        className="boton boton-oscuro"
        target="_blank"
        rel="noopener"
        aria-label="Consultar por los paquetes por WhatsApp"
      >
        Consultar por WhatsApp
      </a>
    </section>
  )
}
