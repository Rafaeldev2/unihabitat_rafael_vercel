"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin } from "lucide-react";

type AssetMapImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src" | "onError"
> & {
  src: string | undefined | null;
};

export function AssetMapImage({ src, alt, className, ...rest }: AssetMapImageProps) {
  const url = typeof src === "string" ? src.trim() : "";
  const [failed, setFailed] = useState(!url);

  useEffect(() => {
    setFailed(!url);
  }, [url]);

  const onError = useCallback(() => setFailed(true), []);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-cream to-cream2 ${className ?? ""}`}
        aria-label={alt ?? "Mapa no disponible"}
      >
        <div className="flex flex-col items-center gap-1.5 text-muted/40">
          <MapPin size={28} strokeWidth={1.5} />
          <span className="text-[10px] font-medium tracking-wide uppercase">Sin mapa</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={onError}
      {...rest}
    />
  );
}
