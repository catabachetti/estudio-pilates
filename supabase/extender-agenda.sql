-- EXTIENDE LA AGENDA DE /reservar. A diferencia de seed.sql, que pisa el
-- catalogo con `do update`, este archivo toca UNA SOLA TABLA —`clases`— y solo
-- agrega: nunca modifica ni borra nada.
--
-- Esa distincion es el motivo por el que existe. seed.sql es la fuente de
-- verdad del catalogo: `instructoras`, `tipos_clase` y `paquetes` entran con
-- `on conflict ... do update`, asi que correrlo revierte cualquier precio o
-- texto que se haya editado desde /admin/paquetes, sin avisar y sin dejar
-- rastro. Para agregar semanas no hace falta pagar ese costo.
--
-- QUE PROBLEMA RESUELVE. Las clases las genero el seed una vez, ocho semanas, y
-- nada las renueva. Cuando se agota, /reservar no avisa: muestra la agenda
-- normal con la tira de dias vacia, porque el bloque "No hay clases cargadas"
-- solo aparece si la tabla queda sin NINGUNA clase, y las pasadas no se borran.
--
-- CUANDO CORRERLO. Cuando falten pocas semanas por delante. No hay nada
-- automatico: es a mano, desde el editor SQL de Supabase. La alternativa es
-- cargarlas de a una desde /admin/clases, que tambien sirve y es mejor si la
-- grilla de esa semana es distinta de la habitual.
--
-- SE PUEDE CORRER CUANTAS VECES HAGA FALTA. `on conflict (fecha, hora) do
-- nothing` usa la restriccion de unicidad que ya tiene la tabla: las clases que
-- ya existen quedan intactas, CON SUS RESERVAS, y solo se agregan los dias que
-- faltaban. Correrlo dos veces seguidas la segunda vez no hace nada.
--
-- COMO SE USA: correr la seccion 1 y mirar hasta cuando llega la agenda. Si hace
-- falta extenderla, correr la 2 y despues la 3 para confirmar.

-- ---------------------------------------------------------------------------
-- 1. HASTA CUANDO LLEGA LA AGENDA HOY. Solo lee.
-- ---------------------------------------------------------------------------
-- `programada` y no todas: un dia con todas sus clases canceladas no es un dia
-- con agenda, y agendaDeLaSemana() lo filtra igual.
select
  min(fecha) filter (where fecha >= current_date) as primera_por_delante,
  max(fecha)                                      as ultima_cargada,
  max(fecha) - current_date                       as dias_por_delante,
  count(*) filter (where fecha >= current_date)   as clases_por_delante
from clases
where estado = 'programada';

-- ---------------------------------------------------------------------------
-- 2. AGREGAR LAS SEMANAS QUE FALTEN
-- ---------------------------------------------------------------------------
-- La consulta es LA MISMA del seed, extraida tal cual. Si la grilla del estudio
-- cambia, hay que cambiarla en los dos lugares: es el unico dato duplicado
-- entre este archivo y seed.sql, y se acepta porque separarlo en una funcion
-- obligaria a una migracion para algo que se edita una vez por ano.
--
-- EMPIEZA EN current_date, NO EN LA ULTIMA CLASE CARGADA. Asi, si quedo un
-- hueco —una semana que nadie cargo— tambien se llena. Lo que ya existe no se
-- toca, asi que arrancar antes no cuesta nada.
--
-- LAS OCHO SEMANAS SON EL HORIZONTE, y es el unico numero que conviene cambiar:
-- `8 * 7 - 1` son 56 dias contados desde hoy.
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
-- isodow: 1 es lunes y 7 es domingo. Los domingos no entran en ningun bloque,
-- asi que quedan afuera sin necesidad de excluirlos explicitamente.
on (extract(isodow from dia) between 1 and 5 and horario.bloque = 'semana')
or (extract(isodow from dia) = 6            and horario.bloque = 'sabado')
order by dia, horario.hora
on conflict (fecha, hora) do nothing;

-- ---------------------------------------------------------------------------
-- 3. COMPROBACION
-- ---------------------------------------------------------------------------
-- `ultima_cargada` tiene que haberse corrido hacia adelante, y
-- `dias_por_delante` tiene que dar 55 o 56 si se corrio recien.
select
  max(fecha)                                    as ultima_cargada,
  max(fecha) - current_date                     as dias_por_delante,
  count(*) filter (where fecha >= current_date) as clases_por_delante
from clases
where estado = 'programada';
