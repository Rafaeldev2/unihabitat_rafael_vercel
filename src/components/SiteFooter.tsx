"use client";

import Link from "next/link";
import { Phone, Mail, MapPin, Facebook, Twitter, Linkedin, Instagram } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-navy">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-4">
              <BrandMark variant="branco" size={28} textClassName="text-sm text-white" />
            </div>
            <p className="mb-5 text-xs leading-relaxed text-white/50">
              Plataforma especializada en la gestión y comercialización de activos inmobiliarios NPL y CDR.
            </p>
            <div className="flex gap-3">
              {[Facebook, Twitter, Linkedin, Instagram].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Red social (próximamente)"
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-gold">Servicios</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/portal?cat=NPL" className="text-xs text-white/50 transition-colors hover:text-white">
                  Carteras NPL
                </Link>
              </li>
              <li>
                <Link href="/portal" className="text-xs text-white/50 transition-colors hover:text-white">
                  Catálogo de activos
                </Link>
              </li>
              <li>
                <Link href="/portal" className="text-xs text-white/50 transition-colors hover:text-white">
                  Propiedades
                </Link>
              </li>
              <li>
                <Link href="/portal/contacto" className="text-xs text-white/50 transition-colors hover:text-white">
                  Asesoramiento
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-gold">Legal</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/legal/privacidad" className="text-xs text-white/50 transition-colors hover:text-white">
                  Aviso Legal / Privacidad
                </Link>
              </li>
              <li>
                <Link href="/legal/privacidad" className="text-xs text-white/50 transition-colors hover:text-white">
                  Política de Privacidad
                </Link>
              </li>
              <li>
                <Link href="/legal/politica-cookies" className="text-xs text-white/50 transition-colors hover:text-white">
                  Política de Cookies
                </Link>
              </li>
              <li>
                <Link href="/portal/contacto" className="text-xs text-white/50 transition-colors hover:text-white">
                  Contacto
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-gold">Contacto</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <MapPin size={13} className="mt-0.5 shrink-0 text-gold" />
                <span className="text-xs text-white/50">Madrid, España</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={13} className="shrink-0 text-gold" />
                <a href="tel:+34624534931" className="text-xs text-white/50 transition-colors hover:text-white">
                  624 534 931
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={13} className="shrink-0 text-gold" />
                <a href="mailto:info@unihabitat.net" className="text-xs text-white/50 transition-colors hover:text-white">
                  info@unihabitat.net
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <span className="text-[11px] text-white/30">
            &copy; {new Date().getFullYear()} Unihabitat. Todos los derechos reservados.
          </span>
          <span className="text-[11px] text-white/20">Portal público · Solo activos publicados</span>
        </div>
      </div>
    </footer>
  );
}
