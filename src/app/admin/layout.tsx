"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2, ShoppingCart, Handshake, CheckSquare, BarChart3,
  Settings, LogOut, FileText, type LucideIcon,
} from "lucide-react";
import { signOut } from "@/app/login/actions";
import { getDevAuthFromDocument } from "@/lib/auth-helpers";
import { fetchVendorPermissions } from "@/app/actions/permissions";
import type { VendorPermission, SectionId, UserSession } from "@/lib/permissions";
import { AssetsErrorBanner } from "@/components/AssetsErrorBanner";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  sectionId: SectionId | "config";
  sep?: boolean;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/admin",              label: "Activos",     icon: Building2,    sectionId: "activos" },
  { href: "/admin/compradores",  label: "Compradores", icon: ShoppingCart,  sectionId: "compradores" },
  { href: "/admin/vendedores",   label: "Vendedores",  icon: Handshake,    sectionId: "vendedores" },
  { href: "/admin/tareas",       label: "Tareas",      icon: CheckSquare,  sectionId: "tareas", sep: true },
  { href: "/admin/ofertas",      label: "Ofertas",     icon: FileText,     sectionId: "ofertas" },
  { href: "/admin/informes",     label: "Informes",    icon: BarChart3,    sectionId: "informes" },
  { href: "/admin/config",       label: "Config",      icon: Settings,     sectionId: "config", sep: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<UserSession | null>(null);
  const [permissions, setPermissions] = useState<VendorPermission[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getDevAuthFromDocument();
    setSession(s);

    if (s?.role === "vendedor" && s.vendedorId) {
      fetchVendorPermissions(s.vendedorId)
        .then(setPermissions)
        .catch(() => setPermissions([]))
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/assets");
    return pathname.startsWith(href);
  };

  const visibleNav = ALL_NAV_ITEMS.filter((item) => {
    if (!session || session.role === "admin") return true;
    if (item.sectionId === "config") return false;
    const perm = permissions.find((p) => p.section === item.sectionId);
    return perm?.canView ?? false;
  });

  if (!ready) return null;

  return (
    <div className="flex min-h-screen">
      <aside className="fixed left-0 top-0 z-50 flex h-screen w-[72px] flex-col items-center bg-navy py-5 shadow-[3px_0_20px_rgba(0,0,0,0.25)]">
        <Link href="/" className="mb-6 flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="Logo" className="h-8 w-8 object-contain" width={40} height={40} />
        </Link>

        {session && (
          <div className="mb-4 flex flex-col items-center gap-1">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: session.role === "admin" ? "linear-gradient(135deg,#b8933a,#0d1b2a)" : "linear-gradient(135deg,#2563a8,#0d2a4a)" }}
            >
              {session.nombre.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
              session.role === "admin" ? "bg-gold/20 text-gold" : "bg-blue-400/20 text-blue-300"
            }`}>
              {session.role === "admin" ? "Admin" : "Vendedor"}
            </span>
          </div>
        )}

        <nav className="flex flex-1 flex-col items-center gap-1">
          {visibleNav.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <div key={item.href}>
                {item.sep && <div className="my-2 h-px w-8 bg-white/[0.08]" />}
                <Link
                  href={item.href}
                  className={`flex w-14 flex-col items-center justify-center gap-1.5 rounded-lg py-2.5 transition-all ${
                    active ? "bg-white/[0.08] text-gold" : "text-white/40 hover:bg-white/[0.05] hover:text-white/70"
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                  <span className="text-[9px] font-medium uppercase tracking-[0.8px]">{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        <form action={signOut} className="mt-auto">
          <button
            type="submit"
            className="flex w-14 flex-col items-center justify-center gap-1.5 rounded-lg py-2.5 text-white/40 transition-all hover:bg-white/[0.05] hover:text-red-400"
            title="Cerrar sesión"
          >
            <LogOut size={18} strokeWidth={1.5} />
            <span className="text-[9px] font-medium uppercase tracking-[0.8px]">Salir</span>
          </button>
        </form>
      </aside>

      <main className="ml-[72px] flex flex-1 flex-col min-h-screen">
        <AssetsErrorBanner />
        {children}
      </main>
    </div>
  );
}
