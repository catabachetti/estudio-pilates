#!/bin/zsh
set -e
export PATH=/Library/PostgreSQL/18/bin:$PATH
S="$(mktemp -d)"
P="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$S/pgr"
initdb -D "$S/pgr" -U prueba --auth=trust -E UTF8 --locale=C > /dev/null
pg_ctl -D "$S/pgr" -o "-p 55434 -k /tmp -c listen_addresses=127.0.0.1" -l "$S/pgr.log" start > /dev/null
sleep 2
limpiar() { pg_ctl -D "$S/pgr" stop -m fast > /dev/null 2>&1 || true; rm -rf "$S"; }
trap limpiar EXIT
q() { psql -h 127.0.0.1 -p 55434 -U prueba -d v -v ON_ERROR_STOP=1 -tA -q "$@"; }
psql -h 127.0.0.1 -p 55434 -U prueba -d postgres -q -c "create database v;"
psql -h 127.0.0.1 -p 55434 -U prueba -d v -q -v ON_ERROR_STOP=1 -f "$P/auth-de-mentira.sql"
for a in "$P"/migraciones/*.sql; do psql -h 127.0.0.1 -p 55434 -U prueba -d v -q -v ON_ERROR_STOP=1 -f "$a"; done
psql -h 127.0.0.1 -p 55434 -U prueba -d v -q -v ON_ERROR_STOP=1 -f "$P/seed.sql"

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

echo "=== 1. LA CARRERA POR EL ULTIMO LUGAR ==="
echo "    Ana abre una transaccion, llama a la funcion y la deja abierta 3 segundos."
echo "    Bea llama al mismo tiempo: tiene que quedarse esperando el candado."
(psql -h 127.0.0.1 -p 55434 -U prueba -d v -tA -q -v ON_ERROR_STOP=1 <<SQL
begin;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
select '  Ana  -> ' || resultado from reservar_clase('$CLASE');
select pg_sleep(3);
commit;
SQL
) &
sleep 1
INICIO=$(python3 -c "import time;print(time.time())")
psql -h 127.0.0.1 -p 55434 -U prueba -d v -tA -q -v ON_ERROR_STOP=1 <<SQL
begin;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
select '  Bea  -> ' || resultado from reservar_clase('$CLASE');
commit;
SQL
FIN=$(python3 -c "import time;print(time.time())")
wait
python3 -c "print(f'  Bea espero {$FIN - $INICIO:.1f}s por el candado')"
echo "  reservas confirmadas en la clase: $(q -c "select count(*) from reservas where clase_id='$CLASE' and estado='confirmada';")  (tiene que ser 1)"

echo
como() { # como <uuid> <sql>
  psql -h 127.0.0.1 -p 55434 -U prueba -d v -tA -q -v ON_ERROR_STOP=1 <<SQL
begin;
select set_config('request.jwt.claim.sub','$1',true);
$2
commit;
SQL
}
ANA=11111111-1111-1111-1111-111111111111
BEA=22222222-2222-2222-2222-222222222222
libres() { q -c "select count(*) from creditos c where c.user_id='$1' and c.vence_el >= current_date and not exists (select 1 from reservas r where r.credito_id = c.id);"; }

echo "=== 2. SIN CREDITOS ==="
C2=$(q -c "insert into clases (tipo_clase_id, fecha, hora, cupo_total) select (select id from tipos_clase limit 1), current_date + 2, '23:30', 6 returning id;")
echo "  a Ana ya no le quedan creditos libres: $(libres $ANA)"
como $ANA "select '  Ana pide otra clase -> ' || resultado from reservar_clase('$C2');"

echo
echo "=== 3. YA RESERVADA ==="
CLASE=$(q -c "select id from clases where fecha = current_date + 1 and hora = '23:30';")
como $ANA "select '  Ana pide la misma de nuevo -> ' || resultado from reservar_clase('$CLASE');"

echo
echo "=== 4. CANCELAR A TIEMPO (clase manana, ventana de 6 horas) ==="
R=$(q -c "select id from reservas where user_id='$ANA' and estado='confirmada' limit 1;")
echo "  creditos libres de Ana antes: $(libres $ANA)"
como $ANA "select '  cancelar -> ' || resultado || ', credito devuelto: ' || credito_devuelto from cancelar_reserva('$R');"
echo "  creditos libres de Ana despues: $(libres $ANA)   (tiene que volver a 1)"

echo
echo "=== 5. CANCELAR TARDE (clase dentro de 2 horas) ==="
C3=$(q -c "insert into clases (tipo_clase_id, fecha, hora, cupo_total) select (select id from tipos_clase limit 1), (now() + interval '2 hours')::date, to_char(now() + interval '2 hours','HH24:MI')::time, 6 returning id;")
como $ANA "select '  reservar -> ' || resultado from reservar_clase('$C3');"
echo "  creditos libres de Ana: $(libres $ANA)"
R3=$(q -c "select id from reservas where user_id='$ANA' and clase_id='$C3';")
como $ANA "select '  cancelar -> ' || resultado || ', credito devuelto: ' || credito_devuelto from cancelar_reserva('$R3');"
echo "  creditos libres de Ana despues: $(libres $ANA)   (tiene que seguir en 0: lo perdio)"

echo
echo "=== 6. EL ESTUDIO CANCELA UNA CLASE ==="
q -q -c "update creditos set vence_el = current_date + 30 where user_id='$BEA';"
C4=$(q -c "insert into clases (tipo_clase_id, fecha, hora, cupo_total) select (select id from tipos_clase limit 1), current_date + 3, '23:30', 6 returning id;")
como $BEA "select '  Bea reserva -> ' || resultado from reservar_clase('$C4');"
echo "  creditos libres de Bea: $(libres $BEA)   reservas confirmadas: $(q -c "select count(*) from reservas where clase_id='$C4' and estado='confirmada';")"
echo "  --- el estudio cancela la clase ---"
q -q -c "update clases set estado='cancelada' where id='$C4';"
echo "  reservas confirmadas: $(q -c "select count(*) from reservas where clase_id='$C4' and estado='confirmada';")  canceladas: $(q -c "select count(*) from reservas where clase_id='$C4' and estado='cancelada';")"
echo "  creditos libres de Bea: $(libres $BEA)   (tiene que haber vuelto a 1, sin mirar la ventana)"
echo "  --- el estudio la reactiva ---"
q -q -c "update clases set estado='programada' where id='$C4';"
echo "  reservas confirmadas: $(q -c "select count(*) from reservas where clase_id='$C4' and estado='confirmada';")  (tiene que seguir en 0: no vuelven)"
echo "  creditos libres de Bea: $(libres $BEA)   (sigue teniendolo)"
