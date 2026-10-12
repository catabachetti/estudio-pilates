-- Devuelve los turnos de una fecha con sus lugares libres, en una sola consulta.
--
-- Ya existe lugares_disponibles(clase_id), que devuelve un número para una
-- clase. La página de reservas muestra un día entero, que son hasta siete
-- turnos: con esa función harían falta siete llamadas, más una octava para
-- traer hora, tipo e instructora de cada clase. Esta devuelve todo junto.
--
-- Además evita que las dos consultas vean estados distintos de la base: si
-- alguien reserva entre una y otra, los cupos mostrados no coincidirían con las
-- clases listadas.
--
-- security definer por el mismo motivo que lugares_disponibles: las políticas de
-- RLS impiden ver las reservas ajenas, así que contarlas desde el cliente daría
-- siempre menos de las que hay. La función las cuenta adentro y devuelve solo el
-- número, sin exponer de quién es cada reserva.

create function public.disponibilidad_del_dia(p_fecha date)
returns table (
  clase_id    uuid,
  hora        time,
  clase       text,
  instructora text,
  cupo_total  integer,
  lugares     integer
)
language sql
security definer set search_path = ''
stable
as $$
  select
    c.id,
    c.hora,
    t.nombre,
    i.nombre,
    c.cupo_total,
    (c.cupo_total - (
      select count(*) from public.reservas r
      where r.clase_id = c.id and r.estado = 'confirmada'
    ))::integer
  from public.clases c
  join public.tipos_clase t on t.id = c.tipo_clase_id
  -- left join: instructora_id admite null, y una clase sin instructora asignada
  -- igual tiene que aparecer en la grilla.
  left join public.instructoras i on i.id = c.instructora_id
  where c.fecha = p_fecha
  order by c.hora;
$$;
