-- Columnas que el sitio ya mostraba y el esquema no tenía.
--
-- Al migrar las páginas a la base aparecieron tres datos que vivían solo en
-- app/datos/contenido.js y no tenían dónde guardarse. Sin estas columnas, ese
-- archivo no se puede borrar y el sitio queda leyendo mitad de la base y mitad
-- del código, que es justo lo que la migración viene a terminar.
--
--   imagen_alt   el texto alternativo de cada foto. No es decorativo: sin él,
--                quien usa lector de pantalla no sabe qué muestra la imagen.
--                Hoy la página de clases lo reemplaza por el nombre de la
--                clase, que es peor.
--   que_llevar   los tres ítems de la ficha del detalle. Va como arreglo de
--                texto porque son una lista, no una frase.
--   incluye      la descripción corta de cada paquete en su tarjeta.

alter table tipos_clase add column imagen_alt text;
alter table tipos_clase add column que_llevar text[];
alter table paquetes    add column incluye text;
