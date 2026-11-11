import { preguntasCon } from '../datos/sitio'
import { horasDeCancelacion } from '../lib/ajustes'
import { clienteSupabase } from '../lib/supabase'

// Las respuestas se arman con lo que la base tiene hoy: las horas de
// cancelación y la vigencia de cada paquete. Ver preguntasCon() en
// app/datos/sitio.js.
export default async function Preguntas({ sinTitulo = false }) {
  const [horas, { data: vigencias, error }] = await Promise.all([
    horasDeCancelacion(),
    clienteSupabase()
      .from('paquetes')
      .select('nombre, dias_vigencia')
      .eq('activo', true)
      .order('orden'),
  ])

  if (error) {
    console.error('No se pudieron leer las vigencias de los paquetes:', error.message)
  }

  const preguntas = preguntasCon({ horas, vigencias: error ? null : vigencias })

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
