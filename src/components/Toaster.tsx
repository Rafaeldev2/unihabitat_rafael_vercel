"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      duration={4500}
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg border border-border bg-white shadow-lg text-text",
          title: "text-sm font-semibold text-navy",
          description: "text-xs text-muted",
          actionButton: "bg-navy text-white",
          cancelButton: "bg-cream text-muted",
        },
      }}
    />
  );
}
