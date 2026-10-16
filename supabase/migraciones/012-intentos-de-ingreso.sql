-- Bloqueo progresivo tras varios intentos fallidos de ingreso.
--
-- POR QUÉ HACE FALTA: Supabase trae un límite de caudal por IP, medido el 16 de
-- octubre de 2026 contra este proyecto: corta en el intento 35 y suelta a los
-- 10 segundos. Eso es anti-inundación, no es lo que pide el módulo 10. No
-- frena una fuerza bruta paciente —a tres intentos por segundo nunca se
-- activa— y encima es por IP compartida: con una cuenta bloqueada, otra cuenta
-- distinta con su contraseña correcta también recibió 429.
--
-- LA CLAVE ES (correo, ip) Y NO EL CORREO SOLO. Un bloqueo por cuenta es, por
-- definición, una forma de dejar a alguien afuera: quien sepa un correo falla
-- cinco veces a propósito y bloquea a esa persona. Y como estas funciones
-- tienen que poder llamarse sin sesión —quien ingresa todavía no la tiene—
-- cualquiera podría invocarlas directo sin intentar entrar siquiera.
-- Con la IP en la clave, quien ataca se bloquea a sí mismo.
--
-- LO QUE ESTE CONTROL NO HACE, y está escrito para que nadie lo suponga: vive
-- en nuestra aplicación. El endpoint /auth/v1/token de Supabase es público y
-- alcanzable con la clave publishable, así que quien quiera saltear el
-- formulario lo saltea. Esto protege el formulario, no el endpoint. Lo único
-- que cerraría esa puerta es el CAPTCHA, que Supabase aplica del lado suyo y
-- que se descartó a propósito (ver docs/seguridad.md).

begin;

create table intentos_ingreso (
  email           text        not null,
  ip              text        not null,
  fallos          integer     not null default 0,
  ultimo_fallo    timestamptz not null default now(),
  bloqueado_hasta timestamptz,
  primary key (email, ip)
);

alter table intentos_ingreso enable row level security;

-- SIN NINGUNA POLÍTICA, a propósito. Con RLS activa y cero políticas la tabla
-- es invisible y no se puede escribir desde fuera: solo entran las funciones
-- de abajo, que son security definer. Es la forma más cerrada que hay.
--
-- Importa que sea así: la tabla guarda correos con los que alguien intentó
-- entrar, incluidos los que no existen. Si fuera legible sería, ella misma, una
-- lista de direcciones y un modo de averiguar quién usa el sitio.

-- Escalera de espera. Los primeros cuatro fallos no cuestan nada, porque
-- equivocarse cuatro veces es algo que pasa. Del quinto en adelante la espera
-- se duplica, con techo de cinco minutos: suficiente para que una fuerza bruta
-- deje de ser práctica, poco para que alguien que se equivocó tire el teléfono.
--
-- EL TECHO VA EN EL EXPONENTE Y NO EN EL RESULTADO. La primera versión decía
--
--     least(30 * (2 ^ (p_fallos - 5))::integer, 300)
--
-- y eso se rompe: el `least` acota el resultado, pero la potencia se calcula
-- antes. Medido contra Postgres 18, a partir de **32 fallos** la función corta
-- con "integer out of range" en vez de devolver 300. No es el casteo el que
-- desborda sino la multiplicación: con 32 fallos, 30 * 2^27 da 4.026.531.840 y
-- el máximo de un integer es 2.147.483.647.
--
-- Y 32 fallos no es un número raro: es exactamente lo que acumula quien está
-- probando contraseñas, que es el caso para el que existe esta tabla. La
-- función habría fallado justo cuando hacía falta, y el error habría llegado a
-- registrar_fallo(), que es lo que impone el bloqueo.
--
-- Acotando el exponente en 4 la curva es idéntica —30, 60, 120, 240, 300— y no
-- hay número de fallos que la rompa.
create function public.espera_por_fallos(p_fallos integer)
returns integer
language sql
immutable
as $$
  select case
    when p_fallos < 5 then 0
    else least(30 * (2 ^ least(p_fallos - 5, 4))::integer, 300)
  end;
$$;

-- ¿Puede intentar? Devuelve cuántos segundos faltan, o cero.
--
-- No mira si la cuenta existe y no tiene forma de saberlo: consulta una tabla
-- que no sabe nada de cuentas. Un correo inexistente y uno real se comportan
-- exactamente igual, que es lo que hay que conservar para no convertir esto en
-- una forma de averiguar quién está registrado.
create function public.puede_intentar(p_email text, p_ip text)
returns integer
language sql
security definer set search_path = ''
stable
as $$
  select greatest(
    coalesce(
      (select extract(epoch from (i.bloqueado_hasta - now()))::integer
       from public.intentos_ingreso i
       where i.email = lower(trim(p_email)) and i.ip = p_ip
         and i.bloqueado_hasta > now()),
      0),
    0);
$$;

-- Registra un fallo y devuelve cuántos segundos hay que esperar ahora.
create function public.registrar_fallo(p_email text, p_ip text)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v_email  text := lower(trim(p_email));
  v_fallos integer;
  v_espera integer;
begin
  insert into public.intentos_ingreso (email, ip, fallos, ultimo_fallo)
  values (v_email, p_ip, 1, now())
  on conflict (email, ip) do update set
    -- Si el último fallo fue hace rato, la cuenta vuelve a empezar: alguien que
    -- se equivoca dos veces hoy y dos el mes que viene no tiene por qué
    -- arrastrar nada.
    fallos = case
      when public.intentos_ingreso.ultimo_fallo < now() - interval '15 minutes'
      then 1
      else public.intentos_ingreso.fallos + 1
    end,
    ultimo_fallo = now()
  returning fallos into v_fallos;

  v_espera := public.espera_por_fallos(v_fallos);

  if v_espera > 0 then
    update public.intentos_ingreso
       set bloqueado_hasta = now() + make_interval(secs => v_espera)
     where email = v_email and ip = p_ip;
  end if;

  return v_espera;
end;
$$;

-- Al entrar bien, se borra el registro: nadie arrastra sus errores.
create function public.limpiar_intentos(p_email text, p_ip text)
returns void
language sql
security definer set search_path = ''
as $$
  delete from public.intentos_ingreso
  where email = lower(trim(p_email)) and ip = p_ip;
$$;

-- `anon` tiene que poder llamarlas: quien está ingresando todavía no tiene
-- sesión. Es seguro porque la clave incluye la IP, así que lo peor que puede
-- hacer quien las invoque directo es bloquearse a sí mismo.
grant execute on function public.puede_intentar(text, text)   to anon, authenticated;
grant execute on function public.registrar_fallo(text, text)  to anon, authenticated;
grant execute on function public.limpiar_intentos(text, text) to anon, authenticated;

commit;
