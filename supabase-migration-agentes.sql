-- ============================================================
-- PropCRM — Migración: agentes (vendedores) ↔ auth.users + asignaciones
-- ============================================================
-- Ejecutar UNA VEZ en Supabase SQL Editor. Es idempotente.
--
-- Objetivo:
-- 1. Vincular cada agente con su cuenta de Supabase Auth (vendedores.user_id).
-- 2. Asegurar tablas M2M agente↔activo y agente↔comprador (ya existen en
--    supabase-schema.sql; se duplican con `if not exists` por si el proyecto
--    fue creado antes de esa versión del schema).
-- 3. Permitir que la tabla `notificaciones` reciba alertas dirigidas a agentes
--    (la tabla ya existe; aquí solo asegura columnas).

-- 1. vendedores.user_id (opcional, lookup por email si no está)
alter table public.vendedores
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_vendedores_user_id on public.vendedores(user_id);
create index if not exists idx_vendedores_email on public.vendedores(lower(email));

-- 2. Asignaciones (idempotentes)
create table if not exists public.vendedor_assets (
  vendedor_id text references public.vendedores(id) on delete cascade,
  asset_id    text references public.assets(id)    on delete cascade,
  assigned_at timestamptz default now(),
  primary key (vendedor_id, asset_id)
);

create table if not exists public.vendedor_compradores (
  vendedor_id   text references public.vendedores(id) on delete cascade,
  comprador_id  text references public.compradores(id) on delete cascade,
  assigned_at   timestamptz default now(),
  primary key (vendedor_id, comprador_id)
);

create index if not exists idx_vendedor_assets_vendor on public.vendedor_assets(vendedor_id);
create index if not exists idx_vendedor_assets_asset on public.vendedor_assets(asset_id);
create index if not exists idx_vendedor_compradores_vendor on public.vendedor_compradores(vendedor_id);
create index if not exists idx_vendedor_compradores_comprador on public.vendedor_compradores(comprador_id);

-- 3. RLS — solo admin escribe; los propios agentes pueden leer sus filas
alter table public.vendedor_assets enable row level security;
alter table public.vendedor_compradores enable row level security;

-- Borramos políticas previas con el mismo nombre para que el script sea
-- idempotente sin acumular versiones.
drop policy if exists "vendedor_assets_admin" on public.vendedor_assets;
drop policy if exists "vendedor_assets_self_read" on public.vendedor_assets;
drop policy if exists "vendedor_compradores_admin" on public.vendedor_compradores;
drop policy if exists "vendedor_compradores_self_read" on public.vendedor_compradores;

create policy "vendedor_assets_admin" on public.vendedor_assets
  for all using (public.is_admin());
create policy "vendedor_assets_self_read" on public.vendedor_assets
  for select using (
    vendedor_id in (select id from public.vendedores where user_id = auth.uid())
  );

create policy "vendedor_compradores_admin" on public.vendedor_compradores
  for all using (public.is_admin());
create policy "vendedor_compradores_self_read" on public.vendedor_compradores
  for select using (
    vendedor_id in (select id from public.vendedores where user_id = auth.uid())
  );
