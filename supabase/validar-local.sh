#!/bin/zsh
# Valida las migraciones y el seed contra un Postgres descartable, sin tocar
# Supabase. Levanta un cluster propio en el puerto 55433, corre todo, comprueba
# que las nueve tablas queden con RLS activa y con politicas, y despues borra el
# cluster. Uso: zsh supabase/validar-local.sh
set -e
export PATH=/Library/PostgreSQL/18/bin:$PATH
S=/private/tmp/claude-501/-Users-catalina-Documents-estudio-pilates/5bc70947-0430-4b45-8d56-6bb52f730354/scratchpad
P=/Users/catalina/Documents/estudio-pilates/supabase

rm -rf "$S/pgv"
initdb -D "$S/pgv" -U prueba --auth=trust -E UTF8 --locale=C > /dev/null
pg_ctl -D "$S/pgv" -o "-p 55433 -k /tmp -c listen_addresses=127.0.0.1" -l "$S/pgv.log" start > /dev/null
sleep 2
limpiar() { pg_ctl -D "$S/pgv" stop -m fast > /dev/null 2>&1 || true; rm -rf "$S/pgv" "$S/pgv.log"; }
trap limpiar EXIT

q() { psql -h 127.0.0.1 -p 55433 -U prueba -d validacion -v ON_ERROR_STOP=1 "$@"; }
psql -h 127.0.0.1 -p 55433 -U prueba -d postgres -q -c "create database validacion;"

echo "=== migraciones, en orden numerico ==="
q -q -f "$P/auth-de-mentira.sql"
for archivo in "$P"/migraciones/*.sql; do
  q -q -f "$archivo" && echo "  $(basename $archivo)  ok"
done

echo
echo "=== seed: primera pasada ==="
q -q -f "$P/seed.sql" && echo "  sin errores"
q -c "select 'instructoras' as tabla, count(*) from instructoras union all select 'tipos_clase', count(*) from tipos_clase union all select 'paquetes', count(*) from paquetes union all select 'clases', count(*) from clases order by 1;"

echo "=== un usuario y una reserva, entre pasada y pasada ==="
q -q -c "insert into auth.users (email, raw_user_meta_data) values ('alguien@ejemplo.com', '{\"nombre\":\"Alguien\"}'::jsonb);"
q -q -c "insert into reservas (user_id, clase_id) select (select id from auth.users limit 1), (select id from clases order by fecha, hora limit 1);"
echo "  reservas=$(q -tAc 'select count(*) from reservas;')  perfiles=$(q -tAc 'select count(*) from perfiles;')"

echo
echo "=== seed: segunda pasada ==="
q -q -f "$P/seed.sql" && echo "  sin errores"
q -c "select 'instructoras' as tabla, count(*) from instructoras union all select 'tipos_clase', count(*) from tipos_clase union all select 'paquetes', count(*) from paquetes union all select 'clases', count(*) from clases order by 1;"
echo "  reservas que quedan: $(q -tAc 'select count(*) from reservas;')"

echo
echo "=== control de seguridad ==="
q -c "select relname as tabla, relrowsecurity as rls, (select count(*) from pg_policies p where p.tablename = c.relname) as politicas
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname='public' and c.relkind='r' order by 1;"

# Falla ruidosamente si alguna tabla queda sin RLS o sin politicas.
q -v ON_ERROR_STOP=1 -q <<'SQL'
do $$
declare
  sin_rls text;
  sin_politicas text;
  cuantas integer;
begin
  select string_agg(c.relname, ', ' order by c.relname) into sin_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  select string_agg(c.relname, ', ' order by c.relname) into sin_politicas
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and not exists (select 1 from pg_policies p where p.tablename = c.relname);

  select count(*) into cuantas
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';

  if cuantas <> 9 then
    raise exception 'FALLA: se esperaban 9 tablas y hay %', cuantas;
  end if;
  if sin_rls is not null then
    raise exception 'FALLA: estas tablas quedaron sin RLS: %', sin_rls;
  end if;
  if sin_politicas is not null then
    raise exception 'FALLA: estas tablas no tienen ninguna politica: %', sin_politicas;
  end if;

  raise notice 'OK: las 9 tablas tienen RLS activa y al menos una politica';
end $$;
SQL

echo
echo "  validacion terminada sin fallas"
