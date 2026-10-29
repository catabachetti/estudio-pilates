#!/bin/zsh
# Comprueba quién puede acreditar créditos, contra un Postgres descartable.
#
# El caso que importa es el del webhook de Mercado Pago: corre SIN SESIÓN, con
# la clave secreta, o sea con el rol service_role. Hasta la migración 013 el
# guardia de otorgar_creditos() lo rechazaba, y acá se ve rechazado y aceptado.
#
# Uso: zsh supabase/probar-acreditacion.sh
set -e
export PATH=/Library/PostgreSQL/18/bin:$PATH
D="$(mktemp -d)"
P="$(cd "$(dirname "$0")" && pwd)"
PUERTO=$(python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()")

initdb -D "$D/pg" -U prueba --auth=trust -E UTF8 --locale=C > /dev/null
pg_ctl -D "$D/pg" -o "-p $PUERTO -k $D -c listen_addresses=127.0.0.1" -l "$D/pg.log" start > /dev/null
sleep 2
limpiar() { pg_ctl -D "$D/pg" stop -m fast > /dev/null 2>&1 || true; rm -rf "$D"; }
trap limpiar EXIT

q()  { psql -h 127.0.0.1 -p $PUERTO -U prueba -d acred -v ON_ERROR_STOP=1 "$@"; }
qa() { psql -h 127.0.0.1 -p $PUERTO -U authenticator -d acred "$@"; }
psql -h 127.0.0.1 -p $PUERTO -U prueba -d postgres -q -c "create database acred;"
q -q -f "$P/auth-de-mentira.sql"
for a in "$P"/migraciones/*.sql; do q -q -f "$a"; done
q -q -f "$P/seed.sql"

# PostgREST se conecta con un rol de entrada y hace `set local role` segun quien
# llame. Eso es lo que se imita.
q -q -c "create role authenticator login noinherit;
         grant anon, authenticated, service_role to authenticator;
         grant usage on schema public to authenticator;"

# LOS PRIVILEGIOS DE TABLA, que Supabase da de fabrica y este Postgres pelado
# no. Supabase tiene configurado `alter default privileges ... grant all on
# tables to anon, authenticated, service_role`, por eso ninguna migracion del
# proyecto escribe un `grant` y las tablas de la 001 igual se leen con sesion.
# Se otorgan aca y no en auth-de-mentira.sql para no cambiarles el resultado a
# probar-reservas.sh y a validar-local.sh, que miden rechazos de RLS sobre
# tablas a las que hoy nadie tiene privilegio.
#
# Importa que sean privilegios y no politicas: un privilegio faltante da
# "permission denied"; RLS, en cambio, no da error, simplemente no devuelve ni
# afecta filas. Confundir los dos es tomar un error de configuracion por una
# regla de seguridad que funciona.
q -q -c "grant usage on schema public to anon, authenticated, service_role;
         grant all on all tables in schema public to anon, authenticated, service_role;
         grant all on all sequences in schema public to anon, authenticated, service_role;"

# Dos cuentas: una de administración y una común.
# head -1: psql imprime tambien el tag "INSERT 0 1" despues de la fila.
ADMIN=$(q -q -tAc "insert into auth.users (email, raw_user_meta_data)
                values ('admin@ejemplo.com','{\"nombre\":\"Admin\"}'::jsonb) returning id;" | head -1)
q -q -c "update perfiles set rol='admin' where id='$ADMIN';"
CLIENTE=$(q -q -tAc "insert into auth.users (email, raw_user_meta_data)
                  values ('cliente@ejemplo.com','{\"nombre\":\"Cliente\"}'::jsonb) returning id;" | head -1)
PAQ=$(q -tAc "select id from paquetes order by orden limit 1;")
CLASES=$(q -tAc "select clases from paquetes where id='$PAQ';")
echo "=== paquete de prueba: $CLASES clases ==="

# Llama a otorgar_creditos con un rol y una identidad dados. Devuelve la salida
# o el mensaje de error, en una sola linea.
acreditar() {  # $1=rol  $2=auth.uid o vacio  $3=user_id  $4=mp_payment_id
  local sub_sql=""
  [ -n "$2" ] && sub_sql="set local \"request.jwt.claim.sub\" = '$2';"
  qa -tA -v ON_ERROR_STOP=0 2>&1 <<SQL | tr '\n' ' ' | sed 's/  */ /g'
begin;
set local role $1;
$sub_sql
select * from public.otorgar_creditos('$3'::uuid, '$PAQ'::uuid, '$4');
commit;
SQL
}

creditos_de() { q -tAc "select count(*) from creditos where user_id='$1';"; }

fallar() { echo "  FALLO: $1"; exit 1; }

# ---------------------------------------------------------------------------
echo
echo "=== 1. CONTRAPRUEBA: con el guardia viejo, el webhook queda afuera ==="
# Se instala a propósito la versión anterior del guardia, la que comparaba
# current_user. Sin esto, el arreglo de la 013 no se distingue de un cambio
# cosmético.
q -q -c "$(python3 - <<'PY'
import re, pathlib
t = pathlib.Path('supabase/migraciones/013-pago-mercadopago.sql').read_text()
m = re.search(r'create or replace function public\.otorgar_creditos\(.*?\n\$\$;', t, re.S)
print(m.group(0).replace(
  "current_setting('role', true) = 'service_role'", "current_user = 'service_role'"))
PY
)"
VIEJO=$(acreditar service_role "" "$CLIENTE" "pago-viejo-1")
echo "$VIEJO" | grep -q 'Solo administración puede otorgar créditos' \
  && echo "  service_role RECHAZADO, como estaba antes de la 013" \
  || fallar "esperaba el rechazo del guardia viejo, dio: $VIEJO"
