"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Lock } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { SiteFooter } from "@/components/SiteFooter";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const devCookie = document.cookie.split("; ").find(c => c.startsWith("dev-auth="));
    if (devCookie) {
      try {
        const dev = JSON.parse(decodeURIComponent(devCookie.split("=").slice(1).join("=")));
        setUserId(dev.user_id ?? dev.userId ?? undefined);
        setIsLoggedIn(true);
      } catch { /* ignore */ }
    }
  }, []);
  return (
    <div className="flex min-h-screen flex-col bg-cream2">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-border bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/LogoAzul.svg" alt="Unihabitat" width={32} height={32} className="h-8 w-auto" priority />
            <span className="text-base font-bold tracking-tight text-navy">Unihabitat</span>
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            <Link href="/portal" className="text-sm font-medium text-navy transition-colors hover:text-gold">
              Propiedades
            </Link>
            <Link href="/portal/contacto" className="text-sm font-medium text-muted transition-colors hover:text-navy">
              Contáctanos
            </Link>
            {isLoggedIn && <NotificationBell userId={userId} />}
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-navy3"
            >
              <Lock size={12} />
              {isLoggedIn ? "Zona Privada" : "Acceso Privado"}
            </Link>
          </nav>

          {/* Mobile nav toggle */}
          <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border md:hidden" aria-label="Menú">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1">{children}</main>

      <SiteFooter />
    </div>
  );
}
