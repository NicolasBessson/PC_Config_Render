"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type ReactNode } from "react";
import { Badge, Card, DemoNotice, LinkButton, PageShell, StatusBadge } from "@/components/ui";
import { Viewer } from "@/components/viewer/Viewer";
import { buildPrice, componentPrice, estimatePower, fanCountOf, formatChf, isComplete, resolveBuild, type Build } from "@/lib/build";
import { CATEGORIES, CATEGORY_LABELS, games, type Resolution } from "@/lib/catalog";
import { checkBuild } from "@/lib/compat";
import { evaluateUpgradability } from "@/lib/insights";
import { estimateFps } from "@/lib/perf/estimate";
import { parseViewState } from "@/lib/query";
import { useSavedBuilds } from "@/lib/saved";

const EXAMPLES = [
  { name: "Exemple — entrée de gamme", query: "b=i5-12400f.rtx-5060.b760m-ddr4.ddr4-16-lpx.nv3-1tb.cx550.pure-rock-2.4000d-airflow&style=noir" },
  { name: "Exemple — équilibrée 1440p", query: "b=r5-7600.rx-9070.b650m-ds3h.ddr5-32-vengeance.sn850x-1tb.rm750e.pa120-se.h5-flow-white&style=blanc" },
  { name: "Exemple — haut de gamme", query: "b=r7-9800x3d.rtx-5080.b650-tomahawk.ddr5-32-tridentz5-rgb.990pro-2tb.rm850x.lf3-360-argb.lancool-216-rgb&style=rgb" },
];

function describeSide(query: string | null) {
  if (!query) return null;
  const view = parseViewState(new URLSearchParams(query));
  if (Object.keys(view.ids).length === 0) return null;
  const build = resolveBuild(view.ids);
  const report = checkBuild(build);
  return { query, view, build, report, price: buildPrice(build), power: estimatePower(build), upgradability: isComplete(build) ? evaluateUpgradability(build) : null };
}
type Side = NonNullable<ReturnType<typeof describeSide>>;

function Row({ label, a, b, differs = false }: { label: string; a: ReactNode; b: ReactNode; differs?: boolean }) {
  return (
    <tr className={differs ? "bg-accent/[0.07]" : ""}>
      <th scope="row" className="w-[22%] px-3 py-2.5 text-left align-top text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
        {differs && <span className="mt-0.5 block normal-case tracking-normal text-accent-soft">différent</span>}
      </th>
      <td className="w-[39%] px-3 py-2.5 align-top text-sm">{a}</td>
      <td className="w-[39%] px-3 py-2.5 align-top text-sm">{b}</td>
    </tr>
  );
}

function fpsCell(side: Side, gameId: string, resolution: Resolution) {
  if (!side.build.cpu || !side.build.gpu) return { node: <span className="text-muted">—</span>, fps: null };
  const result = estimateFps({ cpuId: side.build.cpu.id, gpuId: side.build.gpu.id, gameId, resolution });
  if (result.kind === "insufficient") return { node: <Badge>Données insuffisantes</Badge>, fps: null };
  return {
    fps: result.fps,
    node: (
      <span className="font-mono">
        <span className="font-semibold">≈ {result.fps} FPS</span> <span className="text-muted">({result.low}–{result.high})</span>
        <span className="mt-0.5 block font-sans text-[11px] text-muted">confiance {result.confidence}{result.demo ? " · source de démonstration" : ""}</span>
      </span>
    ),
  };
}

function tradeoffs(side: Side) {
  const list = [...side.report.failures.map((d) => `Incompatible — ${d.title.toLowerCase()}`), ...side.report.warnings.map((d) => `À vérifier — ${d.title.toLowerCase()}`)];
  if (side.build.gpu && side.build.gpu.vramGb <= 8) list.push(`${side.build.gpu.vramGb} Go de mémoire vidéo`);
  if (side.build.ram && side.build.ram.capacityGb < 32) list.push(`${side.build.ram.capacityGb} Go de RAM`);
  if (side.upgradability?.level === "Limitée") list.push("Capacité d'évolution limitée");
  return list.length === 0 ? <span className="text-muted">Aucun compromis notable</span> : (
    <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-muted">{list.map((item) => <li key={item}>{item}</li>)}</ul>
  );
}

