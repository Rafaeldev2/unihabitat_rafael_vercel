import { NextResponse, type NextRequest } from "next/server";
import {
  getDevUser,
  getSupabaseUser,
  type SessionInfo,
} from "@/lib/middleware-session";

function redirectWithCookies(
  request: NextRequest,
  supabaseLookup: Awaited<ReturnType<typeof getSupabaseUser>> | null,
  target: string,
  redirectParam?: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = target;
  if (redirectParam) {
    url.searchParams.set("redirect", redirectParam);
  } else {
    url.searchParams.delete("redirect");
  }
  const res = NextResponse.redirect(url);
  if (supabaseLookup?.outResponse) {
    for (const c of supabaseLookup.outResponse.cookies.getAll()) {
      res.cookies.set(c);
    }
  }
  return res;
}

function guardAdmin(
  request: NextRequest,
  session: SessionInfo,
  supabaseLookup: Awaited<ReturnType<typeof getSupabaseUser>> | null,
  pathname: string,
) {
  if (!session) {
    return redirectWithCookies(request, supabaseLookup, "/login", pathname);
  }
  if (session.role !== "admin" && session.role !== "vendedor") {
    return redirectWithCookies(request, supabaseLookup, "/portal/privado");
  }
  if (session.role === "vendedor" && pathname.startsWith("/admin/config")) {
    return redirectWithCookies(request, supabaseLookup, "/admin");
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const devUser = getDevUser(request);
  const supabaseLookup = devUser ? null : await getSupabaseUser(request);
  const session: SessionInfo = devUser ?? supabaseLookup?.user ?? null;
  const baseResponse = supabaseLookup?.outResponse ?? NextResponse.next();

  if (pathname.startsWith("/admin")) {
    const blocked = guardAdmin(request, session, supabaseLookup, pathname);
    if (blocked) return blocked;
  }

  if (pathname.startsWith("/portal/privado") && !session) {
    return redirectWithCookies(request, supabaseLookup, "/login", pathname);
  }

  if (pathname === "/login" && session) {
    const dest =
      session.role === "admin" || session.role === "vendedor"
        ? "/admin"
        : "/portal/privado";
    return redirectWithCookies(request, supabaseLookup, dest);
  }

  return baseResponse;
}

export const config = {
  matcher: ["/admin/:path*", "/portal/privado/:path*", "/login"],
};
