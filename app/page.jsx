import Hero from './components/Hero'
import TiposDeClase from './components/TiposDeClase'
import Paquetes from './components/Paquetes'
import Reservas from './components/Reservas'
import Franja from './components/Franja'
import Nosotras from './components/Nosotras'
import Preguntas from './components/Preguntas'

export default function Home() {
  return (
    <main>
      <Hero />
      <TiposDeClase />
      <Paquetes />
      <Reservas />
      <Franja />
      <Nosotras />
      <Preguntas />
    </main>
  )
}
