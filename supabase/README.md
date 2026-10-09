# Base de datos

El esquema vive en Supabase. Esta carpeta guarda el SQL que lo construye, para
poder rehacerlo desde cero y para que los cambios queden versionados en git.

## Reconstruir la base en un proyecto nuevo

En el SQL Editor de Supabase, en este orden:

1. `migraciones/001-tablas.sql` — las nueve tablas y el trigger de perfil
2. `migraciones/002-habilitar-rls.sql` — activa Row Level Security en las nueve
3. `migraciones/003-politicas.sql` — las funciones auxiliares y las 19 políticas
4. `migraciones/004-paquetes-clases-nullable.sql` — permite paquetes sin cantidad fija de clases
5. `migraciones/005-nombres-unicos.sql` — nombre único en instructoras y paquetes
6. `seed.sql` — los datos iniciales

**El orden numérico es el orden de ejecución.** Cada migración asume el estado
que dejó la anterior: las políticas no se pueden crear sobre tablas que no
existen, y activar RLS después de escribir las políticas deja una ventana en la
que las reglas están pero no rigen. Por eso el `enable` va en la 002 y las
políticas en la 003.

Los archivos se renumeraron cuando se agregó el `enable`: lo que antes era la
002 ahora es la 003, y así. En una base ya construida eso no cambia nada, porque
los cuatro archivos originales ya se habían ejecutado; el orden nuevo es el que
hay que seguir para levantar un proyecto desde cero.

Las migraciones ya aplicadas no se editan: si hace falta cambiar algo, se agrega
una migración nueva con el número siguiente. Editar una vieja hace que el
archivo deje de describir lo que realmente pasó en la base.

## El seed se puede correr más de una vez

`seed.sql` no borra nada. Cada INSERT es idempotente: o agrega la fila que
falta, o la deja como está.

No hay ningún `delete from` a propósito. `reservas.clase_id` referencia a
`clases` con `on delete cascade`, así que vaciar `clases` no daría error: se
llevaría las reservas de las personas en silencio.

Cómo evita duplicar cada tabla:

| Tabla | Mecanismo | Por qué |
|---|---|---|
| `tipos_clase` | `on conflict (slug) do nothing` | `slug` es unique |
| `clases` | `on conflict (fecha, hora) do nothing` | la tabla tiene `unique (fecha, hora)` |
| `instructoras` | `on conflict (nombre) do nothing` | `nombre` es unique desde la 004 |
| `paquetes` | `on conflict (nombre) do nothing` | `nombre` es unique desde la 004 |

Correrlo de nuevo una semana después deja intactas las clases viejas con sus
reservas y agrega solo los días nuevos del final de las ocho semanas.

## Por qué existe la migración 002

En el proyecto actual las nueve tablas ya tienen RLS activa: Supabase la activó
al crearlas desde el panel. Pero eso fue una casilla de la interfaz y no vive en
ningún archivo, así que las migraciones por sí solas producían una base abierta.

`create policy` escribe la regla; `alter table ... enable row level security` la
pone en vigencia. Una tabla con políticas y RLS apagada se lee y se escribe
entera. Los `alter table` son idempotentes: sobre la base actual no cambian
nada.

## Verificado localmente

`zsh supabase/validar-local.sh` levanta un Postgres descartable en el puerto
55433, imita el esquema `auth` que Supabase trae de fábrica (`auth-de-mentira.sql`),
corre las cinco migraciones y el seed dos veces, y después borra el cluster. No
toca Supabase ni ningún Postgres que tengas corriendo.

Al final comprueba y **falla ruidosamente** si no se cumple:

- que haya exactamente nueve tablas,
- que las nueve tengan `relrowsecurity = true`,
- que ninguna quede sin políticas.

Último resultado: las cinco migraciones sin errores, 3 instructoras, 3 tipos de
clase, 5 paquetes y 304 clases iguales en las dos pasadas del seed, una reserva
creada entre medio que sobrevivió, y las nueve tablas con RLS y políticas.

La comprobación se probó al revés: salteando la 002 a propósito, corta con
`FALLA: estas tablas quedaron sin RLS: clases, compras, creditos, ...`.
