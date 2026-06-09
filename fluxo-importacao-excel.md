# Documento Técnico: Fluxo de Importação de Excel — PropCRM

> Análise completa do pipeline de importação de planilhas Excel (.xlsx/.xls) no sistema PropCRM, gerado a partir da leitura dos arquivos-fonte em `src/`.

---

## 1. VISÃO GERAL DO FLUXO

O upload de Excel é um pipeline de **5 etapas no cliente** (`UploadActivosModal`) intercaladas com **chamadas a server actions** que tocam Supabase, Catastro DNP, Geoapify e Anthropic. A premissa de UX é **"persistir cedo, enriquecer depois"**: o usuário vê as filas no CRM em segundos, e o enriquecimento (IA + Catastro + geocodificação) acontece em background no mesmo modal.

### Diagrama ASCII completo

```
┌───────────────────────────────────────────────────────────────────────────┐
│  USUÁRIO seleciona .xlsx em UploadActivosModal                            │
└──────────────────────────────┬────────────────────────────────────────────┘
                               │
                ┌──────────────▼──────────────┐
                │ STEP 1: parseExcelFile       │  ← cliente (browser)
                │  ├ detectFormatByHeader      │
                │  ├ parseProveedor 1/2/3      │
                │  ├ parseEnriquecido          │
                │  ├ enrichAssets (catRef join)│
                │  └ augmentAssetFromHeaders   │
                └──────────────┬───────────────┘
                               │ Asset[] + sheetDiag
              ┌────────────────┴────────────────┐
              │                                 │
        parsed.length > 0                parsed.length === 0
              │                                 │
              │            ┌────────────────────▼──────────────────┐
              │            │ STEP 1b: heurística + IA               │
              │            │  ├ parseExcelHeuristic (header → Asset)│
              │            │  ├ extractRawPreview                   │
              │            │  ├ detectFormatWithClaude →server action│──► Anthropic API
              │            │  ├ parseWithMapping (col → field)      │
              │            │  └ mergeHeuristicIntoMapped            │
              │            └────────────────────┬───────────────────┘
              │                                 │
              └─────────────┬───────────────────┘
                            │
                ┌───────────▼────────────────┐
                │ STEP 2: db-raw              │  ← chunkArray(parsed, 100)
                │  upsertAssets (4 paralelo)  │──► Supabase service role
                │   ├ dedupAssetsByIdWithCount│       │
                │   ├ fetch existing rows     │       │
                │   ├ mergeRowPreferNonEmpty  │       │
                │   ├ applyMapFromLatLng      │       │
                │   └ .upsert({onConflict:id})│       │
                └───────────┬─────────────────┘       │
                            │ rawSaved                 │
                            ▼                          ▼
                   refreshAssets()           tabela `assets`
                            │
              ┌─────────────▼──────────────┐
              │ STEP 3 (ai-validate):      │  ← se parsed ≤ AI_SKIP_THRESHOLD
              │ validateAssetsBatch        │
              │  (BATCH_SIZE=15, CC=3)     │──► Anthropic /messages
              │  applyClaudeCorrections    │
              └─────────────┬──────────────┘
                            │ parsed atualizado
              ┌─────────────▼───────────────┐
              │ STEP 4 (catastro):          │  ← apenas IDs novos
              │ enrichAssetsBatch           │
              │  (CC=3, delay 500ms)        │──► ovc.catastro.meh.es
              │  ├ fetchConsultaDnprc       │       (retry 3x)
              │  ├ geocodeAddressLine       │──► api.geoapify.com
              │  ├ buildStaticMapUrl        │
              │  └ applyCatastroOverwrite   │
              └─────────────┬───────────────┘
                            │ allEnriched
                            ▼
                   upsertAssets final (CC=4, batch=100) ──► Supabase
                            │
                            ▼
                   fetchAssetsByIds (verificação)
                            │ finalFailures?
                            ▼
              ┌────────────────────────────────┐
              │ STEP 5: backfillUploadedMaps   │  ← server action
              │  ├ fetch persistidos           │──► Supabase
              │  ├ shouldBackfillMapFromAddress│
              │  ├ geocodeLadder (7 passos)    │──► Geoapify
              │  ├ upsert lat/lng/map          │──► Supabase
              │  └ read-back (driftIds)        │──► Supabase
              └─────────────┬──────────────────┘
                            │
                            ▼
            window.dispatchEvent("propcrm-assets-updated")
                            │
                            ▼
              AppContext.loadAssetsFromServer (re-fetch + backfill)
```

### Pontos de falha possíveis (com referência)

| # | Ponto | Sintoma para o usuário | Onde |
|---|---|---|---|
| 1 | XLSX corrompido / não-Excel | erro "Solo se permiten archivos Excel" | `UploadActivosModal.tsx:247` |
| 2 | Formato não detectável + IA sem key | 0 filas extraídas, `status:error` | `UploadActivosModal.tsx:358-396` |
| 3 | ID duplicado em mesma planilha | linhas fundidas silenciosamente (warn no log) | `normalize-excel.ts:417-440` |
| 4 | ID vazio na linha | linha descartada (`parsed < rows` no `SheetDiag`) | `normalize-excel.ts:99,161,257` |
| 5 | RLS / service role rejeita upsert | `upsertErr` no batch → entra em `finalFailures` | `assets.ts:299-311` |
| 6 | `db-max-rows=1000` do PostgREST | leitura truncada se não paginar | `assets.ts:14-43` |
| 7 | Catastro DNP HTTP 503/429 | item entra em `catFailedList` (categoria reintentável) | `dnp.ts:331-346` |
| 8 | Geoapify sem `GEOAPIFY_API_KEY` | `geocodeLadder` cai para 0 hits → log "Comprueba GEOAPIFY_API_KEY" | `UploadActivosModal.tsx:732-739` |
| 9 | Drift no read-back | banner amarelo no log; lat/lng não confirmadas | `maps.ts:280-285` |
| 10 | `validateAssetsBatch` 500/timeout | `aiErrors++`, demais batches seguem | `UploadActivosModal.tsx:483-503` |
| 11 | Sessão admin perdida durante upload | `requireAdmin throw` → todos os IDs do batch em `finalFailures` | `UploadActivosModal.tsx:629-657` |
| 12 | `ON CONFLICT` no Postgres (id duplicado no array) | batch inteiro rejeitado — mitigado por dedup | `assets.ts:263-270` |

---

## 2. ETAPA 1 — LEITURA E PARSE DO EXCEL

**Arquivo fonte:** `src/lib/normalize-excel.ts`
**Função principal:** `parseExcelFile(file, { diag: true })` → `Promise<ParseExcelResult>`
**Input:** `File` (browser File API, `.xlsx` ou `.xls`)
**Output:** `{ assets: Asset[]; sheetDiag: SheetDiagEntry[] }`

### 2.1 Detecção de formato (`detectFormatByHeader`)

Existem **5 valores possíveis** para `SheetFormat` (linha 471): `"prov1" | "prov2" | "prov3" | "enriquecido" | "unknown"`.

A detecção tem **2 vias em cascata** (linhas 950-961):

1. **Por nome da aba** (rápido): se o nome contém `"PROVEEDOR 1/2/3"` ou `"ENRIQUECIDO"`, define `nameFormat` diretamente. Nesse caso só calcula o `offset` via `findOffsetByCol0` (linhas 731-737) — não exige verificar os campos `verify`, pois nomes confiáveis bastam.
2. **Por cabeçalho** (fallback): `detectFormatByHeader` percorre `FORMAT_ANCHORS` (linhas 705-710) e considera cada formato confirmado quando o **col0 anchor** existe E todos os campos em `verify` aparecem após ele.

```typescript
const FORMAT_ANCHORS: { format: SheetFormat; col0: string; verify: string[] }[] = [
  { format: "prov2", col0: "ID PIPEDRIVE", verify: ["ASSET ID", "ASSET PROVINCE"] },
  { format: "prov1", col0: "DATA REF",     verify: ["UF", "PROVINCIA"] },
  { format: "prov3", col0: "CARTERA",      verify: ["NDG", "ADRESS"] },
  { format: "enriquecido", col0: "REFERENCIA", verify: ["CLASE", "USO", "BIEN"] },
];
```

