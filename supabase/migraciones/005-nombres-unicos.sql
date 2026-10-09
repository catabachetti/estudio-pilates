-- Nombre único en instructoras y en paquetes.
--
-- El seed necesita poder correrse dos veces sin duplicar filas. Para tipos_clase
-- y clases eso ya lo garantiza la base, con el unique de slug y el de
-- (fecha, hora). Estas dos tablas no tenían nada, así que el seed las resolvía
-- con un WHERE NOT EXISTS: consulta y después inserta, y entre esas dos cosas
-- otra ejecución podría colarse e insertar lo mismo. Con la restricción, la
-- garantía queda en la base y no en el archivo que la carga.
--
-- Es además una regla de negocio cierta: no hay dos paquetes con el mismo
-- nombre ni dos instructoras homónimas en un estudio de tres personas.

alter table instructoras add constraint instructoras_nombre_unico unique (nombre);
alter table paquetes     add constraint paquetes_nombre_unico     unique (nombre);
