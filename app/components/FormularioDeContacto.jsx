'use client'

import { useState } from 'react'
import { enviarMensaje } from '../acciones/contacto'
// Solo el texto de éxito. Los textos de FALLO no se importan a propósito: los
// decide el servidor y llegan en la respuesta de la API, así que el cliente
// muestra lo que el servidor dijo en vez de tener su propia tabla. Una segunda
// copia podría desincronizarse del lado que de verdad sabe qué pasó.
import { TEXTO_OK } from '../lib/mensajes'
import {
  MensajeDeContacto,
  MINIMO_NOMBRE_CONTACTO,
  LARGO_NOMBRE_CONTACTO,
  MINIMO_MENSAJE,
  LARGO_MENSAJE,
} from '../lib/esquemas'

// LA SEGUNDA Y ÚLTIMA EXCEPCIÓN A "CERO 'use client'" DEL PROYECTO.
//
// La primera es el medidor de contraseña, y su argumento fue que el medidor es
// un agregado y no una dependencia. ACÁ ESE ARGUMENTO NO ALCANZA, y conviene
// decirlo antes de nada: **el `fetch` es funcional.** Es el camino por el que se
// manda el mensaje. Si el formulario fuera solo `fetch`, el JavaScript sería la
// única forma de usarlo y esta excepción violaría la regla del proyecto.
//
// LO QUE LA HACE ADMISIBLE ES QUE EL RESPALDO SIN JAVASCRIPT FUNCIONE. El
// `action` de abajo apunta a una Server Action, así que sin JavaScript el
// navegador postea el formulario y el mensaje se guarda igual. Con eso el
// camino funcional es el formulario nativo y el `fetch` vuelve a ser un
// agregado, como la barra del medidor.
//
// **El respaldo no es un extra: es la condición.** Si deja de funcionar, este
// componente no corresponde.
//
// POR QUÉ NO SE PUEDE CON CSS, que es la otra mitad de la regla: lo que se
// agrega son los tres estados de una petición en curso —enviando, enviado,
// falló—. CSS no sabe que hay un pedido en vuelo.
//
// CÓMO CONVIVEN EL `action` Y EL `fetch`, que es la parte que hubo que medir:
// `onSubmit` llama a `preventDefault()`, y en Next 16.4.3 eso **impide** que
// React ejecute el `action`. Medido con su control —el mismo formulario sin
// `preventDefault` sí ejecuta la acción, con la cabecera `Next-Action` a la
// vista— porque "no pasó nada" también sería el resultado de un montaje donde
// la acción nunca funciona. El detalle está en docs/arquitectura.md.
//
// Los campos van con `defaultValue` y sin `value`, igual que el medidor: así
// son HTML común y escribir funciona aunque React nunca hidrate.
export default function FormularioDeContacto() {
  // 'inicial' | 'enviando' | 'listo' | 'error'
  const [estado, setEstado] = useState('inicial')
  const [errores, setErrores] = useState({})
  const [motivo, setMotivo] = useState(null)

  async function manejar(evento) {
    evento.preventDefault()

    // El freno de verdad contra el doble envío. `aria-disabled` no deshabilita
    // nada: avisa. Lo que corta es esto.
    if (estado === 'enviando') return

    const formulario = evento.currentTarget
    const datos = Object.fromEntries(new FormData(formulario))

    // El MISMO esquema que valida la Server Action y el Route Handler. No es
    // una copia de las reglas: es el objeto importado.
    const validado = MensajeDeContacto.safeParse(datos)
    if (!validado.success) {
      setErrores(
        Object.fromEntries(validado.error.issues.map((i) => [i.path[0], i.message]))
      )
      setEstado('inicial')
      return
    }

    setErrores({})
    setEstado('enviando')

    try {
      const respuesta = await fetch('/api/v1/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validado.data),
      })

      if (respuesta.ok) {
        formulario.reset()
        setMotivo(null)
        setEstado('listo')
        return
      }

      const cuerpo = await respuesta.json().catch(() => null)
      setMotivo(cuerpo?.error?.mensaje ?? null)
      setEstado('error')
    } catch {
      // Sin red. El mensaje lo dice sin culpar a nadie y deja el WhatsApp a la
      // vista, que está en la misma página.
      setMotivo('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
      setEstado('error')
    }
  }

  const enviando = estado === 'enviando'

  // `aria-labelledby` en la sección la convierte en una REGION con nombre
  // accesible, y eso sirve para dos cosas a la vez: un lector de pantalla la
  // puede anunciar y saltar a ella, y las pruebas pueden buscar el aviso
  // ADENTRO de esta región en vez de en toda la página.
  //
  // Lo segundo hizo falta: `getByRole('alert')` a secas también encuentra el
  // `__next-route-announcer__` que Next inyecta para anunciar los cambios de
  // ruta, así que la prueba del estado de error chocaba con dos elementos. Solo
  // pasa con JavaScript —sin él ese anunciador no existe— y por eso las pruebas
  // de sin-javascript.spec.js nunca lo vieron.
  return (
    <section id="contacto" aria-labelledby="contacto-titulo">
      <h2 className="bloque-titulo" id="contacto-titulo">
        Escribinos
      </h2>

      {/* LOS TRES ESTADOS. `role="status"` para los que informan y
          `role="alert"` para el que interrumpe, que es el mismo criterio que
          usan las otras ocho pantallas del sitio. */}
      {estado === 'listo' && (
        <p className="mensaje" role="status">
          {TEXTO_OK}
        </p>
      )}
      {estado === 'error' && (
        <p className="mensaje mensaje-error" role="alert">
          {motivo ?? 'No pudimos enviar tu mensaje. Probá de nuevo.'}
        </p>
      )}

      <form action={enviarMensaje} onSubmit={manejar} className="formulario" noValidate>
        <div className="campo">
          <label htmlFor="contacto-nombre">Nombre</label>
          <input
            type="text"
            id="contacto-nombre"
            name="nombre"
            autoComplete="name"
            required
            minLength={MINIMO_NOMBRE_CONTACTO}
            maxLength={LARGO_NOMBRE_CONTACTO}
            defaultValue=""
            aria-invalid={errores.nombre ? 'true' : undefined}
            aria-describedby={errores.nombre ? 'error-nombre' : undefined}
          />
          {errores.nombre && (
            <p className="campo-ayuda" id="error-nombre">
              {errores.nombre}
            </p>
          )}
        </div>

        <div className="campo">
          <label htmlFor="contacto-email">Correo electrónico</label>
          <input
            type="email"
            id="contacto-email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            defaultValue=""
            aria-invalid={errores.email ? 'true' : undefined}
            aria-describedby={errores.email ? 'error-email' : undefined}
          />
          {errores.email && (
            <p className="campo-ayuda" id="error-email">
              {errores.email}
            </p>
          )}
        </div>

        <div className="campo">
          <label htmlFor="contacto-mensaje">Mensaje</label>
          <textarea
            id="contacto-mensaje"
            name="mensaje"
            rows={5}
            required
            minLength={MINIMO_MENSAJE}
            maxLength={LARGO_MENSAJE}
            defaultValue=""
            aria-invalid={errores.mensaje ? 'true' : undefined}
            aria-describedby={errores.mensaje ? 'error-mensaje' : undefined}
          />
          {errores.mensaje && (
            <p className="campo-ayuda" id="error-mensaje">
              {errores.mensaje}
            </p>
          )}
        </div>

        {/* `aria-disabled` y no `disabled`: un botón deshabilitado de verdad
            sale del orden de tabulación y los lectores de pantalla dejan de
            anunciarlo, así que quien está esperando no se entera de nada. Con
            aria-disabled el botón sigue ahí y el handler corta los envíos
            repetidos. */}
        <button
          type="submit"
          className="boton boton-oscuro"
          aria-disabled={enviando ? 'true' : undefined}
        >
          {enviando ? 'Enviando…' : 'Enviar mensaje'}
        </button>
      </form>
    </section>
  )
}