function Compare() {
  const params = useSearchParams();
  const router = useRouter();
  const { saved, remove } = useSavedBuilds();
  const a = useMemo(() => describeSide(params.get("a")), [params]);
  const b = useMemo(() => describeSide(params.get("b")), [params]);
  const [resolution, setResolution] = useState<Resolution>(() => a?.view.resolution ?? "1440p");

  const choices = [...saved.map((s) => ({ name: s.name, query: s.query, id: s.id })), ...EXAMPLES.map((e) => ({ ...e, id: null }))];
  const setSide = (key: "a" | "b", query: string) => {
    const next = new URLSearchParams(params.toString());
    if (query) next.set(key, query);
    else next.delete(key);
    router.replace(`/comparer?${next.toString()}`);
  };

  const picker = (key: "a" | "b", side: Side | null) => {
    const known = choices.some((c) => c.query === side?.query);
    return (
      <label className="block text-xs text-muted">
        Configuration {key.toUpperCase()}
        <select value={side?.query ?? ""} onChange={(e) => setSide(key, e.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent">
          <option value="">Choisir…</option>
          {side && !known && <option value={side.query}>Configuration ouverte</option>}
          {saved.length > 0 && <optgroup label="Mes configurations">{saved.map((s) => <option key={s.id} value={s.query}>{s.name}</option>)}</optgroup>}
          <optgroup label="Exemples">{EXAMPLES.map((e) => <option key={e.name} value={e.query}>{e.name}</option>)}</optgroup>
        </select>
      </label>
    );
  };

  const perf = a && b ? games.map((game) => ({ game, a: fpsCell(a, game.id, resolution), b: fpsCell(b, game.id, resolution) })) : [];
  const shared = perf.filter((p) => p.a.fps !== null && p.b.fps !== null);
  const mean = (values: number[]) => Math.exp(values.reduce((s, v) => s + Math.log(v), 0) / values.length);
  const value = (side: Side, key: "a" | "b") => (shared.length ? `${((mean(shared.map((p) => p[key].fps!)) / side.price) * 100).toFixed(1)} FPS par 100 CHF` : "—");

  return (
    <PageShell title="Comparer deux configurations" intro="Composants, prix, performances estimées et compromis, côte à côte. Les lignes qui diffèrent sont mises en évidence.">
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {picker("a", a)}
          {picker("b", b)}
        </div>
        {saved.length === 0 && <p className="mt-3 text-xs text-muted">Astuce : le bouton « Enregistrer » d&apos;une fiche ou du configurateur manuel ajoute vos configurations à ces listes.</p>}
      </Card>

      {a && b ? (
        <>
          <Card className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">En bref</h2>
            <ul className="mt-2 space-y-1 text-sm">
              <li>
                {a.price === b.price ? "Les deux configurations coûtent le même prix." : `La configuration ${a.price < b.price ? "A" : "B"} coûte ${formatChf(Math.abs(a.price - b.price))} de moins.`}
              </li>
              {shared.length > 0 ? (
                (() => {
                  const ratio = mean(shared.map((p) => p.b.fps!)) / mean(shared.map((p) => p.a.fps!));
                  const gap = Math.round(Math.abs(ratio - 1) * 100);
                  return <li>{gap === 0 ? `Performances estimées équivalentes en ${resolution}.` : `La configuration ${ratio > 1 ? "B" : "A"} est estimée ${gap} % plus rapide en ${resolution}, en moyenne sur ${shared.length} jeu${shared.length > 1 ? "x" : ""}.`}</li>;
                })()
              ) : (
                <li className="text-muted">Performances non comparables : données insuffisantes pour au moins une des deux.</li>
              )}
              <li>{CATEGORIES.filter((c) => a.build[c]?.id !== b.build[c]?.id).length} composant(s) sur {CATEGORIES.length} diffèrent.</li>
              {a.report.status !== b.report.status && <li>Compatibilité différente : vérifiez la ligne correspondante.</li>}
            </ul>
            <p className="mt-2 text-xs text-muted">Écarts calculés sur des estimations et des prix indicatifs : un écart de quelques pour cent n&apos;est pas significatif.</p>
          </Card>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className="px-3 py-3" />
                  {[a, b].map((side, i) => (
                    <th key={i} className="px-3 py-3 text-left align-top font-normal">
                      <Viewer build={side.build} style={side.view.style} lighting={side.view.lighting} animate={false} toolbar={false} className="aspect-[4/3] w-full" />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">Configuration {i === 0 ? "A" : "B"}</span>
                        <LinkButton href={`/config?${side.query}`} variant="ghost" className="px-2 py-1 text-xs">Ouvrir la fiche →</LinkButton>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line border-t border-line">
                <Row label="Prix total" differs={a.price !== b.price}
                  a={<span className="font-mono text-lg font-semibold">{formatChf(a.price)}</span>}
                  b={<span className="font-mono text-lg font-semibold">{formatChf(b.price)} <span className="text-xs font-normal text-muted">({b.price >= a.price ? "+" : "−"}{formatChf(Math.abs(b.price - a.price))})</span></span>} />
                <Row label="Compatibilité" differs={a.report.status !== b.report.status} a={<StatusBadge status={a.report.status} />} b={<StatusBadge status={b.report.status} />} />
                {CATEGORIES.map((category) => {
                  const ca = a.build[category], cb = b.build[category];
                  const cell = (build: Build, c: typeof ca) =>
                    c ? <>{category === "fans" ? `${fanCountOf(build)} × ` : ""}{c.brand} {c.name}<span className="block font-mono text-xs text-muted">{formatChf(componentPrice(build, category))}</span></> : <span className="text-muted">{category === "fans" ? "Aucun" : "Non choisi"}</span>;
                  const differs = ca?.id !== cb?.id || (category === "fans" && fanCountOf(a.build) !== fanCountOf(b.build));
                  return <Row key={category} label={CATEGORY_LABELS[category]} differs={differs} a={cell(a.build, ca)} b={cell(b.build, cb)} />;
                })}
                <tr>
                  <th colSpan={3} className="bg-white/5 px-3 py-2 text-left">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Performances estimées · preset « Élevé », sans ray tracing ni upscaling</span>
                      <span className="flex rounded-full border border-line p-0.5 text-xs font-normal">
                        {(["1080p", "1440p", "4K"] as const).map((r) => (
                          <button key={r} type="button" onClick={() => setResolution(r)} aria-pressed={r === resolution} className={`rounded-full px-2.5 py-1 ${r === resolution ? "bg-accent text-white" : "text-muted hover:text-ink"}`}>{r}</button>
                        ))}
                      </span>
                    </span>
                  </th>
                </tr>
                {perf.map((p) => <Row key={p.game.id} label={p.game.name} differs={p.a.fps !== p.b.fps} a={p.a.node} b={p.b.node} />)}
                <Row label="Rapport performances / prix" a={value(a, "a")} b={value(b, "b")} differs={shared.length > 0 && value(a, "a") !== value(b, "b")} />
                <Row label="Consommation estimée" differs={a.power?.totalW !== b.power?.totalW} a={a.power ? `${a.power.totalW} W` : "—"} b={b.power ? `${b.power.totalW} W` : "—"} />
                <Row label="Capacité d'évolution" differs={a.upgradability?.level !== b.upgradability?.level} a={a.upgradability?.level ?? "—"} b={b.upgradability?.level ?? "—"} />
                <Row label="Compromis" a={tradeoffs(a)} b={tradeoffs(b)} />
              </tbody>
            </table>
          </div>
          <DemoNotice className="mt-4" />
        </>
      ) : (
        <Card>
          <p className="text-sm text-muted">Choisissez deux configurations ci-dessus pour afficher le tableau comparatif.</p>
        </Card>
      )}

      {saved.length > 0 && (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Mes configurations enregistrées</h2>
          <ul className="mt-2 divide-y divide-line">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{s.name} <span className="text-xs text-muted">· {new Date(s.savedAt).toLocaleDateString("fr-CH")}</span></span>
                <span className="flex gap-1">
                  <LinkButton href={`/config?${s.query}`} variant="ghost" className="px-2 py-1 text-xs">Ouvrir</LinkButton>
                  <button type="button" onClick={() => remove(s.id)} className="rounded-lg px-2 py-1 text-xs text-muted hover:text-fail">Supprimer</button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageShell>
  );
}

export default function ComparePage() {
  return (
    <Suspense>
      <Compare />
    </Suspense>
  );
}
