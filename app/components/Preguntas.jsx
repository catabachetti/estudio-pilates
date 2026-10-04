import { preguntas } from '../datos/contenido'

export default function Preguntas({ Titulo = 'h2' }) {
  return (
    <section className="preguntas" id="preguntas">
      <div className="contenedor">
        <Titulo className={Titulo === 'h1' ? 'pagina-titulo' : 'titulo-seccion'}>
          Preguntas frecuentes
        </Titulo>

        <div className="preguntas-lista">
          {preguntas.map((item) => (
            <details className="pregunta" key={item.pregunta}>
              <summary>{item.pregunta}</summary>
              <p>{item.respuesta}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
