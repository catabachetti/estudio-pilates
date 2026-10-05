import { grilla } from '../datos/contenido'

export default function TablaHorarios() {
  return (
    <>
      {grilla.map((bloque) => (
        <div className="bloque-grilla" key={bloque.dia}>
          <table className="tabla-horarios">
            <caption>{bloque.dia}</caption>
            <colgroup>
              <col className="col-hora" />
              <col className="col-clase" />
              <col className="col-duracion" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Hora</th>
                <th scope="col">Clase</th>
                <th scope="col">Duración</th>
              </tr>
            </thead>
            <tbody>
              {bloque.turnos.map((turno) => (
                <tr key={turno.hora}>
                  <th scope="row">{turno.hora}</th>
                  <td>{turno.clase}</td>
                  <td>{turno.duracion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}
