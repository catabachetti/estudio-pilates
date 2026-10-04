import Preguntas from '../components/Preguntas'

export const metadata = {
  title: 'Preguntas frecuentes | ACTIVE',
  description:
    'Qué llevar a la clase, cuántas personas hay por grupo, cómo funcionan las cancelaciones y el vencimiento de los créditos.',
}

export default function PreguntasPage() {
  return (
    <main>
      <Preguntas Titulo="h1" />
    </main>
  )
}
