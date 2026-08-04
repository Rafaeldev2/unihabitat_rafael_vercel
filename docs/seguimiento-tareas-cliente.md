# Seguimiento — tareas pendientes (lado cliente / ops)

> **Propósito:** Checklist de acciones que debes hacer tú (Supabase, env, validación manual). No es trabajo de código.  
> **Público:** Product owner / ops Unihabitat.  
> **Actualizado:** 2026-07-29 (correcciones feedback cliente + slugs + import OCUPADO)

Las Fases 1–3 ya están en código. Lo de abajo es lo que falta **por tu parte**.

## ⚠ No usar producción

Las migraciones y el smoke de este documento se hacen solo en **staging** (Supabase staging + Vercel Preview / local con keys staging).

Guía paso a paso: [**operacoes/staging.md**](operacoes/staging.md).

| Entorno | ¿Migraciones / checklist aquí? |
|---------|--------------------------------|
| Staging (Supabase + Preview) | **Sí** |
| Local → BD staging | **Sí** |
| Producción (`www.unihabitat.net` + Supabase prod) | **No** hasta smoke OK en staging |

---

## Paso 0 — Crear staging (antes del checklist)

- [x] Proyecto Supabase staging (`rflzqlutlbwtvgfbswtn`) distinto de prod  
- [x] Schema + migraciones + datos copiados desde prod (`scripts/copy-prod-to-staging.mjs`)  
- [x] `.env.local` local con keys **staging** + `EMAIL_DRY_RUN=true`  
- [x] Deploy staging: https://unihabitat-staging.vercel.app (proyecto Vercel aparte; prod intacta)  
- [x] Rama Git `staging` en GitHub (`origin/staging`)  
- [ ] Auth redirect URLs del proyecto staging: Site URL + `https://unihabitat-staging.vercel.app/**` + localhost  
- [ ] Smoke cliente en esa URL (checklist abajo)  
- [x] Tutorial admin **Guía** → https://unihabitat-staging.vercel.app/admin/guia-staging (solo staging)  

Detalle: [staging.md](operacoes/staging.md).

---

## Obligatorio en staging (no en prod)

### 1. Migraciones SQL (SQL Editor del proyecto **staging**)

