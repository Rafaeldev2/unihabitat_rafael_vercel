import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isDevAuthEnabled, resolveRole } from "@/lib/auth-role";

export type SessionInfo = {
  role: "admin" | "vendedor" | "cliente";
  email?: string;
} | null;

export function getDevUser(request: NextRequest): SessionInfo {
  if (!isDevAuthEnabled()) return null;
  const raw = request.cookies.get("dev-auth")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.role === "string") {
      return { role: parsed.role, email: parsed.email };
    }
    return null;
  } catch {
    return null;
  }
}

function applyCookieRefresh(
  request: NextRequest,
  cookiesToSet: {
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }[],
): NextResponse {
  for (const { name, value } of cookiesToSet) {
    request.cookies.set(name, value);
  }
  const outResponse = NextResponse.next({ request });
  for (const { name, value, options } of cookiesToSet) {
    outResponse.cookies.set(name, value, options);
  }
  return outResponse;
}

export async function getSupabaseUser(
  request: NextRequest,
): Promise<{ user: SessionInfo; outResponse: NextResponse }> {
  let outResponse = NextResponse.next({ request });
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { user: null, outResponse };
  }
  const hasSupabaseCookie = request.cookies
    .getAll()
    .some((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
  if (!hasSupabaseCookie) {
    return { user: null, outResponse };
  }
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        outResponse = applyCookieRefresh(request, cookiesToSet);
      },
    },
  });
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { user: null, outResponse };
    const metadataRole = user.user_metadata?.role as string | undefined;
    const role = resolveRole(metadataRole, user.email);
    return { user: { role, email: user.email ?? undefined }, outResponse };
  } catch {
    return { user: null, outResponse };
  }
}
