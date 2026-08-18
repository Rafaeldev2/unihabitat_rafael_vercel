"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Building2, ShoppingCart, Handshake, CheckSquare, BarChart3,
  Settings, FileText, BookOpen,
} from "lucide-react";
import { hrefToSection } from "@/lib/permissions";
import { useApp } from "@/lib/context";
import { AdminSidebar, type NavItem } from "@/components/AdminSidebar";
import { isNavItemVisible, isSectionAllowed, shouldRedirectToActivos } from "@/lib/admin-access";
import { AssetsErrorBanner } from "@/components/AssetsErrorBanner";
import { isStagingGuideEnabled } from "@/lib/staging-guide";

const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/admin",              label: "Activos",     icon: Building2,    sectionId: "activos" },
  { href: "/admin/compradores",  label: "Compradores", icon: ShoppingCart, sectionId: "compradores" },
  { href: "/admin/agentes",      label: "Agentes",     icon: Handshake,    sectionId: "agentes" },
  { href: "/admin/tareas",       label: "Tareas",      icon: CheckSquare,  sectionId: "tareas", sep: true },
  { href: "/admin/ofertas",      label: "Ofertas",     icon: FileText,     sectionId: "ofertas" },
  { href: "/admin/informes",     label: "Informes",    icon: BarChart3,    sectionId: "informes" },
  { href: "/admin/config",       label: "Config",      icon: Settings,     sectionId: "config", sep: true },
  {
    href: "/admin/guia-staging",
    label: "Guía",
    icon: BookOpen,
    sectionId: "guia-staging",
    stagingOnly: true,
    sep: true,
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, sessionResolved, permissions } = useApp();
  const showStagingGuide = isStagingGuideEnabled();

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin" || pathname.startsWith("/admin/assets")
      : pathname.startsWith(href);

  const visibleNav = ALL_NAV_ITEMS.filter((item) =>
    isNavItemVisible(item, { session, sessionResolved, permissions, showStagingGuide }),
  );

  const access = {
    session,
    sessionResolved,
    permissions,
    currentSection: hrefToSection(pathname),
    isGuiaStaging: pathname.startsWith("/admin/guia-staging"),
    showStagingGuide,
  };
  const sectionAllowed = isSectionAllowed(access);
  const redirectToActivos = shouldRedirectToActivos(access);

  useEffect(() => {
    if (redirectToActivos) router.replace("/admin");
  }, [redirectToActivos, router]);

  if (!sessionResolved) return null;

  return (
    <div className="flex min-h-screen">
      <AdminSidebar session={session} items={visibleNav} isActive={isActive} />

      <main className="ml-[72px] flex flex-1 flex-col min-h-screen">
        <AssetsErrorBanner />
        {sectionAllowed ? children : <SinAcceso />}
      </main>
    </div>
  );
}

function SinAcceso() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted">
      <p className="text-lg font-medium text-navy">Sin acceso</p>
      <p className="text-sm">No tienes permisos para ver esta sección.</p>
      <Link href="/admin" className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy3">
        Volver a Activos
      </Link>
    </div>
  );
}