| # | Archivo | Qué hace |
|---|---------|----------|
| 1 | [`supabase-migration-feedback-cliente-staging.sql`](../supabase-migration-feedback-cliente-staging.sql) | `assets.referencia` + `public_slug` + drop CHECK categoría + RPC preflight — **obligatorio para import OCUPADO y URLs slug** |
| 2 | [`supabase-migration-categoria-libre.sql`](../supabase-migration-categoria-libre.sql) | Idempotente: categoría libre (si no usaste el #1 completo) |
| 3 | [`supabase-migration-comprador-acceso.sql`](../supabase-migration-comprador-acceso.sql) | Columna `compradores.acceso` (`sin_acceso` \| `activo`) |
| 4 | [`supabase-migration-ofertas-vendedor.sql`](../supabase-migration-ofertas-vendedor.sql) | `ofertas.vendedor_id` + uniques parciales — oferta del agente sin comprador — **obligatorio antes de probar Oferta como agente** |

Script auxiliar: `node scripts/run-migration-feedback-cliente.mjs` / `node scripts/run-migration-ofertas-vendedor.mjs` (intentan `exec_sql`; si falla, pegar SQL en el Editor staging).

Si staging es un proyecto vacío, aplica antes el schema base + migraciones históricas ([migrations-supabase.md](operacoes/migrations-supabase.md)).

Sin (1), el import de OCUPADO falla y las URLs slug no existen. Sin (3), el bloqueo de `/portal/privado` no será fiable.

### 2. Variables de entorno (local / Vercel **Preview**)

| Variable | Para qué |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto Supabase **staging** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente browser staging |
| `SUPABASE_SERVICE_ROLE_KEY` | Server actions staging |
| `RESEND_API_KEY` + `EMAIL_FROM` | Solo si pruebas email real |
| `EMAIL_DRY_RUN=true` | Staging/local: no spamear clientes |
| `NEXT_PUBLIC_APP_URL` / `APP_ORIGIN` | URL del Preview o staging |

---

## Operación diaria (contra staging)

### Compradores y acceso al portal

- [ ] Altas nuevas quedan en **Sin acceso**.
- [ ] En `/admin/compradores` → **Activar acceso** cuando proceda.
- [ ] NDA firmada **no** abre el portal sola; hace falta activar acceso a mano.
- [ ] Demo `cliente@propcrm.com` **también** respeta `sin_acceso` (ya no hay bypass).

### Email al compartir un activo

- [ ] Con `EMAIL_DRY_RUN=true`: compartir activo y revisar consola (`assetSharedTemplate`).
- [ ] Con Resend real (opcional): verificar bandeja + deep link.

### Matching al publicar

- [ ] Publicar activo → matches/oportunidades.
- [ ] Favorito → notificación a admin/agente.

### Ofertas

- [ ] `/admin/ofertas` filtrar por estado (histórico completo).
- [ ] Ficha comprador → “Historial de Ofertas”.

### Portal (cliente y vendedor)

- [ ] `vendedor@propcrm.com` → Presentar oferta / solicitar info.
- [ ] Cliente con acceso activo → mismos flujos.

---

## Validación Fase 1 (staging)

- [ ] Upload plantilla `Referencia Catastral` + categoría `OCUPADO`.
- [ ] Filtros admin: Situación + Proceso + Deuda; Fase Interna persiste.
- [ ] Grupos ID1: badge “N inmuebles”.

---

## Smoke Fase 3 (staging / Preview)

- [ ] Marca `Unihabitat*` (asterisco negro); metadata sin PropCRM.
- [ ] Filtros URL `cat|prov|pob|tipo` sobreviven al volver; `pob` = población.
- [ ] `?cat=REO` → catálogo sin ese filtro.
- [ ] Footer legal → `/legal/privacidad` y `/legal/politica-cookies`.
- [ ] Toggle Lista | Mapa en `/portal`.
- [ ] Privado → ficha → **Mis Notas**.
- [ ] Card NPL = **Deuda**; CDR = **Precio** / “Haz tu Oferta”.
- [ ] Detalle grupo ID1 = actual + hermanos.

---

## Promoción a producción (solo cuando staging esté OK)

Orden fijo: **SQL prod → merge `staging`→`main` → smoke**. Nunca al revés.

### Gate staging

- [x] Schema staging: `ofertas.vendedor_id`, `assets.public_slug`, `compradores.acceso`
- [x] Tests críticos + `npm run build` en `staging` (`a97f770`)
- [ ] OK explícito del cliente en staging (Oferta agente, OCUPADO, portal)

### 1) SQL en Supabase **prod** (`ywvczogdjanhdnibzmfg`)

Pegar **una vez** el archivo combinado:

[`supabase-migration-prod-promote-staging.sql`](../supabase-migration-prod-promote-staging.sql)

Editor: https://supabase.com/dashboard/project/ywvczogdjanhdnibzmfg/sql/new  

**No** aplicar `supabase-dev-policies.sql`.

Verificar:

```bash
node scripts/verify-prod-schema.mjs
```

Debe mostrar ✅ `assets.public_slug`, `compradores.acceso`, `ofertas.vendedor_id`.

### 2) Env Vercel Production (proyecto `unihabitat_producion_vercel` / team unihabitats)

- [ ] Keys Supabase = prod (`ywvczog…`), no staging
- [ ] `APP_ORIGIN` / `NEXT_PUBLIC_APP_URL` = `https://www.unihabitat.net`
- [ ] `EMAIL_DRY_RUN` ausente o `false`
- [ ] `NEXT_PUBLIC_SHOW_STAGING_GUIDE` ausente o `false`
- [ ] Auth redirects prod incluyen `https://www.unihabitat.net/**`

### 3) Código

- [ ] PR `staging` → `main` (rollback SHA: `100f3c7`)
- [ ] Merge + deploy Production READY en `www.unihabitat.net`

### 4) Smoke prod

- [ ] Login admin → ficha activo
- [ ] Login agente → Oferta sin comprador → listado
- [ ] Portal slug `/portal/inmueble/...`
- [ ] `sin_acceso` bloquea `/portal/privado`
- [ ] Oferta portal (comprador) OK

---

## Fuera de alcance

- Automatización NDA end-to-end.
- URLs redes sociales del footer.

---

## Estado del plan

| Fase | Código | Tu acción |
|------|--------|-----------|
| Fase 1–3 | Hecha | Staging + migraciones + smoke (este doc) |
| Producción | — | Solo tras “Promoción a producción” |

Plan técnico: [`plan.md`](../plan.md).  
Staging: [`operacoes/staging.md`](operacoes/staging.md).
