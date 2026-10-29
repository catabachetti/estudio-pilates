# Base de datos

El esquema vive en Supabase. Esta carpeta guarda el SQL que lo construye, para
poder rehacerlo desde cero y para que los cambios queden versionados en git.

## Reconstruir la base en un proyecto nuevo

En el SQL Editor de Supabase, en este orden:

1. `001-tablas.sql` — las nueve tablas iniciales y el trigger de perfil
2. `002-habilitar-rls.sql` — activa Row Level Security en las nueve
3. `003-politicas.sql` — las funciones auxiliares y las 19 políticas
4. `004-paquetes-clases-nullable.sql` — permite paquetes sin cantidad fija de clases
5. `005-nombres-unicos.sql` — nombre único en instructoras y paquetes
6. `006-campos-que-faltaban.sql` — columnas que el sitio ya mostraba y el esquema no tenía
7. `007-disponibilidad-del-dia.sql` — los turnos de una fecha con sus lugares libres, en una consulta
8. `008-mes-libre-fuera.sql` — saca el "Mes libre" y **revierte la 004**: `clases` vuelve a ser obligatorio
9. `009-clases-estado.sql` — cancelar una clase cambia su estado, no la borra
10. `010-creditos-y-busqueda.sql` — `buscar_persona()` y `otorgar_creditos()`, para el panel y el webhook
11. `011-reservar.sql` — la tabla `ajustes`, `reservar_clase()` y `cancelar_reserva()`
12. `012-intentos-de-ingreso.sql` — la tabla `intentos_ingreso` y el bloqueo progresivo
13. `seed.sql` — los datos iniciales

**La 008 revierte la 004 y las dos quedan.** Parece redundante y no lo es: una
migración ya aplicada no se edita ni se borra, porque el archivo describe lo que
realmente le pasó a la base. Una base nueva pasa por las dos y termina igual
que la de producción; si se borrara la 004, las dos historias dejarían de
coincidir.

**Las tablas son once, no nueve.** La 011 agregó `ajustes` y la 012
`intentos_ingreso`. `intentos_ingreso` tiene RLS activa y **cero políticas** a
propósito: nadie la lee ni la escribe desde el cliente, solo las funciones
`security definer`.

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

## El seed es para arrancar, no para mantener

`seed.sql` sirve para dejar una base vacía lista para usar. **Desde que exista el
panel de administración (E5), no se vuelve a correr.**

El motivo es que las tres tablas de catálogo usan `on conflict ... do update`:
el archivo es su fuente de verdad y sobrescribe lo que encuentre. Eso está bien
mientras el catálogo se edita acá, en git. Deja de estarlo en cuanto alguien
pueda cambiar un precio desde la web: la próxima corrida lo revierte sin avisar
y sin dejar rastro.

Si más adelante hace falta actualizar el catálogo de una base en uso, va en otro
archivo, con otro criterio: diciendo explícitamente qué campos pisa y cuáles
respeta. No en este.

`clases` es distinta y usa `do nothing`: de esas filas cuelgan las reservas de
las personas.

## Se puede correr más de una vez

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

`zsh supabase/validar-local.sh` levanta un Postgres descartable, imita el
esquema `auth` que Supabase trae de fábrica (`auth-de-mentira.sql`), corre las
doce migraciones y el seed dos veces, y después borra el cluster. No toca
Supabase ni ningún Postgres que tengas corriendo.

Al final comprueba y **falla ruidosamente** si no se cumple:

- que estén las once tablas,
- que las once tengan `relrowsecurity = true`,
- que las que no tienen políticas sean las que están cerradas a propósito.

Último resultado: las doce migraciones sin errores, 3 instructoras, 3 tipos de
clase, 4 paquetes y 304 clases iguales en las dos pasadas del seed, una reserva
creada entre medio que sobrevivió, y las once tablas con RLS.

Hay dos arneses más, con el mismo mecanismo:

| Script | Qué comprueba |
|---|---|
| `probar-reservas.sh` | las seis situaciones de `reservar_clase()` y `cancelar_reserva()`, incluida la carrera por el último lugar con dos transacciones reales |
| `probar-bloqueo.sh` | el bloqueo progresivo de la 012, con el techo en el exponente |
| `probar-limpieza.sh` | que `limpiar-datos-de-prueba.sql` frene cuando hay una reserva de una cuenta real, y que sin eso se lleve lo de prueba y nada más |

## Limpiar los datos de prueba

`limpiar-datos-de-prueba.sql` **no es una migración** y por eso no va numerada:
borra filas que quedaron de probar los módulos 10 y 11, no describe el esquema.

Se corre desde el editor SQL de Supabase, en dos pasos y mirando lo que
devuelve el primero. Tiene que correrse desde ahí porque `clases` y `reservas`
no tienen política de DELETE para nadie, y eso es a propósito: una política de
DELETE agregada para limpiar sería una puerta nueva a la tabla que el candado
de `reservar_clase()` protege.

Trae un freno: si alguna clase de 2027 tiene una reserva de una cuenta que no
es de prueba, corta con un `raise` y no borra nada. Las cuentas en sí no se
borran desde el SQL, van de a una por Authentication → Users, porque un
`delete from auth.users` con un `like` es la clase de consulta que un día se
lleva la cuenta del estudio porque alguien le agregó un alias.

La comprobación se probó al revés: salteando la 002 a propósito, corta con
`FALLA: estas tablas quedaron sin RLS: clases, compras, creditos, ...`.
