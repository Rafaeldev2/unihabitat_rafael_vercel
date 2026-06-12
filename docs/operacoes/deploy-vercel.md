# Deploy Vercel

> **Propósito:** Orientações para deploy do PropCRM na Vercel.  
> **Público:** DevOps / desenvolvedores.  
> **Última verificação:** 2026-06-12

## Pré-requisitos

- Repositório ligado à Vercel
- Projecto Supabase (URL + keys)
- Domínio Resend verificado (se email em produção)

## Build

```bash
npm run build
```

Framework preset: **Next.js**. Comando default da Vercel funciona (`next build`).

## Variáveis de ambiente

Configurar no dashboard Vercel (Production + Preview):

**Obrigatórias:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Recomendadas produção:**
- `APP_ORIGIN=https://www.unihabitat.net` (ou domínio real)
- `NEXT_PUBLIC_APP_URL` — mesmo domínio HTTPS
- `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_SUPPORT`
- `GEOAPIFY_API_KEY`

**Não usar em produção:**
- `EMAIL_DRY_RUN=true`

Lista completa: [variaveis-ambiente.md](variaveis-ambiente.md).

## Auth redirects

Supabase Auth redirect URLs devem incluir o domínio de produção. `APP_ORIGIN` evita magic links para `localhost` quando `NEXT_PUBLIC_APP_URL` ficou incorrecto no build.

## Middleware

Edge middleware em `src/middleware.ts` — compatível com Vercel Edge por default.

## Pós-deploy

1. Testar `/login` com utilizador real Supabase
2. Testar `/admin` e upload Excel
3. Verificar email (ou logs se dry-run)
4. Confirmar mapas/Catastro com Geoapify key de produção

## Ficheiros relacionados

- [troubleshooting.md](troubleshooting.md)
- [setup-local.md](../getting-started/setup-local.md)
