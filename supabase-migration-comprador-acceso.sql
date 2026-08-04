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
