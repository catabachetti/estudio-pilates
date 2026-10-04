export const tiposDeClase = [
  {
    slug: 'flow',
    imagen: '/imagenes/clase-flow.jpg',
    imagenAlt:
      'Mujer recostada en un reformer estirando los brazos por encima de la cabeza',
    nombre: 'Reformer Flow',
    descripcionCorta:
      'Control, alineación y fluidez. Trabaja todo el cuerpo con precisión sobre el reformer.',
    descripcionLarga: [
      'Flow es nuestra clase base y la puerta de entrada al reformer. Trabajamos la respiración, la alineación de la columna y la activación del centro, con transiciones suaves entre ejercicios y una progresión que no deja huecos.',
      'La instructora corrige postura durante toda la clase y ajusta la resistencia de los resortes para cada persona, así que podés tomarla sin experiencia previa y sostenerla durante años sin que deje de desafiarte.',
    ],
    duracion: '50 minutos',
    nivel: 'Apta para principiantes',
    queLlevar: ['Medias antideslizantes', 'Botella de agua', 'Ropa cómoda'],
  },
  {
    slug: 'power',
    imagen: '/imagenes/clase-power.jpg',
    imagenAlt:
      'Mujer sentada en un reformer empujando la barra de pies con las piernas',
    nombre: 'Reformer Power',
    descripcionCorta:
      'Más intensa y dinámica. Fuerza, resistencia y control en cada repetición.',
    descripcionLarga: [
      'Power sube la exigencia: series más largas, menos pausa entre ejercicios y mayor carga en los resortes. El objetivo es construir fuerza real y resistencia muscular sin perder la precisión del método.',
      'Pedimos experiencia previa porque la clase asume que ya conocés el equipo y los principios básicos. Si venís de otro estudio, tomá una Flow primero para que la instructora vea cómo te movés.',
    ],
    duracion: '50 minutos',
    nivel: 'Requiere experiencia previa',
    queLlevar: ['Medias antideslizantes', 'Botella de agua', 'Ropa cómoda'],
  },
  {
    slug: 'prenatal',
    imagen: '/imagenes/clase-prenatal.jpg',
    imagenAlt:
      'Mujer embarazada sentada en un reformer mientras una instructora la asiste',
    nombre: 'Reformer Prenatal',
    descripcionCorta:
      'Movimiento seguro para el embarazo. Fortalece, alivia tensiones y mejora la postura.',
    descripcionLarga: [
      'Una clase pensada para acompañar el embarazo trimestre a trimestre. Trabajamos piso pélvico, movilidad de cadera y fuerza en piernas y espalda, que es donde más se siente el cambio de peso y de eje.',
      'Adaptamos cada ejercicio a la etapa en la que estás y evitamos las posiciones contraindicadas. Necesitamos la autorización de tu obstetra antes de la primera clase, y te pedimos que nos avises si algo molesta durante la práctica.',
    ],
    duracion: '50 minutos',
    nivel: 'Con autorización médica',
    queLlevar: ['Medias antideslizantes', 'Botella de agua', 'Ropa cómoda'],
  },
]

export function buscarClase(slug) {
  return tiposDeClase.find((clase) => clase.slug === slug)
}

export const paquetes = [
  {
    id: 'clase-1',
    nombre: '1 clase',
    precio: 18000,
    dias: 30,
    incluye: 'Una clase suelta, para probar el estudio o sumar a tu semana.',
  },
  {
    id: 'clases-4',
    nombre: '4 clases',
    precio: 64000,
    dias: 60,
    incluye: 'Una clase por semana durante un mes, con margen para reprogramar.',
  },
  {
    id: 'clases-8',
    nombre: '8 clases',
    precio: 120000,
    dias: 90,
    incluye: 'Dos clases por semana. El ritmo que más recomendamos para ver cambios.',
  },
  {
    id: 'clases-12',
    nombre: '12 clases',
    precio: 168000,
    dias: 120,
    incluye: 'Tres clases por semana, con la vigencia más larga del estudio.',
  },
  {
    id: 'mes-libre',
    nombre: 'Mes libre',
    precio: 195000,
    dias: 30,
    incluye: 'Todas las clases que quieras durante 30 días, sujeto a disponibilidad.',
  },
]

export const condiciones = [
  'Los créditos vencen según el paquete que compres.',
  'Siempre se consume primero el crédito que vence antes.',
  'Podés cancelar sin costo hasta 6 horas antes de la clase.',
  'Después de esa ventana el crédito se pierde.',
]

