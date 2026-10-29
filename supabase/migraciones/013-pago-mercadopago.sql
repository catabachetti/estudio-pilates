-- Lo que falta para que un pago de Mercado Pago acredite créditos solo.
--
-- Dos cosas, y la primera es un arreglo que bloqueaba todo lo demás:
--
--   1. El guardia de rol de otorgar_creditos() rechazaba al webhook.
--   2. La tabla intenciones_de_pago, que es lo que viaja en la
--      `external_reference` de la preferencia.
--
-- POR QUÉ HACE FALTA UNA TABLA Y NO ALCANZA CON LA external_reference SOLA.
-- Cuando se crea la preferencia, el pago todavía no existe: no hay
-- mp_payment_id. Y cuando llega el aviso de pago, el webhook tiene el pago
-- pero no sabe a quién ni qué paquete acreditar. La `external_reference` es
-- el único dato que elegimos nosotros ANTES y que Mercado Pago nos devuelve
-- DESPUÉS, así que es el puente, pero tiene que apuntar a algo.
--
--   external_reference   -> lo elegimos nosotros, existe antes de pagar,
--                           contesta "quién estaba comprando qué"
--   compras.mp_payment_id -> lo elige Mercado Pago, existe después de pagar,
--                           es el `unique` que da la idempotencia
--
-- No son lo mismo y no pueden serlo.
--
-- POR QUÉ NO SE USA LA FILA 'pendiente' DE compras, que es lo que uno
-- esperaría viendo que compras.estado ya admite 'pendiente': porque
-- otorgar_creditos() INSERTA una compra, no actualiza una pendiente. Usarla
-- obligaría a escribir otra función y a volver a probar desde cero la
-- idempotencia y la concurrencia, que ya están probadas. La tabla nueva deja
-- esa función intacta.

-- ---------------------------------------------------------------------------
-- 1. El guardia de rol que no funcionaba
-- ---------------------------------------------------------------------------
-- La explicación completa está en el comentario de adentro de la función,
-- donde la va a leer quien la edite.
create or replace function public.otorgar_creditos(
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
  --
  -- NO SE USA current_user, Y ESTE ES EL MOTIVO. Dentro de una función
  -- `security definer`, current_user es EL DUEÑO DE LA FUNCIÓN, no quien la
  -- llama. Medido contra Postgres 18, imitando cómo PostgREST atiende un
  -- pedido con la clave secreta (conecta como `authenticator` y hace
  -- `set local role service_role`):
  --
  --                              fuera        dentro de security definer
  --   current_user               service_role  el dueño (postgres)   <- nunca
  --   session_user               authenticator authenticator         <- nunca
  --   current_setting('role')    service_role  service_role          <- sí
  --
  -- Con el guardia anterior la rama del webhook no se cumplía nunca. No se
  -- notó porque las pruebas corrieron con sesión de administración, donde
  -- es_admin() ya devuelve verdadero y el `or` corta antes de llegar acá.
  --
  -- Tampoco se usa request.jwt.claim.role, que también mide bien: las claves
  -- nuevas (sb_secret_...) NO son JWT, son opacas, así que no hay garantía de
  -- que PostgREST publique ese claim. current_setting('role') refleja el
  -- `set local role` que PostgREST aplicó de verdad.
  if not (public.es_admin() or current_setting('role', true) = 'service_role') then
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
-- ---------------------------------------------------------------------------
-- 2. Las intenciones de pago
-- ---------------------------------------------------------------------------
create table intenciones_de_pago (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  paquete_id    uuid not null references paquetes(id),
  -- El id de la preferencia que devolvió Mercado Pago. No se usa para
  -- conciliar —eso lo hace la external_reference— pero es lo que permite
  -- buscar esta compra en el panel de Mercado Pago cuando algo no cierra.
  preference_id text,
  created_at    timestamptz not null default now()
);

-- Para la consulta del webhook, que busca por id, y para poder ver las
-- intenciones de una persona sin recorrer la tabla entera.
create index intenciones_de_pago_user_id_idx
  on intenciones_de_pago (user_id, created_at desc);

alter table intenciones_de_pago enable row level security;

-- Cada persona ve las suyas. La cuenta de administración ve todas, igual que
-- en el resto del esquema.
--
-- OJO CON ESTO, que es la trampa que ya apareció una vez en /cuenta: con
-- `or es_admin()`, para una cuenta de administración esta política devuelve
-- TODO. Cualquier pantalla "mis compras" tiene que filtrar por user_id
-- igual, aunque parezca redundante.
create policy "ve sus intenciones" on intenciones_de_pago for select
  using (user_id = auth.uid() or public.es_admin());

-- Crear la intención es el primer paso de comprar, y lo hace la persona desde
-- su sesión. El `with check` es lo que impide anotar una intención a nombre de
-- otro: sin él, cualquiera con sesión podría crear una intención con el
-- user_id de otra persona y hacer que el crédito del pago caiga en esa cuenta.
create policy "crea su intencion" on intenciones_de_pago for insert
  with check (user_id = auth.uid());

-- NO HAY POLÍTICA DE UPDATE NI DE DELETE, y es a propósito.
--
-- Una intención es el registro de que alguien empezó a pagar. Si se pudiera
-- editar, se podría cambiar el paquete DESPUÉS de pagar y antes de que llegue
-- el aviso: pagar el de 1 clase y acreditarse el de 8. Y si se pudiera
-- borrar, se perdería el único rastro de los checkouts que nadie terminó.
--
-- El webhook solo lee. La escritura la hace otorgar_creditos() sobre compras
-- y creditos, que es donde corresponde.
