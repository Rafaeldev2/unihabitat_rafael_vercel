# Matching engine

> **Propósito:** Detalhe técnico do algoritmo de scoring.  
> **Público:** Desenvolvedores.  
> **Última verificação:** 2026-06-12

## API

```typescript
scoreMatch(comprador: Comprador, asset: Asset): number  // 0–100
findMatches(compradores, assets, threshold = 25): Match[]
```

Ficheiro: [`src/lib/matching.ts`](../../src/lib/matching.ts)

## Entradas

**Comprador:**
- `intereses` — string livre (províncias, tipos, keywords)
- `presupuesto` — string parseada para número (remove não-dígitos)

**Asset:**
- `prov`, `ccaa`, `tip`, `precio`
- `propiedades[].categoria` — para bonus NPL

## Algoritmo (pseudo)

```
score = 0
if intereses contains asset.prov: score += 30
if intereses contains asset.ccaa: score += 20
if asset.tip matches tipKeywords in intereses: score += 25
if intereses mentions inversión/NPL and asset has NPL propiedad: score += 15
if asset.precio <= presupuesto:
  score += (ratio >= 0.5 ? 20 : 10)
else if asset.precio <= presupuesto * 1.2:
  score += 5
if intereses mentions costa and asset.prov in coastal list: score += 10
return min(score, 100)
```

## Persistência

[`matching.ts`](../../src/app/actions/matching.ts) actions:

- Upsert em tabela `oportunidades` (comprador_id, asset_id, score, estado)
- Notifica top 5 compradores por imóvel via `notificaciones.ts`

## Testes

Não há teste unitário dedicado a matching; considerar adicionar em `src/__tests__/matching.test.ts` se o algoritmo evoluir.

## Guia operacional

Ver [matching-oportunidades.md](../guias/matching-oportunidades.md).
