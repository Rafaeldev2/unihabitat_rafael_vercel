# Seguimiento — tareas pendientes (lado cliente / ops)

> **Propósito:** Checklist de acciones que debes hacer tú (Supabase, env, validación manual). No es trabajo de código.  
> **Público:** Product owner / ops Unihabitat.  
> **Actualizado:** 2026-07-23 (tras Fase 3 + guía staging)

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
- [ ] Vars **Preview** en Vercel apuntando a staging (Production sin tocar)  
- [ ] Auth redirect URLs del proyecto staging incluyen Preview + localhost  
- [ ] Rama Git `staging` desplegada; URL Preview compartida con el cliente  

Detalle: [staging.md](operacoes/staging.md).

---

## Obligatorio en staging (no en prod)

### 1. Migraciones SQL (SQL Editor del proyecto **staging**)

| # | Archivo | Qué hace |
|---|---------|----------|
| 1 | [`supabase-migration-categoria-libre.sql`](../supabase-migration-categoria-libre.sql) | Categoría libre en Excel (p. ej. OCUPADO) — Fase 1 |
| 2 | [`supabase-migration-comprador-acceso.sql`](../supabase-migration-comprador-acceso.sql) | Columna `compradores.acceso` (`sin_acceso` \| `activo`) — Fase 2 |

Si staging es un proyecto vacío, aplica antes el schema base + migraciones históricas ([migrations-supabase.md](operacoes/migrations-supabase.md)).

Sin (2), el bloqueo de `/portal/privado` no será fiable (fail-open con warning).

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
- [ ] Demo `cliente@propcrm.com` puede entrar al privado en local (bypass dev).

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

- [ ] Smoke staging completo.
- [ ] Ejecutar las **mismas** migraciones en Supabase **prod**.
- [ ] Deploy Production / merge a `main`.
- [ ] Smoke mínimo en prod.

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
