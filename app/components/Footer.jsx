import Link from 'next/link'
import { navegacionPie, TELEFONO_WHATSAPP, DIRECCION } from '../datos/contenido'
import { horariosDeAtencion } from '../datos/agenda'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="contenedor footer-grilla">
        <div>
          <p className="logo">ACTIVE</p>
          <p className="footer-texto">
            Reformer pilates en Palermo.
            <br />
            Grupos reducidos, instructoras certificadas.
          </p>
        </div>

        <nav aria-label="Secciones del sitio">
          <h2 className="footer-titulo">Estudio</h2>
          <ul className="footer-lista">
            {navegacionPie.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.texto}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="footer-titulo">Contacto</h2>
          <address className="footer-datos">
            {DIRECCION.calle}, {DIRECCION.barrio}
            <br />
            {DIRECCION.ciudad}
            <br />
            <a href={`https://wa.me/${TELEFONO_WHATSAPP}`}>+54 11 0000 0000</a>
            <br />
            <a href="mailto:hola@activereformer.com">hola@activereformer.com</a>
          </address>
        </div>

        <div>
          <h2 className="footer-titulo">Horarios</h2>
          <div className="footer-datos">
            {horariosDeAtencion().map((bloque) => (
              <p key={bloque.dia}>
                {bloque.dia}
                <br />
                {bloque.desde} a {bloque.hasta}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="contenedor footer-legal">
        <p>© 2026 ACTIVE</p>
        <ul className="footer-legal-lista">
          <li>
            <Link href="/terminos">Términos y condiciones</Link>
          </li>
          <li>
            <Link href="/privacidad">Política de privacidad</Link>
          </li>
        </ul>
      </div>
    </footer>
  )
}
