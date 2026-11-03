-- LIMPIEZA DE LOS DATOS DE PRUEBA DE LOS MODULOS 10 Y 11.
--
-- NO ES UNA MIGRACION. No va numerada y no describe el esquema: borra filas
-- que se crearon probando, y por eso vive aparte.
--
-- Cubre tres grupos: las clases de 2027, lo de las cuentas con '+' en el
-- correo, y los pagos de prueba de Mercado Pago, que son los unicos que se
-- hicieron con la cuenta REAL del estudio y por eso necesitan su propia
-- seccion. Correrlo dos veces no hace
-- daño, pero tampoco hay por que.
--
-- Se corre desde el editor SQL de Supabase, porque `clases` y `reservas` no
-- tienen politica de DELETE para nadie: eso es a proposito y esta explicado en
-- CLAUDE.md. Una politica de DELETE agregada para limpiar seria una puerta
-- nueva a la tabla que el candado de reservar_clase() protege.
--
-- COMO SE USA: correr primero la seccion 1 y LEER lo que devuelve. Si los
-- numeros son los esperados, correr la seccion 2. No correr las dos juntas sin
-- mirar: el dia que una clase real quede en 2027 este script se la lleva.

-- ---------------------------------------------------------------------------
-- 1. QUE SE VA A BORRAR. Solo lee, no cambia nada.
-- ---------------------------------------------------------------------------

-- Las clases de prueba se reconocen por la fecha: el estudio no tiene nada
-- cargado en 2027, y las de prueba estan a horas que no existen en la agenda
-- real (03:11, 04:05) justamente para que se distingan de un tiron.
select
  c.fecha,
  c.hora,
  c.estado,
  count(r.id) as reservas_colgando,
  count(r.credito_id) as creditos_enganchados
from clases c
left join reservas r on r.clase_id = c.id
where c.fecha >= date '2027-01-01'
group by c.fecha, c.hora, c.estado
order by c.fecha, c.hora;

-- Las cuentas de prueba. El correo real del estudio no lleva '+'.
select
  u.id,
  u.email,
  p.rol,
  (select count(*) from reservas r where r.user_id = u.id) as reservas,
  (select count(*) from creditos k where k.user_id = u.id) as creditos,
  (select count(*) from compras m where m.user_id = u.id) as compras
from auth.users u
left join perfiles p on p.id = u.id
where u.email like '%+%@%'
-- Por email y no por created_at: auth-de-mentira.sql, el auth.users de juguete
-- que usan las pruebas locales, no tiene created_at, y una consulta que solo
-- corre contra Supabase no se puede probar antes de correrla en serio.
order by u.email;

-- ---------------------------------------------------------------------------
-- 2. EL BORRADO. En este orden, porque las claves ajenas lo exigen.
-- ---------------------------------------------------------------------------

-- Freno: si alguna clase de 2027 tiene una reserva de una cuenta que NO es de
-- prueba, algo se entendio mal y conviene parar antes de borrarla.
do $$
declare
  ajenas integer;
begin
  select count(*) into ajenas
  from reservas r
  join clases c on c.id = r.clase_id
  join auth.users u on u.id = r.user_id
  where c.fecha >= date '2027-01-01'
    and u.email not like '%+%@%';

  if ajenas > 0 then
    raise exception
      'Hay % reserva(s) de cuentas que no son de prueba en clases de 2027. No se borra nada.',
      ajenas;
  end if;
end $$;

-- Las reservas primero: tienen clase_id y credito_id apuntando a lo que sigue.
delete from reservas r
using clases c
where c.id = r.clase_id
  and c.fecha >= date '2027-01-01';

delete from clases
where fecha >= date '2027-01-01';

-- EL ORDEN DE ESTOS TRES IMPORTA, Y LA PRIMERA VERSION LO TENIA MAL.
--
-- Borraba los creditos antes que las reservas, con el argumento de que los
-- creditos referencian la compra. Eso es cierto y es la razon por la que los
-- creditos van antes que `compras`, pero se olvidaba de la otra punta:
-- `reservas.credito_id` referencia `creditos` y NO TIENE accion de borrado.
--
-- Corriendolo contra datos de verdad fallo con 23503: una cuenta de prueba
-- tenia una reserva en una clase REAL —no de 2027, asi que los delete de
-- arriba no se la llevaron— usando uno de esos creditos. El arnes no lo
-- detectaba porque ninguno de sus tres casos ponia a una cuenta de prueba a
-- reservar en una clase que el script no borra.
--
-- Asi que primero las reservas, que son las que apuntan a los creditos.
delete from creditos
where user_id in (select id from auth.users where email like '%+%@%');

