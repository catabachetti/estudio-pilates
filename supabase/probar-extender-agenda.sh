#!/bin/zsh
# Comprueba extender-agenda.sql contra un Postgres descartable.
#
# Que verifica, y la ultima es la que importa:
#   1. que corra sin error
#   2. que sea idempotente: la segunda corrida no agrega nada
#   3. que una reserva sobre una clase existente sobreviva
#   4. que NO toque el catalogo
#   5. CONTRAPRUEBA de la afirmacion del encabezado del archivo: que el SEED si
#      pise un precio editado y extender-agenda no. Eso no prueba que el script
#      funcione —eso es lo de arriba— prueba que lo que su comentario AFIRMA es
#      cierto, que es otra cosa.
#
# Uso: zsh supabase/probar-extender-agenda.sh
set -e
# Los binarios de Postgres, donde esten. Antes esto era una ruta fija de macOS
# (/Library/PostgreSQL/18/bin) y por eso estos arneses no podian correr en el
# CI: ubuntu-latest trae Postgres instalado pero no en el PATH.
#
# Se buscan en orden y se corta con un mensaje claro si no aparecen, en vez de
# fallar mas adelante con "command not found".
ruta_de_postgres() {
  command -v initdb > /dev/null 2>&1 && return 0
  # null_glob acotado a esta funcion: zsh, al contrario de bash, aborta cuando un
  # glob no coincide con nada, y aca la mayoria de los candidatos no van a existir.
  setopt local_options null_glob
  local d
  for d in /Library/PostgreSQL/*/bin /usr/lib/postgresql/*/bin /usr/local/pgsql/bin /opt/homebrew/opt/postgresql*/bin; do
    if [ -x "$d/initdb" ]; then export PATH="$d:$PATH"; return 0; fi
  done
  echo "No encontre initdb. Hace falta PostgreSQL para este arnes." >&2
  echo "Buscado en: el PATH, /Library/PostgreSQL/*/bin, /usr/lib/postgresql/*/bin," >&2
  echo "/usr/local/pgsql/bin y /opt/homebrew/opt/postgresql*/bin" >&2
  return 1
}
ruta_de_postgres || exit 1
D="$(mktemp -d)"; P=/Users/catalina/Documents/estudio-pilates/supabase
trap 'pg_ctl -D "$D/pg" stop -m fast >/dev/null 2>&1 || true; rm -rf "$D"' EXIT
PUERTO=$(python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()")
initdb -D "$D/pg" -U prueba --auth=trust -E UTF8 --locale=C > /dev/null
pg_ctl -D "$D/pg" -o "-p $PUERTO -k $D -c listen_addresses=127.0.0.1" -l "$D/pg.log" start > /dev/null
sleep 2
q() { psql -h 127.0.0.1 -p $PUERTO -U prueba -d v -v ON_ERROR_STOP=1 -tA -q "$@"; }
psql -h 127.0.0.1 -p $PUERTO -U prueba -d postgres -q -c "create database v;"
q -f "$P/auth-de-mentira.sql" >/dev/null
for a in "$P"/migraciones/*.sql; do q -f "$a" >/dev/null; done
q -f "$P/seed.sql" >/dev/null

echo "=== despues del seed ==="
echo "  clases:        $(q -c 'select count(*) from clases;')"
echo "  ultima fecha:  $(q -c 'select max(fecha) from clases;')"

echo "=== se simula una agenda agotada: se borran las ultimas 5 semanas ==="
q -c "delete from clases where fecha > current_date + 20;" >/dev/null
echo "  clases:        $(q -c 'select count(*) from clases;')"
echo "  ultima fecha:  $(q -c 'select max(fecha) from clases;')"

echo "=== y una reserva sobre una clase que YA existe, para ver que sobreviva ==="
q -c "insert into auth.users (email, raw_user_meta_data) values ('alguien@ejemplo.com','{\"nombre\":\"A\"}'::jsonb);" >/dev/null
q -c "insert into reservas (user_id, clase_id)
      select (select id from auth.users limit 1), (select id from clases order by fecha, hora limit 1);" >/dev/null
RES_ANTES=$(q -c 'select count(*) from reservas;')
CLASE_RES=$(q -c 'select clase_id from reservas limit 1;')
echo "  reservas: $RES_ANTES  sobre la clase $CLASE_RES"

CAT_ANTES=$(q -c "select md5(string_agg(x, '|' order by x)) from (
  select nombre || coalesce(bio,'') from instructoras
  union all select slug || nombre from tipos_clase
  union all select nombre || precio::text || clases::text from paquetes) t(x);")

echo
echo "=== PRIMERA corrida de extender-agenda.sql ==="
q -f "$P/extender-agenda.sql" | tail -3 | sed 's/^/  /'
echo "  clases:        $(q -c 'select count(*) from clases;')"
echo "  ultima fecha:  $(q -c 'select max(fecha) from clases;')"
N1=$(q -c 'select count(*) from clases;')

echo "=== SEGUNDA corrida: no tiene que agregar nada ==="
q -f "$P/extender-agenda.sql" >/dev/null
N2=$(q -c 'select count(*) from clases;')
echo "  clases:        $N2"
[ "$N1" = "$N2" ] && echo "  idempotente: si" || { echo "  FALLO: agrego filas en la segunda corrida"; exit 1; }

echo
echo "=== el catalogo quedo intacto? ==="
CAT_DESPUES=$(q -c "select md5(string_agg(x, '|' order by x)) from (
  select nombre || coalesce(bio,'') from instructoras
  union all select slug || nombre from tipos_clase
  union all select nombre || precio::text || clases::text from paquetes) t(x);")
[ "$CAT_ANTES" = "$CAT_DESPUES" ] && echo "  si: mismo hash" || { echo "  FALLO: el catalogo cambio"; exit 1; }

echo "=== la reserva sobrevivio? ==="
RES_DESPUES=$(q -c 'select count(*) from reservas;')
MISMA=$(q -c "select count(*) from reservas where clase_id = '$CLASE_RES';")
[ "$RES_ANTES" = "$RES_DESPUES" ] && [ "$MISMA" = "1" ] \
  && echo "  si: $RES_DESPUES reserva(s), y sigue apuntando a la misma clase" \
  || { echo "  FALLO: reservas antes=$RES_ANTES despues=$RES_DESPUES misma=$MISMA"; exit 1; }

echo
echo "=== y el catalogo se modificaria si corrieramos el seed? (contraprueba) ==="
q -c "update paquetes set precio = 999 where orden = (select min(orden) from paquetes);" >/dev/null
q -f "$P/extender-agenda.sql" >/dev/null
P1=$(q -c "select precio from paquetes where orden = (select min(orden) from paquetes);")
echo "  precio editado a 999, despues de extender-agenda: $P1"
[ "$P1" = "999" ] && echo "  extender-agenda NO lo piso, correcto" || { echo "  FALLO: lo piso"; exit 1; }
q -f "$P/seed.sql" >/dev/null
P2=$(q -c "select precio from paquetes where orden = (select min(orden) from paquetes);")
echo "  despues de correr el SEED:                        $P2"
[ "$P2" != "999" ] && echo "  el seed SI lo piso: esa es la diferencia que el archivo afirma" || { echo "  FALLO: el seed no lo piso, la afirmacion del archivo seria falsa"; exit 1; }

echo
echo "TODO OK"
