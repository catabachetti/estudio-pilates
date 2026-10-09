-- Datos iniciales de ACTIVE.
--
-- Traduce a la base lo que hoy vive en app/datos/contenido.js y app/datos/agenda.js.
-- Se puede correr las veces que haga falta sin duplicar nada y, sobre todo, sin
-- borrar nada: no hay ningún DELETE.
--
-- POR QUÉ NO HAY DELETE: `reservas.clase_id` referencia a `clases` con
-- ON DELETE CASCADE. Un `delete from clases` no daría error, se llevaría las
-- reservas de las personas en silencio. Por eso cada INSERT es idempotente por
-- su cuenta: o inserta la fila que falta, o la deja como está.
--
-- Todo va en una transacción: si algo falla a mitad de camino, la base queda
-- como estaba y no a medio cargar.

begin;

-- ---------------------------------------------------------------------------
-- instructoras
-- ---------------------------------------------------------------------------
-- `nombre` es unique desde la migración 005, así que alcanza con ON CONFLICT.
--
-- `imagen` queda en null: el sitio todavía no tiene retratos de las
-- instructoras, solo fotos del estudio y de las clases.

insert into instructoras (nombre, bio, imagen) values
  ('Malena Ruiz',
   'Especialista en Reformer Flow y rehabilitación de columna. Da las clases de la mañana y el último turno de la tarde.',
   null),
  ('Sofía Arrieta',
   'Especialista en Reformer Power y entrenamiento de fuerza. Da las clases más exigentes del estudio.',
   null),
  ('Juana Belgrano',
   'Especialista en prenatal y posparto. Acompaña el embarazo trimestre a trimestre y la vuelta al movimiento.',
   null)
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------------
-- tipos_clase
-- ---------------------------------------------------------------------------
-- Acá sí hay unicidad: `slug` es unique, así que alcanza con ON CONFLICT.
--
-- `nivel` va en null para prenatal: esa clase no tiene nivel, se adapta a cada
-- etapa del embarazo. El requisito es el que manda.
-- `duracion_min` sale de DURACION_CLASE, que en el código es 50.

insert into tipos_clase
  (slug, nombre, descripcion_corta, descripcion_larga, nivel, requisito, duracion_min, imagen, orden)
values
  ('flow',
   'Reformer Flow',
   'Control, alineación y fluidez. Trabaja todo el cuerpo con precisión sobre el reformer.',
   'Flow es nuestra clase base y la puerta de entrada al reformer. Trabajamos la respiración, la alineación de la columna y la activación del centro, con transiciones suaves entre ejercicios y una progresión que no deja huecos.

La instructora corrige postura durante toda la clase y ajusta la resistencia de los resortes para cada persona, así que podés tomarla sin experiencia previa y sostenerla durante años sin que deje de desafiarte.',
   'Nivel inicial',
   'Apta para principiantes',
   50,
   '/imagenes/clase-flow.jpg',
   1),

  ('power',
   'Reformer Power',
   'Más intensa y dinámica. Fuerza, resistencia y control en cada repetición.',
   'Power sube la exigencia: series más largas, menos pausa entre ejercicios y mayor carga en los resortes. El objetivo es construir fuerza real y resistencia muscular sin perder la precisión del método.

Pedimos experiencia previa porque la clase asume que ya conocés el equipo y los principios básicos. Si venís de otro estudio, tomá una Flow primero para que la instructora vea cómo te movés.',
   'Nivel intermedio',
   'Requiere experiencia previa',
   50,
   '/imagenes/clase-power.jpg',
   2),

  ('prenatal',
   'Reformer Prenatal',
   'Movimiento seguro para el embarazo. Fortalece, alivia tensiones y mejora la postura.',
   'Una clase pensada para acompañar el embarazo trimestre a trimestre. Trabajamos piso pélvico, movilidad de cadera y fuerza en piernas y espalda, que es donde más se siente el cambio de peso y de eje.

Adaptamos cada ejercicio a la etapa en la que estás y evitamos las posiciones contraindicadas. Necesitamos la autorización de tu obstetra antes de la primera clase, y te pedimos que nos avises si algo molesta durante la práctica.',
   null,
   'Con autorización médica',
   50,
   '/imagenes/clase-prenatal.jpg',
   3)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- paquetes
