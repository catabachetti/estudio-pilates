#!/bin/zsh
# Comprueba limpiar-datos-de-prueba.sql contra un Postgres descartable: que el
# freno corte cuando hay una reserva de una cuenta que no es de prueba, y que
# sin esa reserva se lleve lo de prueba y nada mas.
#
# Uso: zsh supabase/probar-limpieza.sh
set -e
export PATH=/Library/PostgreSQL/18/bin:$PATH
D="$(mktemp -d)"
P="$(cd "$(dirname "$0")" && pwd)"
# Un puerto libre, elegido ahora: un cluster huerfano de una corrida anterior
# deja el puerto tomado y pg_ctl falla con "could not start server" sin decir
# por que. El socket va al directorio temporal propio y no a /tmp por lo mismo.
PUERTO=$(python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()")

initdb -D "$D/pg" -U prueba --auth=trust -E UTF8 --locale=C > /dev/null
pg_ctl -D "$D/pg" -o "-p $PUERTO -k $D -c listen_addresses=127.0.0.1" -l "$D/pg.log" start > /dev/null
sleep 2
limpiar() { pg_ctl -D "$D/pg" stop -m fast > /dev/null 2>&1 || true; rm -rf "$D"; }
trap limpiar EXIT

q() { psql -h 127.0.0.1 -p $PUERTO -U prueba -d lim -v ON_ERROR_STOP=1 "$@"; }
psql -h 127.0.0.1 -p $PUERTO -U prueba -d postgres -q -c "create database lim;"
q -q -f "$P/auth-de-mentira.sql"
for a in "$P"/migraciones/*.sql; do q -q -f "$a"; done
q -q -f "$P/seed.sql"

REALES=$(q -tAc "select count(*) from clases;")
echo "=== punto de partida: $REALES clases del seed ==="

echo "=== se fabrican datos de prueba: dos clases en 2027, una cuenta con '+' ==="
q -q -c "insert into auth.users (email, raw_user_meta_data) values
         ('x+apidoc@ejemplo.com','{\"nombre\":\"Prueba\"}'::jsonb),
         ('estudio@ejemplo.com','{\"nombre\":\"Real\"}'::jsonb);"
q -q -c "insert into clases (fecha, hora, tipo_clase_id, cupo_total)
         select date '2027-06-01', time '03:51', (select id from tipos_clase limit 1), 6
         union all
         select date '2027-06-02', time '03:51', (select id from tipos_clase limit 1), 6;"
q -q -c "insert into compras (user_id, paquete_id, monto, mp_payment_id)
         select u.id, (select id from paquetes limit 1), 19000, 'prueba-1'
         from auth.users u where u.email like '%+%';"
q -q -c "insert into creditos (user_id, compra_id, vence_el)
         select m.user_id, m.id, current_date + 30 from compras m where m.mp_payment_id = 'prueba-1';"
q -q -c "insert into reservas (user_id, clase_id, credito_id)
         select (select id from auth.users where email like '%+%'),
                (select id from clases where fecha = date '2027-06-01'),
                (select id from creditos limit 1);"

echo "=== se fabrica tambien un pago de prueba de Mercado Pago ==="
# Con la cuenta REAL (sin '+'), que es el caso que la seccion 2.5 cubre.
q -q -c "insert into compras (user_id, paquete_id, monto, estado, mp_payment_id)
         select (select id from auth.users where email = 'estudio@ejemplo.com'),
                (select id from paquetes order by orden limit 1), 18000, 'aprobada', '186232108573';"
q -q -c "insert into creditos (user_id, compra_id, vence_el)
         select m.user_id, m.id, current_date + 30 from compras m
         where m.mp_payment_id = '186232108573';"
q -q -c "insert into intenciones_de_pago (user_id, paquete_id)
         select (select id from auth.users where email = 'estudio@ejemplo.com'),
                (select id from paquetes order by orden limit 1)
         from generate_series(1, 3);"
echo "  compras con ese pago: $(q -tAc "select count(*) from compras where mp_payment_id='186232108573';")"
echo "  creditos que cuelgan: $(q -tAc "select count(*) from creditos k join compras m on m.id=k.compra_id where m.mp_payment_id='186232108573';")"
echo "  intenciones:          $(q -tAc 'select count(*) from intenciones_de_pago;')"

echo "=== 1. el freno: una reserva de cuenta real en una clase de 2027 ==="
q -q -c "insert into reservas (user_id, clase_id)
         select (select id from auth.users where email = 'estudio@ejemplo.com'),
                (select id from clases where fecha = date '2027-06-02');"
if q -q -f "$P/limpiar-datos-de-prueba.sql" > /dev/null 2>"$D/err.txt"; then
  echo "  FALLO: no freno, borro igual"; exit 1
fi
# NO ALCANZA CON QUE FALLE. La primera version de esta prueba dio "freno bien"
# cuando el script cortaba por un error de columna varias lineas ANTES de
# llegar al raise. Hay que afirmar el mensaje, no el codigo de salida.
if ! grep -q 'No se borra nada' "$D/err.txt"; then
  echo "  FALLO: corto, pero por otro motivo:"; sed 's/^/    /' "$D/err.txt"; exit 1
fi
grep -o 'Hay .*No se borra nada\.' "$D/err.txt" | sed 's/^/  /'
[ "$(q -tAc "select count(*) from clases where fecha >= date '2027-01-01';")" = "2" ] \
  || { echo "  FALLO: borro algo igual"; exit 1; }
echo "  y las dos clases de 2027 siguen ahi"

echo "=== 1b. el otro freno: una reserva hecha con un credito del pago de prueba ==="
# reservas.credito_id no tiene accion de borrado, asi que Postgres se negaria
# con un error de clave ajena. El script lo dice con palabras antes.
q -q -c "insert into reservas (user_id, clase_id, credito_id)
         select (select id from auth.users where email = 'estudio@ejemplo.com'),
                (select id from clases where fecha < date '2027-01-01' order by fecha limit 1),
                (select k.id from creditos k join compras m on m.id = k.compra_id
                 where m.mp_payment_id = '186232108573' limit 1);"
# Se saca la reserva ajena de la clase de 2027 para que NO corte el freno anterior
# y se vea cortar este.
q -q -c "delete from reservas where clase_id in (select id from clases where fecha >= date '2027-01-01');"
if q -q -f "$P/limpiar-datos-de-prueba.sql" > /dev/null 2>"$D/err2.txt"; then
  echo "  FALLO: no freno, borro un credito que una reserva usaba"; exit 1
fi
if ! grep -q 'reservas.credito_id no deja borrar' "$D/err2.txt"; then
  echo "  FALLO: corto, pero por otro motivo:"; sed 's/^/    /' "$D/err2.txt"; exit 1
fi
grep -o 'Hay .*no deja borrar el credito\.' "$D/err2.txt" | sed 's/^/  /'
[ "$(q -tAc "select count(*) from compras where mp_payment_id='186232108573';")" = "1" ] \
  || { echo "  FALLO: borro la compra igual"; exit 1; }
echo "  y la compra de prueba sigue ahi"
# Ahora si se saca esa reserva, para que el borrado pueda completarse.
q -q -c "delete from reservas;"

echo "=== 2. sin esa reserva ajena, el borrado completo ==="
q -q -c "delete from reservas where user_id = (select id from auth.users where email = 'estudio@ejemplo.com');"
q -q -f "$P/limpiar-datos-de-prueba.sql" > /dev/null
for par in "select count(*) from clases where fecha >= date '2027-01-01'|clases de 2027" \
           "select count(*) from reservas|reservas" \
           "select count(*) from creditos where user_id in (select id from auth.users where email like '%+%@%')|creditos de prueba" \
           "select count(*) from compras where user_id in (select id from auth.users where email like '%+%@%')|compras de prueba" \
           "select count(*) from compras where mp_payment_id in ('186232108573','prueba-api-fecha-1')|pagos de prueba de MP" \
           "select count(*) from creditos k join compras m on m.id=k.compra_id where m.mp_payment_id='186232108573'|creditos de ese pago" \
           "select count(*) from intenciones_de_pago|intenciones de pago"; do
  consulta="${par%%|*}"; nombre="${par##*|}"
  n=$(q -tAc "$consulta")
  printf '  %-22s %s' "$nombre" "$n"
  [ "$n" = "0" ] && echo "  ok" || { echo "  FALLO: esperaba 0"; exit 1; }
done
AHORA=$(q -tAc "select count(*) from clases;")
printf '  %-22s %s' "clases reales" "$AHORA"
[ "$AHORA" = "$REALES" ] && echo "  ok, intactas" || { echo "  FALLO: eran $REALES"; exit 1; }
echo
echo "TODO OK"
