<!-- Lo que sigue es lo que de verdad se revisa antes de mergear en este
     proyecto, no una lista de buenos deseos. Si un ítem no aplica, se borra el
     renglón en vez de tildarlo: un checklist donde todo está tildado siempre
     deja de informar. -->

## Qué cambia y por qué

<!-- Una o dos frases. Si el cambio corrige una afirmación falsa que estaba
     escrita en el código o en un documento, decilo acá: en este proyecto pasó
     cuatro veces y es la clase de cosa que conviene que se vea en el diff. -->

## Siempre

- [ ] `npm test` en verde — es lint con `--max-warnings 0` más las tres pruebas de nodo, lo mismo que corre el job `estático y unitario`
- [ ] `npm run build` pasa **en un árbol sin `.env.local`**, si el cambio toca algo que se ejecute al compilar
- [ ] Los tres checks del CI en verde. Si están rojos, el motivo está leído y no adivinado
- [ ] Ninguna credencial en el diff: ni en el código, ni en un YAML, ni en un comentario

## Si toca la base de datos

- [ ] La migración está en `supabase/migraciones/` con su número y **explica por qué**, no solo qué
- [ ] **La migración está corrida en Supabase.** El código mergeado que depende de una migración que nadie aplicó deja producción roto sin que el CI lo note: los arneses corren contra un Postgres descartable, no contra el proyecto real
- [ ] `zsh supabase/validar-local.sh` en verde, incluido el guardia que cuenta tablas
- [ ] Si la tabla es nueva: tiene RLS activa, y **las políticas que le faltan es porque está cerrada a propósito**
- [ ] Si la escritura es nueva: ¿va por una función `security definer` o por una política? La respuesta está en el comentario de la migración
- [ ] Los siete arneses de `supabase/` en verde, no solo el que cubre lo nuevo

## Si toca seguridad o autorización

- [ ] `docs/seguridad.md` **sigue siendo cierto** después del cambio. No "se actualizó": se leyó y se verificó
- [ ] La verificación de rol está en la página **y** en la acción, no en un layout
- [ ] Si la pantalla muestra "mis cosas", filtra por `user_id` **aunque** la política diga `or es_admin()`
- [ ] Toda actualización termina en `.select()`, para distinguir "no tenía permiso" de "guardado"

## Si toca la interfaz

- [ ] Encabezados sin saltos de nivel, `label` asociado a cada campo, `alt` en cada imagen
- [ ] Probado a 1280, 900 y 500 px
- [ ] **Funciona con JavaScript desactivado.** Si no, el cambio necesita el argumento de por qué, y el argumento no es "es más cómodo"
- [ ] Si agrega un `'use client'`: están las dos demostraciones que pide `CLAUDE.md` —que no se puede con CSS, y que lo que se agrega no es funcional— y están escritas en el archivo

## Si toca las pruebas

- [ ] **Se vio fallar.** Una comprobación que nunca falló no se sabe si puede fallar
- [ ] Sin reintentos nuevos. Una prueba inestable es un hallazgo, no una molestia
- [ ] Si el conteo de la suite cambió, `docs/pruebas.md` lo dice con el número medido por `npx playwright test --list`

## Si el diff afirma algo

- [ ] La afirmación trae **el comando que la comprueba**, no la palabra "verificado". `grep -rn "useEffect" app/  # 0` se puede volver a correr; "no usamos useEffect" no
- [ ] Si cambia una afirmación de arquitectura, el `grep` que la respaldaba se corrió de nuevo y sigue dando lo mismo

<!-- Por qué el último grupo existe: las descripciones de arquitectura se
     desactualizan más rápido que la arquitectura, porque nada las compila ni
     las prueba. El README afirmó durante dos meses que había un carrito y un
     buscador que nunca existieron. Ver docs/prompts.md, 4 de noviembre. -->
