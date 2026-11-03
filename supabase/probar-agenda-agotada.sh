#!/bin/zsh
# Comprueba, contra Postgres de verdad, que el filtro `fecha >= current_date`
# es lo que hace que una agenda agotada se distinga de una agenda cargada.
#
# QUE BUG CUBRE. agendaDeLaSemana() calculaba la ultima fecha de la agenda sin
# ese filtro, asi que tomaba la ultima clase de la tabla aunque ya hubiera
# pasado. Como las clases pasadas no se borran, la consulta nunca devolvia
# null, `sinAgenda` nunca era true, y el bloque "No hay clases cargadas" no se
# podia mostrar nunca.
#
# Este nivel prueba el MECANISMO: que sobre una tabla con solo clases pasadas,
# la consulta con el filtro devuelve cero filas y la de antes devuelve una. Que
# la funcion USE ese resultado para poner sinAgenda lo prueba
# docs/ejemplos/probar-agenda.mjs, con un cliente de mentira que ademas afirma
# que el filtro sigue estando.
#
# Uso: zsh supabase/probar-agenda-agotada.sh
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
D="$(mktemp -d)"
P="$(cd "$(dirname "$0")" && pwd)"
trap 'pg_ctl -D "$D/pg" stop -m fast >/dev/null 2>&1 || true; rm -rf "$D"' EXIT
PUERTO=$(python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()")

initdb -D "$D/pg" -U prueba --auth=trust -E UTF8 --locale=C > /dev/null
pg_ctl -D "$D/pg" -o "-p $PUERTO -k $D -c listen_addresses=127.0.0.1" -l "$D/pg.log" start > /dev/null
sleep 2
q() { psql -h 127.0.0.1 -p $PUERTO -U prueba -d v -v ON_ERROR_STOP=1 -tA -q "$@"; }
psql -h 127.0.0.1 -p $PUERTO -U prueba -d postgres -q -c "create database v;"
q -f "$P/auth-de-mentira.sql" > /dev/null
for a in "$P"/migraciones/*.sql; do q -f "$a" > /dev/null; done
q -f "$P/seed.sql" > /dev/null

# La consulta de agendaDeLaSemana, en sus dos versiones.
CON_FILTRO="select coalesce(max(fecha)::text, 'NULL') from clases
            where estado = 'programada' and fecha >= current_date;"
SIN_FILTRO="select coalesce(max(fecha)::text, 'NULL') from clases
            where estado = 'programada';"

fallo=0
comparar() {  # $1=etiqueta  $2=esperado con filtro  $3=esperado sin filtro
  local con=$(q -c "$CON_FILTRO") sin=$(q -c "$SIN_FILTRO")
  printf '  %-34s con filtro: %-12s sin filtro: %-12s' "$1" "$con" "$sin"
  if [ "$con" = "$2" ] && [ "$sin" = "$3" ]; then echo "ok"
  else echo "MAL (esperaba $2 / $3)"; fallo=1; fi
}

echo "=== 1. agenda cargada: las dos versiones coinciden ==="
echo "    (con clases por delante el filtro no cambia nada, y por eso el bug"
echo "     era invisible mientras la agenda estuviera viva)"
ULTIMA=$(q -c "select max(fecha)::text from clases where estado='programada';")
comparar "agenda normal del seed" "$ULTIMA" "$ULTIMA"

echo
echo "=== 2. agenda agotada: solo clases pasadas ==="
# Se corren todas las clases un ano hacia atras: la tabla sigue teniendo
# filas, que es la condicion que hacia imposible el aviso.
q -c "update clases set fecha = fecha - interval '1 year';" > /dev/null
echo "  clases en la tabla: $(q -c 'select count(*) from clases;')  (ninguna por delante)"
comparar "solo clases pasadas" "NULL" "$(q -c "select max(fecha)::text from clases where estado='programada';")"

echo
echo "=== 3. CONTRAPRUEBA: el filtro es lo unico que los diferencia ==="
echo "    Sin el filtro la consulta devuelve una fecha pasada, o sea NO null,"
echo "    o sea sinAgenda=false y el aviso no aparece. Eso era el bug."
SIN=$(q -c "$SIN_FILTRO")
CON=$(q -c "$CON_FILTRO")
if [ "$CON" = "NULL" ] && [ "$SIN" != "NULL" ]; then
  echo "    con filtro -> NULL   (sinAgenda = true,  aviso visible)"
  echo "    sin filtro -> $SIN   (sinAgenda = false, aviso IMPOSIBLE)"
else
  echo "    MAL: con=$CON sin=$SIN"; fallo=1
fi

echo
echo "=== 4. y la tabla no quedo vacia, que es lo que lo hacia invisible ==="
VACIA=$(q -c 'select count(*) = 0 from clases;')
[ "$VACIA" = "f" ] && echo "  la tabla tiene filas: la condicion 'sin ninguna clase' no se cumple sola" \
  || { echo "  MAL: la tabla quedo vacia y la prueba no demuestra nada"; fallo=1; }

echo
[ "$fallo" = "0" ] && echo "TODO OK" || { echo "HAY CASOS MAL"; exit 1; }
