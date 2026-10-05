// Encabezado único de las páginas internas: título y bajada a ancho de lectura.
// Sin columna derecha a propósito: los datos útiles ya viven en el cuerpo de
// cada página y repetirlos arriba los duplicaba.
export default function EncabezadoPagina({ titulo, bajada }) {
  return (
    <header className="encabezado">
      <h1 className="pagina-titulo">{titulo}</h1>
      {bajada && <p className="seccion-texto">{bajada}</p>}
    </header>
  )
}
