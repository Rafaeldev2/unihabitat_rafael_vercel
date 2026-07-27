# Entorno staging (frontend + base de datos)

> **Propósito:** Probar migraciones y smoke de Fases 1–3 **sin tocar producción**.  
> **Público:** Ops / DevOps Unihabitat.  
> **Última actualización:** 2026-07-27

## Regla de oro

| Entorno | Supabase | Vercel | Migraciones SQL |
|---------|----------|--------|-----------------|
| **Producción** | Proyecto prod (`ywvczogdjanhdnibzmfg`) | Production + `www.unihabitat.net` | Solo tras smoke OK en staging |
| **Staging** | Proyecto `unihabitab stagin` (`rflzqlutlbwtvgfbswtn`) | Rama `staging` / Preview | Aquí sí |
| **Local** | Keys staging en `.env.local` | `npm run dev` | Misma BD staging |

Nunca pegues `supabase-migration-*.sql` en el SQL Editor de **producción** hasta validar staging.

---

## Estado actual (2026-07-27)

- [x] Proyecto Supabase staging creado
- [x] Schema + migraciones históricas + `categoria-libre` + `comprador-acceso` (+ policies staging)
- [x] Datos CRM copiados desde prod (assets, propiedades, compradores, …)
- [x] Deploy Vercel aislado: **https://unihabitat-staging.vercel.app** (proyecto `unihabitat-staging`, no toca `www.unihabitat.net`)
- [ ] Auth redirect URLs staging → `https://unihabitat-staging.vercel.app/**` + localhost
- [ ] Smoke cliente ([seguimiento](../seguimiento-tareas-cliente.md))

---

## 1. Base de datos staging

### SQL (proyecto vacío) — orden

1. `supabase-schema.sql`
2. `supabase-migration-excel-raw.sql`
3. `supabase-migration-map-columns.sql`
4. `supabase-migration-comprador-assets.sql`
5. **`supabase-migration-inmuebles-propiedades.sql`** (crea `propiedades`)
6. `supabase-migration-agentes.sql`
7. `supabase-migration-categoria-libre.sql`
8. `supabase-migration-comprador-acceso.sql`
9. `supabase-dev-policies.sql` — **solo staging**

### Copiar datos prod → staging

```bash
PROD_SUPABASE_URL=https://ywvczogdjanhdnibzmfg.supabase.co \
PROD_SUPABASE_KEY=<anon_o_service_prod> \
STAGING_SUPABASE_URL=https://rflzqlutlbwtvgfbswtn.supabase.co \
STAGING_SUPABASE_SERVICE_ROLE_KEY=<service_staging> \
node scripts/copy-prod-to-staging.mjs
```

- Solo **lee** prod; escribe en staging.
- No copia `auth.users` (`user_id` se anula). Login real Supabase hay que recrearlo, o usar usuarios demo (`DEV_USERS` en login).

### Auth (staging)

- Site URL = URL Preview de la rama `staging`
- Redirect URLs: esa URL + `http://localhost:3000/**`

---

## 2. Frontend staging

### Flujo Git (fijo)

```
feature → PR → staging → (cliente OK) → PR → main → Production
```

1. Push a rama **`staging`** → Vercel Preview.
2. Preview usa env **Preview** → Supabase staging.
3. **Production** sigue con keys prod (no tocar).

### Variables Vercel Preview

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rflzqlutlbwtvgfbswtn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable/anon **staging** |
| `SUPABASE_SERVICE_ROLE_KEY` | secret **staging** |
| `EMAIL_DRY_RUN` | `true` |
| `NEXT_PUBLIC_APP_URL` / `APP_ORIGIN` | URL del Preview |

Si no tienes acceso al proyecto Vercel de prod: crea proyecto separado `unihabitat-staging` ligado a la rama `staging`.

---

## 3. Local

`.env.local` (nunca commits) con keys **staging** + `EMAIL_DRY_RUN=true`.

```bash
npm run dev
```

---

## 4. Checklist “¿estoy en staging?”

- [ ] URL ≠ `www.unihabitat.net`
- [ ] Supabase project ref = `rflzqlutlbwtvgfbswtn`
- [ ] Vars editadas en **Preview**, no Production
- [ ] SQL solo en SQL Editor staging
- [ ] `EMAIL_DRY_RUN=true`

---

## 5. Promoción a producción

1. Smoke staging OK + OK cliente  
2. Mismas migraciones nuevas en Supabase **prod**  
3. Merge `staging` → `main`  
4. Smoke mínimo en prod  

---

## Relacionado

- [seguimiento-tareas-cliente.md](../seguimiento-tareas-cliente.md)
- [deploy-vercel.md](deploy-vercel.md)
- [migrations-supabase.md](migrations-supabase.md)
