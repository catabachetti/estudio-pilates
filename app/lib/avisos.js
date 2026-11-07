// Buscar un aviso en un diccionario con una clave QUE VIENE DE LA URL.
//
// POR QUE NO ALCANZA `DICCIONARIO[clave]`, que es lo que hacían las doce
// pantallas que muestran un `?error=`, un `?r=` o un `?estado=`: una clave como
// `toString`, `constructor`, `valueOf` o `__proto__` no devuelve `undefined`,
// devuelve la propiedad **heredada del prototipo** de Object. Casi siempre una
// función.
//
// Y una función no se puede renderizar. MEDIDO sobre el sitio compilado, con
// `?error=toString`:
//
//   /registro, /ingresar, /paquetes, /contacto, /cuenta,
//   /cuenta/contrasena, /admin/clases, /admin/creditos, /admin/paquetes   500
//   /reservar                        200, pero con una caja de aviso VACIA
//                                    anunciada como `role="alert"`
//
// /reservar se salvaba por casualidad: sus valores son objetos y el código lee
// `.tono` y `.texto`, que en una función son `undefined`. No es una defensa, es
// una coincidencia.
//
// `Object.hasOwn` mira **solo las propiedades propias**, así que cualquier clave
// inventada cae en `undefined`, que es lo que cada pantalla ya sabe manejar: no
// muestra ningún aviso.
//
// Esto es la misma regla que el proyecto ya aplica a `volver` con
// `rutaInterna()`: todo lo que llega por la URL se valida antes de usarlo. Acá
// faltaba, y faltaba en todas.
export function mensajeDe(diccionario, clave) {
  return typeof clave === 'string' && Object.hasOwn(diccionario, clave)
    ? diccionario[clave]
    : undefined
}
