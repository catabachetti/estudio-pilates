-- Dos funciones para el panel de créditos, que el webhook de Mercado Pago va a
-- reutilizar tal cual.
--
-- POR QUÉ FUNCIONES Y NO LA CLAVE SECRETA: `creditos` no tiene política de
-- INSERT y la de `compras` exige `user_id = auth.uid()`, o sea que administración
-- no puede acreditarle un paquete a otra persona con la clave publishable. La
-- clave secreta saltea RLS por completo; estas hacen una cosa sola y se pueden
-- auditar. Es el mismo patrón que es_admin() y lugares_disponibles().

begin;

-- Buscar a alguien por su correo. Los correos viven en auth.users, que no es
-- legible con la clave pública, y `perfiles` no tiene columna de mail.
create function public.buscar_persona(p_email text)
returns table (id uuid, nombre text)
language plpgsql
security definer set search_path = ''
stable
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo administración puede buscar personas por correo';
  end if;

  return query
    select u.id, p.nombre
    from auth.users u
    join public.perfiles p on p.id = u.id
    where lower(u.email) = lower(trim(p_email));
end;
$$;

-- Acredita un paquete: crea la compra aprobada y sus créditos, todo o nada.
--
-- IDEMPOTENCIA. Mercado Pago reintenta los avisos cuando no recibe respuesta a
-- tiempo, así que esta función se va a llamar más de una vez para el mismo pago.
-- Lo que lo impide es el `unique` de compras.mp_payment_id, que ya existe desde
-- la 001: el `on conflict do nothing` no devuelve fila en el reintento y la
-- función sale sin acreditar nada. Es la base la que decide, no el código que
-- llama, así que no hay forma de olvidarse de chequear.
--
-- Con p_mp_payment_id en null —la carga manual del panel— no hay conflicto
-- posible, porque en Postgres dos nulos no chocan en un índice único. Es lo
-- correcto: dos cargas manuales son dos paquetes.
create function public.otorgar_creditos(
  p_user_id        uuid,
  p_paquete_id     uuid,
  p_mp_payment_id  text default null
)
returns table (compra_id uuid, creditos_creados integer, ya_estaba boolean)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_precio  integer;
  v_clases  integer;
  v_dias    integer;
  v_vence   date;
  v_compra  uuid;
begin
  -- El webhook corre sin sesión, con la clave de servicio: no es admin y no
  -- tiene que serlo. Las dos puertas quedan abiertas y ninguna otra.
  if not (public.es_admin() or current_user = 'service_role') then
    raise exception 'Solo administración puede otorgar créditos';
  end if;

  select precio, clases, dias_vigencia
    into v_precio, v_clases, v_dias
    from public.paquetes where id = p_paquete_id;

  if not found then
    raise exception 'No existe el paquete %', p_paquete_id;
  end if;

  -- La fecha del estudio, no la del servidor. En UTC, a las 22 de Buenos Aires
  -- ya es mañana, y el crédito vencería un día antes de lo que corresponde.
  v_vence := (now() at time zone 'America/Argentina/Buenos_Aires')::date + v_dias;

  insert into public.compras (user_id, paquete_id, monto, estado, mp_payment_id)
  values (p_user_id, p_paquete_id, v_precio, 'aprobada', p_mp_payment_id)
  on conflict (mp_payment_id) do nothing
  returning id into v_compra;

  if v_compra is null then
    -- Reintento de un pago ya acreditado. Se devuelve la compra que ya existía
    -- para que quien llama pueda responderle 200 a Mercado Pago y que deje de
    -- reintentar.
    select id into v_compra
      from public.compras where mp_payment_id = p_mp_payment_id;
    return query select v_compra, 0, true;
    return;
  end if;

  -- Un crédito por clase, cada uno una fila: reservas.credito_id es unique, o
  -- sea que una reserva consume exactamente uno.
  insert into public.creditos (user_id, compra_id, vence_el)
  select p_user_id, v_compra, v_vence
  from generate_series(1, v_clases);

  return query select v_compra, v_clases, false;
end;
$$;

-- Que ni siquiera se puedan invocar sin sesión. El guardia de adentro ya
-- alcanza; esto evita que alguien anónimo las use para tantear.
revoke execute on function public.buscar_persona(text) from public, anon;
revoke execute on function public.otorgar_creditos(uuid, uuid, text) from public, anon;
grant execute on function public.buscar_persona(text) to authenticated, service_role;
grant execute on function public.otorgar_creditos(uuid, uuid, text) to authenticated, service_role;

commit;
