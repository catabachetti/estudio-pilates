import EncabezadoPagina from '../components/EncabezadoPagina'

export const metadata = {
  title: 'Política de privacidad | ACTIVE',
  description:
    'Qué datos personales recolecta ACTIVE, para qué los usa y cómo ejercer tus derechos según la Ley 25.326.',
}

export default function PrivacidadPage() {
  return (
    <main className="seccion">
      <div className="contenedor texto-legal">
        <EncabezadoPagina titulo="Política de privacidad" />
        <p className="legal-fecha">Última actualización: octubre de 2026</p>

        <h2>Qué datos pedimos</h2>
        <p>
          Para crear tu cuenta necesitamos tu nombre, tu correo electrónico y
          un teléfono de contacto. Si comprás un paquete, guardamos el registro
          de la compra y el identificador que nos devuelve Mercado Pago. No
          almacenamos datos de tarjetas en ningún momento.
        </p>

        <h2>Para qué los usamos</h2>
        <p>
          Usamos tus datos para gestionar tus créditos y reservas, avisarte
          cuando se libera un lugar de la lista de espera y enviarte
          información sobre el estudio. Podés pedirnos que dejemos de
          escribirte cuando quieras.
        </p>

        <h2>Con quién los compartimos</h2>
        <p>
          Solo con los proveedores que hacen funcionar el servicio: Mercado
          Pago para procesar los cobros y nuestro proveedor de base de datos y
          correo. No vendemos ni cedemos tus datos a terceros con fines
          publicitarios.
        </p>

        <h2>Datos de salud</h2>
        <p>
          La información médica que compartas con nosotros se usa únicamente
          para adaptar los ejercicios y la conoce solo el equipo de
          instructoras.
        </p>

        <h2>Tus derechos</h2>
        <p>
          La Ley 25.326 de Protección de Datos Personales te da derecho a
          acceder, rectificar y suprimir tus datos. Escribinos a{' '}
          <a href="mailto:hola@activereformer.com">hola@activereformer.com</a>{' '}
          y lo resolvemos dentro de los plazos que fija la norma. La Agencia de
          Acceso a la Información Pública es el órgano de control.
        </p>
      </div>
    </main>
  )
}
