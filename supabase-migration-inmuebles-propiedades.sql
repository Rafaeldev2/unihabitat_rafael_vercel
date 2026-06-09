-- ============================================================
-- PropCRM — Migración: separar inmuebles (assets) de propiedades
-- ============================================================
-- Modelo nuevo:
--   assets       = INMUEBLE físico (1 fila por Referencia catastral única).
--                  Campos: dirección, geo, catastrales, tipología, descripción,
--                  precio representativo, flag de publicación.
--   propiedades  = CARGA / lien / colateral. N filas por inmueble.
--                  Campos: propietario del préstamo, deuda, fase judicial,
--                  identificadores del sistema origen (Collateral ID, Prinex,
--                  ID Property), portfolio, stage status.
--
-- Decisión confirmada: TRUNCATE de datos legacy. Compradores, vendedores,
-- tareas y notificaciones SE CONSERVAN.
-- ============================================================

-- 1. LIMPIAR DATOS LEGACY (cascade limpia FKs: mensajes, notas, documentos,
--    oportunidades, ofertas, comprador_assets, comprador_favoritos,
--    vendedor_assets) — TODOS los ids actuales son de proveedores antiguos
--    (UF/NDG/Asset ID) y no encajan con el nuevo esquema (PK = Referencia).
-- ============================================================
truncate table public.assets cascade;

-- 2. ELIMINAR COLUMNAS DE assets QUE SE MUEVEN A propiedades
-- ============================================================
-- Campos del préstamo / propietario / categoría / fase: pasan a propiedades.
alter table public.assets drop column if exists cat;
alter table public.assets drop column if exists fase;
alter table public.assets drop column if exists fase_c;
alter table public.assets drop column if exists owner_name;
alter table public.assets drop column if exists owner_tel;
alter table public.assets drop column if exists owner_mail;

-- cat_ref desaparece: assets.id ES la Referencia catastral.
drop index if exists idx_assets_cat_ref;
alter table public.assets drop column if exists cat_ref;

-- Sub-objeto AssetAdmin: todos sus campos van a propiedades.
alter table public.assets drop column if exists adm_pip;
alter table public.assets drop column if exists adm_lin;
alter table public.assets drop column if exists adm_cat;
alter table public.assets drop column if exists adm_car;
alter table public.assets drop column if exists adm_cli;
alter table public.assets drop column if exists adm_id1;
alter table public.assets drop column if exists adm_con;
alter table public.assets drop column if exists adm_aid;
alter table public.assets drop column if exists adm_loans;
alter table public.assets drop column if exists adm_tcol;
alter table public.assets drop column if exists adm_scol;
alter table public.assets drop column if exists adm_ccaa;
alter table public.assets drop column if exists adm_prov;
alter table public.assets drop column if exists adm_city;
alter table public.assets drop column if exists adm_zip;
alter table public.assets drop column if exists adm_addr;
alter table public.assets drop column if exists adm_finca;
alter table public.assets drop column if exists adm_reg;
alter table public.assets drop column if exists adm_cref;
alter table public.assets drop column if exists adm_ejud;
alter table public.assets drop column if exists adm_ejmap;
alter table public.assets drop column if exists adm_eneg;
alter table public.assets drop column if exists adm_ob;
alter table public.assets drop column if exists adm_sub;
alter table public.assets drop column if exists adm_deu;
alter table public.assets drop column if exists adm_cprev;
alter table public.assets drop column if exists adm_cpost;
alter table public.assets drop column if exists adm_dtot;
alter table public.assets drop column if exists adm_pest;
alter table public.assets drop column if exists adm_str;
alter table public.assets drop column if exists adm_liq;
alter table public.assets drop column if exists adm_avj;
alter table public.assets drop column if exists adm_mmap;
alter table public.assets drop column if exists adm_buck;
alter table public.assets drop column if exists adm_lbuck;
alter table public.assets drop column if exists adm_smf;
alter table public.assets drop column if exists adm_rsub;
alter table public.assets drop column if exists adm_conn;
alter table public.assets drop column if exists adm_conn2;

-- excel_raw se mueve a propiedades (la fila cruda viene de la propiedad).
alter table public.assets drop column if exists excel_raw;

