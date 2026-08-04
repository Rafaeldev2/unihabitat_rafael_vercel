-- ============================================================
-- PropCRM — Corrección feedback cliente (STAGING primero)
-- - assets.referencia
-- - assets.public_slug (URL pública opaca)
-- - eliminar CHECK CDR/NPL en propiedades.categoria
-- - preflight RPC + reload PostgREST
-- Idempotente. NO aplicar en producción sin aprobación.
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
