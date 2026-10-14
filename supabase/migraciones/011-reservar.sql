-- La reserva real: una sola función que verifica y escribe, o no hace nada.
--
-- POR QUÉ UNA FUNCIÓN Y NO CÓDIGO QUE CONSULTA Y DESPUÉS INSERTA: dos personas
-- pidiendo el último lugar al mismo tiempo leen las dos "queda 1", las dos
-- escriben, y la clase termina con siete personas y seis reformers. Contar
-- antes de insertar no alcanza nunca: entre contar e insertar pasa tiempo.

begin;

-- ---------------------------------------------------------------------------
-- 1. La ventana de cancelación, del lado del servidor
-- ---------------------------------------------------------------------------
-- No puede viajar como parámetro de la función: quien la llame elegiría 9999 y
-- recuperaría siempre el crédito. Y no puede estar escrita a mano acá y en
-- app/datos/sitio.js a la vez, porque tarde o temprano alguien cambia una sola.
-- Queda acá, que es donde se aplica, y el sitio la lee de acá para mostrarla.
--
-- Como tabla y no como constante dentro de la función para que el panel la
-- pueda editar más adelante sin una migración ni un deploy.
create table ajustes (
  clave       text primary key,
  valor       integer not null,
  descripcion text
);

alter table ajustes enable row level security;

-- Lectura pública: el texto de las condiciones lo muestran páginas que se ven
-- sin sesión.
create policy "ajustes visibles" on ajustes for select using (true);
create policy "admin edita" on ajustes for all
  using (public.es_admin()) with check (public.es_admin());

insert into ajustes (clave, valor, descripcion) values
  ('horas_cancelacion', 6,
   'Horas antes de la clase hasta las que se puede cancelar sin perder el crédito');

-- ---------------------------------------------------------------------------
-- 2. Se cierra la puerta lateral
-- ---------------------------------------------------------------------------
-- El candado de más abajo solo sirve si no hay otro camino para escribir una
-- reserva. Mientras exista una política de INSERT, cualquiera con sesión le
-- pega al REST de Supabase y se crea una reserva sin cupo, sin crédito y sin
-- pasar por la función.
--
-- Desde acá `reservas` queda como `creditos`: cada quien lee las suyas, y
-- escribir solo se puede desde las funciones de este archivo.
drop policy "crea su reserva" on reservas;
drop policy "cancela su reserva" on reservas;

-- ---------------------------------------------------------------------------
-- 3. Reservar
-- ---------------------------------------------------------------------------
create function public.reservar_clase(p_clase_id uuid)
returns table (resultado text, reserva_id uuid)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_ahora    timestamptz := now();
  v_hoy      date;
  v_cupo     integer;
  v_inicio   timestamptz;
  v_tomados  integer;
  v_credito  uuid;
  v_reserva  uuid;
  v_estado   text;
begin
  if v_uid is null then
    raise exception 'Hay que iniciar sesión para reservar';
  end if;

  v_hoy := (v_ahora at time zone 'America/Argentina/Buenos_Aires')::date;

  -- EL CANDADO. Bloquea la fila de esta clase hasta que termine la
  -- transacción. Dos personas que piden el mismo último lugar entran de a una:
  -- la segunda espera acá, y cuando pasa ya ve la reserva de la primera al
  -- contar. Bloquea por clase, así que reservar en clases distintas no se
  -- estorba.
  select c.cupo_total,
         (c.fecha + c.hora) at time zone 'America/Argentina/Buenos_Aires'
    into v_cupo, v_inicio
  from public.clases c
  where c.id = p_clase_id and c.estado = 'programada'
  for update;

  if v_cupo is null then
    return query select 'no_disponible'::text, null::uuid;
    return;
  end if;

  if v_inicio <= v_ahora then
    return query select 'ya_paso'::text, null::uuid;
    return;
  end if;

  select r.id, r.estado into v_reserva, v_estado
  from public.reservas r
  where r.user_id = v_uid and r.clase_id = p_clase_id;

  if v_estado = 'confirmada' then
    return query select 'ya_reservada'::text, v_reserva;
    return;
  end if;

  select count(*) into v_tomados
  from public.reservas r
  where r.clase_id = p_clase_id and r.estado = 'confirmada';

  if v_tomados >= v_cupo then
    return query select 'completa'::text, null::uuid;
    return;
  end if;

  -- EL CRÉDITO QUE VENCE PRIMERO, que es la regla escrita en las condiciones
  -- del sitio. Tres cosas pasan en esta sola consulta:
  --
  --   vence_el >= hoy      no sirve un crédito vencido
  --   not exists (...)     está libre si NINGUNA reserva lo referencia, sin
  --                        mirar el estado: una cancelación tardía lo deja
  --                        enganchado, y por eso se pierde
  --   skip locked          si otra transacción ya tomó este crédito —dos
  --                        pestañas de la misma persona reservando a la vez—
  --                        se pasa al siguiente en vez de chocar contra el
  --                        unique de reservas.credito_id
  --
  -- El unique sigue ahí de red: skip locked evita la colisión, la restricción
  -- la haría imposible si algo se escapara.
  select c.id into v_credito
  from public.creditos c
  where c.user_id = v_uid
    and c.vence_el >= v_hoy
    and not exists (select 1 from public.reservas r where r.credito_id = c.id)
  order by c.vence_el, c.created_at
  limit 1
  for update skip locked;

  if v_credito is null then
    -- No es un error, es un estado normal: la persona necesita comprar un
    -- paquete. Por eso vuelve como resultado y no como excepción, que daría
    -- una pantalla de error del servidor.
    return query select 'sin_creditos'::text, null::uuid;
    return;
  end if;

  if v_reserva is null then
    insert into public.reservas (user_id, clase_id, credito_id, estado)
    values (v_uid, p_clase_id, v_credito, 'confirmada')
    returning id into v_reserva;
  else
    -- Había una reserva cancelada para esta misma clase. Se reactiva en vez de
    -- insertar, porque unique (user_id, clase_id) no deja tener dos filas. Sin
    -- esto, quien cancela una vez no podría volver a anotarse nunca.
    update public.reservas
       set estado = 'confirmada', credito_id = v_credito
     where id = v_reserva;
  end if;

  return query select 'ok'::text, v_reserva;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Cancelar
