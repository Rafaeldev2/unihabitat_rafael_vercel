# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PropCRM — a real estate CRM for managing NPL (Non-Performing Loans) and REO (Real Estate Owned) property portfolios. Spanish-language domain (UI labels, field names, entity names are in Spanish). Two interfaces: admin panel and public buyer portal.

## Commands

```bash
npm run dev      # Start Next.js dev server
npm run build    # Production build
npm run lint     # ESLint
npm run start    # Serve production build

npx vitest run                                     # Run all tests once (jsdom env)
npx vitest run src/__tests__/phone-utils.test.ts   # Run a single test file
npx vitest                                         # Watch mode
```

Tests live in `src/__tests__/` and use Vitest + `@testing-library/jest-dom/vitest` (setup in `src/__tests__/setup.ts`). Standalone helpers: `catastro.py` (Spanish cadastral registry API), and `scripts/` (`e2e-test.mjs`, `fix-postgrest-schema.mjs`, `test-supabase-connection.mjs`).

## Architecture

**Stack:** Next.js 16 + React 19 + TypeScript, Tailwind CSS 4, Supabase (auth + PostgreSQL)

**Path alias:** `@/*` maps to `./src/*`

### Two interfaces

- `/admin/*` — Internal CRM panel (assets, compradores, vendedores, tareas, informes, ofertas, oportunidades, notificaciones, config). Middleware (`src/lib/supabase/middleware.ts`) requires an authenticated `admin` user; non-admins are redirected to `/portal/privado`.
- `/portal/*` — Public property browsing. `/portal/privado/*` requires authentication (enforced by the same middleware).
- `/login` — Supabase email/password auth. Redirects by `user_metadata.role`: `admin` → `/admin`, `cliente` → `/portal/privado`.

The middleware also honors a **dev-auth cookie** (`dev-auth`, JSON `{email, role, nombre}`) that bypasses Supabase for local-only roleplay; if present, it short-circuits the Supabase auth path. See `src/lib/dev-auth-client.ts`.

### Data flow

1. **Server actions** (`src/app/actions/`) handle all DB mutations via Supabase service-role client
2. **React Context** (`src/lib/context.tsx`) provides client-side state (assets, compradores, vendedores, tareas) with `refresh*` methods that re-fetch from Supabase
3. **Row mappers** (`src/lib/supabase/db.ts`) convert between snake_case DB columns and camelCase TypeScript models — all DB reads/writes go through these

### Supabase clients

- `src/lib/supabase/client.ts` — Browser client (anon key)
- `src/lib/supabase/server.ts` — Server client + `createServiceClient()` using `SUPABASE_SERVICE_ROLE_KEY` for admin operations
- `src/lib/supabase/middleware.ts` — Session refresh + route protection logic

### Key modules

- **Matching engine** (`src/lib/matching.ts`, `src/app/actions/matching.ts`): Scores buyer-asset compatibility (province, property type, strategy, budget, coastal preference). Threshold: 25 points.
- **Excel normalization** (`src/lib/normalize-excel.ts`): Parses multi-provider Excel uploads with provider-specific column mappings (Proveedor 1/2/3 + Enriquecido). **Proveedor 1** maps UF/portfolio/address-style fields; **Pipedrive, LinkedIn, NPL category, client, contract id** come from the **Proveedor 2** column layout. When the same `id` appears on multiple sheets, rows are **merged field-by-field** (not "first row wins") so CRM fields from one sheet are not discarded if another sheet has `"—"` for those columns.
- **Catastro enrichment** (`src/lib/catastro/`): `dnp.ts` queries the Spanish cadastre, `geoapify.ts` geocodes addresses + builds static maps, `to-partial-asset.ts` adapts the result into an Asset patch. Server actions live in `src/app/actions/catastro.ts` and `src/app/actions/maps.ts`. `merge-asset-partial.ts` applies the patches without clobbering existing CRM data.
- **Claude AI validation** (`src/app/actions/claude.ts`, `claude-format-detect.ts`): Server actions that call the Anthropic API (model `claude-sonnet-4-20250514`, batch size 20) to validate/normalize imported asset rows. Requires `ANTHROPIC_API_KEY`; gracefully no-ops if missing.
- **Types** (`src/lib/types.ts`): All entity interfaces — Asset (80+ fields with nested `AssetAdmin`), Comprador, Vendedor, Tarea, plus supporting types.

### Database

Schema in `supabase-schema.sql`; Excel-raw migration in `supabase-migration-excel-raw.sql`; dev RLS policies in `supabase-dev-policies.sql`. Tables: `assets`, `compradores`, `vendedores`, `tareas`, `mensajes`, `notas`, `documentos`, `oportunidades`, `notificaciones`.

### Environment variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional (Catastro / mapas / IA):
- `GEOAPIFY_API_KEY` — geocodificación y mapa estático tras importar Excel con enriquecimiento Catastro (servidor); si no existe, se usa `NEXT_PUBLIC_GEOAPIFY_KEY`
- `NEXT_PUBLIC_GEOAPIFY_KEY` — mapas en la normalización Excel en cliente (ver `.env.example`)
- `ASSET_UPSERT_AFTER_CATASTRO_ENRICH=true` — tras enriquecer, ejecutar `upsertAssets` en Supabase
- `ANTHROPIC_API_KEY` — habilita la validación/normalización IA en `src/app/actions/claude.ts`; si falta, las acciones devuelven un no-op informativo

## Conventions

- Entity names are Spanish: activos (assets), compradores (buyers), vendedores (sellers), tareas (tasks), oportunidades (opportunities), notificaciones (notifications)
- DB columns use snake_case; app models use camelCase — always use the mappers in `src/lib/supabase/db.ts`
- Server actions are organized one-per-entity in `src/app/actions/`
- UI uses Lucide React icons and utility classes via `clsx` + `tailwind-merge`
