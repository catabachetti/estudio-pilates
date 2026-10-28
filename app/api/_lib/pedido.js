import { malPedido } from './errores'

// Los tres mecanismos de extracción que pide el módulo, cada uno validado con
// un esquema. Las tres funciones lanzan ZodError si no se cumple, y el
// manejador lo convierte en un 400 con el detalle por campo.

// ROUTE PARAMS: los segmentos dinámicos de la URL, que identifican un recurso.
// En Next 16 `params` es una Promise, igual que en las páginas.
export async function paramsDeRuta(contexto, esquema) {
  const params = await contexto.params
  return esquema.parse(params)
}

// QUERY PARAMS: lo que va después del `?`. Sirven para filtrar, ordenar y
// paginar, no para identificar.
export function paramsDeConsulta(request, esquema) {
  const { searchParams } = new URL(request.url)
  return esquema.parse(Object.fromEntries(searchParams))
}

// BODY: las estructuras complejas, en JSON. Un cuerpo mal formado es culpa de
// quien llama, así que es 400 y no 500.
export async function cuerpo(request, esquema) {
  let crudo
  try {
    crudo = await request.json()
  } catch {
    throw malPedido('El cuerpo del pedido tiene que ser JSON válido.')
  }
  return esquema.parse(crudo)
}
