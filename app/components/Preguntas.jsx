import { preguntas } from '../datos/contenido'

export default function Preguntas({ sinTitulo = false }) {
  return (
    <section className={`preguntas${sinTitulo ? ' preguntas-sueltas' : ''}`} id="preguntas">
      <div className="contenedor">
        {!sinTitulo && <h2 className="titulo-seccion">Preguntas frecuentes</h2>}

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
