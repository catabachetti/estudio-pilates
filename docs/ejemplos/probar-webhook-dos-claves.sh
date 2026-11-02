#!/bin/zsh
# Comprueba que el webhook acepte las DOS claves de firma de Mercado Pago.
#
# POR QUE EXISTE ESTE ARCHIVO: Mercado Pago tiene una clave secreta distinta
# por modo, "Modo productivo" y "Modo de prueba", y los avisos de pagos hechos
# con cuentas de prueba llegan firmados con la de Modo de prueba —aunque el
# pago diga live_mode: true y aunque la URL este cargada en el campo de modo
# productivo. Con solo la productiva cargada, cada aviso daba 401 y el credito
# no se acreditaba. El caso A de abajo reproduce ese estado.
#
# Levanta el sitio compilado con distintas combinaciones de claves y firma con
# una o con otra. Usa type=merchant_order, que el handler ignora ANTES de
# escribir: no acredita nada ni toca la base.
#
# Uso: npm run build && zsh docs/ejemplos/probar-webhook-dos-claves.sh
set -e
S="$(mktemp -d)"
trap 'rm -rf "$S"' EXIT
PROD='clave-modo-productivo-de-prueba-local'
PRUE='clave-modo-de-prueba-de-prueba-local'
U='http://localhost:3001/api/webhooks/mercadopago'

arrancar() {  # recibe las asignaciones como ARGUMENTOS SEPARADOS, no como un
              # string: zsh no divide $1 en palabras y env lo tomaria como una
              # sola asignacion con espacios adentro.
  local PID=$(lsof -nP -iTCP:3001 -sTCP:LISTEN -t 2>/dev/null)
  [ -n "$PID" ] && kill $PID
  for i in $(seq 1 20); do lsof -nP -iTCP:3001 -sTCP:LISTEN >/dev/null 2>&1 || break; sleep 0.5; done
  : > $S/srv.log
  env "$@" nohup npx next start -p 3001 >$S/srv.log 2>&1 &
  for i in $(seq 1 60); do curl -sf -o /dev/null http://localhost:3001/ && break; sleep 1; done
}

probar() {  # $1=etiqueta  $2=clave  $3=esperado
  python3 -c "
import hmac, hashlib, time, uuid, sys
rid, ts = str(uuid.uuid4()), str(int(time.time()))
man = f'id:999;request-id:{rid};ts:{ts};'
print(rid); print('ts=' + ts + ',v1=' + hmac.new(sys.argv[1].encode(), man.encode(), hashlib.sha256).hexdigest())" "$2" > $S/sig.txt
  local RID=$(sed -n 1p $S/sig.txt) SIG=$(sed -n 2p $S/sig.txt)
  local C=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$U?data.id=999&type=merchant_order" \
    -H "x-signature: $SIG" -H "x-request-id: $RID" -H 'Content-Type: application/json' -d '{"type":"merchant_order"}')
  printf '    %-34s -> %s%s\n' "$1" "$C" "$([ "$C" = "$3" ] && echo '' || echo "   MAL, esperaba $3")"
  [ "$C" = "$3" ] || echo FALLO >> $S/fallos.txt
}

: > $S/fallos.txt
# Las dos vacias a proposito en cada caso que no las quiere: una variable vacia
# cuenta como no configurada, y el entorno del proceso le gana a .env.local,
# que SI trae MP_WEBHOOK_SECRET.
echo "=== A. solo la clave productiva (el estado que perdio el pago) ==="
arrancar "MP_WEBHOOK_SECRET=$PROD" "MP_WEBHOOK_SECRET_PRUEBA="
probar "firmado con la productiva" "$PROD" 200
probar "firmado con la de prueba" "$PRUE" 401
echo "    ^ ese 401 es el sintoma exacto. Lo que dijo el registro:"
grep -o 'OJO: solo está configurada la clave de modo [a-z]*' $S/srv.log | tail -1 | sed 's/^/      /'

echo "=== B. las dos (como queda ahora) ==="
arrancar "MP_WEBHOOK_SECRET=$PROD" "MP_WEBHOOK_SECRET_PRUEBA=$PRUE"
probar "firmado con la productiva" "$PROD" 200
probar "firmado con la de prueba" "$PRUE" 200
probar "firmado con una tercera" "clave-ajena" 401
echo "    modos que registro el servidor:"
grep -o 'firma válida (modo [a-z]*)' $S/srv.log | sort | uniq -c | sed 's/^/      /'
echo "    y con una tercera NO dice que falte configuracion:"
if grep -q 'OJO: solo' $S/srv.log; then echo "      MAL: lo dijo con las dos cargadas"; echo FALLO >> $S/fallos.txt
else echo "      correcto, no lo dice"; fi

echo "=== C. solo la de prueba ==="
arrancar "MP_WEBHOOK_SECRET=" "MP_WEBHOOK_SECRET_PRUEBA=$PRUE"
probar "firmado con la de prueba" "$PRUE" 200
probar "firmado con la productiva" "$PROD" 401

echo "=== D. ninguna ==="
arrancar "MP_WEBHOOK_SECRET=" "MP_WEBHOOK_SECRET_PRUEBA="
probar "firmado con cualquiera" "$PROD" 500
echo "    ^ 500 a proposito: MP reintenta y el pago no se pierde"
grep -o 'NO HAY NINGUNA CLAVE DE FIRMA configurada' $S/srv.log | head -1 | sed 's/^/      /'

echo
[ -s $S/fallos.txt ] && { echo "$(wc -l < $S/fallos.txt | tr -d ' ') caso(s) MAL"; exit 1; } || echo "TODO OK"
