"use client";

import { Suspense, useMemo, useState } from "react";
import { BuildActions } from "@/components/BuildActions";
import { BudgetBreakdown, CompatPanel, PerfPanel, PowerPanel, PriceTotal } from "@/components/BuildPanels";
import { Badge, Button, Card, CardTitle, DemoNotice, LinkButton, PageShell, STATUS_DOT, StatusBadge } from "@/components/ui";
import { useViewState } from "@/components/useViewState";
import { LightingPicker, StylePicker, Viewer } from "@/components/viewer/Viewer";
import { STYLES } from "@/components/viewer/styles";
import { formatChf, resolveBuild, type BuildIds } from "@/lib/build";
import { catalog, CATEGORIES, CATEGORY_LABELS, type AnyComponent, type Category } from "@/lib/catalog";
import { describeComponent } from "@/lib/catalog/describe";
import { CATEGORY_HELP } from "@/lib/catalog/help";
import { checkBuild, checkCandidate } from "@/lib/compat";

function Manual() {
  const { state, update, query } = useViewState();
  const build = useMemo(() => resolveBuild(state.ids), [state.ids]);
  const report = useMemo(() => checkBuild(build), [build]);
  const [open, setOpen] = useState<Category | null>(() => CATEGORIES.find((c) => !state.ids[c]) ?? null);
  const [hideIncompatible, setHideIncompatible] = useState(false);
  // Sur petit écran, les trois zones deviennent trois onglets.
  const [tab, setTab] = useState<"composants" | "apercu" | "details">("composants");
  const zone = (id: typeof tab) => (tab === id ? "" : "hidden");

  const select = (category: Category, component: AnyComponent) => {
    const ids: BuildIds = { ...state.ids };
    if (ids[category] === component.id) {
      delete ids[category];
      update({ ids });
      return;
    }
    ids[category] = component.id;
    // Choisir un boîtier applique son style au rendu ; il reste modifiable ensuite.
    if (category === "case" && "style" in component) update({ ids, style: component.style, lighting: STYLES[component.style].lighting });
    else update({ ids });
    setOpen(CATEGORIES.find((c) => !ids[c]) ?? null);
  };

  const chosen = CATEGORIES.filter((c) => state.ids[c]).length;

  return (
    <PageShell
      title="Configuration manuelle"
      intro="Choisissez chaque composant. La compatibilité, le prix et le rendu 3D se mettent à jour à chaque changement."
      actions={
        <>
          <Button onClick={() => { update({ ids: {} }); setOpen("cpu"); }} disabled={chosen === 0}>Tout effacer</Button>
          <LinkButton href={`/config?${query}`} variant="primary">Voir la fiche</LinkButton>
        </>
      }
    >
      <div role="tablist" aria-label="Zones du configurateur" className="mb-3 flex rounded-xl border border-line bg-surface p-1 text-sm xl:hidden">
        {([["composants", "Composants"], ["apercu", "Aperçu 3D"], ["details", "Prix et détails"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex-1 rounded-lg px-2 py-2 transition ${tab === id ? "bg-accent text-white" : "text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[23rem_minmax(0,1fr)_23rem]">
        {/* Sélection des composants */}
        <div className={`${zone("composants")} min-w-0 space-y-2.5 xl:block xl:max-h-[calc(100vh-9.5rem)] xl:overflow-y-auto xl:pr-1`}>
          <div className="flex items-center justify-between px-1 text-sm">
            <span className="text-muted">{chosen} / {CATEGORIES.length} composants choisis</span>
            <label className="flex cursor-pointer items-center gap-2 text-muted">
              <input type="checkbox" checked={hideIncompatible} onChange={(e) => setHideIncompatible(e.target.checked)} className="accent-[var(--color-accent)]" />
              Masquer les incompatibles
            </label>
          </div>
          {CATEGORIES.map((category) => {
            const current = build[category];
            const isOpen = open === category;
            const options = (catalog[category] as AnyComponent[]).map((component) => ({ component, check: checkCandidate(build, category, component as never) }));
            const visible = options.filter((o) => !hideIncompatible || o.check.status !== "fail" || o.component.id === current?.id);
            const involved = report.diagnostics.filter((d) => d.involves.includes(category));
            const worst = involved.some((d) => d.status === "fail") ? "fail" : involved.some((d) => d.status === "warn") ? "warn" : current ? "ok" : null;
            return (
              <section key={category} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <button type="button" onClick={() => setOpen(isOpen ? null : category)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${worst ? STATUS_DOT[worst] : "bg-white/15"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] uppercase tracking-wider text-muted">{CATEGORY_LABELS[category]}</span>
                    <span className={`block truncate text-sm ${current ? "font-medium text-ink" : "text-muted"}`}>{current ? `${current.brand} ${current.name}` : "À choisir"}</span>
                  </span>
                  {current && <span className="shrink-0 font-mono text-xs text-muted">{formatChf(current.priceChf)}</span>}
                  <span className={`shrink-0 text-muted transition ${isOpen ? "rotate-180" : ""}`} aria-hidden>⌄</span>
                </button>
                {isOpen && (
                  <ul className="space-y-1.5 border-t border-line p-2.5">
                    <li className="rounded-xl bg-white/5 px-3 py-2 text-xs leading-relaxed text-muted">
                      <span className="text-ink">{CATEGORY_HELP[category].role}</span> {CATEGORY_HELP[category].tip}
                    </li>
                    {visible.map(({ component, check }) => {
                      const active = component.id === current?.id;
                      return (
                        <li key={component.id}>
                          <button
                            type="button"
                            onClick={() => select(category, component)}
                            aria-pressed={active}
                            className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${active ? "border-accent bg-accent/10" : check.status === "fail" ? "border-line opacity-60 hover:opacity-100" : "border-line hover:border-white/25"}`}
                          >
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="text-sm font-medium">{component.brand} {component.name}</span>
                              <span className="shrink-0 font-mono text-sm">{formatChf(component.priceChf)}</span>
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                              {describeComponent(category, component as never)}
                              {check.status === "fail" && <Badge tone="fail">Incompatible</Badge>}
                              {check.status === "warn" && <Badge tone="warn">À vérifier</Badge>}
                              {active && <Badge tone="accent">Sélectionné</Badge>}
                              {component.verified && <Badge tone="ok" title="Caractéristiques confirmées par une source constructeur">Fiche vérifiée</Badge>}
                            </span>
                            {check.reasons.length > 0 && (
                              <span className={`mt-1.5 block text-xs leading-snug ${check.status === "fail" ? "text-fail" : "text-warn"}`}>{check.reasons.join(" ")}</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                    {visible.length === 0 && <li className="px-2 py-3 text-sm text-muted">Aucun composant compatible avec la sélection actuelle.</li>}
                  </ul>
                )}
              </section>
            );
          })}
          <p className="px-1 text-xs text-muted">Les ventilateurs supplémentaires ne font pas encore partie du catalogue : le rendu affiche ceux du style choisi.</p>
        </div>

        {/* Rendu et diagnostics */}
        <div className={`${zone("apercu")} min-w-0 space-y-4 xl:block xl:sticky xl:top-18 xl:self-start`}>
          <Viewer build={build} style={state.style} lighting={state.lighting} className="aspect-[4/3] w-full xl:aspect-auto xl:h-[calc(100vh-24rem)] xl:min-h-[26rem]" />
          <Card>
            <CardTitle>Style et éclairage</CardTitle>
            <StylePicker value={state.style} onChange={(style) => update({ style, lighting: STYLES[style].lighting })} compact />
            <div className="mt-3">
              <LightingPicker value={state.lighting} onChange={(lighting) => update({ lighting })} />
            </div>
          </Card>
        </div>

        {/* Prix, compatibilité, performances */}
        <div className={`${zone("details")} min-w-0 space-y-4 xl:block xl:max-h-[calc(100vh-9.5rem)] xl:overflow-y-auto xl:pr-1`}>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <PriceTotalInline build={build} />
              <StatusBadge status={report.status} />
            </div>
            <div className="mt-4">
              <BuildActions query={query} build={build} />
            </div>
          </Card>
          <CompatPanel report={report} />
          <PerfPanel build={build} resolution={state.resolution} targetFps={state.targetFps} onResolution={(resolution) => update({ resolution })} />
          <BudgetBreakdown build={build} />
          <PowerPanel build={build} />
          <DemoNotice />
        </div>
      </div>
    </PageShell>
  );
}

function PriceTotalInline({ build }: { build: ReturnType<typeof resolveBuild> }) {
  return (
    <div className="flex-1">
      <PriceTotal build={build} />
    </div>
  );
}

export default function ManualPage() {
  return (
    <Suspense>
      <Manual />
    </Suspense>
  );
}
