"use client";

import Link from "next/link";
import { LogOut, type LucideIcon } from "lucide-react";
import { signOut } from "@/app/login/actions";
import type { SectionId, UserSession } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  sectionId: SectionId | "config" | "guia-staging";
  sep?: boolean;
  stagingOnly?: boolean;
}

const ITEM_BASE = "flex w-14 flex-col items-center justify-center gap-1.5 rounded-lg py-2.5 transition-all";
const LABEL = "text-[9px] font-medium uppercase tracking-[0.8px]";

function initials(nombre: string): string {
  return nombre.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function SidebarUserBadge({ session }: { session: UserSession }) {
  const esAdmin = session.role === "admin";
  return (
    <div className="mb-4 flex flex-shrink-0 flex-col items-center gap-1">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ background: esAdmin ? "linear-gradient(135deg,#b8933a,#0d1b2a)" : "linear-gradient(135deg,#2563a8,#0d2a4a)" }}
      >
        {initials(session.nombre)}
      </div>
      <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
        esAdmin ? "bg-gold/20 text-gold" : "bg-blue-400/20 text-blue-300"
      }`}>
        {esAdmin ? "Admin" : "Agente"}
      </span>
    </div>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const tone = active
    ? "bg-white/[0.08] text-gold"
    : "text-white/40 hover:bg-white/[0.05] hover:text-white/70";
  return (
    <div>
      {item.sep && <div className="my-2 h-px w-8 bg-white/[0.08]" />}
      <Link href={item.href} className={`${ITEM_BASE} ${tone}`}>
        <Icon size={18} strokeWidth={active ? 2 : 1.5} />
        <span className={LABEL}>{item.label}</span>
      </Link>
    </div>
  );
}

export function AdminSidebar({
  session, items, isActive,
}: {
  session: UserSession | null;
  items: NavItem[];
  isActive: (href: string) => boolean;
}) {
  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-[72px] flex-col items-center bg-navy py-5 shadow-[3px_0_20px_rgba(0,0,0,0.25)]">
      <Link href="/" className="mb-6 flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="Logo" className="h-8 w-8 object-contain" width={40} height={40} />
      </Link>

      {session && <SidebarUserBadge session={session} />}

      <nav className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
        {items.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>

      <form action={signOut} className="mt-auto flex-shrink-0">
        <button
          type="submit"
          className={`${ITEM_BASE} text-white/40 hover:bg-white/[0.05] hover:text-red-400`}
          title="Cerrar sesión"
        >
          <LogOut size={18} strokeWidth={1.5} />
          <span className={LABEL}>Salir</span>
        </button>
      </form>
    </aside>
  );
}
