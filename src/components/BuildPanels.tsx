import { buildPrice, componentPrice, estimatePower, fanCountOf, formatChf, isComplete, type Build } from "@/lib/build";
import { CATEGORIES, CATEGORY_LABELS, games, type Resolution } from "@/lib/catalog";
import type { CompatibilityReport } from "@/lib/compat";
import { GLOSSARY } from "@/lib/catalog/help";
import { evaluateUpgradability } from "@/lib/insights";
import { estimateFps, type FpsResult } from "@/lib/perf/estimate";
import { Badge, Card, CardTitle, STATUS_DOT, StatusBadge } from "./ui";

export function ComponentList({ build, dense = false }: { build: Build; dense?: boolean }) {
  return (
    <ul className={`divide-y divide-line ${dense ? "text-[13px]" : "text-sm"}`}>
      {CATEGORIES.map((category) => {
        const component = build[category];
        return (
          <li key={category} className={`flex items-baseline justify-between gap-3 ${dense ? "py-1.5" : "py-2"}`}>
            <div className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wider text-muted">{CATEGORY_LABELS[category]}</span>
              <span className={component ? "text-ink" : "text-muted"}>
                {component ? `${category === "fans" ? `${fanCountOf(build)} × ` : ""}${component.brand} ${component.name}` : category === "fans" ? "Aucun (ceux du boîtier)" : "Non choisi"}
              </span>
            </div>
            {component && <span className="shrink-0 font-mono text-xs text-muted">{formatChf(componentPrice(build, category))}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function PriceTotal({ build }: { build: Build }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-muted">Prix total indicatif</span>
      <span className="font-mono text-2xl font-semibold tracking-tight">{formatChf(buildPrice(build))}</span>
    </div>
  );
}

/**
 * Répartition du budget : une barre par catégorie, triée du plus cher au
 * moins cher. Une seule série, donc une seule teinte ; les valeurs sont écrites.
 */
export function BudgetBreakdown({ build }: { build: Build }) {
  const total = buildPrice(build);
  const rows = CATEGORIES.filter((category) => build[category]).map((category) => ({ category, price: componentPrice(build, category) })).sort((a, b) => b.price - a.price);
  if (rows.length === 0) return null;
  const max = rows[0].price;
  return (
    <Card>
      <CardTitle aside={<span className="font-mono text-sm text-ink">{formatChf(total)}</span>}>Répartition du budget</CardTitle>
      <ul className="space-y-2">
        {rows.map(({ category, price }) => {
          const share = Math.round((price / total) * 100);
          return (
            <li key={category} title={`${CATEGORY_LABELS[category]} : ${formatChf(price)}, soit ${share} % du total`} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 text-xs">
              <span className="truncate text-muted">{CATEGORY_LABELS[category]}</span>
              <span className="h-2 rounded-r bg-white/5">
                <span className="block h-2 rounded-r bg-accent" style={{ width: `${(price / max) * 100}%` }} />
              </span>
              <span className="w-24 text-right font-mono text-ink">
                {formatChf(price)} <span className="text-muted">· {share} %</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">Prix indicatifs, non relevés. Seuls les composants choisis sont comptés.</p>
    </Card>
  );
}

export function CompatPanel({ report }: { report: CompatibilityReport }) {
  const order = { fail: 0, warn: 1, ok: 2 };
  const diagnostics = [...report.diagnostics].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <Card>
      <CardTitle aside={<StatusBadge status={report.status} />}>Compatibilité</CardTitle>
      {report.status === "incompatible" && (
        <p className="mb-3 rounded-xl border border-fail/30 bg-fail/10 px-3 py-2 text-sm text-fail">
          Cette configuration ne peut pas être assemblée telle quelle : {report.failures.length} conflit{report.failures.length > 1 ? "s" : ""} bloquant{report.failures.length > 1 ? "s" : ""}.
        </p>
      )}
      {diagnostics.length === 0 ? (
        <p className="text-sm text-muted">Choisissez au moins deux composants pour lancer les vérifications.</p>
      ) : (
        <ul className="space-y-2.5">
          {diagnostics.map((d) => (
            <li key={d.ruleId} className="flex gap-2.5 text-sm">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[d.status]}`} />
              <div>
                <p className="font-medium text-ink">
                  {d.title}
                  {d.status === "warn" && <span className="ml-2 text-xs font-normal text-warn">à vérifier</span>}
                  {d.status === "fail" && <span className="ml-2 text-xs font-normal text-fail">incompatible</span>}
                </p>
                <p className="text-[13px] leading-snug text-muted">{d.message}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {report.status === "incomplete" && diagnostics.length > 0 && <p className="mt-3 text-xs text-muted">Configuration incomplète : toutes les règles ne peuvent pas encore être vérifiées.</p>}
    </Card>
  );
}

const CONFIDENCE_TONE = { élevée: "ok", moyenne: "warn", faible: "neutral" } as const;

/** Une estimation, toujours accompagnée de sa fourchette, de sa source et de sa confiance. */
export function FpsRow({ name, result, targetFps }: { name: string; result: FpsResult; targetFps?: number | null }) {
  if (result.kind === "insufficient") {
    return (
      <div className="py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">{name}</span>
          <Badge>Données insuffisantes</Badge>
        </div>
        <p className="mt-1 text-xs text-muted">{result.reason} Aucun chiffre n&apos;est affiché plutôt qu&apos;une valeur inventée.</p>
      </div>
    );
  }
  const scale = Math.max(result.high, (targetFps ?? 0) * 1.25, 60) * 1.08;
  const pct = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
  const meets = targetFps ? result.fps >= targetFps : null;
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{name}</span>
        <span className="font-mono text-sm">
          <span className={`text-base font-semibold ${meets === false ? "text-fail" : "text-ink"}`}>≈ {result.fps}</span>
          <span className="text-muted"> FPS · {result.low}–{result.high}</span>
        </span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-white/8">
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent/35" style={{ width: pct(result.high) }} />
        <div className={`absolute inset-y-0 left-0 rounded-full ${meets === false ? "bg-fail" : "bg-accent"}`} style={{ width: pct(result.fps) }} />
        <div className="absolute inset-y-0 rounded-full bg-bg/60" style={{ left: pct(result.low), width: 2 }} />
        {targetFps ? <div className="absolute -inset-y-1 w-0.5 rounded bg-white" style={{ left: pct(targetFps) }} title={`Cible : ${targetFps} FPS`} /> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
        <Badge tone="neutral">Estimation dérivée</Badge>
        <Badge tone={CONFIDENCE_TONE[result.confidence]}>Confiance {result.confidence}</Badge>
        {result.demo && <Badge tone="warn" title="Les sources de cette estimation sont un jeu de données de démonstration">Source de démonstration</Badge>}
        <span>
          Preset {result.preset} · limité par {result.limitedBy === "gpu" ? "la carte graphique" : "le processeur"} · {result.sources.length} source{result.sources.length > 1 ? "s" : ""}
          {targetFps ? ` · cible ${targetFps} FPS` : ""}
        </span>
      </div>
    </div>
  );
}

export function PerfPanel({ build, resolution, targetFps, gameIds, onResolution }: { build: Build; resolution: Resolution; targetFps?: number | null; gameIds?: string[]; onResolution?: (r: Resolution) => void }) {
  const list = gameIds ? games.filter((g) => gameIds.includes(g.id)) : games;
  return (
    <Card>
      <CardTitle
        aside={
          onResolution ? (
            <div className="flex rounded-full border border-line p-0.5 text-xs">
              {(["1080p", "1440p", "4K"] as const).map((r) => (
                <button key={r} type="button" onClick={() => onResolution(r)} aria-pressed={r === resolution} className={`rounded-full px-2.5 py-1 transition ${r === resolution ? "bg-accent text-white" : "text-muted hover:text-ink"}`}>
                  {r}
                </button>
              ))}
            </div>
          ) : (
            <Badge>{resolution}</Badge>
          )
        }
      >
        Performances estimées
      </CardTitle>
      {!build.cpu || !build.gpu ? (
        <p className="text-sm text-muted">Choisissez un processeur et une carte graphique pour obtenir une estimation.</p>
      ) : (
        <div className="divide-y divide-line">
          {list.map((game) => (
            <FpsRow key={game.id} name={game.name} targetFps={targetFps} result={estimateFps({ cpuId: build.cpu!.id, gpuId: build.gpu!.id, gameId: game.id, resolution })} />
          ))}
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Méthode : performance relative normalisée par source, moyenne géométrique, ancrage sur une mesure absolue, puis min(limite GPU, limite CPU). Ray tracing et upscaling désactivés.
      </p>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer text-accent-soft">Comprendre ces chiffres</summary>
        <p className="mt-1.5 leading-relaxed">{GLOSSARY.fps}</p>
        <p className="mt-1 leading-relaxed">{GLOSSARY.range}</p>
        <p className="mt-1 leading-relaxed">{GLOSSARY.low}</p>
      </details>
    </Card>
  );
}

const RESOLUTIONS = ["1080p", "1440p", "4K"] as const;

/**
 * FPS estimés par jeu et par résolution, en petits multiples : une ligne par
 * jeu, trois barres sur la même échelle. Une cellule sans donnée reste vide.
 */
export function FpsByResolution({ build, targetFps }: { build: Build; targetFps?: number | null }) {
  if (!build.cpu || !build.gpu) return null;
  const rows = games.map((game) => ({
    game,
    cells: RESOLUTIONS.map((resolution) => estimateFps({ cpuId: build.cpu!.id, gpuId: build.gpu!.id, gameId: game.id, resolution })),
  }));
  const documented = rows.filter((row) => row.cells.some((cell) => cell.kind === "estimate"));
  if (documented.length === 0) return null;
  return (
    <Card>
      <CardTitle>FPS estimés par résolution</CardTitle>
      <div className="space-y-4">
        {documented.map(({ game, cells }) => {
          // Échelle propre à chaque jeu : les jeux ne se comparent pas entre eux.
          const max = Math.max(...cells.map((cell) => (cell.kind === "estimate" ? cell.high : 0)), targetFps ?? 0);
          return (
            <div key={game.id}>
              <p className="mb-1.5 text-sm font-medium">{game.name}</p>
              <ul className="space-y-1.5">
                {cells.map((cell, i) => (
                  <li key={RESOLUTIONS[i]} className="grid grid-cols-[3.2rem_1fr_auto] items-center gap-2 text-xs" title={cell.kind === "estimate" ? `${game.name} en ${RESOLUTIONS[i]} : environ ${cell.fps} FPS (${cell.low}–${cell.high}), confiance ${cell.confidence}` : cell.reason}>
                    <span className="font-mono text-muted">{RESOLUTIONS[i]}</span>
                    {cell.kind === "estimate" ? (
                      <>
                        <span className="relative h-2 rounded-r bg-white/5">
                          <span className="absolute inset-y-0 left-0 rounded-r bg-accent/35" style={{ width: `${(cell.high / max) * 100}%` }} />
                          <span className="absolute inset-y-0 left-0 rounded-r bg-accent" style={{ width: `${(cell.fps / max) * 100}%` }} />
                          {targetFps ? <span className="absolute -inset-y-1 w-0.5 rounded bg-white" style={{ left: `${Math.min(100, (targetFps / max) * 100)}%` }} /> : null}
                        </span>
                        <span className="w-32 whitespace-nowrap text-right font-mono text-ink">
                          ≈ {cell.fps} <span className="text-muted">({cell.low}–{cell.high})</span>
                        </span>
                      </>
                    ) : (
                      <span className="col-span-2 text-muted">Données insuffisantes</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Barre pleine : estimation ; zone claire : haut de la fourchette{targetFps ? ` ; trait blanc : cible de ${targetFps} FPS` : ""}. Chaque jeu a sa propre échelle. Sources de démonstration.
      </p>
    </Card>
  );
}

export function PowerPanel({ build }: { build: Build }) {
  const power = estimatePower(build);
  const upgradability = isComplete(build) ? evaluateUpgradability(build) : null;
  return (
    <Card>
      <CardTitle>Consommation et évolution</CardTitle>
      {power ? (
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Estimée en charge", `${power.totalW} W`],
            ["Alimentation requise", `${power.requiredW} W`],
            ["Alimentation choisie", build.psu ? `${build.psu.wattage} W` : "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/5 px-2 py-2.5">
              <dd className="font-mono text-lg font-semibold">{value}</dd>
              <dt className="mt-0.5 text-[11px] leading-tight text-muted">{label}</dt>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted">La consommation est estimée dès qu&apos;un processeur et une carte graphique sont choisis.</p>
      )}
      {power && <p className="mt-2 text-xs text-muted">Processeur {power.cpuW} W + carte graphique {power.gpuW} W + reste du système {power.restW} W, puis 25 % de marge.</p>}
      {upgradability && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            Capacité d&apos;évolution <Badge tone={upgradability.level === "Bonne" ? "ok" : upgradability.level === "Moyenne" ? "warn" : "neutral"}>{upgradability.level}</Badge>
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[13px] text-muted">
            {upgradability.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
