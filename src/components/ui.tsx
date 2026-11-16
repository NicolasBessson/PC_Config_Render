import Link from "next/link";
import type { ReactNode } from "react";
import { benchmarks, catalogStats } from "@/lib/catalog";
import { STATUS_LABELS, type OverallStatus, type Status } from "@/lib/compat";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {aside}
    </div>
  );
}

const TONE = {
  ok: "border-ok/30 bg-ok/10 text-ok",
  warn: "border-warn/30 bg-warn/10 text-warn",
  fail: "border-fail/30 bg-fail/10 text-fail",
  neutral: "border-line bg-white/5 text-muted",
  accent: "border-accent/40 bg-accent/15 text-accent-soft",
} as const;

export function Badge({ tone = "neutral", children, title }: { tone?: keyof typeof TONE; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE[tone]}`}>
      {children}
    </span>
  );
}

const OVERALL_TONE: Record<OverallStatus, keyof typeof TONE> = { compatible: "ok", "a-verifier": "warn", incompatible: "fail", incomplete: "neutral" };
const OVERALL_ICON: Record<OverallStatus, string> = { compatible: "✓", "a-verifier": "!", incompatible: "✕", incomplete: "…" };

export function StatusBadge({ status }: { status: OverallStatus }) {
  return (
    <Badge tone={OVERALL_TONE[status]}>
      <span aria-hidden>{OVERALL_ICON[status]}</span> {STATUS_LABELS[status]}
    </Badge>
  );
}

export const STATUS_DOT: Record<Status, string> = { ok: "bg-ok", warn: "bg-warn", fail: "bg-fail" };

const BUTTON = {
  primary: "bg-accent text-white hover:bg-accent/85 disabled:bg-white/10 disabled:text-muted",
  secondary: "border border-line bg-white/5 text-ink hover:bg-white/10 disabled:text-muted disabled:hover:bg-white/5",
  ghost: "text-muted hover:text-ink",
} as const;
const buttonClass = (variant: keyof typeof BUTTON, className: string) =>
  `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${BUTTON[variant]} ${className}`;

export function Button({ variant = "secondary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON }) {
  return <button type="button" {...props} className={buttonClass(variant, className)} />;
}

export function LinkButton({ variant = "secondary", className = "", href, children }: { variant?: keyof typeof BUTTON; className?: string; href: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

/** État réel des données : ce qui est vérifié, ce qui ne l'est pas encore. Calculé depuis le catalogue. */
export function DemoNotice({ className = "" }: { className?: string }) {
  const { total, verified, partial, pricesChecked } = catalogStats;
  const demoBenchmarks = benchmarks.sources.some((source) => source.demo);
  return (
    <p className={`rounded-xl border border-warn/25 bg-warn/5 px-3 py-2 text-xs leading-relaxed text-warn/90 ${className}`}>
      <strong className="font-semibold">État des données.</strong> Caractéristiques : {verified} fiche{verified > 1 ? "s" : ""} sur {total} vérifiée{verified > 1 ? "s" : ""} auprès des fabricants
      {partial > 0 ? `, ${partial} partiellement` : ""}. Prix : {pricesChecked === 0 ? "aucun relevé, valeurs indicatives non datées" : `${pricesChecked} sur ${total} relevés`}.
      {demoBenchmarks && " Performances : benchmarks de démonstration, non mesurés."} Ne pas utiliser pour décider d&apos;un achat.
    </p>
  );
}

export function PageShell({ title, intro, children, actions }: { title: string; intro?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {intro && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{intro}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
