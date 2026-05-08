import { getResend, EMAIL_FROM, EMAIL_DRY_RUN } from "./resend";

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  from?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const to = Array.isArray(params.to) ? params.to : [params.to];

  if (EMAIL_DRY_RUN) {
    console.info("[email:dry-run]", {
      from: params.from ?? EMAIL_FROM,
      to,
      subject: params.subject,
      replyTo: params.replyTo,
    });
    return { ok: true, id: "dry-run" };
  }

  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: params.from ?? EMAIL_FROM,
      to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    });
    if (error) {
      console.error("[email:send] resend error:", error);
      return { ok: false, error: error.message ?? "Error al enviar email" };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email:send] exception:", msg);
    return { ok: false, error: msg };
  }
}
