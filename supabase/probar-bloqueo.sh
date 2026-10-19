#!/bin/zsh
# Prueba el bloqueo progresivo de la 012 contra un Postgres descartable.
# Uso: zsh supabase/probar-bloqueo.sh
set -e
export PATH=/Library/PostgreSQL/18/bin:$PATH
S="$(mktemp -d)"
P="$(cd "$(dirname "$0")" && pwd)"
initdb -D "$S/pg" -U prueba --auth=trust -E UTF8 --locale=C > /dev/null
pg_ctl -D "$S/pg" -o "-p 55435 -k /tmp -c listen_addresses=127.0.0.1" -l "$S/pg.log" start > /dev/null
sleep 2
limpiar() { pg_ctl -D "$S/pg" stop -m fast > /dev/null 2>&1 || true; rm -rf "$S"; }
trap limpiar EXIT
q() { psql -h 127.0.0.1 -p 55435 -U prueba -d v -v ON_ERROR_STOP=1 -tA -q "$@"; }
psql -h 127.0.0.1 -p 55435 -U prueba -d postgres -q -c "create database v;"
psql -h 127.0.0.1 -p 55435 -U prueba -d v -q -v ON_ERROR_STOP=1 -f "$P/auth-de-mentira.sql"
for a in "$P"/migraciones/*.sql; do psql -h 127.0.0.1 -p 55435 -U prueba -d v -q -v ON_ERROR_STOP=1 -f "$a"; done

echo "=== la escalera de espera ==="
for n in 1 2 3 4 5 6 7 8 9 10 12; do
  printf '  fallo %2s -> espera %4s s\n' "$n" "$(q -c "select espera_por_fallos($n);")"
done

# La primera version desbordaba a partir de 32 fallos: el techo estaba en el
# resultado y no en el exponente, asi que 30 * 2^27 se pasaba del maximo de un
# integer. 32 fallos es justo lo que acumula quien prueba contrasenas, o sea
# que la funcion fallaba exactamente cuando hacia falta.
echo
echo "=== numeros altos: no puede desbordar ==="
for n in 31 32 36 40 1000; do
  R=$(q -c "select espera_por_fallos($n);" 2>&1)
  case "$R" in
    300) printf '  fallo %4s -> %s s  ok\n' "$n" "$R" ;;
    *)   printf '  fallo %4s -> FALLA: %s\n' "$n" "$(echo $R | cut -c1-60)" ; exit 1 ;;
  esac
done

echo
echo "=== fallos seguidos desde la misma IP ==="
for n in 1 2 3 4 5 6 7; do
  E=$(q -c "select registrar_fallo('Alguien@Ejemplo.com', '200.1.2.3');")
  B=$(q -c "select puede_intentar('alguien@ejemplo.com', '200.1.2.3');")
  printf '  intento %s fallido -> espera impuesta %3ss, faltan %3ss\n' "$n" "$E" "$B"
done

echo
echo "=== la misma cuenta desde OTRA IP no esta bloqueada ==="
printf '  faltan: %ss  (tiene que ser 0: quien ataca se bloquea a si mismo)\n' "$(q -c "select puede_intentar('alguien@ejemplo.com', '190.9.9.9');")"

echo
echo "=== el correo no distingue mayusculas ni espacios ==="
printf '  "  ALGUIEN@ejemplo.com  " -> faltan %ss (el mismo registro)\n' "$(q -c "select puede_intentar('  ALGUIEN@ejemplo.com  ', '200.1.2.3');")"

echo
echo "=== un correo que no existe se comporta igual ==="
q -c "select registrar_fallo('nadie-aqui@ejemplo.com', '200.1.2.3');" > /dev/null
printf '  registro creado igual: %s fila(s)  (no se puede deducir si la cuenta existe)\n' "$(q -c "select count(*) from intentos_ingreso where email='nadie-aqui@ejemplo.com';")"

echo
echo "=== entrar bien borra el registro ==="
q -c "select limpiar_intentos('alguien@ejemplo.com', '200.1.2.3');" > /dev/null
printf '  filas para esa cuenta e IP: %s   faltan: %ss\n' "$(q -c "select count(*) from intentos_ingreso where email='alguien@ejemplo.com' and ip='200.1.2.3';")" "$(q -c "select puede_intentar('alguien@ejemplo.com','200.1.2.3');")"

echo
echo "=== despues de 15 minutos sin fallar, la cuenta vuelve a cero ==="
q -c "select registrar_fallo('otra@ejemplo.com', '1.1.1.1');" > /dev/null
q -c "select registrar_fallo('otra@ejemplo.com', '1.1.1.1');" > /dev/null
q -c "select registrar_fallo('otra@ejemplo.com', '1.1.1.1');" > /dev/null
printf '  tres fallos seguidos: fallos=%s\n' "$(q -c "select fallos from intentos_ingreso where email='otra@ejemplo.com';")"
q -c "update intentos_ingreso set ultimo_fallo = now() - interval '20 minutes' where email='otra@ejemplo.com';" > /dev/null
q -c "select registrar_fallo('otra@ejemplo.com', '1.1.1.1');" > /dev/null
printf '  uno mas, 20 minutos despues: fallos=%s  (vuelve a 1)\n' "$(q -c "select fallos from intentos_ingreso where email='otra@ejemplo.com';")"

echo
echo "=== la tabla es invisible desde afuera ==="
q -c "select count(*) from pg_policies where tablename='intentos_ingreso';" | xargs printf '  politicas: %s   '
q -c "select relrowsecurity from pg_class where relname='intentos_ingreso';" | xargs printf 'RLS activa: %s\n'
