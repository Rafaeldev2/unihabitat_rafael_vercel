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
```

No test framework is configured. Python script `catastro.py` is standalone (Spanish cadastral registry API integration).

## Architecture

**Stack:** Next.js 16 + React 19 + TypeScript, Tailwind CSS 4, Supabase (auth + PostgreSQL)

**Path alias:** `@/*` maps to `./src/*`

### Two interfaces

- `/admin/*` — Internal CRM panel (assets, buyers, sellers, tasks, reports, opportunities, notifications, config). No auth middleware on admin routes currently — protected at the app level.
- `/portal/*` — Public property browsing. `/portal/privado/*` requires authentication (enforced by middleware).
- `/login` — Supabase email/password auth. Redirects by `user_metadata.role`: `admin` → `/admin`, `cliente` → `/portal/privado`.

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
- **Excel normalization** (`src/lib/normalize-excel.ts`): Parses multi-provider Excel uploads with provider-specific column mappings (Proveedor 1/2/3 + Enriquecido). **Proveedor 1** maps UF/portfolio/address-style fields; **Pipedrive, LinkedIn, NPL category, client, contract id** come from the **Proveedor 2** column layout. When the same `id` appears on multiple sheets, rows are **merged field-by-field** (not “first row wins”) so CRM fields from one sheet are not discarded if another sheet has `"—"` for those columns.
- **Types** (`src/lib/types.ts`): All entity interfaces — Asset (80+ fields with nested `AssetAdmin`), Comprador, Vendedor, Tarea, plus supporting types.

### Database

Schema in `supabase-schema.sql`. Dev RLS policies in `supabase-dev-policies.sql`. Tables: `assets`, `compradores`, `vendedores`, `tareas`, `mensajes`, `notas`, `documentos`, `oportunidades`, `notificaciones`.

### Environment variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional (Catastro / mapas):
- `GEOAPIFY_API_KEY` — geocodificación y mapa estático tras importar Excel con enriquecimiento Catastro (servidor); si no existe, se usa `NEXT_PUBLIC_GEOAPIFY_KEY`
- `NEXT_PUBLIC_GEOAPIFY_KEY` — mapas en la normalización Excel en cliente (ver `.env.example`)
- `ASSET_UPSERT_AFTER_CATASTRO_ENRICH=true` — tras enriquecer, ejecutar `upsertAssets` en Supabase

## Conventions

- Entity names are Spanish: activos (assets), compradores (buyers), vendedores (sellers), tareas (tasks), oportunidades (opportunities), notificaciones (notifications)
- DB columns use snake_case; app models use camelCase — always use the mappers in `src/lib/supabase/db.ts`
- Server actions are organized one-per-entity in `src/app/actions/`
- UI uses Lucide React icons and utility classes via `clsx` + `tailwind-merge`
