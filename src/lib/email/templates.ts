const NAVY = "#0d2a4a";
const GOLD = "#c4a572";
const CREAM = "#f8f5ef";
const TEXT = "#1f2937";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(s: string): string {
  return escapeHtml(s).replace(/\n/g, "<br>");
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

interface BaseLayoutInput {
  preheader: string;
  banner: string;
  bodyHtml: string;
}

function baseLayout({ preheader, banner, bodyHtml }: BaseLayoutInput): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unihabitat</title>
</head>
<body style="margin:0;padding:0;background-color:${CREAM};font-family:Arial,Helvetica,sans-serif;color:${TEXT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background-color:${NAVY};padding:20px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px;">Unihabitat</td>
                <td align="right" style="color:${GOLD};font-size:11px;text-transform:uppercase;letter-spacing:1.5px;">${escapeHtml(banner)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:${TEXT};font-size:14px;line-height:1.6;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:16px 28px;border-top:1px solid ${BORDER};color:${MUTED};font-size:11px;line-height:1.5;">
            <p style="margin:0;">Unihabitat &middot; Plataforma especializada en NPL y REO &middot; Madrid, España</p>
            <p style="margin:6px 0 0 0;">Este correo se envió automáticamente desde la plataforma.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function row(label: string, value: string | undefined | null): string {
  if (value == null || value === "" || value === "—") return "";
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:${MUTED};font-size:11px;text-transform:uppercase;letter-spacing:0.8px;width:140px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;color:${TEXT};font-size:14px;">${nl2br(value)}</td>
  </tr>`;
}

function infoTable(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:6px;padding:8px 16px;background-color:#fafafa;">
    ${rows}
  </table>`;
}

function highlight(label: string, value: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${NAVY};border-radius:6px;margin:16px 0;">
    <tr>
      <td style="padding:18px 20px;color:${GOLD};font-size:11px;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(label)}</td>
      <td align="right" style="padding:18px 20px;color:#ffffff;font-size:22px;font-weight:bold;">${escapeHtml(value)}</td>
    </tr>
  </table>`;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// ── 1. Contáctanos ────────────────────────────────────────────────────────
export interface ContactInquiryInput {
  nombre: string;
  email: string;
  telefono?: string;
  asunto: string;
  mensaje: string;
}

export function contactInquiryTemplate(input: ContactInquiryInput): EmailTemplate {
  const subject = `[Contacto] ${input.asunto} — ${input.nombre}`;
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Has recibido un nuevo mensaje desde el formulario de contacto.</p>
    ${infoTable(
      row("Nombre", input.nombre) +
      row("Email", input.email) +
      row("Teléfono", input.telefono) +
      row("Asunto", input.asunto)
    )}
    <h3 style="font-size:13px;color:${NAVY};text-transform:uppercase;letter-spacing:1px;margin:22px 0 8px 0;">Mensaje</h3>
    <div style="padding:14px;border-left:3px solid ${GOLD};background-color:${CREAM};border-radius:4px;color:${TEXT};">${nl2br(input.mensaje)}</div>
    <p style="margin:22px 0 0 0;color:${MUTED};font-size:12px;">Responde a este correo para contactar directamente con ${escapeHtml(input.nombre)}.</p>
  `;
  const html = baseLayout({
    preheader: `Contacto de ${input.nombre}: ${input.asunto}`,
    banner: "Nuevo contacto",
    bodyHtml,
  });
  const text = [
    "Nuevo mensaje desde el formulario de contacto.",
    "",
    `Nombre: ${input.nombre}`,
    `Email: ${input.email}`,
    input.telefono ? `Teléfono: ${input.telefono}` : null,
    `Asunto: ${input.asunto}`,
    "",
    "Mensaje:",
    input.mensaje,
  ].filter(Boolean).join("\n");
  return { subject, html, text };
}

// ── 2. Solicitar información ──────────────────────────────────────────────
export interface InfoRequestAssetSummary {
  id: string;
  fullAddr?: string;
  addr?: string;
  pob?: string;
  prov?: string;
  cp?: string;
  tip?: string;
  cat?: string;
}

export interface InfoRequestInput {
  nombre: string;
  email: string;
  telefono?: string;
  mensaje: string;
  asset: InfoRequestAssetSummary;
}

export function infoRequestTemplate(input: InfoRequestInput): EmailTemplate {
  const lugar = [input.asset.pob, input.asset.prov].filter(v => v && v !== "—").join(", ");
  const subject = `[Solicitud info] ${input.asset.id}${lugar ? ` — ${lugar}` : ""}`;
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Un usuario solicita información sobre un activo del catálogo.</p>
    <h3 style="font-size:13px;color:${NAVY};text-transform:uppercase;letter-spacing:1px;margin:18px 0 8px 0;">Activo</h3>
    ${infoTable(
      row("ID", input.asset.id) +
      row("Categoría", input.asset.cat) +
      row("Dirección", input.asset.fullAddr || input.asset.addr) +
      row("Población", input.asset.pob) +
      row("Provincia", input.asset.prov) +
      row("CP", input.asset.cp) +
      row("Tipología", input.asset.tip)
    )}
    <h3 style="font-size:13px;color:${NAVY};text-transform:uppercase;letter-spacing:1px;margin:22px 0 8px 0;">Datos del solicitante</h3>
    ${infoTable(
      row("Nombre", input.nombre) +
      row("Email", input.email) +
      row("Teléfono", input.telefono)
    )}
    <h3 style="font-size:13px;color:${NAVY};text-transform:uppercase;letter-spacing:1px;margin:22px 0 8px 0;">Mensaje</h3>
    <div style="padding:14px;border-left:3px solid ${GOLD};background-color:${CREAM};border-radius:4px;color:${TEXT};">${nl2br(input.mensaje)}</div>
    <p style="margin:22px 0 0 0;color:${MUTED};font-size:12px;">Responde a este correo para contactar directamente con ${escapeHtml(input.nombre)}.</p>
  `;
  const html = baseLayout({
    preheader: `${input.nombre} solicita información sobre ${input.asset.id}`,
    banner: "Solicitud de información",
    bodyHtml,
  });
  const text = [
    "Nueva solicitud de información sobre un activo.",
    "",
    `Activo: ${input.asset.id}${lugar ? ` (${lugar})` : ""}`,
    input.asset.fullAddr ? `Dirección: ${input.asset.fullAddr}` : null,
    input.asset.cat ? `Categoría: ${input.asset.cat}` : null,
    input.asset.tip ? `Tipología: ${input.asset.tip}` : null,
    "",
    `Nombre: ${input.nombre}`,
    `Email: ${input.email}`,
    input.telefono ? `Teléfono: ${input.telefono}` : null,
    "",
    "Mensaje:",
    input.mensaje,
  ].filter(Boolean).join("\n");
  return { subject, html, text };
}

// ── 3. Presentar oferta ───────────────────────────────────────────────────
export interface OfferAssetSummary {
  id: string;
  fullAddr?: string;
  addr?: string;
  pob?: string;
  prov?: string;
  cp?: string;
  tip?: string;
  precio?: number | null;
}

export interface OfferInput {
  buyer: { nombre: string; email: string; telefono?: string };
  asset: OfferAssetSummary;
  propuestaEuros: number;
  comentarios?: string;
  ofertaId?: string;
}

export function offerTemplate(input: OfferInput): EmailTemplate {
  const lugar = [input.asset.pob, input.asset.prov].filter(v => v && v !== "—").join(", ");
  const subject = `[Oferta] ${input.asset.id} — ${fmtEur(input.propuestaEuros)}`;
  const bodyHtml = `
    <p style="margin:0 0 8px 0;">Has recibido una nueva oferta sobre uno de tus activos.</p>
    ${highlight("Propuesta del comprador", fmtEur(input.propuestaEuros))}
    <h3 style="font-size:13px;color:${NAVY};text-transform:uppercase;letter-spacing:1px;margin:18px 0 8px 0;">Activo</h3>
    ${infoTable(
      row("ID", input.asset.id) +
      row("Dirección", input.asset.fullAddr || input.asset.addr) +
      row("Población", input.asset.pob) +
      row("Provincia", input.asset.prov) +
      row("CP", input.asset.cp) +
      row("Tipología", input.asset.tip) +
      row("Precio publicado", input.asset.precio != null ? fmtEur(input.asset.precio) : undefined)
    )}
    <h3 style="font-size:13px;color:${NAVY};text-transform:uppercase;letter-spacing:1px;margin:22px 0 8px 0;">Comprador</h3>
    ${infoTable(
      row("Nombre", input.buyer.nombre) +
      row("Email", input.buyer.email) +
      row("Teléfono", input.buyer.telefono)
    )}
    ${input.comentarios ? `<h3 style="font-size:13px;color:${NAVY};text-transform:uppercase;letter-spacing:1px;margin:22px 0 8px 0;">Comentarios</h3>
    <div style="padding:14px;border-left:3px solid ${GOLD};background-color:${CREAM};border-radius:4px;color:${TEXT};">${nl2br(input.comentarios)}</div>` : ""}
    ${input.ofertaId ? `<p style="margin:22px 0 0 0;color:${MUTED};font-size:12px;">Referencia interna: ${escapeHtml(input.ofertaId)}</p>` : ""}
    <p style="margin:14px 0 0 0;color:${MUTED};font-size:12px;">Responde a este correo para contactar directamente con el comprador.</p>
  `;
  const html = baseLayout({
    preheader: `Oferta de ${fmtEur(input.propuestaEuros)} sobre ${input.asset.id}`,
    banner: "Nueva oferta",
    bodyHtml,
  });
  const text = [
    "Nueva oferta recibida.",
    "",
    `Activo: ${input.asset.id}${lugar ? ` (${lugar})` : ""}`,
    input.asset.fullAddr ? `Dirección: ${input.asset.fullAddr}` : null,
    "",
    `Propuesta: ${fmtEur(input.propuestaEuros)}`,
    input.asset.precio != null ? `Precio publicado: ${fmtEur(input.asset.precio)}` : null,
    "",
    `Comprador: ${input.buyer.nombre}`,
    `Email: ${input.buyer.email}`,
    input.buyer.telefono ? `Teléfono: ${input.buyer.telefono}` : null,
    input.comentarios ? `\nComentarios:\n${input.comentarios}` : null,
    input.ofertaId ? `\nReferencia: ${input.ofertaId}` : null,
  ].filter(Boolean).join("\n");
  return { subject, html, text };
}

// ── 4. Notificación in-system (mirror) ────────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  match: "Nuevo match con activo",
  invitacion: "Activo compartido contigo",
  asignacion_comprador: "Nuevo comprador asignado",
  asignacion_activo: "Nuevo activo asignado",
  desasignacion: "Asignación retirada",
};

export interface NotificationMirrorInput {
  tipo: string;
  mensaje: string;
  referenciaId?: string;
  recipientName?: string;
  appUrl?: string;
}

export function notificationMirrorTemplate(input: NotificationMirrorInput): EmailTemplate {
  const label = TIPO_LABEL[input.tipo] ?? "Nueva notificación";
  const subject = `[Unihabitat] ${label}`;
  const greeting = input.recipientName ? `Hola ${escapeHtml(input.recipientName)},` : "Hola,";
  const ctaUrl = input.appUrl ?? "";
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">${greeting}</p>
    <p style="margin:0 0 14px 0;">Has recibido una notificación en tu portal Unihabitat:</p>
    <div style="padding:16px 18px;border-left:3px solid ${GOLD};background-color:${CREAM};border-radius:4px;color:${TEXT};">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${MUTED};margin-bottom:6px;">${escapeHtml(label)}</div>
      <div style="font-size:14px;color:${TEXT};">${nl2br(input.mensaje)}</div>
    </div>
    ${input.referenciaId ? `<p style="margin:14px 0 0 0;color:${MUTED};font-size:12px;">Referencia: ${escapeHtml(input.referenciaId)}</p>` : ""}
    ${ctaUrl ? `<p style="margin:22px 0 0 0;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background-color:${NAVY};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:bold;">Abrir Unihabitat</a></p>` : ""}
  `;
  const html = baseLayout({
    preheader: input.mensaje.slice(0, 120),
    banner: label,
    bodyHtml,
  });
  const text = [
    input.recipientName ? `Hola ${input.recipientName},` : "Hola,",
    "",
    `${label}:`,
    input.mensaje,
    input.referenciaId ? `\nReferencia: ${input.referenciaId}` : null,
    ctaUrl ? `\nAbrir Unihabitat: ${ctaUrl}` : null,
  ].filter(Boolean).join("\n");
  return { subject, html, text };
}