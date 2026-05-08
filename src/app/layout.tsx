import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProvider } from "@/lib/context";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { Toaster } from "@/components/Toaster";
import { WelcomeToast } from "@/components/WelcomeToast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "PropCRM — Real Estate Asset Management",
  description: "Hybrid Real Estate CRM + Public Portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <AppProvider>{children}</AppProvider>
        <CookieConsentBanner />
        <Toaster />
        <WelcomeToast />
      </body>
    </html>
  );
}
