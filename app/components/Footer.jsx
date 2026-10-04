import Link from 'next/link'
import { navegacionPie, TELEFONO_WHATSAPP } from '../datos/contenido'

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
            Gorriti 4520, Palermo
            <br />
            Ciudad de Buenos Aires
            <br />
            <a href={`https://wa.me/${TELEFONO_WHATSAPP}`}>+54 11 0000 0000</a>
            <br />
            <a href="mailto:hola@activereformer.com">hola@activereformer.com</a>
          </address>
        </div>

        <div>
          <h2 className="footer-titulo">Horarios</h2>
          <p className="footer-datos">
            Lunes a viernes
            <br />
            7:00 a 21:00
            <br />
            <br />
            Sábados
            <br />
            9:00 a 14:00
          </p>
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
