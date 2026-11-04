-- Mensajes del formulario de contacto.
--
-- POR QUÉ UNA TABLA Y NO UN CORREO: mandar un mail necesita un proveedor y una
-- clave nueva, o sea una dependencia externa más en el camino crítico de un
-- formulario. Una tabla ya está, se lee desde /admin/mensajes y no se cae
-- cuando el proveedor de correo tiene un mal día. El aviso por mail es una
-- mejora posible encima de esto, no un reemplazo.

begin;

create table mensajes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text        not null,
  email      text        not null,
  mensaje    text        not null,
  -- Si había sesión abierta queda registrado quién escribió. Nulo cuando
  -- escribe alguien que no tiene cuenta, que es el caso normal del formulario
  -- de contacto. `on delete set null` y no `cascade`: si la persona borra su
  -- cuenta, el mensaje queda pero deja de estar asociado.
  user_id    uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table mensajes enable row level security;

-- SELECT solo para administración. Un mensaje de contacto trae un nombre y un
-- correo de alguien que puede no tener cuenta: que la tabla fuera legible la
-- convertiría en una lista de direcciones.
create policy "administracion ve los mensajes" on mensajes for select
  using (public.es_admin());

-- SIN POLÍTICA DE INSERT, a propósito, igual que `reservas`, `creditos` e
-- `intentos_ingreso`. El motivo es el de siempre pero acá importa el doble:
-- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` viaja al navegador y cualquiera la
-- lee, así que una política de INSERT para anónimos sería una invitación a
-- llenar la tabla con un `curl` en un bucle, sin pasar por el formulario. Y RLS
-- no sabe limitar por frecuencia: una política dice sí o no, no dice
-- "cinco por hora".
--
-- Por eso la única puerta es enviar_mensaje(), que tiene el límite adentro.

-- El índice que usa el límite de abajo. Sin esto, cada envío haría un recorrido
-- completo de la tabla.
create index mensajes_email_fecha on mensajes (email, created_at desc);

-- Un envío, con su límite en la misma sentencia.
--
-- EL LÍMITE VA ADENTRO DE LA FUNCIÓN Y NO EN LA APLICACIÓN, por lo mismo que la
-- reserva: contar desde el servidor y escribir después son dos viajes, y entre
-- los dos entra otro envío. Acá la ventana es de una hora y el daño de pasarse
-- por uno es nulo, así que es menos grave que en el cupo de una clase — pero el
-- costo de hacerlo bien es cero y así no hay dos reglas distintas según quién
-- escriba.
--
-- LA CLAVE DEL LÍMITE ES EL CORREO, NO LA IP, y es una decisión con un canje.
-- Limitar por IP frena mejor a un bot, pero exige GUARDAR la IP de cada
-- persona que escribe. Este proyecto ya rechazó guardar datos sensibles de más
-- cuando descartó el historial de contraseñas, y el mismo criterio aplica: el
-- correo ya está en la fila, la IP sería un dato nuevo sobre gente que ni
-- siquiera tiene cuenta.
--
-- LO QUE ESTE LÍMITE NO HACE, y está escrito para que nadie lo suponga: no
-- frena a quien varíe el correo en cada envío. Frena el doble clic, el reenvío
-- por nerviosismo y el bot perezoso. Lo único que cerraría esa puerta de verdad
-- es un CAPTCHA, que el proyecto descartó a propósito (ver docs/seguridad.md).
-- Está acá para que el formulario no sea un megáfono, no para resistir un
-- ataque dedicado.
--
-- Y hay un efecto secundario que conviene conocer: alguien podría gastar los
-- cinco envíos de una hora usando el correo de otra persona, y esa persona
-- tendría que esperar. El daño es chico —el WhatsApp sigue ahí, en la misma
-- página— y la alternativa era guardar la IP. Es el mismo razonamiento de la
-- migración 012 llegando a la conclusión contraria, porque ahí lo que está en
-- juego es el acceso a una cuenta y acá es un mensaje.
create function public.enviar_mensaje(
  p_nombre  text,
  p_email   text,
  p_mensaje text
)
returns table (resultado text)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_nombre  text := trim(p_nombre);
  v_email   text := lower(trim(p_email));
  v_mensaje text := trim(p_mensaje);
  v_recientes integer;
begin
  -- Se valida de nuevo acá aunque el esquema de Zod ya validó en las dos
  -- puertas de la aplicación. No es desconfianza del esquema: esta función es
  -- alcanzable por RPC con la clave publishable, así que es la capa que no se
  -- puede saltear. Es la misma estructura de tres capas que las contraseñas.
  if length(v_nombre) < 2 or length(v_nombre) > 80 then
    return query select 'nombre_invalido'::text;
    return;
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then
    return query select 'email_invalido'::text;
    return;
  end if;

  if length(v_mensaje) < 10 or length(v_mensaje) > 1000 then
    return query select 'mensaje_invalido'::text;
    return;
  end if;

  select count(*) into v_recientes
  from public.mensajes
  where public.mensajes.email = v_email
    and public.mensajes.created_at > now() - interval '1 hour';

  if v_recientes >= 5 then
    return query select 'demasiados'::text;
    return;
  end if;

  insert into public.mensajes (nombre, email, mensaje, user_id)
  values (v_nombre, v_email, v_mensaje, auth.uid());

  return query select 'ok'::text;
end;
$$;

-- `anon` también, porque el formulario de contacto es para quien no tiene
-- cuenta: ese es su caso principal.
grant execute on function public.enviar_mensaje(text, text, text) to anon, authenticated;

commit;
