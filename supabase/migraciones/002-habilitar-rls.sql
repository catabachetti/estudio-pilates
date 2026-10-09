-- Activa Row Level Security en las nueve tablas.
--
-- Va antes de las políticas a propósito: `create policy` escribe la regla, pero
-- la regla solo rige si la tabla tiene RLS activada. Una tabla con políticas y
-- RLS apagada se lee y se escribe entera.
--
-- En el proyecto actual esto ya está activo, porque Supabase lo hizo al crear
-- las tablas desde el panel. Pero eso es una casilla de la interfaz y no vive en
-- ningún archivo: sin esta migración, reconstruir la base desde cero produciría
-- una base abierta. Los `alter table` son idempotentes, así que correrlo sobre
-- una base que ya los tiene no cambia nada.

alter table tipos_clase   enable row level security;
alter table instructoras  enable row level security;
alter table paquetes      enable row level security;
alter table clases        enable row level security;
alter table perfiles      enable row level security;
alter table compras       enable row level security;
alter table creditos      enable row level security;
alter table reservas      enable row level security;
alter table lista_espera  enable row level security;
