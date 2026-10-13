-- El "Mes libre" sale del catálogo, y `clases` vuelve a ser obligatorio.
--
-- POR QUÉ SALE: era el único paquete que no encajaba en el modelo de créditos.
-- No acredita N clases, da acceso libre durante su vigencia, y eso obligaba a
-- un caso especial en tres lugares distintos:
--
--   el panel          un campo "clases" que a veces se deja vacío
--   la reserva        preguntar "¿tiene créditos, o tiene mes libre?" en vez
--                     de "¿le queda algún crédito?"
--   el webhook de MP  no sabría cuántos créditos crear al aprobarse el pago
--
-- A cuatro semanas de la entrega, un modelo coherente vale más que dos a
-- medias. Queda como alcance descartado, no como olvido: si el estudio lo
-- vuelve a vender, no vuelve como un null en esta columna. Vuelve como su
-- propio concepto, una suscripción con fecha de inicio y de fin.
--
-- Esto revierte la 004, que había hecho `clases` nullable solo por este caso.

begin;

-- Red de seguridad. `compras.paquete_id` referencia a `paquetes` sin cascade,
-- así que la base ya rechazaría el delete si alguien compró este paquete, pero
-- con un error de clave ajena que no explica qué hacer. Esto corta antes y
-- dice el número. Corre con los permisos de quien ejecuta el archivo, no con
-- los de una sesión, así que RLS no le esconde filas y el conteo es real.
do $$
declare
  compradas integer;
begin
  select count(*) into compradas
  from public.compras c
  join public.paquetes p on p.id = c.paquete_id
  where p.clases is null;

  if compradas > 0 then
    raise exception
      'Hay % compra(s) de un paquete sin cantidad de clases. No se borra nada: primero hay que decidir qué pasa con esas personas.',
      compradas;
  end if;
end $$;

-- Se borra por la forma del dato, no por el nombre: lo que no encaja en el
-- modelo es "paquete sin cantidad de clases". Si alguien lo hubiera renombrado
-- desde el panel de Supabase, buscar 'Mes libre' no lo encontraría y el
-- `set not null` de abajo fallaría sin razón aparente.
delete from paquetes where clases is null;

-- Y ahora que ningún paquete necesita el null, la columna vuelve a exigir un
-- número. No es cosmético: el panel tiene un campo "clases" y, con la columna
-- nullable, dejarlo vacío guardaba null en silencio y el paquete se convertía
-- en acceso libre por accidente, resucitando justo el caso que acabamos de
-- sacar. Ahora lo rechaza la base, que es el único lugar donde la regla no se
-- puede olvidar.
alter table paquetes alter column clases set not null;

commit;
