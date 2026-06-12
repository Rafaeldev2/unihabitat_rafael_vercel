# Convenções de código

> **Propósito:** Padrões do repositório PropCRM.  
> **Público:** Desenvolvedores.  
> **Última verificação:** 2026-06-12

## Idioma e domínio

- **UI e labels:** espanhol (*Activos*, *Compradores*, *Ofertas*)
- **Código:** nomes de entidades em espanhol no domínio (`Comprador`, `Vendedor`, `Propiedad`)
- **Docs meta:** português em `docs/` (excepto citações de UI)

## Base de dados ↔ TypeScript

- Colunas PostgreSQL: **snake_case**
- Modelos app: **camelCase**
- **Sempre** usar mappers em [`src/lib/supabase/db.ts`](../../src/lib/supabase/db.ts) — nunca mapear manualmente na UI

## Server actions

- Pasta: `src/app/actions/` — uma entidade por ficheiro
- Directiva `"use server"` no topo
- Writes admin: `createServiceClient()`
- Auth: `requireAdmin()`, `requireEditPermission(section)` de `auth-server.ts`

## Estado cliente

- [`AppProvider`](../../src/lib/context.tsx) — estado global assets/compradores/vendedores/tarefas
- Após mutações: `refreshAssets()` etc. ou eventos `propcrm-*-updated`

## UI

- Lucide React para ícones
- `clsx` + `tailwind-merge` para classes
- Tailwind CSS 4

## Testes

- Unit: Vitest em `src/__tests__/`
- E2E: Playwright em `tests/e2e/`
- Referenciar testes relevantes ao documentar fluxos

## Path alias

`@/*` → `src/*`

## Ficheiros relacionados

- [CLAUDE.md](../../CLAUDE.md)
- [visao-geral.md](../arquitetura/visao-geral.md)
