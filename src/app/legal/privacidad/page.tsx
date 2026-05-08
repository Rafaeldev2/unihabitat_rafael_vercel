import type { Metadata } from "next";
import { PrivacyPolicyBody } from "./PrivacyPolicyBody";

export const metadata: Metadata = {
  title: "Política de privacidad y aviso legal — Unihabitat",
  description:
    "Información sobre tratamiento de datos personales, responsable, derechos y aviso legal de Unihabitat.",
};

export default function PrivacidadPage() {
  return <PrivacyPolicyBody />;
}
