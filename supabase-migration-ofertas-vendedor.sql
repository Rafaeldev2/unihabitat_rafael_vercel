-- Ofertas registradas por agente (vendedor): vendedor_id, comprador opcional.
-- Aplicar solo en Supabase STAGING hasta OK del cliente. No prod.

-- 1) Columna agente
alter table public.ofertas
  add column if not exists vendedor_id text references public.vendedores(id) on delete set null;

-- 2) Quitar unique antiguo (nombre por defecto Postgres)
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.ofertas'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) ilike '%comprador_id%'
    and pg_get_constraintdef(oid) ilike '%asset_id%';
  if cname is not null then
    execute format('alter table public.ofertas drop constraint %I', cname);
  end if;
end $$;

-- También por si era un índice unique con nombre distinto
drop index if exists public.ofertas_comprador_id_asset_id_key;

-- 3) Uniques parciales
create unique index if not exists ofertas_comprador_asset_uidx
  on public.ofertas (comprador_id, asset_id)
  where comprador_id is not null;

create unique index if not exists ofertas_vendedor_asset_uidx
  on public.ofertas (vendedor_id, asset_id)
  where vendedor_id is not null;

-- 4) Al menos un actor
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ofertas'::regclass
      and conname = 'ofertas_actor_chk'
  ) then
    alter table public.ofertas
      add constraint ofertas_actor_chk
      check (comprador_id is not null or vendedor_id is not null);
  end if;
end $$;

create index if not exists idx_ofertas_vendedor on public.ofertas (vendedor_id);
