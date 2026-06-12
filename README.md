# PropCRM — Unihabitat

CRM imobiliário para gestão de carteiras **NPL** e **CDR/REO** na Espanha. Inclui painel admin interno, portal público de imóveis e área privada para compradores.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase · Resend

## Documentação

Toda a documentação vive em **[docs/README.md](docs/README.md)** — setup, arquitetura, guias de operação e fluxos técnicos.

## Comandos

```bash
npm install
npm run dev          # Servidor de desenvolvimento (http://localhost:3000)
npm run build        # Build de produção
npm run lint         # ESLint
npm run test         # Testes unitários (Vitest)
npm run test:e2e     # Testes E2E (Playwright)
npm run test:all     # Unit + dados + E2E
```

## Setup rápido

1. Copiar `.env.example` → `.env.local` e preencher credenciais Supabase
2. `npm run dev`
3. Login demo: `admin@propcrm.com` / `Admin1234!` → `/admin`

Ver [docs/getting-started/setup-local.md](docs/getting-started/setup-local.md) para detalhes.

## Estrutura

| Pasta | Conteúdo |
|-------|----------|
| `src/app/` | Rotas App Router, server actions |
| `src/lib/` | Domínio, Supabase, Excel, Catastro, email |
| `src/components/` | Componentes UI reutilizáveis |
| `docs/` | Documentação do projeto |
| `scripts/` | Utilitários Supabase, Geoapify, E2E |
