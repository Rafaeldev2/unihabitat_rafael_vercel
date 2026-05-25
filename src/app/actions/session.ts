"use server";

import { getServerSession } from "@/lib/auth-server";
import type { UserSession } from "@/lib/permissions";

/** Sesión unificada (dev-auth o Supabase) para componentes cliente. */
export async function fetchCurrentSession(): Promise<UserSession | null> {
  return getServerSession();
}
