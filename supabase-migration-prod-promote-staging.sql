-- ============================================================
-- PropCRM — Promoción PRODUCCIÓN (SQL antes del merge)
-- Proyecto: ywvczogdjanhdnibzmfg
-- Pegar en: https://supabase.com/dashboard/project/ywvczogdjanhdnibzmfg/sql/new
-- NO aplicar supabase-dev-policies.sql
-- ============================================================

-- >>> FROM supabase-migration-feedback-cliente-staging.sql
-- ============================================================
-- PropCRM — Corrección feedback cliente (STAGING primero)
-- - assets.referencia
-- - assets.public_slug (URL pública opaca)
-- - eliminar CHECK CDR/NPL en propiedades.categoria
-- - preflight RPC + reload PostgREST
-- Idempotente. APROBADO para prod — promoción staging→main.
-- ============================================================

-- 1) Columna referencia (mapper assetToRow ya la envía)
alter table public.assets
  add column if not exists referencia text default '';

update public.assets
set referencia = coalesce(nullif(trim(referencia), ''), split_part(id, '__', 2), id)
where referencia is null or trim(referencia) = '';

-- 2) public_slug único para URLs /portal/inmueble/[slug]
alter table public.assets
  add column if not exists public_slug text;

-- Backfill estable: tip-pob + sufijo opaco derivado del id (sin catastral en claro)
update public.assets a
set public_slug = lower(
  regexp_replace(
    regexp_replace(
      coalesce(nullif(trim(a.tip), ''), 'inmueble') || '-' ||
      coalesce(nullif(trim(a.pob), ''), 'espana') || '-' ||
      substr(md5(a.id), 1, 6),
      '[^a-z0-9]+', '-', 'g'
    ),
    '(^-|-$)', '', 'g'
  )
)
where a.public_slug is null or trim(a.public_slug) = '';

-- Resolver colisiones residuales añadiendo más hash
do $$
declare
  r record;
  n int;
  candidate text;
begin
  for r in
    select id, public_slug
    from public.assets
    where public_slug in (
      select public_slug from public.assets group by public_slug having count(*) > 1
    )
  loop
    n := 0;
    loop
      n := n + 1;
      candidate := r.public_slug || '-' || substr(md5(r.id || n::text), 1, 4);
      exit when not exists (
        select 1 from public.assets where public_slug = candidate and id <> r.id
      );
    end loop;
    update public.assets set public_slug = candidate where id = r.id;
  end loop;
end $$;

alter table public.assets
  alter column public_slug set not null;

create unique index if not exists idx_assets_public_slug
  on public.assets (public_slug);

-- 3) Categoría libre (OCUPADO, CDR, NPL, …)
alter table public.propiedades
  drop constraint if exists propiedades_categoria_check;

alter table public.propiedades
  alter column categoria set default 'CDR';

-- 4) Preflight para el importador (fail-fast antes de escribir)
create or replace function public.import_schema_preflight()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  errs text[] := '{}';
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assets' and column_name = 'referencia'
  ) then
    errs := array_append(errs, 'Falta columna assets.referencia');
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assets' and column_name = 'public_slug'
  ) then
    errs := array_append(errs, 'Falta columna assets.public_slug');
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'propiedades_categoria_check'
  ) then
    errs := array_append(errs, 'Constraint propiedades_categoria_check aún activa (bloquea OCUPADO)');
  end if;

  return jsonb_build_object(
    'ok', coalesce(array_length(errs, 1), 0) is null or coalesce(array_length(errs, 1), 0) = 0,
    'errors', to_jsonb(errs)
  );
end;
$$;

grant execute on function public.import_schema_preflight() to anon, authenticated, service_role;

-- 5) Recargar schema cache de PostgREST
notify pgrst, 'reload schema';

-- >>> FROM supabase-migration-comprador-acceso.sql
-- Acceso manual al portal privado (validación admin / futuro NDA).
-- Valores: 'sin_acceso' | 'activo'
-- Ejecutar en Supabase SQL Editor.

alter table public.compradores
  add column if not exists acceso text not null default 'activo';

alter table public.compradores
  drop constraint if exists compradores_acceso_check;

alter table public.compradores
  add constraint compradores_acceso_check
  check (acceso in ('sin_acceso', 'activo'));

-- Altas nuevas vía app usan sin_acceso; el default 'activo' protege filas legacy.
comment on column public.compradores.acceso is
  'Portal privado: sin_acceso hasta activación manual del admin; activo = acceso permitido.';

-- >>> FROM supabase-migration-ofertas-vendedor.sql
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

-- >>> Verificación final
select 'assets.public_slug' as check, count(*)::text as n
from information_schema.columns
where table_schema='public' and table_name='assets' and column_name='public_slug'
union all
select 'compradores.acceso', count(*)::text
from information_schema.columns
where table_schema='public' and table_name='compradores' and column_name='acceso'
union all
select 'ofertas.vendedor_id', count(*)::text
from information_schema.columns
where table_schema='public' and table_name='ofertas' and column_name='vendedor_id';
