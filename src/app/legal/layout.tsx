import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-10 border-b border-border bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-gold"
          >
            <ArrowLeft size={16} aria-hidden />
            Volver al inicio
          </Link>
          <span className="text-border">|</span>
          <BrandMark size={22} textClassName="text-xs uppercase tracking-wider text-muted" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">— Información legal</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 pb-28">{children}</main>
    </div>
  );
}
