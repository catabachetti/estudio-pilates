#!/bin/zsh
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
S="$(mktemp -d)"
P="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$S/pgr"
# Un puerto libre, pedido ahora, y el socket en el directorio temporal propio.
# Con un puerto fijo y el socket en /tmp, dos de estos scripts corriendo a la
# vez —o uno que quedo colgado de antes— hacen fallar al otro con
# "could not start server", que no tiene nada que ver con lo que esta probando.
PUERTO=$(python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()")
initdb -D "$S/pgr" -U prueba --auth=trust -E UTF8 --locale=C > /dev/null
pg_ctl -D "$S/pgr" -o "-p $PUERTO -k "$S" -c listen_addresses=127.0.0.1" -l "$S/pgr.log" start > /dev/null
sleep 2
limpiar() { pg_ctl -D "$S/pgr" stop -m fast > /dev/null 2>&1 || true; rm -rf "$S"; }
trap limpiar EXIT
q() { psql -h 127.0.0.1 -p $PUERTO -U prueba -d v -v ON_ERROR_STOP=1 -tA -q "$@"; }
psql -h 127.0.0.1 -p $PUERTO -U prueba -d postgres -q -c "create database v;"
psql -h 127.0.0.1 -p $PUERTO -U prueba -d v -q -v ON_ERROR_STOP=1 -f "$P/auth-de-mentira.sql"
for a in "$P"/migraciones/*.sql; do psql -h 127.0.0.1 -p $PUERTO -U prueba -d v -q -v ON_ERROR_STOP=1 -f "$a"; done
psql -h 127.0.0.1 -p $PUERTO -U prueba -d v -q -v ON_ERROR_STOP=1 -f "$P/seed.sql"

# Dos personas, una clase de manana con UN solo lugar, un credito cada una.
q -q <<'SQL'
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111','ana@x.com','{"nombre":"Ana"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222','bea@x.com','{"nombre":"Bea"}'::jsonb);

-- una clase manana a las 10, cupo 1
insert into clases (tipo_clase_id, fecha, hora, cupo_total)
select (select id from tipos_clase limit 1), current_date + 1, '23:30', 1;

-- una compra y un credito para cada una
insert into compras (user_id, paquete_id, monto, estado)
select u.id, (select id from paquetes limit 1), 1000, 'aprobada' from auth.users u;
insert into creditos (user_id, compra_id, vence_el)
select c.user_id, c.id, current_date + 30 from compras c;
SQL
echo "preparado: 2 personas, 1 clase con cupo 1, 1 credito cada una"
echo
CLASE=$(q -c "select id from clases where fecha = current_date + 1 and hora = '23:30';")

# CADA SECCION AFIRMA, NO SOLO IMPRIME. Hasta el 11 de noviembre de 2026 este
# arnes mostraba el resultado al lado de lo que "tiene que" dar y dejaba que una
# persona lo leyera: en el CI pasaba en verde aunque cancelar a tiempo dejara de
# devolver el credito, porque solo cortaba si una consulta daba error. Una
# comprobacion que no puede fallar no comprueba nada.
fallar() { echo "  FALLA: $1" >&2; exit 1; }
igual() { # igual <obtenido> <esperado> <que se comprueba>
  if [ "$1" = "$2" ]; then echo "  ok  $3: $1"; else fallar "$3: dio '$1' y tenia que dar '$2'"; fi
}

# Hacer algo como una persona. `set local` en vez de set_config(): no imprime
# nada, asi que lo que devuelve esta funcion es solo el resultado de la consulta.
como() { # como <uuid> <sql>
  psql -h 127.0.0.1 -p $PUERTO -U prueba -d v -tA -q -v ON_ERROR_STOP=1 <<SQL
begin;
set local "request.jwt.claim.sub" = '$1';
$2
commit;
SQL
}
ANA=11111111-1111-1111-1111-111111111111
BEA=22222222-2222-2222-2222-222222222222
libres() { q -c "select count(*) from creditos c where c.user_id='$1' and c.vence_el >= current_date and not exists (select 1 from reservas r where r.credito_id = c.id);"; }
confirmadas() { q -c "select count(*) from reservas where clase_id='$1' and estado='confirmada';"; }

echo "=== 1. LA CARRERA POR EL ULTIMO LUGAR ==="
echo "    Ana abre una transaccion, llama a la funcion y la deja abierta 3 segundos."
echo "    Bea llama al mismo tiempo: tiene que quedarse esperando el candado."
(psql -h 127.0.0.1 -p $PUERTO -U prueba -d v -tA -q -v ON_ERROR_STOP=1 > "$S/ana.txt" <<SQL
begin;
set local "request.jwt.claim.sub" = '$ANA';
select resultado from reservar_clase('$CLASE');
select pg_sleep(3);
commit;
SQL
) &
sleep 1
INICIO=$(python3 -c "import time;print(time.time())")
BEA_R=$(como $BEA "select resultado from reservar_clase('$CLASE');")
FIN=$(python3 -c "import time;print(time.time())")
wait
ANA_R=$(grep -v '^$' "$S/ana.txt" | head -1)
igual "$ANA_R" ok "Ana, que llego primero"
igual "$BEA_R" completa "Bea, que llego mientras Ana tenia el candado"
igual "$(confirmadas $CLASE)" 1 "reservas confirmadas en la clase de 1 lugar"
# Que Bea haya ESPERADO es la evidencia del candado. Sin el `for update`, Bea no
# esperaria: contaria cero, porque la reserva de Ana todavia no tiene commit, y
# entraria tambien.
ESPERA=$(python3 -c "print(f'{$FIN - $INICIO:.1f}')")
python3 -c "import sys; sys.exit(0 if $ESPERA >= 1.0 else 1)" \
  && echo "  ok  Bea espero el candado: ${ESPERA}s" \
  || fallar "Bea no espero el candado (${ESPERA}s): la segunda no quedo bloqueada"

echo
echo "=== 2. SIN CREDITOS ==="
C2=$(q -c "insert into clases (tipo_clase_id, fecha, hora, cupo_total) select (select id from tipos_clase limit 1), current_date + 2, '23:30', 6 returning id;")
igual "$(libres $ANA)" 0 "creditos libres de Ana"
igual "$(como $ANA "select resultado from reservar_clase('$C2');")" sin_creditos "Ana pide otra clase"
igual "$(confirmadas $C2)" 0 "reservas creadas en esa clase"

echo
echo "=== 3. YA RESERVADA ==="
igual "$(como $ANA "select resultado from reservar_clase('$CLASE');")" ya_reservada "Ana pide la misma de nuevo"

echo
echo "=== 4. CANCELAR A TIEMPO (clase manana, ventana de 6 horas) ==="
R=$(q -c "select id from reservas where user_id='$ANA' and estado='confirmada' limit 1;")
igual "$(libres $ANA)" 0 "creditos libres de Ana antes"
igual "$(como $ANA "select resultado || ' ' || credito_devuelto from cancelar_reserva('$R');")" "ok true" "cancelar, y si devuelve el credito"
igual "$(libres $ANA)" 1 "creditos libres de Ana despues"

echo
echo "=== 5. CANCELAR TARDE (clase dentro de 2 horas) ==="
C3=$(q -c "insert into clases (tipo_clase_id, fecha, hora, cupo_total) select (select id from tipos_clase limit 1), (now() + interval '2 hours')::date, to_char(now() + interval '2 hours','HH24:MI')::time, 6 returning id;")
igual "$(como $ANA "select resultado from reservar_clase('$C3');")" ok "Ana reserva la clase de dentro de 2 horas"
igual "$(libres $ANA)" 0 "creditos libres de Ana"
R3=$(q -c "select id from reservas where user_id='$ANA' and clase_id='$C3';")
igual "$(como $ANA "select resultado || ' ' || credito_devuelto from cancelar_reserva('$R3');")" "ok false" "cancelar tarde, y si devuelve el credito"
igual "$(libres $ANA)" 0 "creditos libres de Ana despues: lo perdio"

echo
echo "=== 6. EL ESTUDIO CANCELA UNA CLASE ==="
q -q -c "update creditos set vence_el = current_date + 30 where user_id='$BEA';"
C4=$(q -c "insert into clases (tipo_clase_id, fecha, hora, cupo_total) select (select id from tipos_clase limit 1), current_date + 3, '23:30', 6 returning id;")
igual "$(como $BEA "select resultado from reservar_clase('$C4');")" ok "Bea reserva"
igual "$(libres $BEA)" 0 "creditos libres de Bea"
igual "$(confirmadas $C4)" 1 "reservas confirmadas"
echo "  --- el estudio cancela la clase ---"
q -q -c "update clases set estado='cancelada' where id='$C4';"
igual "$(confirmadas $C4)" 0 "reservas confirmadas"
igual "$(q -c "select count(*) from reservas where clase_id='$C4' and estado='cancelada';")" 1 "reservas canceladas"
igual "$(libres $BEA)" 1 "creditos libres de Bea: volvio sin mirar la ventana"
echo "  --- el estudio la reactiva ---"
q -q -c "update clases set estado='programada' where id='$C4';"
igual "$(confirmadas $C4)" 0 "reservas confirmadas: no vuelven"
igual "$(libres $BEA)" 1 "creditos libres de Bea: sigue teniendolo"

echo
echo "TODO OK"
