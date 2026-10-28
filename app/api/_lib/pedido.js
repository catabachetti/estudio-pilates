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
  return esquema.parse(await cuerpoCrudo(request))
}

// El cuerpo sin validar, para la única ruta que tiene que mirarlo antes de
// elegir con qué esquema validarlo: PATCH /clases/{id} acepta un cambio de
// estado o una edición completa, y son dos formas distintas.
//
// Está acá y no allá para que el mensaje de "no es JSON" se escriba una sola
// vez. Antes estaba copiado en los dos lados, que es la manera de que un día
// uno de los dos diga otra cosa.
export async function cuerpoCrudo(request) {
  try {
    return await request.json()
  } catch {
    throw malPedido('El cuerpo del pedido tiene que ser JSON válido.')
  }
}
