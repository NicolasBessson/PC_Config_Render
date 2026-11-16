import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "PC Architect — Imaginez, vérifiez et visualisez votre PC",
  description: "Configurateur de PC avec vérification de compatibilité, estimation de performances transparente et visualisation 3D par style. Prix en CHF.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line px-4 py-6 text-center text-xs leading-relaxed text-muted">
          <p>
            PC Architect — projet en cours de conception. Prix indicatifs en CHF et benchmarks de démonstration, non vérifiés : à ne pas utiliser pour un achat.
          </p>
          <p>Le rendu 3D est illustratif ; seule la vérification de compatibilité fait foi.</p>
        </footer>
      </body>
    </html>
  );
}