> **⚠️ A ordem importa**: `prov2` é checado primeiro porque seu anchor (`"ID PIPEDRIVE"`) é o mais específico — se viesse depois de `prov1` (anchor `"DATA REF"`), um arquivo que tivesse ambas as colunas seria classificado errado.

### 2.2 O que é `offset` e por que existe

```typescript
function shiftRows(rows: unknown[][], offset: number): unknown[][] {
  if (offset === 0) return rows;
  return rows.map(r => (r as unknown[]).slice(offset));
}
```

`offset` é o **número de colunas extras à esquerda** que o provedor adicionou antes do layout canônico. Cada `parseProveedor*` espera colunas em índices fixos (ex.: prov1 → UF na col 2, prov2 → Asset ID na col 7). Se o cliente prepend cinco colunas de metadados (Propietario, Telefono, mail, Publicar, Categoría), sem o offset o parser leria a coluna errada como ID — e a fila seria descartada porque "ID vazio".

> **⚠️ Sintoma sem fix:** o teste em `excel-import.test.ts:53-74` documenta o bug histórico — antes do `findOffsetByCol0`, prov1 e prov3 retornavam **0 assets** porque liam a coluna errada como ID.

Quando `offset > 0` e o formato é `prov1/2/3`, o código também **captura as colunas extras** (`extraColumns` Map) e as injeta como `ownerName`/`ownerTel`/`ownerMail`/`pub`/`cat` (linhas 993-1008 e 1057-1071).

### 2.3 Pipeline heurístico quando formato é desconhecido (`parseExcelHeuristic`)

Acionado em `UploadActivosModal.tsx:305` quando `parsed.length === 0` após `parseExcelFile`. Diferente do parser estruturado, **não exige cabeçalhos canônicos**:

- Lê todas as planilhas.
- Para cada planilha chama `inferHeaderColumns(headerRow)` (linha 540) — mapeia regex → índice de coluna.
- Para cada linha não-vazia tenta extrair `id` via `cell("id")`. Se não há, fallback para `firstNonEmpty`. Última garantia: `RAW-{sheet}-{row}` (linhas 821-830).
- **Garantia explícita** (comentário linha 770): "nunca devuelve [] si el archivo tenía filas con datos".
- Aplica `dedupAssetsById` antes de retornar (linha 907) — evita `ON CONFLICT` no upsert.

### 2.4 `inferHeaderColumns` — como funciona e limitações

```typescript
function inferHeaderColumns(headerRow: unknown[]): Partial<Record<HeaderField, number>> {
  const cols: Partial<Record<HeaderField, number>> = {};
  const set = (k: HeaderField, idx: number) => { if (cols[k] === undefined) cols[k] = idx; };

  for (let c = 0; c < headerRow.length; c++) {
    const h = foldHeaderLabel(headerRow[c]);
    if (!h) continue;

    if (cols.id === undefined && /\b(UF|NDG|ASSET ID|ID PRINEX|ID ACTIVO|REFERENCIA(?! CATASTRAL)|CONTRACT ID|DATA REF|^ID$|^ID\s|^ID\d+$|^ID\d+\s|CODIGO ACTIVO)\b/.test(h)) {
      set("id", c);
      continue;
    }
    if (/(REFERENCIA CATASTRAL|CAT\.? ?REF|CD REFERENCIA|CADASTRAL)/.test(h)) set("catRef", c);
    // ... 25+ regex adicionais
```

`foldHeaderLabel` normaliza para uppercase + tira acentos (NFD), permitindo `"Dirección"` ≡ `"DIRECCION"` ≡ `"DIR."`.

**Limitações:**

- ⚠️ **First-wins** — `set` só atribui se ainda undefined. Se aparecem `"Provincia"` e `"Asset Province"` na mesma planilha, ganha a primeira.
- ⚠️ A regex `id` exclui `"REFERENCIA CATASTRAL"` (`(?! CATASTRAL)`), mas aceita `"REFERENCIA"` solo — colisão possível.
- ⚠️ Não detecta sinônimos exóticos (ex.: `"PROPIEDAD"` vai para nenhum campo; `"MUNICIPIO"` casa via `MUNICIPI` mas `"VILA"` não).
- O `tip` cai em fallback `"Vivienda"` quando a coluna não está mapeada (linha 835).

`augmentAssetFromHeaders` (linhas 585-703) é uma **segunda passada conservadora**: roda apenas para `prov1/2/3` quando o parser estruturado terminou, e preenche **apenas campos que ficaram em `"—"`**. Nunca sobrescreve o que o parser já capturou (linhas 1024-1045).

### 2.5 Fusão IA + heurística (`mergeHeuristicIntoMapped`)

```typescript
export function mergeHeuristicIntoMapped(
  mappedAssets: Asset[],
  heuristicAssets: Asset[],
): Asset[] {
  const byHeurId = new Map(heuristicAssets.map((a) => [a.id, a]));
  const mergedById = new Map<string, Asset>();
  const orderIds: string[] = [];

  for (const ai of mappedAssets) {
    const existing = mergedById.get(ai.id);
    if (existing) { mergedById.set(ai.id, mergeAssetsSameId(existing, ai)); continue; }
    const hi = byHeurId.get(ai.id);
    const merged = hi ? mergeAssetsSameId(ai, hi) : ai;
    mergedById.set(ai.id, merged);
    orderIds.push(ai.id);
  }
  for (const hi of heuristicAssets) {
    const existing = mergedById.get(hi.id);
    if (existing) { mergedById.set(hi.id, mergeAssetsSameId(existing, hi)); continue; }
    mergedById.set(hi.id, hi);
    orderIds.push(hi.id);
  }
  return orderIds.map((id) => mergedById.get(id)!);
}
```

> **⚠️ Sem early-return**: mesmo que um dos arrays venha vazio, o outro pode ter IDs duplicados internamente que precisam ser fundidos via `mergeAssetsSameId` (caso contrário, mesmo bug de `ON CONFLICT`). Coberto pelo teste `excel-import.test.ts:213-239`.

O `mergeAssetsSameId` (linhas 443-469) usa `pickStr` (regra "preferir não-vazio, com `curr` ganhando se ambos preenchidos") para campos texto e `mergeAdmPreferNonEmpty` para o sub-objeto `adm`. `excelRaw` é fundido pelo `mergeExcelRawMaps` (preserva todas as planilhas de origem).

### 2.6 Deduplicação e o risco de `ON CONFLICT`

```typescript
export function dedupAssetsByIdWithCount(
  assets: Asset[],
): { assets: Asset[]; duplicates: Map<string, number> } {
  const byId = new Map<string, Asset>();
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const a of assets) {
    const prev = byId.get(a.id);
    if (prev) {
      byId.set(a.id, mergeAssetsSameId(prev, a));
      counts.set(a.id, (counts.get(a.id) ?? 1) + 1);
    } else {
      byId.set(a.id, a);
      order.push(a.id);
    }
  }
  return { assets: order.map(id => byId.get(id)!), duplicates: counts };
}
```

> **⚠️ Risco crítico:** o Postgres em `INSERT ... ON CONFLICT DO UPDATE` rejeita o batch inteiro com `"ON CONFLICT DO UPDATE command cannot affect row a second time"` se o mesmo `id` aparece duas vezes no array. Isso acontece tanto quando o Excel tem linhas duplicadas (legítimo) quanto quando o mesmo activo aparece em várias planilhas (Proveedor 1 + Proveedor 2 do mesmo cliente).

A dedup é aplicada em **três lugares defensivamente**:

| Local | Linha | Por quê |
|---|---|---|
| `parseExcelFile` (interno, byId Map) | 1050-1055 | fusão final entre planilhas |
| `parseExcelHeuristic` | 907 | mesmo id em várias hojas raw |
| `upsertAssets` (server) | 268-270 | proteção final — o caller pode passar duplicatas |

O Map `duplicates` retornado é propagado até a UI como `dupTotals` (`UploadActivosModal.tsx:412,428-433`) e logado como warning com IDs de exemplo.

