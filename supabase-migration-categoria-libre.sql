-- Categoría libre (CDR, NPL, OCUPADO, …) — elimina CHECK restrictivo.
-- Ejecutar en Supabase SQL Editor tras desplegar el parser actualizado.

alter table public.propiedades
  drop constraint if exists propiedades_categoria_check;

-- Sin CHECK: cualquier texto no vacío es válido (default CDR para filas legacy).
alter table public.propiedades
  alter column categoria set default 'CDR';
