import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  /** Logo variant: azul (fondos claros) o branco (fondos oscuros). */
  variant?: "azul" | "branco";
  /** Tamaño del logo en px. */
  size?: number;
  /** Clase del contenedor. */
  className?: string;
  /** Clase del texto de marca. */
  textClassName?: string;
  /** Mostrar solo texto (sin logo). */
  textOnly?: boolean;
};

/**
 * Marca Unihabitat con asterisco negro (CE-9).
 * El `*` es siempre negro; el nombre hereda color del contenedor.
 */
export function BrandMark({
  variant = "azul",
  size = 28,
  className,
  textClassName,
  textOnly = false,
}: BrandMarkProps) {
  const src = variant === "branco" ? "/LogoBranco.svg" : "/LogoAzul.svg";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {!textOnly && (
        <Image
          src={src}
          alt="Unihabitat"
          width={size}
          height={size}
          className="h-auto w-auto"
          style={{ height: size, width: "auto" }}
          priority={size >= 32}
        />
      )}
      <span className={cn("font-bold tracking-tight", textClassName)}>
        Unihabitat<span className="text-black">*</span>
      </span>
    </span>
  );
}
