import { Resend } from "resend";

let cachedResend: Resend | null = null;

export function getResend(): Resend {
  if (cachedResend) return cachedResend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no configurada en variables de entorno");
  }
  cachedResend = new Resend(apiKey);
  return cachedResend;
}

export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Unihabitat <soporte@unihabitat.es>";

export const EMAIL_SUPPORT =
  process.env.EMAIL_SUPPORT ?? "soporte@unihabitat.com";

export const EMAIL_DRY_RUN = process.env.EMAIL_DRY_RUN === "true";
