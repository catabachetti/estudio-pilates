-- Cancelar una clase cambia su estado. No la borra.
--
-- POR QUÉ NO ES UN DELETE: `reservas.clase_id` referencia a `clases` con
-- ON DELETE CASCADE. Borrar la fila se llevaría en silencio las reservas de las
-- personas que ya tenían lugar, y el estudio perdería el registro de a quién
-- tiene que avisarle. Con un estado, la clase desaparece del sitio público, las
-- reservas quedan en pie y el panel las sigue mostrando.
--
-- EL UNIQUE (fecha, hora) QUEDA COMO ESTÁ, y eso tiene una consecuencia: una
-- clase cancelada sigue ocupando su horario, así que no se puede crear otra
-- distinta ese día a esa hora. Hay que reactivar esa. Es a propósito: esa fila
-- tiene reservas colgando, y dos clases a la misma hora dejaría a esas personas
-- sin saber a cuál van.
--
-- No hace falta política nueva: `clases` ya tiene "admin edita" desde la 003.

begin;

alter table clases
  add column estado text not null default 'programada'
    check (estado in ('programada', 'cancelada'));

-- La función que alimenta /reservar tiene que dejar de ofrecer las canceladas.
-- Va completa y no como un parche sobre la 007, para que este archivo muestre
-- qué quedó corriendo y no haya que leer las dos migraciones juntas.
create or replace function public.disponibilidad_del_dia(p_fecha date)
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
    and c.estado = 'programada'
  order by c.hora;
$$;

commit;
