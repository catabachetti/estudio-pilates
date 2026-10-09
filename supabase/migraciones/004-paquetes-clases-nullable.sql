-- Permite que un paquete no tenga una cantidad fija de clases.
--
-- El "Mes libre" no acredita N clases: da acceso libre durante su vigencia. El
-- check (clases > 0) sigue valiendo para los demás, porque en SQL un null no
-- falla una restricción de verificación, la deja pasar. Queda entonces: o es un
-- entero positivo, o es acceso libre.

alter table paquetes alter column clases drop not null;