---

## 3. ETAPA 2 — GRAVAÇÃO RÁPIDA (db-raw)

**Arquivo fonte:** `src/app/actions/assets.ts` (server action `upsertAssets`)
**Trigger no cliente:** `UploadActivosModal.tsx:406-457`
**Input:** `Asset[]` parseado
**Output:** `UpsertAssetsResult = { inserted, updated, errors, duplicatesMerged }`

### 3.1 Por que gravar antes do enriquecimento

Decisão de UX explicada no comentário (linha 405): _"El usuario ve los activos en el CRM en segundos, sin esperar enriquecimiento."_

A UI mostra o banner verde "✓ Activos ya disponibles en el CRM — puedes cerrar y volver más tarde" (linha 977) assim que o step `db-raw` termina. Os steps subsequentes (AI, Catastro, backfill) seguem em background.

### 3.2 `upsertAssets` — anatomia

```typescript
export async function upsertAssets(assets: Asset[]): Promise<UpsertAssetsResult> {
  await requireAdmin();
  const supabase = await createServiceClient();
  // ...
  const { assets: deduped, duplicates } = dedupAssetsByIdWithCount(assets);
  // ...
  const BATCH_SIZE = 50;
  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE);
    const batchIds = batch.map(a => a.id);

    const { data: existingRows, error: fetchErr } = await supabase
      .from("assets").select("*").in("id", batchIds);
    // ...
    const rows = batch.map(a => {
      const incoming = assetToRow(a);
      const existing = existingMap.get(a.id);
      const merged = existing ? mergeRowPreferNonEmpty(existing, incoming) : incoming;
      applyMapFromLatLng(merged);
      return merged;
    });

    const { error: upsertErr } = await supabase
      .from("assets")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: false });
```

**Fluxo por batch de 50:**

1. Fetch dos `existingRows` por `id IN (...)` para conhecer o estado atual.
2. Para cada incoming: monta `rows = mergeRowPreferNonEmpty(existing, incoming)`.
3. `applyMapFromLatLng(merged)` (ver 3.4).
4. `.upsert(rows, { onConflict: "id", ignoreDuplicates: false })`.
5. Conta `inserted` (não estava no `existingMap`) vs `updated`.

> **⚠️ Discrepância de batch size:** o cliente em `UploadActivosModal.tsx:28` usa `DB_BATCH_SIZE = 100`, mas o server faz **rebatch interno de 50** dentro de cada chamada. Resultado efetivo: o cliente envia 100 por RPC, o server quebra em 2×50.

### 3.3 `mergeRowPreferNonEmpty` — campos que NUNCA são sobrescritos

```typescript
function mergeRowPreferNonEmpty(existing, incoming) {
  const merged = { ...existing };

  for (const key of Object.keys(incoming)) {
    if (PRESERVE_FIELDS.has(key)) continue; // id, created_at, updated_at

    const inVal = incoming[key];
    const exVal = existing[key];

    if (key === "excel_raw") {
      const combined = mergeExcelRawMaps(exVal, inVal);
      if (combined && Object.keys(combined).length > 0) merged[key] = combined;
      continue;
    }
    if (key === "pub") {
      if (inVal === true) merged[key] = true; // só override se incoming é true
      continue;
    }
    if (key === "fav") continue;             // NUNCA sobrescreve

    if ((key === "lat" || key === "lng") && inVal == null && exVal != null) continue;
    if (key === "map" && isEmptyVal(inVal) && !isEmptyVal(exVal)) continue;

    if (!isEmptyVal(inVal)) merged[key] = inVal;
  }
  return merged;
}
```

| Campo | Comportamento | Motivo |
|---|---|---|
| `id`, `created_at`, `updated_at` | Sempre preservados | timestamp / chave |
| `pub` | Só vira `true`; nunca volta a `false` por re-import | admin pode ter ativado manualmente |
| `fav` | **Nunca tocado** | flag de UI individual |
| `lat`, `lng` | Preservados se incoming é `null` | dados de geocodificação caros |
| `map` | Preservado se incoming é vazio (`""`/`—`) | URL do mapa real |
| `excel_raw` | Fusão (não substituição) via `mergeExcelRawMaps` | preserva histórico de planilhas |
| Demais campos | Incoming vence se não-vazio (`""`, `"—"`, `null`) | "fill-empty" para CRM |

Validado pelo teste `actions-assets.test.ts:120-189` ("preserva pub=true, lat/lng existentes ante incoming vacío").

### 3.4 `applyMapFromLatLng` — quando e por quê

```typescript
function applyMapFromLatLng(row: Record<string, any>): void {
  const lat = row.lat;
  const lng = row.lng;
  if (lat == null || lng == null) return;
  // ...
  const current = String(row.map ?? "").trim();
  if (current && !isProviderStaticMapUrl(current)) return;
  const geo = buildStaticMapUrl(String(lo), String(la));
  if (geo) { row.map = geo; return; }
  row.map = `https://staticmap.openstreetmap.de/staticmap?center=...&zoom=15&size=600x400`;
}
```

**Quando dispara:**

- Há lat/lng finitos na row mergeada.
- O `map` atual é vazio OU é uma URL provider-static (`geoapify.com` / `staticmap.openstreetmap.de`).

**Quando NÃO dispara** (preserva mapa custom):

- `map` aponta para URL externa que não seja provider-static (ex.: imagem do imóvel passada manualmente pelo admin).

**Motivo:** sincroniza a URL do mapa estático com lat/lng após o merge. Se o admin tinha lat/lng salvos com Geoapify mas o incoming traz lat/lng diferentes (ex.: Catastro corrigiu), o mapa precisa ser regenerado.

### 3.5 `POSTGREST_PAGE_SIZE = 1000` e o problema `db-max-rows`

```typescript
// PostgREST (Supabase) aplica `db-max-rows = 1000` por request. `.range(0, N)` con
// N > 1000 NO destraba el límite: el servidor trunca igualmente y devuelve
// `Content-Range: 0-999/*` con `Status: 206 Partial Content`. Para leer tablas
// > 1000 filas hay que paginar manualmente.
const POSTGREST_PAGE_SIZE = 1000;
const MAX_PAGES = 100; // techo defensivo (100k filas).

