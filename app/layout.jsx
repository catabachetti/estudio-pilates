import { Jost } from 'next/font/google'
import Header from './components/Header'
import Footer from './components/Footer'
import Whatsapp from './components/Whatsapp'
import './globals.css'

const jost = Jost({
  subsets: ['latin'],
  variable: '--fuente',
})

export const metadata = {
  title: 'ACTIVE | Reformer Pilates en Palermo',
  description:
    'Estudio de pilates reformer en Buenos Aires. Comprá tu paquete de clases y reservá online.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={jost.variable}>
      <body>
        <Header />
        {children}
        <Footer />
        <Whatsapp />
      </body>
    </html>
  )
}
