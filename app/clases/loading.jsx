// EL TERCER ESTADO DE UNA PETICION, que hasta el modulo 6 del curso no existia
// en el proyecto: docs/arquitectura.md §4.3 lo tenia anotado como deuda.
//
// Durante la consulta a Supabase se veia la pagina ANTERIOR y nada mas: sin
// esqueleto, sin aviso. Y hay un numero que mide cuanto podia doler: /salud
// tarda 7,0 segundos en devolver su 503 cuando la base no responde.
//
// NO AGREGA UNA LINEA DE JAVASCRIPT AL NAVEGADOR. Es el equivalente de
// servidor de `loading`: Next envuelve la ruta en un Suspense y manda esto
// mientras el componente espera. Es la razon por la que la decision de
// arquitectura del proyecto no obliga a renunciar a este estado.
export default function Cargando() {
  return (
    <main className="seccion">
      <div className="contenedor">
        {/* role="status" y aria-live: quien usa un lector de pantalla tiene que
            enterarse de que algo esta pasando, no solo quien ve la pantalla. */}
        <p className="mensaje" role="status" aria-live="polite">
          Cargando…
        </p>
      </div>
    </main>
  )
}
