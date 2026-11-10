#!/bin/zsh
# Comprueba, contra Postgres de verdad, el formulario de contacto: que la unica
# puerta de escritura sea enviar_mensaje(), que el limite por correo funcione, y
# que los largos que pide la funcion coincidan con los que pide el esquema de
# Zod.
#
# POR QUE EL ULTIMO CASO ES EL QUE MAS IMPORTA. Los largos del mensaje viven en
# DOS lados que no se pueden importar entre si: app/lib/esquemas.js y la funcion
# de la migracion 014. Esa es una duplicacion real y conocida, y lo unico que
# impide que se separen es este arnes: lee las constantes del archivo de
# JavaScript y prueba la funcion EXACTAMENTE en los bordes. Si manana alguien
# cambia uno de los dos, esto falla.
#
# Uso: zsh supabase/probar-mensajes.sh
set -e
# Los binarios de Postgres, donde esten. Antes esto era una ruta fija de macOS
# (/Library/PostgreSQL/18/bin) y por eso estos arneses no podian correr en el
# CI: ubuntu-latest trae Postgres instalado pero no en el PATH.
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
RAIZ="$(cd "$P/.." && pwd)"
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

# Los privilegios que Supabase da de fabrica. HACEN FALTA PARA QUE LA PRUEBA DE
# RLS PRUEBE RLS: sin el grant, un insert de `anon` falla por "permission
# denied" y no por la politica, asi que la prueba pasaria por el motivo
# equivocado.
q -q -c "grant usage on schema public to anon, authenticated, service_role;
         grant all on all tables in schema public to anon, authenticated, service_role;
         grant all on all sequences in schema public to anon, authenticated, service_role;"

fallo=0
afirmar() { # afirmar <etiqueta> <esperado> <obtenido>
  if [ "$2" = "$3" ]; then
    printf '  ok   %-46s %s\n' "$1" "$3"
  else
    printf '  MAL  %-46s %s (esperaba %s)\n' "$1" "$3" "$2"
    fallo=1
  fi
}
enviar() { # enviar <nombre> <email> <mensaje>
  q -c "select resultado from enviar_mensaje('$1','$2','$3');"
}

echo "=== 1. RLS: la unica puerta es la funcion ==="
# El insert directo tiene que fallar, Y EL MOTIVO TIENE QUE SER RLS. Si fallara
# por permisos, este caso no estaria probando la politica.
SALIDA=$(psql -h 127.0.0.1 -p $PUERTO -U prueba -d v -tA -q <<'SQL' 2>&1 || true
begin;
set local role anon;
insert into mensajes (nombre, email, mensaje) values ('Bot','bot@spam.com','mensaje directo sin pasar por la funcion');
commit;
SQL
)
if printf '%s' "$SALIDA" | grep -qi "row-level security"; then
  echo "  ok   el insert directo de anon lo rechaza RLS"
elif printf '%s' "$SALIDA" | grep -qi "permission denied"; then
  echo "  MAL  fallo por PERMISOS y no por RLS: este caso no prueba la politica"
  fallo=1
else
  echo "  MAL  el insert directo de anon NO fallo: $SALIDA"
  fallo=1
fi
afirmar "filas tras el intento directo" "0" "$(q -c 'select count(*) from mensajes;')"

echo
echo "=== 2. El camino bueno ==="
afirmar "un mensaje valido" "ok" "$(enviar 'Ana Perez' 'ana@ejemplo.com' 'Hola, quiero saber si hay lugar los martes a la tarde.')"
afirmar "quedo guardado" "1" "$(q -c 'select count(*) from mensajes;')"
afirmar "el correo se guarda en minusculas" "ana@ejemplo.com" "$(q -c "select email from mensajes limit 1;")"

echo
echo "=== 3. Lo que la funcion rechaza, aunque el esquema de Zod ya haya pasado ==="
echo "    (es alcanzable por RPC con la clave publishable: es la capa que no se saltea)"
afirmar "nombre de un caracter" "nombre_invalido" "$(enviar 'A' 'a@ejemplo.com' 'Un mensaje suficientemente largo para pasar.')"
afirmar "correo sin arroba"     "email_invalido"  "$(enviar 'Ana Perez' 'no-es-un-correo' 'Un mensaje suficientemente largo para pasar.')"
afirmar "mensaje de 5 letras"   "mensaje_invalido" "$(enviar 'Ana Perez' 'a@ejemplo.com' 'corto')"
afirmar "nada se guardo de los tres" "1" "$(q -c 'select count(*) from mensajes;')"

echo
echo "=== 4. El limite por correo ==="
# Ana ya mando uno en la seccion 2. Faltan cuatro para llegar a cinco.
for i in 2 3 4 5; do
  R=$(enviar 'Ana Perez' 'ana@ejemplo.com' "Mensaje numero $i, con largo suficiente para pasar.")
  [ "$R" = "ok" ] || { echo "  MAL  el mensaje $i tendria que haber entrado y dio $R"; fallo=1; }
done
afirmar "cinco entraron" "5" "$(q -c "select count(*) from mensajes where email='ana@ejemplo.com';")"
afirmar "el sexto" "demasiados" "$(enviar 'Ana Perez' 'ana@ejemplo.com' 'Este es el sexto y no tendria que entrar.')"
afirmar "sigue habiendo cinco" "5" "$(q -c "select count(*) from mensajes where email='ana@ejemplo.com';")"