async function fetchAllPaginated<Row>(label, buildQuery) {
  const all: Row[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * POSTGREST_PAGE_SIZE;
    const to = from + POSTGREST_PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);
    // ...
    if (batch.length < POSTGREST_PAGE_SIZE) break;
  }
  return all;
}
```

> **⚠️ Armadilha histórica**: passar `.range(0, 5000)` **não** destrava — o PostgREST retorna 206 Partial Content e ainda devolve só 1000 linhas. A solução implementada é paginar manualmente em chunks de 1000 até a página vir com menos elementos.

`fetchAssetsByIds` aplica a mesma técnica mas chunkeando o `.in("id", chunk)` em blocos de 1000 IDs (linhas 78-97) — relevante para a verificação pós-upload com >1000 ativos.

---

## 4. ETAPA 3 — DETECÇÃO DE FORMATO COM IA (ai-detect)

**Arquivo fonte:** `src/app/actions/claude-format-detect.ts`
**Trigger:** `UploadActivosModal.tsx:305-396` — **apenas se `parsed.length === 0` após `parseExcelFile`**.
**Input:** preview das primeiras 5 linhas de cada planilha (`extractRawPreview`)
**Output:** `{ mapping: { [colIdx]: string }, confidence: number, description: string }`

### 4.1 `detectFormatWithClaude` — prompt e resposta

O system prompt (linhas 65-82) descreve para o Claude:

- Os campos disponíveis do `Asset` (incluindo `adm.*` prefixados para o sub-objeto admin).
- Formato esperado: `{ "mapping": { "0": "campo", ... }, "confidence": 0..1, "description": "..." }`.
- Regra: o campo `id` é obrigatório; se ninguém parece um ID, escolhe o "mais adequado".

O parsing da resposta é **frouxo** (linhas 127-132): aceita um match `{ ... }` mais externo via regex `/\{[\s\S]*\}/`, sem balanceamento (diferente do `extractFirstJsonObject` mais robusto em `claude.ts:83`).

### 4.2 `parseWithMapping` — usando o mapeamento

```typescript
export function parseWithMapping(
  file: File,
  mapping: Record<number, string>,
): Promise<Asset[]> {
  // ...
  for (const [colStr, fieldName] of Object.entries(mapping)) {
    const col = parseInt(colStr, 10);
    const val = s(row[col]);
    if (fieldName.startsWith("adm.")) {
      admFields[fieldName.slice(4)] = val;
    } else {
      fields[fieldName] = val;
    }
  }
  // ...
  return assets.push({ id, cat: fields.cat ?? "—", ... });
```

Cria assets a partir do mapeamento coluna→campo. Suporta nome com prefixo `adm.` (ex.: `"adm.car"`, `"adm.cli"`) para alimentar o sub-objeto admin. Aplica `dedupAssetsById` no final.

### 4.3 Fusão final na UI

```typescript
parsed = mergeHeuristicIntoMapped(mappedFromAi, heuristicAssets);

// ...
if (mappedFromAi.length > 0 && heuristicAssets.length > 0) {
  updateStep("ai-detect", { status: "done", detail: `IA fusionada con cabeceras · ${parsed.length} activo(s)` });
```

> **⚠️ Por que a fusão e não só a IA:**
>
> - A IA frequentemente omite campos óbvios para humanos (ex.: `cat`, `addr`, `fullAddr`).
> - A heurística reconhece exatamente esses sinônimos (`"Categoría"`, `"ADDRESS"`).
> - O merge preenche as lacunas — perde-se menos dado.

Os 4 estados possíveis da step (linhas 359-388):

| Cenário | Status | Detail |
|---|---|---|
| `parsed === 0` | `error` | "Ni IA ni heurística extrajeron filas válidas" |
| só heurística | `skipped` | "Sólo heurística: N activo(s)" |
| IA + heurística | `done` | "IA fusionada con cabeceras · N activo(s)" |
| só IA | `done` | "N activo(s) con mapeo IA" |

---

## 5. ETAPA 4 — VALIDAÇÃO IA (ai-validate)

**Arquivo fonte:** `src/app/actions/claude.ts`
**Trigger:** `UploadActivosModal.tsx:461-521`
**Input:** Asset[] parseado
**Output:** `ClaudeAssetResult[]` (correções por id, parciais)

### 5.1 O que o Claude normaliza

System prompt (`claude.ts:25-53`) instrui Claude Sonnet 4 a:

1. **Validar** — incoerências CP/provincia, campos vazios, preços suspeitos (0€ ou >50M€).
2. **Classificar tipologia** (`tip` → `tipC`): Vivienda/Parking/Trastero/Local/Nave/Oficina/Suelo/Edificio/Comercial.
3. **Classificar fase judicial** (`fase` → `faseC`): `fp-pub`, `fp-sus`, `fp-seg`, `fp-res`, `fp-nd` (a partir de textos livres de `ejud`/`ejmap`/`eneg`).
4. **Normalizar provincia** — erros tipográficos comuns.
5. **Normalizar CP** — 5 dígitos, coerência com provincia.

`slimAsset` (linhas 55-73) envia ao Claude **apenas** 14 campos relevantes (não o asset inteiro, para economizar tokens).

Resposta validada via `extractFirstJsonObject` (linhas 83-109) — parser balanceado que sobrevive a fenced code blocks (` ```json ... ``` `), prefixos textuais e chaves dentro de strings.

> **⚠️ Truncamento por max_tokens** (linhas 146-150): se `stop_reason === "max_tokens"`, lança erro explícito com sugestão de reduzir `AI_BATCH_SIZE`. `max_tokens = 8192` foi calibrado para batches de ~15 com warnings + summary sem truncar.

### 5.2 Batches paralelos: tunables

```typescript
const AI_BATCH_SIZE = 15;          // activos por llamada Claude
const AI_CONCURRENCY = 3;          // llamadas Claude en paralelo
const AI_SKIP_THRESHOLD = 500;     // omitir IA para archivos > N activos
const CATASTRO_BATCH_SIZE = 30;
const CATASTRO_CONCURRENCY = 6;
const DB_BATCH_SIZE = 100;
const DB_CONCURRENCY = 4;
```

A função `runConcurrent` (linhas 84-99) implementa um **worker-pool simples**: cria `min(concurrency, items.length)` "pumps" que consomem `items` por índice atômico (`next++`).

### 5.3 `AI_SKIP_THRESHOLD = 500` — quando dispara e o que acontece

```typescript
const skipAI = parsed.length > AI_SKIP_THRESHOLD;
if (skipAI) {
  updateStep("ai-validate", {
    status: "skipped",
    detail: `Omitido — ${parsed.length} activos supera el límite (${AI_SKIP_THRESHOLD}). Actívalo manualmente si necesitas validación IA.`,
  });
}
```

**Por que existe:** evitar centenas de chamadas pagas ao Claude para uploads em massa. Com 1000 activos e batch=15, seriam 67 chamadas (~$2-5 USD em tokens, ~3-5 min). Para >500 o admin precisa decidir ativamente.

> **⚠️ O que NÃO acontece quando ultrapassa:** o step fica `skipped`, mas o pipeline continua para Catastro e backfill. As correções de `tip`/`fase`/`prov`/`cp` ficam só com o que `normalizeTipo`/`faseToFaseC` produziram no parse.

### 5.4 `applyClaudeCorrections` — modelo "patch parcial"

```typescript
function applyClaudeCorrections(assets: Asset[], results: ClaudeAssetResult[]): Asset[] {
  const map = new Map<string, ClaudeAssetResult>();
  for (const r of results) map.set(r.id, r);
  return assets.map((a) => {
    const c = map.get(a.id);
    if (!c) return a;
    return {
      ...a,
      tip: c.tip ?? a.tip,
      tipC: c.tipC ?? a.tipC,
      fase: c.fase ?? a.fase,
      faseC: c.faseC ?? a.faseC,
      prov: c.prov ?? a.prov,
      cp: c.cp ?? a.cp,
    };
  });
}
```

Apenas 6 campos podem ser corrigidos. `null` no resultado IA = "sem correção" → mantém o valor original. Aplicado duas vezes no fluxo:

1. Em memória, logo após validação (linha 506).
2. Antes do upsert final pós-Catastro (linhas 616-622) — reaplica caso o `enrichAssetsBatch` tenha sobrescrito.

`aiWarnings` (linha 508) são armazenados separadamente e mostrados em accordion na UI (linhas 1025-1047).

---

## 6. ETAPA 5 — ENRIQUECIMENTO CATASTRO

**Arquivo fonte:** `src/app/actions/catastro.ts`
**Trigger:** `UploadActivosModal.tsx:525-659` — **apenas para IDs novos** (não presentes em `existing`).
**Input:** `Asset[]` (filtrado por `!existingIds.has(a.id)`)
**Output:** `{ assets, ok, skipped, failed, failuresByCategory }`

### 6.1 `enrichAssetsBatch` — concorrência e delay

```typescript
const CONCURRENCY = 3;
const BATCH_DELAY_MS = 500;
```

> **⚠️ Não confundir com `CATASTRO_CONCURRENCY = 6` do cliente:** o cliente faz 6 chamadas paralelas a `enrichAssetsBatch`, e cada uma roda 3 lookups paralelos internamente. Pico teórico = 18 requests simultâneos ao DNP — comentário linha 30-31 menciona que foi reduzido de 5→3 para evitar 503/429 do Catastro.

Os `slice(i, i+3)` rodam em `Promise.all`, depois `sleep(500)` antes do próximo slice.

### 6.2 `fetchConsultaDnprc` — retry logic

```typescript
export async function fetchConsultaDnprc(refCat: string): Promise<CatastroDnprcParsed> {
  const ref = normalizeCadastralRef(refCat);
  if (!isPlausibleCadastralRef(ref)) {
    return emptyResult(ref, "Referencia catastral no válida o ausente");
  }
  let last: DnpAttempt | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    last = await fetchConsultaDnprcOnce(ref);
    if (!last.parsed.error) return last.parsed;
    if (!last.transient || attempt === MAX_RETRIES) return last.parsed;
    const backoff = RETRY_BASE_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
    await sleepDnp(backoff);
  }
}
```

- **MAX_RETRIES = 2** → 3 tentativas no total.
- **RETRY_BASE_MS = 600** com backoff exponencial + jitter (até 200ms).
- **TRANSIENT_HTTP_STATUSES**: `{408, 425, 429, 500, 502, 503, 504}` → reintentam.
- HTTP 4xx (404, 400) → NÃO reintenta.
- `AbortError` (timeout 15s configurado em `signal: AbortSignal.timeout(15_000)`) → reintenta.

Coberto pelos testes em `catastro-retry.test.ts:64-119`.

### 6.3 Categorias de erro (`CatastroFailureCategory`)

```typescript
export type CatastroFailureCategory =
  | "http_5xx_429"      // throttle → reintentável
  | "http_4xx"          // permanente
  | "timeout"           // reintentável
  | "ref_not_found"     // permanente — ref não existe no DNP
  | "structure_unknown" // permanente — schema mudou
  | "network_error"     // reintentável
  | "other";
```

`classifyCatastroError` (linhas 15-24) usa regex para classificar `error.message`. `tallyCatastroFailures` agrega contagem por categoria para o resumo.

A UI define `TRANSIENT_CATEGORIES` como `{ http_5xx_429, timeout, network_error }` (`UploadActivosModal.tsx:34-36`) — só essas vão para o botão "Reintentar" do banner.

### 6.4 Geoapify + URL do mapa estático

Fluxo dentro de cada enrich:

```typescript
const query = buildGeocodeQuery({
  direccionCompleta: row.direccionCompleta,
  municipio: row.municipio,
  provincia: row.provincia,
  codigoPostal: row.codigoPostal,
});
let mapUrl = "";
if (query.trim()) {
  const geo = await geocodeAddressLine(query);
  if (geo) mapUrl = buildStaticMapUrl(geo.lon, geo.lat) || "";
}
const partial = catastroParsedToPartialAsset(row, mapUrl);
ok++;
return applyCatastroOverwrite(asset, partial);
```

`geocodeAddressLine` (`geoapify.ts:57-100`) usa `https://api.geoapify.com/v1/geocode/search` com `lang=es`, `limit=1`, timeout 12s. Sem `GEOAPIFY_API_KEY` retorna `null` e loga `reason: "no-key"`.

`buildStaticMapUrl` gera `https://maps.geoapify.com/v1/staticmap?center=lonlat:lon,lat&zoom=15&width=600&height=400&style=osm-bright&apiKey=...`. Sem key retorna `""`.

### 6.5 `catastroParsedToPartialAsset` — campos preenchidos

```typescript
export function catastroParsedToPartialAsset(row, mapUrl): Partial<Asset> {
  const supCNum = parseNumMaybe(row.superficieConstruida);
  const supGNum = parseNumMaybe(row.superficieGrafica);
  const partial: Partial<Asset> = {
    catRef, clase, uso, bien, prov, pob, cp, fullAddr,
    tvia, nvia, num, esc, pla, pta,
    supC, supG, sqm, age, coef, desc,
  };
  if (mapUrl.trim()) partial.map = mapUrl;
  return partial;
}
```

**21 campos** podem ser preenchidos. `map` só entra no partial se `mapUrl` não-vazio (evita "esvaziar" um mapa válido prévio).

### 6.6 `applyCatastroOverwrite` vs `mergePartialIntoAssetFillEmpty`

Duas estratégias, escolhidas em contextos diferentes:

| Função | Quando usada | Política |
|---|---|---|
| `applyCatastroOverwrite` | `enrichAssetsBatch` durante upload | **Sobrescreve** com dados do Catastro (Catastro é fonte de verdade) |
| `mergePartialIntoAssetFillEmpty` | `enrichAssetsWithCatastro` (legacy) + `refreshAssetCatastro` sem `forceOverwrite` | **Fill-empty** — só preenche se atual estiver `"—"` |
| `applyCatastroOverwrite` | `refreshAssetCatastro` com `opts.forceOverwrite: true` (botão "Forzar") | sobrescreve idem ao upload |

```typescript
function applyCatastroOverwrite(asset: Asset, partial: Partial<Asset>): Asset {
  const enriched: Asset = { ...asset, ...partial, adm: { ...asset.adm } };
  if (partial.catRef) enriched.adm.cref = partial.catRef;
  if (partial.prov) enriched.adm.prov = String(partial.prov).toUpperCase();
  if (partial.pob) enriched.adm.city = partial.pob;
  if (partial.cp) enriched.adm.zip = partial.cp;
  if (partial.fullAddr && partial.fullAddr !== "—") {
    enriched.fullAddr = partial.fullAddr;
    enriched.addr = partial.fullAddr;
    enriched.adm.addr = partial.fullAddr;
  }
  return enriched;
}
```

> **⚠️ Sintoma de inconsistência:** se um asset tem `tip="Comercial"` legítimo no Excel e o Catastro diz `"VIVIENDA"`, o upload (overwrite) muda para Vivienda — desejado? Comentário implícito: sim, porque o Catastro tem dado oficial. Mas se for erro de catRef, é falso-positivo.

---

## 7. ETAPA 6 — GEOCODIFICAÇÃO PÓS-IMPORT (`backfillUploadedMaps`)

**Arquivo fonte:** `src/app/actions/maps.ts` (server action)
**Trigger:** `UploadActivosModal.tsx:692-744`, depois do upsert final.
**Input:** `string[]` (IDs persistidos com sucesso)
**Output:** `BackfillUploadedSummary` (10 campos: `requested`, `geocoded`, `unresolved`, `persisted`, `driftIds`, `unresolvedIds`, `persistError`, `byMethod`, etc.)

### 7.1 Pipeline

```typescript
// 1) Leitura das linhas persistidas (service role)
const { data, error } = await sb.from("assets").select("*").in("id", ids);

// 2) Filtragem por shouldBackfillMapFromAddress
const candidates = rows.filter((a) => shouldBackfillMapFromAddress(a));
const stubs: AssetStub[] = candidates.map((a) => ({
  id: a.id, addr: a.addr, pob: a.pob, prov: a.prov, cp: a.cp,
  fullAddr: a.fullAddr, tvia, nvia, num,
  catRef: a.catRef, cref: a.adm?.cref,
  lat: a.lat, lng: a.lng,
}));

// 3) geocodeLadder em batches de 4 com delay 200ms
const result = await backfillMissingMaps(stubs);

// 4) Distribuição por método
const byMethod = {}; for (const hit of Object.values(result.hits)) byMethod[hit.method]++;

// 5) Read-back de verificação
const { data: verified } = await sb.from("assets").select("id, lat, lng").in("id", hitIds);
driftIds = hitIds.filter((id) => !present.get(id) || row.lat == null || row.lng == null);
```

### 7.2 `shouldBackfillMapFromAddress`

```typescript
export function shouldBackfillMapFromAddress(a): boolean {
  if (isPlaceholderMapUrl(a.map)) return true;
  if (a.map?.includes("staticmap.openstreetmap.de")) return true;
  if (a.lat == null && a.lng == null) return hasUsableAddress(a);
  return false;
}
```

Três disparadores: (a) URL é o placeholder de Madrid; (b) é fallback OSM; (c) sem lat/lng E tem endereço utilizável.

### 7.3 `isPlaceholderMapUrl` — detecta o "mapa de Madrid"

```typescript
export function isPlaceholderMapUrl(m: string | null | undefined): boolean {
  if (m == null || !String(m).trim()) return true;
  let s = m;
  try { s = decodeURIComponent(m); } catch { /* usar raw */ }
  const u = s.toLowerCase();
  if (u.includes("maps.geoapify.com")) {
    if (u.includes("lonlat:" + madridLonLatKey()) && u.includes("zoom=6")) return true;
  }
  if (u.includes("staticmap.openstreetmap.de")) {
    if (u.includes("40.4168") && u.includes("-3.7038") && u.includes("zoom=6")) return true;
  }
  return false;
}
```

Reconhece o `defaultMapUrlForClient()` (mapa de Madrid centrado, zoom 6) em ambas as variantes (Geoapify e OSM).

> **⚠️ `decodeURIComponent` envolto em try/catch** porque URLs malformadas com `%` solto quebrariam o decoder.

### 7.4 Os 7 passos do `geocodeLadder` (em ordem)

**Arquivo:** `src/lib/catastro/geocode-ladder.ts`

| # | Método (`GeoMethod`) | Função | Confidence | Critério de match |
|---|---|---|---|---|
| 1 | `direct` | `tryDirect` | 1.0 | Já tem `lat`/`lng` finitos na linha (sem chamar Geoapify) |
| 2 | `catastro` | `tryCatastro` | 0.95 | Tem `catRef`/`cref` plausível → DNP retorna `direccionCompleta` → geocodifica |
| 3 | `fulladdr` | `tryFullAddr` | 0.85 | Tem `fullAddr` não-vazio; concatena com cp/pob/prov para desambiguar |
| 4 | `fulladdr` / `reconstructed` | `tryAddrOrReconstructed` | 0.8 / 0.75 | Tem `addr` (fulladdr) ou reconstrói de `tvia + nvia + num` (reconstructed) |
| 5 | `structured` | `tryStructured` | 0.65 | Postcode + city + state |
| 6 | `coarse:cp+pob+prov` | `tryCoarse` (1º combo) | 0.6 | Degradação progressiva |
| 7 | `coarse:cp+pob` / `pob+prov` / `cp` / `pob` | `tryCoarse` (combos seguintes) | 0.55 → 0.35 | Última tentativa |

> **⚠️ Nota explícita** (linha 222): `prov` sozinha é **omitida** intencionalmente — devolver o centroide de provincia é enganoso. Cada passo loga seu próprio evento via `logGeo`; o sumário final loga `op: "ladder"` com `method` vencedor e `confidence`.

### 7.5 Read-back e `driftIds`

```typescript
const { data: verified, error: verifyErr } = await sb
  .from("assets").select("id, lat, lng").in("id", hitIds);
// ...
driftIds = hitIds.filter((id) => {
  const row = present.get(id);
  if (!row) return true;
  return row.lat == null || row.lng == null;
});
```

**Drift** = a função `backfillMissingMaps` reportou hit para o ID, mas o read-back não acha `lat`/`lng` na linha. Causas possíveis:

- Race condition entre upsert do backfill e outro update concorrente.
- Trigger no banco apagando os campos.
- RLS bloqueou o select (silenciosamente?).

> **⚠️ Drift é separado de `persistError`:** se o upsert falhou inteiro, `persistError != null`; se persistiu mas o read-back não confirma, vai pro `driftIds`. A UI loga: `"Mapas: ${r.driftIds.length} fila(s) geocodificada(s) sin lat/lng confirmados en BD (drift)"` (`UploadActivosModal.tsx:714-720`).

### 7.6 `backfillMissingMaps` — retry de upsert

```typescript
const attempt = async (): Promise<{ error: string | null }> => {
  const { error } = await sb.from("assets").upsert(updates, {
    onConflict: "id", ignoreDuplicates: false,
  });
  return { error: error?.message ?? null };
};
let { error } = await attempt();
if (error && isTransientUpsertError(error)) {
  // ...
  await sleep(RETRY_DELAY_MS);
  ({ error } = await attempt());
}
```

Reintenta **uma vez** se o erro casa com `/timeout|timed? out|fetch failed|ECONNRESET|ENETUNREACH|EAI_AGAIN|503|502|504/i`. Erros de RLS/schema (`42501`, etc.) **não** reintentam. Coberto pelos testes `maps-persistence.test.ts:79-106`.

---

## 8. FLUXO DE ERROS E RETRY

### 8.1 Retry de Catastro pelo usuário (`handleRetryCatastro`)

```typescript
const handleRetryCatastro = useCallback(async () => {
  const transientIds = catFailedList
    .filter(f => TRANSIENT_CATEGORIES.has(classifyCatastroError(f.error)))
    .map(f => f.id);
  if (transientIds.length === 0) {
    setCatRetryMsg("No hay errores reintentables (los restantes son refs no encontradas o 4xx permanentes).");
    return;
  }
  // ...
  const r = await retryCatastroForIds(transientIds);
```

`TRANSIENT_CATEGORIES = { http_5xx_429, timeout, network_error }` — só esses passam pelo retry. O `retryCatastroForIds` (server) recarrega os assets da BD, chama `enrichAssetsBatch` de novo e persiste via `upsertAssets`.

### 8.2 `failedUpserts` e verificação pós-upload

Duas fontes alimentam `finalFailures`:

```typescript
try {
  await runConcurrent(dbBatches, async (batch) => {
    try {
      const result = await upsertAssets(batch);
      if (result.errors.length > 0 && result.inserted + result.updated < batch.length) {
        for (const a of batch) finalFailures.push({ id, reason: result.errors[0] });
      }
    } catch (err) {
      // captura individual: se requireAdmin throw, marca TODOS os IDs
      for (const a of batch) finalFailures.push({ id, reason: msg });
    }
  }, DB_CONCURRENCY);
} catch (err) {
  // catch externo: se runConcurrent rejeita inteiro
  for (const a of toSave) finalFailures.push({ id, reason: msg });
}
```

E logo após, **verificação post-upsert**:

```typescript
try {
  const expectedIds = parsed.map(a => a.id);
  const present = await fetchAssetsByIds(expectedIds);
  const presentIds = new Set(present.map(a => a.id));
  for (const id of expectedIds) {
    if (!presentIds.has(id) && !finalFailures.some(f => f.id === id)) {
      finalFailures.push({ id, reason: "no encontrado en BD tras el upsert" });
    }
  }
} catch (err) {
  console.error("[upload] verificación post-upsert falló:", err);
}
```

> **⚠️ Esta verificação é a última defesa contra falhas silenciosas** — converte _"o upsert disse ok mas a linha não existe"_ em mensagem visível.

### 8.3 `FailedUpsertsBanner` — UI

```typescript
function FailedUpsertsBanner({ failures, total, open, onToggle }) {
  // ...
  return (
    <div className="rounded-lg border border-red-300 bg-red-50">
      // ... "N de M activo(s) no se guardaron"
      // "Estas filas NO están en la base de datos. Al refrescar la página no aparecerán."
      // botão "Copiar IDs" (clipboard)
      // accordion com até 100 IDs + reason
```

Mensagens claras + botão para copiar IDs (debug). Mostrado tanto em `status === "success"` (com warning amarelo) quanto em `status === "error"`.

### 8.4 Estrutura do log baixado

```typescript
const downloadLog = useCallback(() => {
  const lines = logsRef.current.map(l => `[${l.ts}] ${l.level.toUpperCase()} ${l.msg}`);
  const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
  // ...
  a.download = `propcrm-upload-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
```

Formato simples — uma linha por evento:

```text
[2026-06-09T12:00:00.000Z] INFO Inicio de upload: file.xlsx (123.4 KB)
[2026-06-09T12:00:01.234Z] INFO Parser estructurado: 50 activos · hojas: Proveedor 1=prov1(50r,50p,off=0)
[2026-06-09T12:00:02.456Z] WARN Hoja "Hoja3": 10/20 fila(s) parseadas — 10 descartadas
[2026-06-09T12:00:30.789Z] ERROR ...
```

Espelhamento simultâneo no `console.*` do navegador (`pushLog` linhas 215-224).

---

## 9. IMPACTO NO CONTEXTO GLOBAL (AppContext)

**Arquivo:** `src/lib/context.tsx`

### 9.1 `addAssets` — otimista, sem refresh

```typescript
const addAssets = useCallback((assets: Asset[]) => {
  if (assets.length === 0) return;
  setState(prev => {
    const indexById = new Map(prev.assets.map((a, i) => [a.id, i]));
    const next = [...prev.assets];
    for (const a of assets) {
      const i = indexById.get(a.id);
      if (i !== undefined) next[i] = a;
      else { next.push(a); indexById.set(a.id, next.length - 1); }
    }
    return { ...prev, assets: next };
  });
}, []);
```

**Update otimista in-place** — chamado pelo upload (`UploadActivosModal.tsx:564`) após cada batch de Catastro para que o usuário veja os assets enriquecidos sem esperar `refreshAssets`. Faz "upsert" no array local: se o ID já existe, substitui; senão, push.

### 9.2 `refreshAssets` — quando é chamado e por quê

Chamado em **3 momentos**:

| Quando | Linha | Motivo |
|---|---|---|
| Após `db-raw` step | `UploadActivosModal.tsx:437` | Para garantir consistência server-cliente após gravação rápida |
| Após `handleRetryCatastro` | `UploadActivosModal.tsx:784` | Refletir dados enriquecidos do retry |
| Event listener `propcrm-assets-updated` | `context.tsx:246-263` | Disparado pelo upload no final (`window.dispatchEvent`) |

Cada chamada é cancelável via token (`assetsLoadTokenRef`): se outra `refreshAssets` for chamada antes da primeira terminar, a primeira aborta silenciosamente (linhas 99, 113, 135, 141).

### 9.3 `loadAssetsFromServer` — backfill no carregamento inicial

```typescript
const loadAssetsFromServer = useCallback(async () => {
  const token = ++assetsLoadTokenRef.current;
  setState((prev) => ({ ...prev, assetsLoading: true, assetsError: null }));
  try {
    let rows = await fetchAssets();
    if (token !== assetsLoadTokenRef.current) return;

    const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;
    if (GEOAPIFY_KEY && rows.length > 0) {
      const needMap = rows.filter(
        (a) => a.lat == null && a.lng == null && shouldBackfillMapFromAddress(a),
      );
      for (let i = 0; i < needMap.length; i += BACKFILL_CHUNK) { // 100
        if (token !== assetsLoadTokenRef.current) return;
        const chunk = needMap.slice(i, i + BACKFILL_CHUNK);
        const stubs = chunk.map((a) => ({ id, addr, pob, prov, cp }));
        try {
          const { hits } = await backfillMissingMaps(stubs);
          rows = rows.map((a) => {
            const h = hits[a.id];
            if (!h) return a;
            return { ...a, map: h.map, lat: h.lat, lng: h.lng };
          });
        } catch { /* chunk sin backfill */ }
      }
    }
```

> **⚠️ Apenas passa 5 campos** ao backfill (`id, addr, pob, prov, cp`), portanto o ladder não consegue usar os passos `catastro` (não tem catRef) nem `direct` (não tem lat/lng, mas filtra antes). Só restam `fulladdr/addr/structured/coarse`. Isso é deliberado — o backfill server-side do upload já passou os campos completos via `backfillUploadedMaps`.

**Token de cancelamento** (`assetsLoadTokenRef.current`) é verificado em 4 pontos: antes de escrever state, após cada fetch e dentro do loop de chunks. Crucial para evitar race conditions quando o usuário troca de página.

> **⚠️ Comportamento em erro**: se `fetchAssets` falha, `state.assets = []` e `assetsError = msg` — NÃO mantém mocks (comentário linha 138-139: _"engañoso"_).

---

## 10. BANCO DE DADOS — SUPABASE/POSTGRES

### 10.1 Tabela `assets` — colunas críticas para upload

A tabela tem 80+ colunas. Subset relevante para o pipeline:

| Coluna (DB) | Asset (App) | Tipo | Notas |
|---|---|---|---|
| `id` | `id` | `text PRIMARY KEY` | Chave de upsert |
| `lat` | `lat` | `numeric` | Preservada se incoming é null |
| `lng` | `lng` | `numeric` | Idem |
| `map` | `map` | `text` | URL estática Geoapify/OSM/placeholder |
| `excel_raw` | `excelRaw` | `jsonb` | `{ sheetName: { col: val } }` |
| `pub` | `pub` | `boolean` | Só vira `true` no merge, nunca volta a `false` |
| `fav` | `fav` | `boolean` | Nunca tocado no merge |
| `cat_ref` | `catRef` | `text` | Catastral reference (input do ladder e DNP) |
| `tip`/`tip_c` | `tip`/`tipC` | `text` | Tipo + código curto |
| `fase`/`fase_c` | `fase`/`faseC` | `text` | Fase judicial + código |
| `adm_*` (~38 cols) | `adm.*` | `text` | Sub-objeto admin "achatado" |
| `owner_name`/`owner_tel`/`owner_mail` | `ownerName`/`ownerTel`/`ownerMail` | `text` | PII — sanitizado em `rowToAssetPublic` |
| `created_at`/`updated_at` | — | `timestamptz` | Em `PRESERVE_FIELDS` |

A conversão snake_case ↔ camelCase é centralizada em `src/lib/supabase/db.ts` via `rowToAsset`/`assetToRow`/`rowToAssetPublic`.

> **⚠️ Toda leitura/escrita deve passar por esses mappers** — se um campo escapa, ele desaparece silenciosamente.

### 10.2 `mergeExcelRawMaps` — preservação do bruto

```typescript
export function mergeExcelRawMaps(
  existing: Record<string, Record<string, string>> | null | undefined,
  incoming: Record<string, Record<string, string>> | null | undefined,
): Record<string, Record<string, string>> | undefined {
  if (!incoming || Object.keys(incoming).length === 0) return existing ?? undefined;
  if (!existing || Object.keys(existing).length === 0) return { ...incoming };
  const out: Record<string, Record<string, string>> = { ...existing };
  for (const sheet of Object.keys(incoming)) {
    const inc = incoming[sheet];
    const prev = out[sheet] ?? {};
    const merged: Record<string, string> = { ...prev };
    const keys = new Set([...Object.keys(prev), ...Object.keys(inc)]);
    for (const k of keys) {
      const bv = inc[k]; const av = merged[k];
      const bOk = bv != null && bv !== "" && bv !== "—";
      const aOk = av != null && av !== "" && av !== "—";
      if (bOk) merged[k] = bv;
      else if (aOk) merged[k] = av;
      else merged[k] = (bv ?? av ?? "") as string;
    }
    out[sheet] = merged;
  }
  return out;
}
```

**Modelo de dois níveis**: `{ "Proveedor 1": { "UF": "...", "Dirección": "..." }, "Proveedor 2": { ... } }`.

- Se incoming vazio → mantém existing.
- Se existing vazio → spread do incoming.
- Para cada planilha: cell-by-cell, "preferir não-vazio do incoming" (matriz idêntica ao `mergeAdmPreferNonEmpty`).

**Por que isso importa:** quando um cliente reimporta o mesmo XLSX com nova hoja, o `excel_raw` acumula histórico. A UI da ficha do activo tem uma seção "Datos Excel" que permite o admin re-mapear colunas. Também protege contra perda quando o upload for "parcial" (só uma das planilhas do trimestre).

> **⚠️ Validação de payload** (`validateExcelRawPayload`, linhas 131-153): limite de **500.000 caracteres** JSON, sheet name ≤200 chars, col name ≤500 chars, value ≤50.000 chars. Protege contra DOS via payload gigante.

### 10.3 `onConflict: "id"` e `ignoreDuplicates: false`

Toda chamada `.upsert(rows, { onConflict: "id", ignoreDuplicates: false })`:

- **`onConflict: "id"`**: usa a chave primária para detectar conflito → `INSERT ... ON CONFLICT (id) DO UPDATE`.
- **`ignoreDuplicates: false`**: queremos **atualizar** em caso de conflito, não pular silenciosamente. (Se fosse `true`, o re-import nunca atualizaria nada.)

> **⚠️ Restrição crítica do Postgres**: `ON CONFLICT DO UPDATE` falha se o array de rows tem **dois itens com o mesmo id** — mesmo bug coberto pelo dedup nos 3 locais (§2.6).

### 10.4 Service role vs anon key

| Cliente | Onde | Quando |
|---|---|---|
| `createClient()` (anon) | `src/lib/supabase/server.ts` | Leituras públicas (portal), respeita RLS |
| `createServiceClient()` (service role) | idem | Operações admin: `upsertAssets`, `enrichAssetsBatch`, `backfillUploadedMaps`, `deleteAllAssets` |

> **⚠️ Por quê service role no upload:** o `CLAUDE.md` explica que o login admin demo não passa JWT Supabase, então o anon não passaria a RLS. **Não é melhor prática genérica** — em produção com JWT real, RLS + anon seria mais seguro. Para o upload em massa (50-1000 rows com merge de fields), service role é mais simples.

`fetchPublicAssets` (`assets.ts:61-68`) é o único caso de leitura que usa explicitamente `createClient()` (anon) — sanitiza via `rowToAssetPublic` que zera PII e admin fields.

---

## 11. PONTOS DE ATENÇÃO PARA ATUALIZAÇÕES

### 11.1 Os 5 riscos mais críticos ao modificar este fluxo

| # | Risco | Como evitar |
|---|---|---|
| **1** | **Quebrar dedup → `ON CONFLICT DO UPDATE command cannot affect row a second time`** | Manter `dedupAssetsByIdWithCount` em **todas as três** entradas: `parseExcelHeuristic`, `parseWithMapping`, `upsertAssets`. Se adicionar nova entrada (ex.: `parseFromAPI`), dedup obrigatório. Cobertura: `excel-import.test.ts:180-211`, `199-211`. |
| **2** | **Sobrescrever `pub`/`fav`/`lat`/`lng`/`map` durante re-import** | `mergeRowPreferNonEmpty` em `assets.ts:180-217` é a única fonte de verdade. Adicionar test em `actions-assets.test.ts` para qualquer novo campo que deva ser preservado. ⚠️ Mudar `PRESERVE_FIELDS` ou as condições especiais (`if (key === "pub") ...`) sem teste = perder dados em produção. |
| **3** | **`db-max-rows=1000` truncando leituras silenciosamente** | Qualquer nova query que pode retornar >1000 linhas DEVE usar `fetchAllPaginated` (paginação) ou chunking de `.in()` (como `fetchAssetsByIds`). Não confiar em `.range(0, N)` para N>1000. |
| **4** | **Cascata de fallbacks quebrada quando IA/Catastro/Geoapify estão down** | O fluxo presume que cada step pode falhar isoladamente. Não adicionar `throw` que aborte o pipeline inteiro em handlers de IA/Catastro. ⚠️ Manter `try/catch` ao redor de cada step. Cobertura: `maps-persistence.test.ts:79-119`, `catastro-retry.test.ts:64-119`. |
| **5** | **Race condition entre `addAssets` (otimista) e `refreshAssets` (server)** | Se modificar o token `assetsLoadTokenRef`, garantir que TODAS as escritas em `state.assets` checam o token antes (linhas 99, 113, 135, 141 em `context.tsx`). Caso contrário, refresh tardio pode sobrescrever dados otimistas mais recentes. |

### 11.2 Testes que cobrem este fluxo

| Arquivo | Cobre |
|---|---|
| `src/__tests__/excel-import.test.ts` | `parseExcelFile` (regressão com fixtures reais), `parseExcelHeuristic`, `parseWithMapping`, `mergeHeuristicIntoMapped`, `dedupAssetsByIdWithCount`, detecção de offset, IDs vazios, fusão IA+heurística |
| `src/__tests__/actions-assets.test.ts` | `toggleAssetPub`, `fetchAssetById` (RLS), `upsertAssets` (preservação de pub/lat/lng/map) |
| `src/__tests__/maps-persistence.test.ts` | `backfillMissingMaps` (sucesso, transient retry, permanente sem retry, unresolved, OSM fallback) |
| `src/__tests__/catastro-retry.test.ts` | `fetchConsultaDnprc` (503 retry, 404 sem retry, AbortError retry, refs inválidas), `classifyCatastroError` (todas as 7 categorias) |
| `src/__tests__/geocode-ladder.test.ts` | 7 passos do ladder (presume cobertura dos `tryDirect/tryCatastro/...`) |
| `src/__tests__/map-default.test.ts` | `isPlaceholderMapUrl`, `shouldBackfillMapFromAddress`, `defaultMapUrlForClient` |
| `src/__tests__/geoapify-logger.test.ts` | `logGeo`, `classifyFetchError`, `safeSnippet` |

> **⚠️ Fixtures reais** (`ejemplo-datos-2.xlsx`, `prueba-5.xlsx`, `prueba-subida-100.xlsx`) estão em `.gitignore` e os testes que dependem deles são `describe.skipIf(!realFixturesPresent)`. **Em CI esses não rodam** — só os "sintéticos" via `makeXlsxFile`.

Comando para rodar só os testes do fluxo de upload:

```bash
npx vitest run src/__tests__/excel-import.test.ts src/__tests__/actions-assets.test.ts src/__tests__/maps-persistence.test.ts src/__tests__/catastro-retry.test.ts
```

### 11.3 Variáveis de ambiente críticas

| Variável | Obrigatória? | Sem ela acontece o quê |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Sim** | Pipeline falha no primeiro `createClient()` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Sim** | Idem |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sim** | `upsertAssets`, `enrichAssetsBatch`, `backfillUploadedMaps` falham com auth error |
| `ANTHROPIC_API_KEY` | Opcional | `validateAssetsBatch` retorna `{ error: "ANTHROPIC_API_KEY no configurada" }` no-op; `detectFormatWithClaude` idem. Fluxo segue, ai-validate fica `error`/sem correções. |
| `GEOAPIFY_API_KEY` (servidor) | Opcional | `buildStaticMapUrl` retorna `""`; `geocodeAddressLine` retorna `null` com log `reason: "no-key"`. Backfill produz 0 hits; cliente loga "Comprueba GEOAPIFY_API_KEY". |
| `NEXT_PUBLIC_GEOAPIFY_KEY` (cliente) | Opcional | `parseEnriquecido` emite warning e usa fallback OSM ou `defaultMap` (placeholder Madrid). `context.tsx:107` pula o backfill do `loadAssetsFromServer` se ausente. ⚠️ Server `getServerGeoapifyKeyInfo` usa essa como fallback se `GEOAPIFY_API_KEY` faltar. |
| `ASSET_UPSERT_AFTER_CATASTRO_ENRICH` | Opcional | Em `enrichAssetsWithCatastro` (NÃO usado pelo modal, mas pela `refreshAssetCatastro` legacy), se `"true"` executa upsert ao final. |

---

## Anexo — Resumo dos tunables

```text
Cliente (UploadActivosModal.tsx):
  AI_BATCH_SIZE         = 15
  AI_CONCURRENCY        = 3
  AI_SKIP_THRESHOLD     = 500
  CATASTRO_BATCH_SIZE   = 30
  CATASTRO_CONCURRENCY  = 6
  DB_BATCH_SIZE         = 100
  DB_CONCURRENCY        = 4

Servidor:
  upsertAssets       BATCH_SIZE = 50  (rebatch interno)
  enrichAssetsBatch  CONCURRENCY = 3  · BATCH_DELAY_MS = 500
  backfillMissingMaps CONCURRENCY = 4 · DELAY_MS = 200 · RETRY_DELAY_MS = 1000
  loadAssetsFromServer BACKFILL_CHUNK = 100
  fetchConsultaDnprc MAX_RETRIES = 2 · RETRY_BASE_MS = 600 (backoff exponencial + jitter) · timeout 15s
  geocodeAddressLine timeout 12s

Postgres / PostgREST:
  POSTGREST_PAGE_SIZE = 1000 (limite do db-max-rows)
  MAX_PAGES           = 100  (techo defensivo: 100k filas)
```

---

*Documento gerado a partir da leitura completa de `src/lib/normalize-excel.ts`, `src/app/admin/UploadActivosModal.tsx`, `src/app/actions/{assets,catastro,maps,claude,claude-format-detect}.ts`, `src/lib/catastro/{geocode-ladder,dnp,errors,to-partial-asset,geoapify}.ts`, `src/lib/{context,map-default,merge-asset-partial}.tsx`, `src/lib/supabase/db.ts` e dos testes em `src/__tests__/`.*
