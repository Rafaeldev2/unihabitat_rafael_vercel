import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { EMAIL_SUPPORT } from "@/lib/email/resend";
import { offerTemplate } from "@/lib/email/templates";

export interface OfertaNotificationRow {
  id: string;
  asset_id: string;
  comprador_id: string | null;
  vendedor_id: string | null;
  propuesta_euros: number;
  comentarios: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type Client = Awaited<ReturnType<typeof createServiceClient>>;

function cleanEmail(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Agentes asignados al activo; si no hay ninguno, el propietario del inmueble. */
async function resolveRecipients(sb: Client, assetId: string, ownerMail: string): Promise<string[]> {
  const { data: vaRows } = await sb.from("vendedor_assets").select("vendedor_id").eq("asset_id", assetId);
  const vendorIds = (vaRows ?? []).map((r: Row) => r.vendedor_id as string).filter(Boolean);
  if (vendorIds.length > 0) {
    const { data } = await sb.from("vendedores").select("email").in("id", vendorIds);
    const emails = (data ?? []).map((r: Row) => cleanEmail(r.email)).filter((e: string) => EMAIL_RE.test(e));
    if (emails.length > 0) return emails;
  }
  return EMAIL_RE.test(ownerMail) ? [ownerMail] : [];
}

async function loadParty(sb: Client, table: string, id: string | null | undefined, columns: string): Promise<Row> {
  if (!id) return null;
  const { data } = await sb.from(table).select(columns).eq("id", id).maybeSingle();
  return data;
}

/** Best-effort: un fallo de email nunca debe tumbar el alta de la oferta. */
export async function notifyOfferRecipients(oferta: OfertaNotificationRow): Promise<void> {
  try {
    const sb = await createServiceClient();
    const { data: assetRow } = await sb
      .from("assets")
      .select("id, full_addr, addr, pob, prov, cp, tip, precio, owner_mail")
      .eq("id", oferta.asset_id)
      .maybeSingle();

    const [compRow, vendRow, vendorEmails] = await Promise.all([
      loadParty(sb, "compradores", oferta.comprador_id, "nombre, email, tel"),
      loadParty(sb, "vendedores", oferta.vendedor_id, "nombre, email"),
      resolveRecipients(sb, oferta.asset_id, cleanEmail(assetRow?.owner_mail)),
    ]);

    const buyerEmail = cleanEmail(compRow?.email) || cleanEmail(vendRow?.email);
    const buyerNombre =
      compRow?.nombre ?? vendRow?.nombre ?? (oferta.vendedor_id ? "Agente" : "Comprador");

    const tpl = offerTemplate({
      buyer: { nombre: buyerNombre, email: buyerEmail, telefono: compRow?.tel || undefined },
      asset: {
        id: assetRow?.id ?? oferta.asset_id,
        fullAddr: assetRow?.full_addr ?? undefined,
        addr: assetRow?.addr ?? undefined,
        pob: assetRow?.pob ?? undefined,
        prov: assetRow?.prov ?? undefined,
        cp: assetRow?.cp ?? undefined,
        tip: assetRow?.tip ?? undefined,
        precio: assetRow?.precio ?? null,
      },
      propuestaEuros: oferta.propuesta_euros,
      comentarios: oferta.comentarios || undefined,
      ofertaId: oferta.id,
    });

    const huerfana = vendorEmails.length === 0;
    await sendEmail({
      to: huerfana ? [EMAIL_SUPPORT] : vendorEmails,
      subject: huerfana ? `${tpl.subject} [Sin vendedor asignado]` : tpl.subject,
      html: tpl.html,
      text: tpl.text,
      replyTo: EMAIL_RE.test(buyerEmail) ? buyerEmail : undefined,
    });
  } catch (err) {
    console.error("[ofertas] email notification failed:", err);
  }
}