-- Despues los creditos, que apuntan a la compra.
delete from reservas
where user_id in (select id from auth.users where email like '%+%@%');

-- Y por ultimo las compras.
delete from compras
where user_id in (select id from auth.users where email like '%+%@%');

-- Las cuentas en si NO se borran desde aca. Van por Authentication -> Users en
-- el panel, de a una y mirando el correo: un `delete from auth.users` con un
-- `like` es la clase de consulta que un dia se lleva la cuenta del estudio
-- porque alguien le agrego un alias.

-- ---------------------------------------------------------------------------
-- 2.5. LOS DATOS DE PRUEBA DE MERCADO PAGO
-- ---------------------------------------------------------------------------
-- Estos no los alcanza el predicado de arriba, y conviene entender por que:
-- la compra de prueba del checkout se hizo con LA CUENTA REAL del estudio, que
-- no lleva '+' en el correo. Buscar "la cuenta de prueba" no sirve aca.
--
-- POR QUE UNA LISTA EXPLICITA Y NO UN PREDICADO. Se podria filtrar por fecha, o
-- por "compras sin reservas", o por monto. Todas esas reglas aciertan hoy y el
-- dia que haya pagos reales se llevan alguno. Un pago de prueba se reconoce
-- porque lo anotamos, no porque tenga una forma distinta.
--
-- Si se hacen mas pagos de prueba, se agregan sus id a esta lista.

-- Freno: `creditos.compra_id` es `on delete cascade`, asi que borrar la compra
-- se lleva sus creditos sola. Pero `reservas.credito_id` NO tiene accion de
-- borrado, asi que si alguna reserva uso uno de esos creditos, el delete falla
-- con un error de clave ajena. Postgres hace bien en negarse; esto lo dice con
-- palabras antes de que pase.
do $$
declare
  usados integer;
begin
  select count(*) into usados
  from reservas r
  join creditos k on k.id = r.credito_id
  join compras m on m.id = k.compra_id
  where m.mp_payment_id in ('186232108573', 'prueba-api-fecha-1');

  if usados > 0 then
    raise exception
      'Hay % reserva(s) hechas con creditos de pagos de prueba. Cancelalas primero (o borra esas reservas), porque reservas.credito_id no deja borrar el credito.',
      usados;
  end if;
end $$;

-- La compra primero: la cascada se lleva los creditos.
delete from compras
where mp_payment_id in ('186232108573', 'prueba-api-fecha-1');

-- Y las intenciones de pago, TODAS.
--
-- No hay forma de distinguir una intencion de prueba de una real mirando la
-- tabla: la intencion y la compra NO ESTAN RELACIONADAS en el esquema. El
-- vinculo existe solo del lado de Mercado Pago, en la external_reference del
-- pago. Esta anotado como observacion en docs/api.md.
--
-- Mientras el sitio no haya recibido un pago real, todas las intenciones son
-- de prueba, y por eso se borran sin filtro. El dia que haya pagos reales esta
-- linea hay que cambiarla por una lista explicita, igual que la de arriba.
delete from intenciones_de_pago;

-- ---------------------------------------------------------------------------
-- 3. COMPROBACION. Las tres cuentas tienen que dar cero.
-- ---------------------------------------------------------------------------
select
  (select count(*) from clases where fecha >= date '2027-01-01') as clases_2027,
  (select count(*) from reservas r join clases c on c.id = r.clase_id
     where c.fecha >= date '2027-01-01') as reservas_2027,
  (select count(*) from creditos
     where user_id in (select id from auth.users where email like '%+%@%')) as creditos_de_prueba,
  (select count(*) from compras
     where mp_payment_id in ('186232108573', 'prueba-api-fecha-1')) as pagos_de_prueba,
  (select count(*) from intenciones_de_pago) as intenciones;
