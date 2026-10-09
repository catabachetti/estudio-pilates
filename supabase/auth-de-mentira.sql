-- Supabase trae estas piezas de fábrica; acá se imitan para poder correr las
-- migraciones tal cual en un Postgres pelado. No forman parte del proyecto.
create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create role anon;
create role authenticated;
create role service_role;
