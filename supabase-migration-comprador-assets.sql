-- =====================================================================
-- Migration: comprador_assets (compartir activos con clientes)
-- =====================================================================
-- Esta tabla guarda qué activos están compartidos con qué clientes.
-- Está definida en supabase-schema.sql pero falta aplicarla en la
-- instancia. Sin ella, "Compartir con cliente" en /admin falla con
-- "Could not find the table 'public.comprador_assets'".
--
-- Aplicar en Supabase Dashboard → SQL Editor → Run.
-- Es idempotente (if not exists / drop policy if exists), seguro
-- de ejecutar varias veces.
-- =====================================================================

-- 1) Tabla
create table if not exists public.comprador_assets (
  comprador_id text references public.compradores(id) on delete cascade,
  asset_id     text references public.assets(id)      on delete cascade,
  invited_at   timestamptz default now(),
  invited_by   text default 'Admin',
  primary key (comprador_id, asset_id)
);

-- 2) Índices
create index if not exists idx_comprador_assets_comprador
  on public.comprador_assets(comprador_id);
create index if not exists idx_comprador_assets_asset
  on public.comprador_assets(asset_id);

-- 3) Row-Level Security
alter table public.comprador_assets enable row level security;

drop policy if exists "comprador_assets_admin"       on public.comprador_assets;
drop policy if exists "comprador_assets_client_read" on public.comprador_assets;

create policy "comprador_assets_admin"
  on public.comprador_assets
  for all using (public.is_admin());

create policy "comprador_assets_client_read"
  on public.comprador_assets
  for select using (
    comprador_id in (
      select id from public.compradores where user_id = auth.uid()
    )
  );

-- =====================================================================
-- Mientras estás aquí, conviene aplicar también las dos tablas hermanas
-- que están en el schema y comparten el mismo gap (favoritos y
-- vendedor_assets / vendedor_compradores). Si ya existen, los
-- "if not exists" hacen no-op.
-- =====================================================================

create table if not exists public.comprador_favoritos (
  comprador_id text references public.compradores(id) on delete cascade,
  asset_id     text references public.assets(id)      on delete cascade,
  created_at   timestamptz default now(),
  primary key (comprador_id, asset_id)
);

create index if not exists idx_comprador_favoritos_comprador
  on public.comprador_favoritos(comprador_id);
create index if not exists idx_comprador_favoritos_asset
  on public.comprador_favoritos(asset_id);

alter table public.comprador_favoritos enable row level security;

drop policy if exists "comprador_favoritos_owner" on public.comprador_favoritos;
create policy "comprador_favoritos_owner"
  on public.comprador_favoritos
  for all using (
    comprador_id in (
      select id from public.compradores where user_id = auth.uid()
    )
  );
