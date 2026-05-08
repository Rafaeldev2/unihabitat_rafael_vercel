import type { Metadata } from "next";
import { CookiesPolicyBody } from "./CookiesPolicyBody";

export const metadata: Metadata = {
  title: "Política de cookies — Unihabitat",
  description:
    "Información sobre cookies y tecnologías similares utilizadas en el sitio web de Unihabitat, conforme al RGPD y la LSSI-CE.",
};

export default function PoliticaCookiesPage() {
  return <CookiesPolicyBody />;
}