-- ---------------------------------------------------------------------------
-- Mismo caso que instructoras: `nombre` es unique desde la 005.
--
-- `clases` va en null para el mes libre: no acredita una cantidad fija, da
-- acceso libre durante su vigencia. El check (clases > 0) no se rompe, porque
-- en SQL un null no falla una restricción de verificación: la deja pasar.

insert into paquetes (nombre, clases, precio, dias_vigencia, orden) values
  ('1 clase',   1,     18000, 30,  1),
  ('4 clases',  4,     64000, 60,  2),
  ('8 clases',  8,    120000, 90,  3),
  ('12 clases', 12,   168000, 120, 4),
  ('Mes libre', null, 195000, 30,  5)
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------------
-- clases
-- ---------------------------------------------------------------------------
-- Una fila por cada clase concreta de las próximas ocho semanas (SEMANAS_ABIERTAS),
-- contadas desde hoy. Las fechas no están escritas a mano: salen de
-- generate_series sobre current_date, así que el archivo sigue siendo válido
-- el mes que viene.
--
-- La grilla es la misma que usa agenda.js: de lunes a viernes los siete
-- horarios, los sábados tres, los domingos el estudio no abre.
--
-- Las claves foráneas se resuelven por subconsulta sobre el slug y el nombre,
-- porque los ids los genera la base y no se pueden anticipar acá.
--
-- La instructora de cada turno es fija y repite la asignación del sitio:
-- Malena en los turnos de Flow de la mañana y el cierre, Sofía en todos los
-- Power, Juana en el prenatal y en el Flow de las 19.
--
-- ON CONFLICT (fecha, hora) usa la restricción de unicidad que ya existe en la
-- tabla. Al correrlo de nuevo una semana después, las clases viejas quedan
-- intactas con sus reservas y solo se agregan los días nuevos del final.

insert into clases (tipo_clase_id, instructora_id, fecha, hora, cupo_total)
select
  (select id from tipos_clase where slug = horario.slug),
  (select id from instructoras where nombre = horario.instructora),
  dia::date,
  horario.hora,
  6
from generate_series(
       current_date,
       current_date + (8 * 7 - 1),
       interval '1 day'
     ) as dia
join (values
  -- (bloque, hora, slug del tipo de clase, instructora)
  ('semana', time '07:00', 'flow',     'Malena Ruiz'),
  ('semana', time '08:00', 'power',    'Sofía Arrieta'),
  ('semana', time '09:00', 'flow',     'Malena Ruiz'),
  ('semana', time '10:00', 'prenatal', 'Juana Belgrano'),
  ('semana', time '18:00', 'power',    'Sofía Arrieta'),
  ('semana', time '19:00', 'flow',     'Juana Belgrano'),
  ('semana', time '20:00', 'flow',     'Malena Ruiz'),
  ('sabado', time '09:00', 'flow',     'Malena Ruiz'),
  ('sabado', time '10:00', 'power',    'Sofía Arrieta'),
  ('sabado', time '11:00', 'flow',     'Juana Belgrano')
) as horario (bloque, hora, slug, instructora)
-- isodow: 1 es lunes y 7 es domingo. Los domingos no entran en ningún bloque,
-- así que quedan afuera sin necesidad de excluirlos explícitamente.
on (extract(isodow from dia) between 1 and 5 and horario.bloque = 'semana')
or (extract(isodow from dia) = 6            and horario.bloque = 'sabado')
order by dia, horario.hora
on conflict (fecha, hora) do nothing;

commit;
