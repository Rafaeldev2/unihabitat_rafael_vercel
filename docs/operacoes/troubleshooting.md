# Troubleshooting

> **Propósito:** Problemas comuns e soluções.  
> **Público:** Desenvolvedores e operação.  
> **Última verificação:** 2026-06-12

## Setup e auth

| Problema | Solução |
|----------|---------|
| Redirect loop em `/login` | Verificar cookies Supabase; limpar `dev-auth` e cookies `sb-*` |
| Admin bloqueado | Confirmar `user_metadata.role=admin` no Supabase ou usar conta demo |
| Vendedor não acede `/admin/config` | Comportamento esperado — só admin |
| Magic link aponta localhost | Definir `APP_ORIGIN` com URL HTTPS de produção |

## Supabase

| Problema | Solução |
|----------|---------|
| Tabelas vazias / 403 | Verificar RLS; em dev aplicar `supabase-dev-policies.sql` |
| PostgREST schema cache | `node scripts/fix-postgrest-schema.mjs` |
| Ligação falha | `node scripts/test-supabase-connection.mjs` |

## Import Excel

| Problema | Solução |
|----------|---------|
| Zero inmuebles extraídos | Verificar cabeçalhos `Referencia`, `ID1`, `Categoria` — ver [importacao-excel.md](../fluxos-tecnicos/importacao-excel.md) |
| Formato antigo Proveedor 1/2/3 | Usar plantilla maestra CDR/NPL actual |
| Propiedades duplicadas | Verificar PK (Collateral ID / ID Property) |

## Mapas e Catastro

| Problema | Solução |
|----------|---------|
| Mapa em branco | Excel sem lat/lng → refresh Catastro manual; verificar `GEOAPIFY_API_KEY` |
| Referencia catastral inválida | `asset.id` deve ser ref. espanhola plausível |
| Geoapify errors | `npm run test:env`; ver `diagnostics.pingGeoapify` |

## Email

| Problema | Solução |
|----------|---------|
| Emails não chegam | Verificar `RESEND_API_KEY`, domínio verificado, SPF/DKIM |
| Sem envio em dev | Normal se `EMAIL_DRY_RUN=true` — ver consola |
| ok:false sem key | Configurar Resend ou activar dry-run |

## Build / testes

| Problema | Solução |
|----------|---------|
| Vitest falha | `npm run test` — ver `src/__tests__/setup.ts` |
| E2E falha | Servidor dev + credenciais; `npm run test:e2e` |
| Lint errors | `npm run lint` |

## Documentação desactualizada

Se comportamento não bate certo com docs, verificar código em `src/` e abrir PR para actualizar `docs/`. Ver [manter-documentacao.md](../contribuir/manter-documentacao.md).

## Ficheiros relacionados

- [setup-local.md](../getting-started/setup-local.md)
- [variaveis-ambiente.md](variaveis-ambiente.md)
