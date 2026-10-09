-- Las nueve tablas del sistema y el trigger que crea el perfil al registrarse.

create table tipos_clase (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  nombre            text not null,
  descripcion_corta text not null,
  descripcion_larga text,
  nivel             text,
  requisito         text,
  duracion_min      integer not null default 50,
  imagen            text,
  orden             integer not null default 0
);

create table instructoras (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  bio    text,
  imagen text,
  activa boolean not null default true
);

create table paquetes (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  clases        integer not null check (clases > 0),
  precio        integer not null check (precio > 0),
  dias_vigencia integer not null check (dias_vigencia > 0),
  orden         integer not null default 0,
  activo        boolean not null default true
);

create table clases (
  id             uuid primary key default gen_random_uuid(),
  tipo_clase_id  uuid not null references tipos_clase(id),
  instructora_id uuid references instructoras(id),
  fecha          date not null,
  hora           time not null,
  cupo_total     integer not null default 6 check (cupo_total > 0),
  created_at     timestamptz not null default now(),
  unique (fecha, hora)
);

create table perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text,
  telefono   text,
  rol        text not null default 'cliente' check (rol in ('cliente','admin')),
  created_at timestamptz not null default now()
);

create table compras (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  paquete_id    uuid not null references paquetes(id),
  monto         integer not null,
  estado        text not null default 'pendiente'
                  check (estado in ('pendiente','aprobada','rechazada')),
  mp_payment_id text unique,
  created_at    timestamptz not null default now()
);

create table creditos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  compra_id  uuid not null references compras(id) on delete cascade,
  vence_el   date not null,
  created_at timestamptz not null default now()
);

create table reservas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  clase_id   uuid not null references clases(id) on delete cascade,
  credito_id uuid unique references creditos(id),
  estado     text not null default 'confirmada'
               check (estado in ('confirmada','cancelada')),
  created_at timestamptz not null default now(),
  unique (user_id, clase_id)
);

create table lista_espera (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  clase_id   uuid not null references clases(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, clase_id)
);

-- Cada usuario nuevo de auth.users obtiene su fila en perfiles.
create function public.crear_perfil()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, new.raw_user_meta_data->>'nombre');
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();
