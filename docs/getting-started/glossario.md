# Glossário

> **Propósito:** Definir termos de domínio usados no PropCRM.  
> **Público:** Desenvolvedores e operação.  
> **Última verificação:** 2026-06-12

## Negócio imobiliário

| Termo | Significado |
|-------|-------------|
| **NPL** | *Non-Performing Loan* — préstamo / dívida não performante; colateral imobiliário em processo de recuperação |
| **CDR** | Categoria de produto na plantilla Excel (distinto de NPL); inclui campos registrais e de stage |
| **REO** | *Real Estate Owned* — imóvel já na posse do credor (contexto de carteiras distressed) |
| **Inmueble** | Imóvel físico único; entidade `Asset` no código |
| **Propiedad** | Carga / lien / colateral financeiro ligado a um inmueble; pode haver várias por imóvel |
| **Referencia** | Referência catastral espanhola — PK do inmueble (`Asset.id`) |
| **NDA** | Acordo de confidencialidade no fluxo de ofertas |
| **Oportunidade** | Match automático comprador ↔ imóvel com score ≥ 25 |

## Sistema PropCRM

| Termo | Significado |
|-------|-------------|
| **Activo** | Sinónimo de inmueble na UI admin (lista `/admin`) |
| **Comprador** | Investidor ou comprador registado no CRM |
| **Vendedor / Agente** | Utilizador interno ou parceiro com carteira atribuída |
| **pub** | Flag booleana — imóvel visível no portal público |
| **excelRaw** | JSON com a linha Excel original por propiedad (auditoria) |
| **Server action** | Função `"use server"` em `src/app/actions/` — única forma de mutação DB |
| **dev-auth** | Cookie de desenvolvimento para login demo sem Supabase |

## Integrações

| Termo | Significado |
|-------|-------------|
| **Catastro / DNP** | Cadastro espanhol — API `Consulta_DNPRC` para dados cadastrais |
| **Geoapify** | Geocodificação e mapas estáticos |
| **Resend** | Serviço de envio de email transacional |

## UI (espanhol)

Labels da interface estão em espanhol: *Activos*, *Compradores*, *Ofertas*, *Oportunidades*, *Publicar*, etc. Manter consistência ao documentar fluxos operacionais.

## Ficheiros relacionados

- [`src/lib/types.ts`](../../src/lib/types.ts) — interfaces `Asset`, `Propiedad`, `Comprador`
- [`docs/arquitetura/modelo-dados.md`](../arquitetura/modelo-dados.md)
