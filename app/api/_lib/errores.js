import { z } from 'zod'

// EL MANEJO CENTRALIZADO DE ERRORES DE LA API.
//
// La materia lo llama "Global Error Middleware" y lo muestra en Express, donde
// el framework encadena middlewares y uno final captura lo que los anteriores
// lanzaron. **En App Router no existe eso**, y conviene entender por qué antes
// de buscarlo:
//
//   - `proxy.js` corre ANTES del enrutamiento. Decide si el pedido sigue, pero
//     no envuelve al handler ni puede capturar una excepción lanzada adentro.
//   - `error.js` es para errores de renderizado de React en páginas. Un Route
//     Handler no renderiza nada.
//
// Así que el equivalente hay que construirlo, y la única forma de centralizar
// es **componer una función alrededor de cada handler**. Eso es `manejador()`:
// cada ruta exporta `export const GET = manejador(async (request) => ...)` y a
// partir de ahí ningún error se escapa sin pasar por acá.

// Un error que la API sabe explicar, con su código HTTP ya decidido.
export class ErrorDeApi extends Error {
  constructor(estado, codigo, mensaje, detalles = null) {
    super(mensaje)
    this.estado = estado
    this.codigo = codigo
    this.detalles = detalles
  }
}

export const malPedido = (mensaje, detalles) =>
  new ErrorDeApi(400, 'datos_invalidos', mensaje, detalles)

export const noAutenticado = (mensaje = 'Hace falta iniciar sesión.') =>
  new ErrorDeApi(401, 'no_autenticado', mensaje)

export const sinPermiso = (mensaje = 'Tu cuenta no tiene permiso para esto.') =>
  new ErrorDeApi(403, 'sin_permiso', mensaje)

export const noEncontrado = (mensaje = 'No existe eso que pediste.') =>
  new ErrorDeApi(404, 'no_encontrado', mensaje)

// 409 no está en la lista de la materia y hace falta igual. "La clase se llenó"
// y "ya tenías esa reserva" no son datos inválidos (400) ni recursos ausentes
// (404): son un choque con el estado actual del sistema. Devolver 400 le diría
// a quien llama que arregle su pedido, cuando el pedido estaba bien.
export const conflicto = (codigo, mensaje) => new ErrorDeApi(409, codigo, mensaje)

function cuerpoDeError(codigo, mensaje, detalles, id) {
  return {
    error: {
      codigo,
      mensaje,
      // El identificador se devuelve Y se registra junto al error completo. Así
      // alguien puede reportar "me dio error 3f2a..." y lo encontramos en los
      // registros, sin haberle mostrado nada de adentro.
      id,
      ...(detalles ? { detalles } : {}),
    },
  }
}

// Envuelve un Route Handler. Todo lo que salga mal sale de acá con la forma
// correcta y sin filtrar nada.
export function manejador(fn) {
  return async (request, contexto) => {
    const id = crypto.randomUUID()

    try {
      return await fn(request, contexto)
    } catch (e) {
      // Un esquema que no se cumple es un 400 con el detalle por campo, que es
      // lo que le sirve a quien llama para corregir el pedido.
      if (e instanceof z.ZodError) {
        return Response.json(
          cuerpoDeError(
            'datos_invalidos',
            'Algunos datos no son válidos.',
            z.flattenError(e).fieldErrors,
            id
          ),
          { status: 400 }
        )
      }

      if (e instanceof ErrorDeApi) {
        return Response.json(cuerpoDeError(e.codigo, e.message, e.detalles, id), {
          status: e.estado,
        })
      }

      // Lo inesperado. El error COMPLETO va a los registros del servidor y al
      // cliente no le llega nada: devolver una traza expone nombres de
      // archivos, estructura de la base y versiones de librerías. La materia lo
      // marca como vulnerabilidad crítica y tiene razón.
      console.error(`[api ${id}]`, e)
      return Response.json(
        cuerpoDeError('error_interno', 'Algo falló de nuestro lado.', null, id),
        { status: 500 }
      )
    }
  }
}

// Las respuestas que salen bien, para que todas tengan la misma forma.
export const ok = (datos) => Response.json({ datos }, { status: 200 })
export const creado = (datos, ubicacion) =>
  Response.json({ datos }, { status: 201, headers: ubicacion ? { Location: ubicacion } : {} })