[ "$(creditos_de "$CLIENTE")" = "0" ] || fallar "acredito algo igual"

# Y se ve POR QUÉ: current_user adentro de la función no es quien llama.
echo "  por que: current_user adentro de security definer no es quien llama ->"
q -q -c "create or replace function public.quien_soy()
         returns table(cu text, su text, rl text)
         language sql security definer set search_path = '' as \$\$
           select current_user::text, session_user::text,
                  current_setting('role', true) \$\$;"
qa -tA <<SQL | sed 's/|/  |  /g;s/^/    /'
begin;
set local role service_role;
select 'current_user=' || cu, 'session_user=' || su, 'setting role=' || rl
from public.quien_soy();
commit;
SQL

# ---------------------------------------------------------------------------
echo
echo "=== 2. Con el guardia de la 013 ==="
# Solo la función, no la migración entera: la tabla y sus políticas ya
# quedaron creadas cuando corrió el bucle de migraciones, y volver a crearlas
# daría "already exists". Lo que se restaura acá es el guardia bueno.
q -q -c "$(python3 - <<'PY2'
import re, pathlib
t = pathlib.Path('supabase/migraciones/013-pago-mercadopago.sql').read_text()
print(re.search(r'create or replace function public\.otorgar_creditos\(.*?\n\$\$;', t, re.S).group(0))
PY2
)"

OK=$(acreditar service_role "" "$CLIENTE" "pago-1")
echo "$OK" | grep -q "|$CLASES|f" \
  && echo "  service_role (el webhook)        ACREDITA  -> $CLASES creditos" \
  || fallar "service_role deberia acreditar, dio: $OK"
[ "$(creditos_de "$CLIENTE")" = "$CLASES" ] || fallar "no quedaron $CLASES creditos"

AD=$(acreditar authenticated "$ADMIN" "$CLIENTE" "pago-2")
echo "$AD" | grep -q "|$CLASES|f" \
  && echo "  sesion de administracion          ACREDITA  -> sigue funcionando" \
  || fallar "admin deberia acreditar, dio: $AD"

NO=$(acreditar authenticated "$CLIENTE" "$CLIENTE" "pago-3")
echo "$NO" | grep -q 'Solo administración puede otorgar créditos' \
  && echo "  sesion de cliente comun           RECHAZADA" \
  || fallar "un cliente no deberia poder acreditar, dio: $NO"

AN=$(acreditar anon "" "$CLIENTE" "pago-4")
echo "$AN" | grep -qi 'permission denied' \
  && echo "  anon                              NI PUEDE INVOCARLA (privilegio)" \
  || fallar "anon no deberia poder ni invocarla, dio: $AN"

# ---------------------------------------------------------------------------
echo
echo "=== 3. La idempotencia sigue intacta ==="
ANTES=$(creditos_de "$CLIENTE")
RE=$(acreditar service_role "" "$CLIENTE" "pago-1")
echo "$RE" | grep -q '|0|t' \
  && echo "  el mismo mp_payment_id otra vez   ya_estaba=t, 0 creditos nuevos" \
  || fallar "esperaba ya_estaba, dio: $RE"
[ "$(creditos_de "$CLIENTE")" = "$ANTES" ] \
  && echo "  el total no se movio: $ANTES" \
  || fallar "duplico creditos"

# ---------------------------------------------------------------------------
echo
echo "=== 4. intenciones_de_pago: nadie anota una intencion a nombre de otro ==="
MIA=$(qa -tA -v ON_ERROR_STOP=0 2>&1 <<SQL | tr -d '\n'
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$CLIENTE';
insert into public.intenciones_de_pago (user_id, paquete_id)
values ('$CLIENTE'::uuid, '$PAQ'::uuid) returning id;
commit;
SQL
)
# Sin anclar al principio: la salida trae tambien los BEGIN/SET de psql.
echo "$MIA" | grep -qE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' \
  && echo "  la suya                           la crea" \
  || fallar "deberia poder crear la suya, dio: $MIA"

AJENA=$(qa -tA -v ON_ERROR_STOP=0 2>&1 <<SQL | tr '\n' ' '
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$CLIENTE';
insert into public.intenciones_de_pago (user_id, paquete_id)
values ('$ADMIN'::uuid, '$PAQ'::uuid) returning id;
commit;
SQL
)
echo "$AJENA" | grep -qi 'row-level security' \
  && echo "  a nombre de otra persona          RECHAZADA por RLS" \
  || fallar "deberia rechazar una intencion ajena, dio: $AJENA"

VE=$(qa -q -tA <<SQL | tr -d '\n '
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$ADMIN';
select count(*) from public.intenciones_de_pago where user_id = '$CLIENTE'::uuid;
commit;
SQL
)
echo "  (la cuenta de administracion ve $VE intencion(es) del cliente, por el or es_admin())"

for VERBO in "update public.intenciones_de_pago set paquete_id='$PAQ'" \
             "delete from public.intenciones_de_pago"; do
  R=$(qa -tA -v ON_ERROR_STOP=0 2>&1 <<SQL | tr '\n' ' '
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$CLIENTE';
$VERBO;
commit;
SQL
)
  NOMBRE=$(echo "$VERBO" | awk '{print toupper($1)}')
  # Sin politica, RLS no da error: no afecta ninguna fila. Eso es lo que se mide.
  QUEDAN=$(q -tAc "select count(*) from intenciones_de_pago;")
  [ "$QUEDAN" = "1" ] \
    && echo "  $NOMBRE sin politica                no toco ninguna fila (queda $QUEDAN)" \
    || fallar "$NOMBRE modifico filas: quedan $QUEDAN"
done

echo
echo "TODO OK"