-- ---------------------------------------------------------------------------
create function public.cancelar_reserva(p_reserva_id uuid)
returns table (resultado text, credito_devuelto boolean)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_ahora    timestamptz := now();
  v_horas    integer;
  v_inicio   timestamptz;
  v_estado   text;
  v_devuelve boolean;
begin
  if v_uid is null then
    raise exception 'Hay que iniciar sesión';
  end if;

  select valor into v_horas from public.ajustes where clave = 'horas_cancelacion';

  if v_horas is null then
    -- Falta la configuración. Mejor cortar ruidosamente que elegir un número
    -- por las nuestras y cobrarle un crédito a alguien por una regla inventada.
    raise exception 'Falta el ajuste horas_cancelacion';
  end if;

  -- El `and r.user_id = v_uid` no es cosmético: sin él, con el id de una
  -- reserva ajena cualquiera cancelaría la reserva de otra persona.
  select r.estado,
         (c.fecha + c.hora) at time zone 'America/Argentina/Buenos_Aires'
    into v_estado, v_inicio
  from public.reservas r
  join public.clases c on c.id = r.clase_id
  where r.id = p_reserva_id and r.user_id = v_uid
  for update of r;

  if v_estado is null then
    return query select 'no_existe'::text, false;
    return;
  end if;

  if v_estado = 'cancelada' then
    return query select 'ya_cancelada'::text, false;
    return;
  end if;

  v_devuelve := v_inicio - v_ahora > make_interval(hours => v_horas);

  -- Soltar el crédito es lo que lo devuelve al bolsillo: queda sin ninguna
  -- reserva apuntándolo, y la próxima búsqueda lo encuentra libre.
  update public.reservas
     set estado = 'cancelada',
         credito_id = case when v_devuelve then null else credito_id end
   where id = p_reserva_id;

  return query select 'ok'::text, v_devuelve;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Cuando el estudio cancela una clase
-- ---------------------------------------------------------------------------
-- Las reservas de esa clase pasan a canceladas y sueltan su crédito SIEMPRE,
-- sin mirar la ventana. La ventana existe para que alguien no bloquee un lugar
-- y se arrepienta a último momento; acá no se arrepintió nadie, canceló el
-- estudio, y cobrarle el crédito a quien tenía lugar sería cobrarle un error
-- ajeno.
--
-- VA EN UN DISPARADOR Y NO EN EL PANEL, por dos razones. Desde la sección 2 de
-- este archivo `reservas` no tiene política de UPDATE, así que el panel ya no
-- puede tocarlas aunque quiera. Y la regla vale venga de donde venga el
-- cambio de estado: del panel, del editor SQL o de lo que exista mañana.
--
-- QUÉ PASA AL REACTIVAR: nada. Las reservas no vuelven y quien tenía lugar se
-- anota de nuevo. Restaurarlas sería peor: a esas personas ya se les devolvió
-- el crédito y pueden haberlo usado en otra clase, así que la reserva
-- restaurada quedaría sin crédito asociado o le sacaría uno que ya está en uso.
create function public.liberar_reservas_de_clase_cancelada()
returns trigger
language plpgsql
-- security definer porque RLS se aplicaría al rol que hizo el update de la
-- clase, y `reservas` ya no tiene política de UPDATE: sin esto el disparador
-- afectaría cero filas en silencio, que es la peor forma de fallar.
security definer set search_path = ''
as $$
begin
  update public.reservas
     set estado = 'cancelada',
         credito_id = null
   where clase_id = new.id
     and estado = 'confirmada';

  return new;
end;
$$;

create trigger clase_cancelada_libera_reservas
  after update of estado on clases
  for each row
  when (old.estado is distinct from new.estado and new.estado = 'cancelada')
  execute function public.liberar_reservas_de_clase_cancelada();

-- ---------------------------------------------------------------------------
-- 6. Quién puede llamarlas
-- ---------------------------------------------------------------------------
-- El guardia de adentro ya alcanza; esto evita que alguien sin sesión las use
-- para tantear.
revoke execute on function public.reservar_clase(uuid)   from public, anon;
revoke execute on function public.cancelar_reserva(uuid) from public, anon;
grant  execute on function public.reservar_clase(uuid)   to authenticated;
grant  execute on function public.cancelar_reserva(uuid) to authenticated;

commit;
