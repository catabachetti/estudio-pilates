// Ver el comentario de app/clases/loading.jsx. Esta ruta es la unica que
// prerenderiza con generateStaticParams, pero el header del layout raiz la
// degrada a dinamica igual, asi que la consulta pasa en cada pedido.
export default function Cargando() {
  return (
    <main className="seccion">
      <div className="contenedor">
        <p className="mensaje" role="status" aria-live="polite">
          Cargando…
        </p>
      </div>
    </main>
  )
}