-- 3. CREAR TABLA propiedades
-- ============================================================
create table if not exists public.propiedades (
  -- PK: Collateral ID (NPL) / ID Property (CDR) / fallback hash determinístico.
  -- El parser decide la prioridad en este orden: collateral_id → id_property →
  -- hash(activo_id || referencia || row#).
  id text primary key,

  -- FK al inmueble físico (= assets.id = Referencia catastral).
  inmueble_id text not null references public.assets(id) on delete cascade,

  -- Agrupador de propiedades del mismo activo/préstamo (col "ID1" del Excel).
  -- No es FK porque no existe tabla activos; es solo un agrupador lógico.
  activo_id text not null,

  -- Categoría del producto (col "Categoria" del Excel).
  categoria text not null default 'CDR' check (categoria in ('CDR', 'NPL')),

  -- Comerciales (propietario del préstamo) — col 0-3 del Excel.
  propietario text default '—',
  contacto text default '—',
  telefono text default '—',
  mail text default '—',

  -- Contables y judicial básico — col 6-7, 30 del Excel.
  fase_interna text default '—',
  fase_c text default 'fp-nd',
  proceso text default '—',
  deuda numeric,
  precio_publicacion numeric,
  lien text default '—',

  -- Identificadores del sistema origen.
  collateral_id text,
  id_prinex text,
  id_prinex_corto text,
  id_property text,
  data_ref text,

  -- Portafolio / clasificación.
  portfolio text default '—',
  folder text default '—',
  main_local_ccc14 text default '—',
  stage_status text default '—',
  stage_substatus text default '—',
  tipologia text default '—',

  -- Judicial extendido (CDR y NPL).
  juzgado_larga text default '—',
  codigo_procedimiento text default '—',
  ultima_fase_calculada text default '—',
  hito_judicial text default '—',
  fecha_lanzamiento text default '—',
  lanzamiento text default '—',
  info_ocupantes text default '—',

  -- Estado registral (CDR).
  inscrito text default '—',
  cargas text default '—',
  registralmente_ok text default '—',

  -- Fila Excel en bruto: { "Hoja2": { "Header": "Value", ... } }.
  excel_raw jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. ÍNDICES
-- ============================================================
create index if not exists idx_propiedades_inmueble on public.propiedades(inmueble_id);
create index if not exists idx_propiedades_activo   on public.propiedades(activo_id);
create index if not exists idx_propiedades_categoria on public.propiedades(categoria);

-- 5. TRIGGER updated_at
-- ============================================================
drop trigger if exists propiedades_updated_at on public.propiedades;
create trigger propiedades_updated_at before update on public.propiedades
  for each row execute function public.handle_updated_at();

-- 6. ROW LEVEL SECURITY
-- ============================================================
alter table public.propiedades enable row level security;

-- Admin: control total.
drop policy if exists "propiedades_admin_all" on public.propiedades;
create policy "propiedades_admin_all" on public.propiedades
  for all using (public.is_admin());

-- Público: solo propiedades cuyo inmueble está publicado (para mostrar deuda /
-- cargas en la ficha pública del inmueble).
drop policy if exists "propiedades_public_read" on public.propiedades;
create policy "propiedades_public_read" on public.propiedades
  for select using (
    inmueble_id in (select id from public.assets where pub = true)
  );

-- 7. NOTAS POST-MIGRACIÓN
-- ============================================================
-- Después de aplicar esta migración:
--   - assets.id PASA A SER la Referencia catastral (string, ej. "6516208CF2461N0003WZ").
--   - El parser de Excel debe generar:
--       INSERT/UPSERT 1 fila en assets (por Referencia única).
--       INSERT/UPSERT 1 fila en propiedades por fila del Excel.
--   - src/lib/types.ts: actualizar tipos (Asset queda como Inmueble, agregar Propiedad).
--   - src/lib/supabase/db.ts: actualizar rowToAsset/assetToRow (sin adm_*),
--       agregar rowToPropiedad/propiedadToRow.
--   - matching engine: sigue operando sobre assets/inmuebles (no cambia el target).
--   - ofertas/favoritos: siguen referenciando assets.id (= inmueble). No tocar.
