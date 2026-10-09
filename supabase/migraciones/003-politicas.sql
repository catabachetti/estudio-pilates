-- Funciones auxiliares y las 19 políticas de Row Level Security.
-- Las tablas nacen con RLS activa, así que sin estas políticas no devuelven nada.

create function public.es_admin()
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- Cuenta reservas ajenas sin permitir verlas: devuelve solo el número.
create function public.lugares_disponibles(p_clase_id uuid)
returns integer
language sql
security definer set search_path = ''
stable
as $$
  select c.cupo_total - (
    select count(*) from public.reservas r
    where r.clase_id = c.id and r.estado = 'confirmada'
  )
  from public.clases c
  where c.id = p_clase_id;
$$;

-- CATÁLOGO: lectura pública, escritura solo admin.
create policy "catalogo visible" on tipos_clase for select using (true);
create policy "catalogo visible" on instructoras for select using (true);
create policy "catalogo visible" on paquetes    for select using (true);
create policy "catalogo visible" on clases      for select using (true);

create policy "admin edita" on tipos_clase for all
  using (public.es_admin()) with check (public.es_admin());
create policy "admin edita" on instructoras for all
  using (public.es_admin()) with check (public.es_admin());
create policy "admin edita" on paquetes for all
  using (public.es_admin()) with check (public.es_admin());
create policy "admin edita" on clases for all
  using (public.es_admin()) with check (public.es_admin());

-- PERFILES
create policy "ve su perfil" on perfiles for select
  using (id = auth.uid() or public.es_admin());
create policy "edita su perfil" on perfiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Sin esto, cualquiera podría ponerse rol = 'admin' a sí mismo.
revoke update on public.perfiles from authenticated;
grant update (nombre, telefono) on public.perfiles to authenticated;

-- COMPRAS: sin UPDATE, el estado lo cambia el webhook desde el servidor.
create policy "ve sus compras" on compras for select
  using (user_id = auth.uid() or public.es_admin());
create policy "crea su compra" on compras for insert
  with check (user_id = auth.uid());

-- CRÉDITOS: solo lectura. Los crea el servidor cuando el pago se aprueba.
create policy "ve sus creditos" on creditos for select
  using (user_id = auth.uid() or public.es_admin());

-- RESERVAS: sin DELETE. Cancelar cambia el estado y conserva el historial.
create policy "ve sus reservas" on reservas for select
  using (user_id = auth.uid() or public.es_admin());
create policy "crea su reserva" on reservas for insert
  with check (user_id = auth.uid());
create policy "cancela su reserva" on reservas for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- LISTA DE ESPERA: la única con DELETE. Bajarse no deja historial útil.
create policy "ve su espera" on lista_espera for select
  using (user_id = auth.uid() or public.es_admin());
create policy "se anota" on lista_espera for insert
  with check (user_id = auth.uid());
create policy "se baja" on lista_espera for delete
  using (user_id = auth.uid());
