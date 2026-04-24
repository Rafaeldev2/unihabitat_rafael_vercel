-- Añade columna para datos brutos del Excel por hoja (ejecutar en SQL Editor si el proyecto ya existe)
alter table public.assets add column if not exists excel_raw jsonb;

comment on column public.assets.excel_raw is 'Mapa por nombre de hoja → cabecera → valor de celda (importación Excel)';
