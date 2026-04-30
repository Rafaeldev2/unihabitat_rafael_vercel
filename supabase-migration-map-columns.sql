-- ============================================================
-- PropCRM — Migración: columnas requeridas por el pipeline de mapas
-- Ejecutar UNA vez en Supabase SQL Editor (Dashboard).
--
-- Motivo: `supabase-schema.sql` declara `lat`, `lng`, `map` y `age` en
-- `public.assets`, pero usa `create table if not exists`. Si la tabla se
-- creó desde una versión anterior del esquema (sin estas columnas),
-- volver a ejecutar el script no las añade — el `if not exists` actúa
-- a nivel de tabla, no de columna. Por eso PostgREST devolvía:
--   "Could not find the 'lat' column of 'assets' in the schema cache."
--
-- Este archivo es idempotente (todas las sentencias usan `if not exists`)
-- y aditivo (no toca columnas existentes ni elimina nada). Es seguro
-- ejecutarlo varias veces.
-- ============================================================

alter table public.assets add column if not exists map text default '';
alter table public.assets add column if not exists age text;
alter table public.assets add column if not exists lat numeric;
alter table public.assets add column if not exists lng numeric;

comment on column public.assets.map is 'URL del mapa estático (Geoapify u OSM)';
comment on column public.assets.lat is 'Latitud geocodificada (decimal)';
comment on column public.assets.lng is 'Longitud geocodificada (decimal)';
comment on column public.assets.age is 'Antigüedad / año de construcción (texto libre del Catastro)';

-- PostgREST cachea el esquema de la BD: sin esta notificación, el endpoint
-- REST puede tardar varios minutos en reconocer las columnas nuevas y
-- seguiría devolviendo "Could not find the 'lat' column of 'assets' in the
-- schema cache." aunque el ALTER haya tenido éxito.
notify pgrst, 'reload schema';
