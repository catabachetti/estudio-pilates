#!/bin/zsh
# Valida las migraciones y el seed contra un Postgres descartable, sin tocar
# Supabase. Levanta un cluster propio en el puerto 55433, corre todo, comprueba
# que las nueve tablas queden con RLS activa y con politicas, y despues borra el
# cluster. Uso: zsh supabase/validar-local.sh
set -e
export PATH=/Library/PostgreSQL/18/bin:$PATH
S="$(mktemp -d)"
P="$(cd "$(dirname "$0")" && pwd)"

rm -rf "$S/pgv"
initdb -D "$S/pgv" -U prueba --auth=trust -E UTF8 --locale=C > /dev/null
pg_ctl -D "$S/pgv" -o "-p 55433 -k /tmp -c listen_addresses=127.0.0.1" -l "$S/pgv.log" start > /dev/null
sleep 2
limpiar() { pg_ctl -D "$S/pgv" stop -m fast > /dev/null 2>&1 || true; rm -rf "$S"; }
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
echo "=== el seed refresca el catalogo? (prueba de upsert) ==="
q -q -c "update tipos_clase set nombre = 'TEXTO PISADO', que_llevar = null where slug = 'flow';"
echo "  antes del seed:  $(q -tAc "select nombre from tipos_clase where slug='flow';")  que_llevar=$(q -tAc "select coalesce(array_length(que_llevar,1),0) from tipos_clase where slug='flow';") items"
q -q -f "$P/seed.sql"
echo "  despues del seed: $(q -tAc "select nombre from tipos_clase where slug='flow';")  que_llevar=$(q -tAc "select coalesce(array_length(que_llevar,1),0) from tipos_clase where slug='flow';") items"
echo "  columnas nuevas llenas: imagen_alt=$(q -tAc "select count(*) from tipos_clase where imagen_alt is not null;")/3  incluye=$(q -tAc "select count(*) from paquetes where incluye is not null;")/4"

echo
echo "=== control de seguridad ==="
q -c "select relname as tabla, relrowsecurity as rls, (select count(*) from pg_policies p where p.tablename = c.relname) as politicas
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname='public' and c.relkind='r' order by 1;"

# Falla ruidosamente si alguna tabla queda sin RLS o sin politicas.
# Ojo con `reservas` y `creditos`: tienen UNA sola politica, de lectura, y esta
# bien asi. Se escriben solo desde las funciones security definer, que es lo que
# garantiza que nadie cree una reserva salteandose el cupo y el credito.
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

  -- Este numero se actualiza a mano a proposito: si una migracion agrega una
  -- tabla, la validacion falla hasta que alguien mire si esa tabla necesita RLS
  -- y politicas. Es un despertador, no una molestia.
  if cuantas <> 10 then
    raise exception 'FALLA: se esperaban 10 tablas y hay %. Si agregaste una, revisa que tenga RLS y politicas y actualiza este numero.', cuantas;
  end if;
  if sin_rls is not null then
    raise exception 'FALLA: estas tablas quedaron sin RLS: %', sin_rls;
  end if;
  if sin_politicas is not null then
    raise exception 'FALLA: estas tablas no tienen ninguna politica: %', sin_politicas;
  end if;

  raise notice 'OK: las 10 tablas tienen RLS activa y al menos una politica';
end $$;
SQL

echo
echo "  validacion terminada sin fallas"
