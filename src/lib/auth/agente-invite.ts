import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { EMAIL_SUPPORT } from "@/lib/email/resend";
import { agentInviteTemplate } from "@/lib/email/templates";
import { getPublicAppOrigin } from "@/lib/app-public-url";

export interface InviteAgenteInput {
  email: string;
  nombre: string;
  /** Si true, fuerza link de recovery aunque el user sea nuevo (texto distinto). */
  isReinvite?: boolean;
}

export interface InviteAgenteResult {
  ok: boolean;
  /** auth.users.id si se pudo crear/encontrar la cuenta. */
  userId: string | null;
  /** true si el email se envió correctamente vía Resend. */
  emailSent: boolean;
  /** Action link generado por Supabase (utilizable como fallback manual). */
  actionLink?: string;
  /** Mensaje de error legible para mostrar al admin. */
  error?: string;
  /** true si el usuario auth ya existía antes de esta llamada. */
  alreadyExisted: boolean;
}

/**
 * Genera una contraseña aleatoria opaca. No se entrega al agente: solo sirve
 * para que el user exista en `auth.users` mientras el agente abre el link de
 * recovery y define la suya propia.
 */
function generateOpaquePassword(): string {
  return `tmp_${crypto.randomUUID().replace(/-/g, "")}${Date.now().toString(36)}`;
}

/**
 * Crea (si hace falta) la cuenta de Supabase Auth del agente y le envía un
 * email con un link seguro para definir su contraseña.
 *
 * Estrategia:
 *  1. Comprueba si ya existe un user con ese email.
 *  2. Si no existe: lo crea con `admin.createUser` con `email_confirm: true`,
 *     rol `vendedor` y una contraseña temporal opaca.
 *  3. Genera un `recovery` link con `admin.generateLink` (sirve tanto para
 *     primera definición de contraseña como para reinvitar).
 *  4. Envía el link por Resend usando la plantilla `agentInviteTemplate`.
 *
 * Nunca lanza: devuelve un `InviteAgenteResult` con el detalle del error para
 * que el caller decida qué mostrar al admin.
 */
export async function inviteAgenteByEmail(
  input: InviteAgenteInput,
): Promise<InviteAgenteResult> {
  const email = input.email.trim().toLowerCase();
  const nombre = input.nombre.trim();

  if (!email) {
    return {
      ok: false,
      userId: null,
      emailSent: false,
      alreadyExisted: false,
      error: "Email vacío: no se puede invitar.",
    };
  }

  const admin = await createServiceClient();
  const redirectTo = `${getPublicAppOrigin()}/auth/set-password`;

  let userId: string | null = null;
  let alreadyExisted = false;

  try {
    const { data: list } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const existing = list?.users?.find(
      (u) => (u.email || "").toLowerCase() === email,
    );
    if (existing) {
      userId = existing.id;
      alreadyExisted = true;
      const meta = existing.user_metadata ?? {};
      const nextMeta = {
        ...meta,
        role: "vendedor",
        ...(nombre && !meta.nombre ? { nombre } : {}),
      };
      const needsUpdate =
        meta.role !== "vendedor" || (nombre && !meta.nombre);
      if (needsUpdate) {
        await admin.auth.admin.updateUserById(existing.id, {
          user_metadata: nextMeta,
          email_confirm: true,
        });
      }
    }
  } catch (e) {
    return {
      ok: false,
      userId: null,
      emailSent: false,
      alreadyExisted: false,
      error: `No se pudo consultar Supabase Auth: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!userId) {
    try {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          password: generateOpaquePassword(),
          email_confirm: true,
          user_metadata: { role: "vendedor", nombre },
        });

      if (createErr) {
        return {
          ok: false,
          userId: null,
          emailSent: false,
          alreadyExisted: false,
          error: `No se pudo crear la cuenta en Auth: ${createErr.message}`,
        };
      }
      userId = created.user?.id ?? null;
    } catch (e) {
      return {
        ok: false,
        userId: null,
        emailSent: false,
        alreadyExisted: false,
        error: `Excepción creando cuenta en Auth: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  let actionLink: string | undefined;
  try {
    const { data: linkData, error: linkErr } =
      await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
    if (linkErr) {
      return {
        ok: false,
        userId,
        emailSent: false,
        alreadyExisted,
        error: `No se pudo generar el enlace seguro: ${linkErr.message}`,
      };
    }
    actionLink = linkData?.properties?.action_link;
  } catch (e) {
    return {
      ok: false,
      userId,
      emailSent: false,
      alreadyExisted,
      error: `Excepción generando enlace: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!actionLink) {
    return {
      ok: false,
      userId,
      emailSent: false,
      alreadyExisted,
      error: "Supabase no devolvió un action_link válido.",
    };
  }

  const tpl = agentInviteTemplate({
    nombre,
    actionUrl: actionLink,
    isReinvite: input.isReinvite ?? alreadyExisted,
  });

  const result = await sendEmail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: EMAIL_SUPPORT,
  });

  if (!result.ok) {
    return {
      ok: false,
      userId,
      emailSent: false,
      alreadyExisted,
      actionLink,
      error: `Cuenta creada, pero no se pudo enviar el email: ${result.error ?? "error desconocido"}`,
    };
  }

  return {
    ok: true,
    userId,
    emailSent: true,
    alreadyExisted,
    actionLink,
  };
}
