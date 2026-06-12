# Setup local

> **Propósito:** Configurar o ambiente de desenvolvimento PropCRM.  
> **Público:** Desenvolvedores.  
> **Pré-requisitos:** Node.js 20+, npm, projeto Supabase (ou credenciais partilhadas).  
> **Última verificação:** 2026-06-12

## 1. Clonar e instalar

```bash
git clone <repo-url>
cd unihabitat_rafael_vercel
npm install
```

## 2. Variáveis de ambiente

Copiar o template:

```bash
cp .env.example .env.local
```

**Obrigatórias** para a app funcionar:

| Variável | Descrição |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service-role (servidor; nunca expor no cliente) |

Referência completa: [variaveis-ambiente.md](../operacoes/variaveis-ambiente.md).

## 3. Base de dados

O schema base está em `supabase-schema.sql`. Migrações adicionais na raiz do repo (`supabase-migration-*.sql`). Para desenvolvimento local com RLS permissivo, aplicar também `supabase-dev-policies.sql`.

Script útil para testar ligação:

```bash
node scripts/test-supabase-connection.mjs
```

## 4. Arrancar o servidor

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## 5. Login sem Supabase Auth (dev)

Contas demo em `src/app/login/actions.ts` (`DEV_USERS`). Usam cookie `dev-auth` e **não** passam pelo Supabase Auth:

| Email | Password | Role | Destino |
|-------|----------|------|---------|
| `admin@propcrm.com` | `Admin1234!` | admin | `/admin` |
| `vendedor@propcrm.com` | `Vendedor1234!` | vendedor | `/admin` |
| `cliente@propcrm.com` | `Cliente1234!` | cliente | `/portal/privado` |

Útil para desenvolvimento local sem utilizadores reais em `auth.users`.

## 6. Email em desenvolvimento

Com `EMAIL_DRY_RUN=true`, os envíos Resend são registados na consola sem enviar email real. Ver [email-notificacoes.md](../fluxos-tecnicos/email-notificacoes.md).

## 7. Mapas / Catastro (opcional)

Para enriquecimento cadastral e mapas estáticos:

- `GEOAPIFY_API_KEY` (servidor) ou `NEXT_PUBLIC_GEOAPIFY_KEY` (cliente)
- Smoke test: `npm run test:env`

## 8. Testes

```bash
npm run test              # Vitest (unit)
npm run test:data         # CRUD Supabase (scripts/e2e-test.mjs)
npm run test:e2e          # Playwright
npm run test:all          # Tudo
```

## Ficheiros relacionados

- [`.env.example`](../../.env.example)
- [`src/app/login/actions.ts`](../../src/app/login/actions.ts) — `DEV_USERS`
- [`docs/getting-started/primeiro-acesso.md`](primeiro-acesso.md)