echo
echo "=== 5. El limite es POR CORREO, no global ==="
afirmar "otra persona puede escribir" "ok" "$(enviar 'Bea Gomez' 'bea@ejemplo.com' 'Hola, consulto por los horarios de la manana.')"

echo
echo "=== 6. La ventana es de una hora ==="
q -q -c "update mensajes set created_at = now() - interval '2 hours' where email='ana@ejemplo.com';"
afirmar "con los cinco viejos, Ana puede de nuevo" "ok" "$(enviar 'Ana Perez' 'ana@ejemplo.com' 'Pasaron dos horas y vuelvo a escribir.')"

echo
echo "=== 7. Quien puede LEER los mensajes ==="
ADMIN=$(q -q -tAc "insert into auth.users (email, raw_user_meta_data)
                   values ('admin@ejemplo.com','{\"nombre\":\"Admin\"}'::jsonb) returning id;" | head -1)
q -q -c "update perfiles set rol='admin' where id='$ADMIN';"
CLIENTE=$(q -q -tAc "insert into auth.users (email, raw_user_meta_data)
                     values ('cliente@ejemplo.com','{\"nombre\":\"Cliente\"}'::jsonb) returning id;" | head -1)
# El `select set_config(...)` imprime su propio valor, asi que la salida tiene
# dos lineas y la que interesa es la ULTIMA. La primera version usaba head -1 y
# comparaba el UUID contra un conteo.
como() { # como <uuid-o-vacio> <sql>
  psql -h 127.0.0.1 -p $PUERTO -U prueba -d v -tA -q <<SQL 2>/dev/null | tail -1 || true
begin;
set local role anon;
select set_config('request.jwt.claim.sub','$1',true);
$2
commit;
SQL
}
afirmar "anon sin sesion no ve ninguno" "0" "$(como '' 'select count(*) from mensajes;' )"
afirmar "una cuenta comun no ve ninguno" "0" "$(como "$CLIENTE" 'select count(*) from mensajes;')"
afirmar "administracion los ve todos" "$(q -c 'select count(*) from mensajes;')" "$(como "$ADMIN" 'select count(*) from mensajes;')"

echo
echo "=== 8. LOS DOS LADOS PIDEN LO MISMO ==="
echo "    (las constantes salen de app/lib/esquemas.js, no escritas aca)"
leer_constante() { grep -oE "^export const $1 = [0-9]+" "$RAIZ/app/lib/esquemas.js" | grep -oE '[0-9]+$'; }
MIN_NOMBRE=$(leer_constante MINIMO_NOMBRE_CONTACTO)
MAX_NOMBRE=$(leer_constante LARGO_NOMBRE_CONTACTO)
MIN_MENSAJE=$(leer_constante MINIMO_MENSAJE)
MAX_MENSAJE=$(leer_constante LARGO_MENSAJE)
echo "    leidas: nombre $MIN_NOMBRE..$MAX_NOMBRE   mensaje $MIN_MENSAJE..$MAX_MENSAJE"
for V in MIN_NOMBRE MAX_NOMBRE MIN_MENSAJE MAX_MENSAJE; do
  eval "VAL=\$$V"
  [ -n "$VAL" ] || { echo "  MAL  no pude leer $V de app/lib/esquemas.js"; fallo=1; }
done

rep() { python3 -c "import sys;print('x'*int(sys.argv[1]))" "$1"; }
# Se usa un correo nuevo en cada borde para no chocar con el limite por correo.
afirmar "nombre justo en el minimo"      "ok" "$(enviar "$(rep $MIN_NOMBRE)" 'b1@ejemplo.com' 'Mensaje con largo suficiente para pasar.')"
afirmar "nombre uno abajo del minimo"    "nombre_invalido" "$(enviar "$(rep $((MIN_NOMBRE - 1)))" 'b2@ejemplo.com' 'Mensaje con largo suficiente para pasar.')"
afirmar "nombre justo en el maximo"      "ok" "$(enviar "$(rep $MAX_NOMBRE)" 'b3@ejemplo.com' 'Mensaje con largo suficiente para pasar.')"
afirmar "nombre uno arriba del maximo"   "nombre_invalido" "$(enviar "$(rep $((MAX_NOMBRE + 1)))" 'b4@ejemplo.com' 'Mensaje con largo suficiente para pasar.')"
afirmar "mensaje justo en el minimo"     "ok" "$(enviar 'Ana Perez' 'b5@ejemplo.com' "$(rep $MIN_MENSAJE)")"
afirmar "mensaje uno abajo del minimo"   "mensaje_invalido" "$(enviar 'Ana Perez' 'b6@ejemplo.com' "$(rep $((MIN_MENSAJE - 1)))")"
afirmar "mensaje justo en el maximo"     "ok" "$(enviar 'Ana Perez' 'b7@ejemplo.com' "$(rep $MAX_MENSAJE)")"
afirmar "mensaje uno arriba del maximo"  "mensaje_invalido" "$(enviar 'Ana Perez' 'b8@ejemplo.com' "$(rep $((MAX_MENSAJE + 1)))")"

echo
[ $fallo -eq 0 ] && echo "TODO OK" || { echo "HAY FALLAS"; exit 1; }
