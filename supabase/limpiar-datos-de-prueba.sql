-- LIMPIEZA DE LOS DATOS DE PRUEBA DE LOS MODULOS 10 Y 11.
--
-- NO ES UNA MIGRACION. No va numerada y no describe el esquema: borra filas
-- que se crearon probando, y por eso vive aparte. Correrlo dos veces no hace
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

-- Los creditos y las compras de las cuentas de prueba. Los creditos antes, que
-- son los que referencian la compra.
delete from creditos
where user_id in (select id from auth.users where email like '%+%@%');

delete from compras
where user_id in (select id from auth.users where email like '%+%@%');

-- Las reservas que esas cuentas tengan en clases reales, si quedo alguna.
delete from reservas
where user_id in (select id from auth.users where email like '%+%@%');

-- Las cuentas en si NO se borran desde aca. Van por Authentication -> Users en
-- el panel, de a una y mirando el correo: un `delete from auth.users` con un
-- `like` es la clase de consulta que un dia se lleva la cuenta del estudio
-- porque alguien le agrego un alias.

-- ---------------------------------------------------------------------------
-- 3. COMPROBACION. Las tres cuentas tienen que dar cero.
-- ---------------------------------------------------------------------------
select
  (select count(*) from clases where fecha >= date '2027-01-01') as clases_2027,
  (select count(*) from reservas r join clases c on c.id = r.clase_id
     where c.fecha >= date '2027-01-01') as reservas_2027,
  (select count(*) from creditos
     where user_id in (select id from auth.users where email like '%+%@%')) as creditos_de_prueba;
