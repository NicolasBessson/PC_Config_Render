"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/assiste", label: "Configuration assistée", match: ["/assiste", "/resultats"] },
  { href: "/manuel", label: "Configuration manuelle", match: ["/manuel", "/config"] },
  { href: "/comparer", label: "Comparer", match: ["/comparer"] },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-[13px] font-bold text-white">PC</span>
          <span className="hidden sm:inline">PC Architect</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 overflow-x-auto text-sm">
          {LINKS.map((link) => {
            const active = link.match.some((m) => pathname.startsWith(m));
            return (
              <Link key={link.href} href={link.href} className={`whitespace-nowrap rounded-lg px-3 py-1.5 transition ${active ? "bg-white/10 text-ink" : "text-muted hover:text-ink"}`}>
                <span className="sm:hidden">{link.label.replace("Configuration ", "")}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
