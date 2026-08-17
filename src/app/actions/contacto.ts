"use server";

import { sendEmail } from "@/lib/email/send";
import { EMAIL_SUPPORT } from "@/lib/email/resend";
import { contactInquiryTemplate } from "@/lib/email/templates";

interface ContactFormData {
  nombre: string;
  email: string;
  telefono?: string;
  asunto: string;
  mensaje: string;
  assetId?: string;
  honeypot?: string;
  formTimestamp?: number;
  turnstileToken?: string;
}

const MIN_FORM_TIME_MS = 2000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json() as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[contacto] Turnstile verification failed:", err);
    return false;
  }
}

export async function enviarContacto(data: ContactFormData): Promise<{ ok: boolean; error?: string }> {
  const nombre = data.nombre?.trim() ?? "";
  const email = data.email?.trim() ?? "";
  const asunto = data.asunto?.trim() ?? "";
  const mensaje = data.mensaje?.trim() ?? "";
  const telefono = data.telefono?.trim() || undefined;

  if (data.honeypot && data.honeypot.trim() !== "") {
    console.warn("[contacto] Honeypot triggered, likely bot");
    return { ok: true };
  }

  if (data.formTimestamp) {
    const elapsed = Date.now() - data.formTimestamp;
    if (elapsed < MIN_FORM_TIME_MS) {
      console.warn("[contacto] Form submitted too fast:", elapsed, "ms");
      return { ok: true };
    }
  }

  if (!checkRateLimit(email)) {
    return { ok: false, error: "Has enviado demasiados mensajes. Espera un minuto e inténtalo de nuevo." };
  }

  if (process.env.TURNSTILE_SECRET_KEY && data.turnstileToken) {
    const valid = await verifyTurnstile(data.turnstileToken);
    if (!valid) {
      return { ok: false, error: "Verificación de seguridad fallida. Recarga la página e inténtalo de nuevo." };
    }
  }

  if (!nombre || !email || !asunto || !mensaje) {
    return { ok: false, error: "Todos los campos obligatorios deben estar completos" };
  }

  const tpl = contactInquiryTemplate({ nombre, email, telefono, asunto, mensaje });
  const result = await sendEmail({
    to: EMAIL_SUPPORT,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: email,
  });

  if (!result.ok) {
    console.error("[contacto] sendEmail failed:", { error: result.error, to: EMAIL_SUPPORT });
    const detail = result.error ? ` (${result.error})` : "";
    return { ok: false, error: `No se pudo enviar el mensaje.${detail}` };
  }
  return { ok: true };
}
