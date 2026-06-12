# Gestão de activos (guia admin)

> **Propósito:** Operações na ficha e lista de imóveis no admin.  
> **Público:** Operação / admin.  
> **Última verificação:** 2026-06-12

## Lista `/admin`

- Filtrar e pesquisar activos
- Upload Excel — ver [admin-importar-excel.md](admin-importar-excel.md)
- Eliminar em massa (seleccionados)
- Toggle favorito admin

## Publicar no portal

- Abrir ficha `/admin/assets/[id]`
- Activar **Publicar** (`pub=true`) — imóvel visível em `/portal`
- Despublicar remove do catálogo público (mantém no CRM)

## Refresh Catastro

Quando mapa ou dados cadastrais estão incompletos:

1. Abrir ficha do imóvel
2. Usar acção **Refresh Catastro** (requer admin)
3. Sistema consulta cadastro espanhol + Geoapify
4. Preenche campos vazios (ou overwrite se forçado)

Ver [enriquecimento-catastro.md](../fluxos-tecnicos/enriquecimento-catastro.md).

## Convites a compradores

Na ficha do imóvel — secção clientes convidados:

- **Convidar** comprador → vê imóvel em `/portal/privado` mesmo se não publicado
- **Revogar** remove acesso

## Agentes

Atribuir vendedor ao imóvel ou comprador na ficha ou secção Agentes.

## Propiedades (cargas)

Tab admin mostra propiedades ligadas — dados de devedor, dívida, fase judicial, `excelRaw` editável.

## Documentos e notas

Upload documentos (Supabase Storage), notas internas, mensagens na ficha.

## Ficheiros relacionados

- [`src/app/admin/assets/[id]/page.tsx`](../../src/app/admin/assets/[id]/page.tsx)
- [`src/app/actions/invitations.ts`](../../src/app/actions/invitations.ts)
