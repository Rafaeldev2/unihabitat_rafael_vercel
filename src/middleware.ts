import { NextResponse, type NextRequest } from "next/server";

function getDevUser(request: NextRequest) {
  const raw = request.cookies.get("dev-auth")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const devUser = getDevUser(request);

  // Admin routes: require admin or vendedor role
  if (pathname.startsWith("/admin")) {
    if (!devUser) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    if (devUser.role !== "admin" && devUser.role !== "vendedor") {
      const url = request.nextUrl.clone();
      url.pathname = "/portal/privado";
      return NextResponse.redirect(url);
    }
    if (devUser.role === "vendedor" && pathname.startsWith("/admin/config")) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  // Portal privado: require any auth
  if (pathname.startsWith("/portal/privado") && !devUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Login: redirect authenticated users
  if (pathname === "/login" && devUser) {
    const url = request.nextUrl.clone();
    url.pathname = (devUser.role === "admin" || devUser.role === "vendedor") ? "/admin" : "/portal/privado";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/portal/privado/:path*", "/login"],
};
