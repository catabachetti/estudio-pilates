// Encabezado único de las páginas internas: título y bajada a ancho de lectura.
// `compensacion` ajusta la alineación óptica del título cuando su primera letra
// se aparta de la media: ver el comentario en globals.css.
export default function EncabezadoPagina({ titulo, bajada, compensacion }) {
  return (
    <header
      className="encabezado"
      style={compensacion ? { '--compensacion': compensacion } : undefined}
    >
      <h1 className="pagina-titulo">{titulo}</h1>
      {bajada && <p className="seccion-texto">{bajada}</p>}
    </header>
  )
}
