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
# Se matan los servidores que arranco ESTE arnes, y solo esos: se guardan los
# PID en vez de buscarlos por puerto.
PIDS=()
trap 'for p in $PIDS; do kill $p 2>/dev/null || true; done; rm -rf "$S"' EXIT
PROD='clave-modo-productivo-de-prueba-local'
PRUE='clave-modo-de-prueba-de-prueba-local'

# UN PUERTO POR CASO, y no uno solo que se reusa matando al anterior.
#
# La version anterior buscaba al servidor viejo con `lsof` para matarlo. Tenia
# dos problemas, y el segundo es grave:
#
#   - `lsof` no esta garantizado en un runner de CI. En macOS vive en
#     /usr/sbin.
#   - Cuando no estaba, no mataba nada, el `next start` nuevo no podia tomar el
#     puerto ocupado... y el curl de espera igual contestaba, porque contestaba
#     el servidor VIEJO. El arnes seguia adelante y probaba un servidor con
#     otras claves SIN AVISAR.
#
# Lo segundo es un arnes que mide otra cosa, que es el peor tipo de prueba.
# Medido escondiendo `lsof` del PATH: el caso A pasa entero y los otros tres
# fallan contra las claves del A. Se vio primero como un fallo del CI.
#
# Con un puerto por caso no hay nada que matar, no hace falta `lsof`, y si un
# servidor no arranca el arnes CORTA en vez de seguir midiendo.
PUERTO=3000
arrancar() {  # recibe las asignaciones como ARGUMENTOS SEPARADOS, no como un
              # string: zsh no divide $1 en palabras y env lo tomaria como una
              # sola asignacion con espacios adentro.
  PUERTO=$((PUERTO + 1))
  # Si algo ya contesta ahi —un servidor olvidado de una corrida anterior— se
  # pasa al siguiente puerto, porque pegarle a ese seria medir otra cosa.
  #
  # SIN -f, Y ES IMPORTANTE. `curl -sf` falla con cualquier codigo >= 400, asi
  # que no distingue "no hay servidor" (conexion rechazada, codigo 7) de
  # "servidor que contesta 500" (codigo 22). Y aca TODAS las paginas contestan
  # 500, porque el sitio corre sin variables de Supabase a proposito. Sin -f,
  # curl devuelve 0 en cuanto hubo una respuesta HTTP, que es exactamente la
  # pregunta: ¿hay un servidor atendiendo?
  while curl -s -o /dev/null "http://localhost:$PUERTO/" 2>/dev/null; do
    PUERTO=$((PUERTO + 1))
  done
  U="http://localhost:$PUERTO/api/webhooks/mercadopago"
  L="$S/srv-$PUERTO.log"   # un registro por caso: truncar uno compartido
                           # mientras el servidor anterior lo tiene abierto deja
                           # el archivo hecho un nudo.
  : > $L
  env "$@" nohup npx next start -p $PUERTO > $L 2>&1 &
  PIDS+=($!)
  for i in $(seq 1 60); do curl -s -o /dev/null "http://localhost:$PUERTO/" && break; sleep 1; done
  # El freno que faltaba. Sin esto, un servidor que no arranca no se nota.
  curl -s -o /dev/null "http://localhost:$PUERTO/" || {
    echo "    el servidor de este caso no contesta en $PUERTO. Registro:"
    sed 's/^/      /' $L
    exit 1
  }
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
grep -o 'OJO: solo está configurada la clave de modo [a-z]*' $L | tail -1 | sed 's/^/      /'

echo "=== B. las dos (como queda ahora) ==="
arrancar "MP_WEBHOOK_SECRET=$PROD" "MP_WEBHOOK_SECRET_PRUEBA=$PRUE"
probar "firmado con la productiva" "$PROD" 200
probar "firmado con la de prueba" "$PRUE" 200
probar "firmado con una tercera" "clave-ajena" 401
echo "    modos que registro el servidor:"
grep -o 'firma válida (modo [a-z]*)' $L | sort | uniq -c | sed 's/^/      /'
echo "    y con una tercera NO dice que falte configuracion:"
if grep -q 'OJO: solo' $L; then echo "      MAL: lo dijo con las dos cargadas"; echo FALLO >> $S/fallos.txt
else echo "      correcto, no lo dice"; fi

echo "=== C. solo la de prueba ==="
arrancar "MP_WEBHOOK_SECRET=" "MP_WEBHOOK_SECRET_PRUEBA=$PRUE"
probar "firmado con la de prueba" "$PRUE" 200
probar "firmado con la productiva" "$PROD" 401

echo "=== D. ninguna ==="
arrancar "MP_WEBHOOK_SECRET=" "MP_WEBHOOK_SECRET_PRUEBA="
probar "firmado con cualquiera" "$PROD" 500
echo "    ^ 500 a proposito: MP reintenta y el pago no se pierde"
grep -o 'NO HAY NINGUNA CLAVE DE FIRMA configurada' $L | head -1 | sed 's/^/      /'

echo
[ -s $S/fallos.txt ] && { echo "$(wc -l < $S/fallos.txt | tr -d ' ') caso(s) MAL"; exit 1; } || echo "TODO OK"