export const grilla = [
  {
    dia: 'Lunes a viernes',
    turnos: [
      { hora: '7:00', clase: 'Reformer Flow', duracion: '50 minutos', instructora: 'Malena Ruiz' },
      { hora: '8:00', clase: 'Reformer Power', duracion: '50 minutos', instructora: 'Sofía Arrieta' },
      { hora: '9:00', clase: 'Reformer Flow', duracion: '50 minutos', instructora: 'Malena Ruiz' },
      { hora: '10:00', clase: 'Reformer Prenatal', duracion: '50 minutos', instructora: 'Juana Belgrano' },
      { hora: '18:00', clase: 'Reformer Power', duracion: '50 minutos', instructora: 'Sofía Arrieta' },
      { hora: '19:00', clase: 'Reformer Flow', duracion: '50 minutos', instructora: 'Juana Belgrano' },
      { hora: '20:00', clase: 'Reformer Flow', duracion: '50 minutos', instructora: 'Malena Ruiz' },
    ],
  },
  {
    dia: 'Sábados',
    turnos: [
      { hora: '9:00', clase: 'Reformer Flow', duracion: '50 minutos', instructora: 'Malena Ruiz' },
      { hora: '10:00', clase: 'Reformer Power', duracion: '50 minutos', instructora: 'Sofía Arrieta' },
      { hora: '11:00', clase: 'Reformer Flow', duracion: '50 minutos', instructora: 'Juana Belgrano' },
    ],
  },
]

export const instructoras = [
  {
    id: 'malena',
    nombre: 'Malena Ruiz',
    especialidad: 'Reformer Flow y rehabilitación de columna',
  },
  {
    id: 'sofia',
    nombre: 'Sofía Arrieta',
    especialidad: 'Reformer Power y entrenamiento de fuerza',
  },
  {
    id: 'juana',
    nombre: 'Juana Belgrano',
    especialidad: 'Prenatal y posparto',
  },
]

export const navegacion = [
  { href: '/clases', texto: 'Clases' },
  { href: '/paquetes', texto: 'Paquetes' },
  { href: '/horarios', texto: 'Horarios' },
  { href: '/contacto', texto: 'Contacto' },
]

// El pie repite el menu principal y suma las dos secciones que no entran
// arriba, para que ninguna pagina quede sin un enlace que llegue a ella.
export const navegacionPie = [
  ...navegacion,
  { href: '/nosotras', texto: 'Nosotras' },
  { href: '/preguntas', texto: 'Preguntas' },
]

export const preguntas = [
  {
    pregunta: '¿Necesito experiencia previa?',
    respuesta:
      'Para Reformer Flow no, es la clase con la que empieza la mayoría. Reformer Power sí pide experiencia, porque asume que ya conocés el equipo. Si venís de otro estudio, tomá una Flow primero para que la instructora vea cómo te movés.',
  },
  {
    pregunta: '¿Qué llevo a la clase?',
    respuesta:
      'Medias antideslizantes, que son obligatorias, una botella de agua y ropa cómoda que te permita moverte. Toallas hay en el estudio.',
  },
  {
    pregunta: '¿Cuántas personas hay por clase?',
    respuesta:
      'Seis como máximo, porque tenemos seis reformers. Es el límite que nos permite corregir a cada persona durante toda la clase.',
  },
  {
    pregunta: '¿Puedo cancelar una reserva?',
    respuesta:
      'Sí, hasta 6 horas antes del horario de la clase y el crédito vuelve a tu cuenta sin costo. Si cancelás después de esa ventana, o si no venís, el crédito se descuenta igual.',
  },
  {
    pregunta: '¿Los créditos vencen?',
    respuesta:
      'Sí, cada paquete tiene su vigencia en días corridos y empieza a correr el día de la compra: 30 días para una clase, 60 para cuatro, 90 para ocho y 120 para doce. Cuando tenés créditos de distintos paquetes se usa primero el que vence antes.',
  },
  {
    pregunta: '¿Puedo hacer pilates embarazada?',
    respuesta:
      'Sí, con la clase Reformer Prenatal y con autorización de tu obstetra. Adaptamos los ejercicios al trimestre en el que estés y evitamos las posiciones contraindicadas.',
  },
]

// PROVISORIO HASTA E5: mientras no exista el formulario de reserva contra la
// base de datos, las acciones del sitio (reservar, lista de espera, consultar
// un paquete) abren WhatsApp con el mensaje ya escrito, para no perder lo que
// la persona eligio. Cuando E5 este listo, esto se reemplaza por el formulario
// y el numero queda solo como contacto.
export const TELEFONO_WHATSAPP = '5491100000000'

export function enlaceWhatsapp(mensaje) {
  return `https://wa.me/${TELEFONO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`
}

const formatoPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function precioEnPesos(valor) {
  return formatoPrecio.format(valor)
}
