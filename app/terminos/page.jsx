import EncabezadoPagina from '../components/EncabezadoPagina'
import { DIRECCION, MAIL } from '../datos/sitio'
import { horasDeCancelacion } from '../lib/ajustes'

export const metadata = {
  title: 'Términos y condiciones | ACTIVE',
  description:
    'Condiciones de compra de paquetes, vigencia de los créditos y política de cancelación de ACTIVE.',
}

export default async function TerminosPage() {
  // La misma ventana que aplica cancelar_reserva(). Si no se pudo leer, la
  // frase sale sin el número en vez de afirmar uno.
  const horas = await horasDeCancelacion()

  return (
    <main className="seccion">
      <div className="contenedor texto-legal">
        {/* el título empieza con T: ver la compensación óptica en globals.css */}
        <EncabezadoPagina titulo="Términos y condiciones" compensacion="-0.01em" />
        <p className="legal-fecha">Última actualización: octubre de 2026</p>

        <h2>Alcance</h2>
        <p>
          Estas condiciones regulan la compra de paquetes de clases y la
          reserva de turnos en ACTIVE, con domicilio en {DIRECCION.calle},{' '}
          {DIRECCION.ciudad}. Al comprar un paquete aceptás lo que sigue.
        </p>

        <h2>Paquetes y vigencia</h2>
        <p>
          Cada paquete acredita una cantidad de clases en tu cuenta y tiene una
          vigencia expresada en días corridos, que empieza a correr el día de
          la compra. Las clases no utilizadas dentro de ese plazo se pierden y
          no son reembolsables ni transferibles a otra persona. Cuando tenés
          créditos de distintos paquetes, el sistema consume primero el que
          vence antes.
        </p>

        <h2>Reservas y cancelaciones</h2>
        <p>
          Las reservas se hacen por la web y están sujetas a disponibilidad.
          {typeof horas === 'number'
            ? `Podés cancelar sin costo hasta ${horas} horas antes del horario de la clase y el crédito vuelve a tu cuenta.`
            : 'Podés cancelar sin costo con la anticipación que indica la página de reservas, y el crédito vuelve a tu cuenta.'}{' '}
          Pasada esa ventana, o si no te presentás, el crédito se descuenta
          igual.
        </p>

        <h2>Lista de espera</h2>
        <p>
          Si la clase está completa podés anotarte en la lista de espera. Si
          alguien cancela, el lugar se asigna automáticamente a la primera
          persona de la lista y te avisamos por mail.
        </p>

        <h2>Salud</h2>
        <p>
          Es tu responsabilidad informarnos sobre lesiones, cirugías recientes,
          embarazo o cualquier condición que pueda afectar la práctica. Las
          clases prenatales requieren autorización médica escrita.
        </p>

        <h2>Pagos</h2>
        <p>
          Los pagos se procesan a través de Mercado Pago. ACTIVE no almacena
          datos de tarjetas. Los precios pueden actualizarse sin aviso previo,
          pero nunca afectan paquetes ya comprados.
        </p>

        <h2>Consultas</h2>
        <p>
          Por cualquier duda escribinos a{' '}
          <a href={`mailto:${MAIL}`}>{MAIL}</a>.
        </p>
      </div>
    </main>
  )
}
