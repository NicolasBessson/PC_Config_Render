"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ComponentList, FpsRow } from "@/components/BuildPanels";
import { Badge, Button, Card, DemoNotice, LinkButton, PageShell, StatusBadge } from "@/components/ui";
import { Viewer } from "@/components/viewer/Viewer";
import { STYLES } from "@/components/viewer/styles";
import { formatChf } from "@/lib/build";
import { getGame } from "@/lib/catalog";
import { parseRecommendInput, recommendQuery } from "@/lib/query";
import { PROFILE_LABELS, recommend, type Proposal, type RecommendInput } from "@/lib/recommend";

const PROFILE_HINT = {
  economique: "La moins chère qui atteint votre objectif.",
  equilibree: "Le meilleur compromis entre prix, performances et évolutivité.",
  performance: "Les meilleures performances dans votre budget.",
  "meilleur-effort": "N'atteint pas l'objectif : ce que le budget permet de mieux.",
} as const;

function proposalQuery(p: Proposal, input: RecommendInput) {
  const lighting = STYLES[input.style].lighting;
  return new URLSearchParams({ b: p.encoded, style: input.style, lum: lighting.mode, c: lighting.color.slice(1), res: input.resolution, fps: String(input.targetFps) }).toString();
}

function ProposalCard({ proposal: p, input, selected, onSelect, canSelect }: { proposal: Proposal; input: RecommendInput; selected: boolean; onSelect: () => void; canSelect: boolean }) {
  const query = proposalQuery(p, input);
  return (
    <article className={`flex flex-col rounded-2xl border bg-surface ${p.profile === "equilibree" ? "border-accent/60" : "border-line"}`}>
      <div className="p-4 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{PROFILE_LABELS[p.profile]}</h2>
            <p className="min-h-8 text-xs leading-snug text-muted">{PROFILE_HINT[p.profile]}</p>
          </div>
          <StatusBadge status={p.compat.status} />
        </div>
        <Viewer build={p.build} style={input.style} lighting={STYLES[input.style].lighting} animate={false} toolbar={false} className="mt-3 aspect-[4/3] w-full" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-2xl font-semibold">{formatChf(p.price)}</span>
          <Badge tone={p.meetsTarget ? "ok" : "fail"}>{p.meetsTarget ? "Objectif atteint" : "Objectif non atteint"}</Badge>
        </div>

        <div className="divide-y divide-line border-y border-line">
          {p.performance.map((g) => (
            <FpsRow key={g.gameId} name={g.gameName} result={g.result} targetFps={input.targetFps} />
          ))}
        </div>

        <ComponentList build={p.build} dense />

        <div className="grid grid-cols-2 gap-2 text-center text-xs text-muted">
          <div className="rounded-xl bg-white/5 px-2 py-2">
            <span className="block font-mono text-base font-semibold text-ink">{p.power.totalW} W</span>consommation estimée
          </div>
          <div className="rounded-xl bg-white/5 px-2 py-2">
            <span className="block text-base font-semibold text-ink">{p.upgradability.level}</span>capacité d&apos;évolution
          </div>
        </div>

        {p.strengths.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ok">Points forts</h3>
            <ul className="mt-1.5 space-y-1 text-[13px] text-muted">
              {p.strengths.map((s) => (
                <li key={s} className="flex gap-2"><span className="text-ok">+</span>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {p.compromises.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-warn">Compromis</h3>
            <ul className="mt-1.5 space-y-1 text-[13px] text-muted">
              {p.compromises.map((s) => (
                <li key={s} className="flex gap-2"><span className="text-warn">–</span>{s}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <LinkButton href={`/config?${query}`} variant="primary" className="flex-1">Voir en détail</LinkButton>
          <LinkButton href={`/manuel?${query}`}>Modifier</LinkButton>
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${selected ? "border-accent bg-accent/10 text-ink" : "border-line text-muted hover:text-ink"} ${!canSelect && !selected ? "opacity-40" : ""}`}>
            <input type="checkbox" checked={selected} disabled={!canSelect && !selected} onChange={onSelect} className="accent-[var(--color-accent)]" />
            Comparer
          </label>
        </div>
      </div>
    </article>
  );
}

function Results() {
  const params = useSearchParams();
  const router = useRouter();
  const input = useMemo(() => parseRecommendInput(params), [params]);
  const result = useMemo(() => (input ? recommend(input) : null), [input]);
  const [selection, setSelection] = useState<string[]>([]);

  if (!input || !result) {
    return (
      <PageShell title="Résultats">
        <Card>
          <p className="text-sm text-muted">Les critères sont absents ou invalides. Reprenez le questionnaire pour obtenir des propositions.</p>
          <LinkButton href="/assiste" variant="primary" className="mt-4">Ouvrir le questionnaire</LinkButton>
        </Card>
      </PageShell>
    );
  }

  const toggle = (encoded: string) => setSelection((list) => (list.includes(encoded) ? list.filter((e) => e !== encoded) : [...list, encoded].slice(-2)));
  const selected = result.proposals.filter((p) => selection.includes(p.encoded));
  const compareHref = selected.length === 2 ? `/comparer?a=${encodeURIComponent(proposalQuery(selected[0], input))}&b=${encodeURIComponent(proposalQuery(selected[1], input))}` : null;
  const gameNames = input.gameIds.map((id) => getGame(id)?.name ?? id).join(", ");
  const tone = result.status === "ok" ? "border-ok/30 bg-ok/10" : "border-warn/30 bg-warn/10";

  return (
    <PageShell
      title="Vos configurations"
      intro={`${formatChf(input.budget)} · ${gameNames} · ${input.resolution} · ${input.targetFps} FPS · style ${STYLES[input.style].label}`}
      actions={<LinkButton href="/assiste">Modifier mes critères</LinkButton>}
    >
      <div className={`mb-4 rounded-2xl border px-4 py-3 ${tone}`}>
        <p className="text-sm font-medium">{result.message}</p>
        {result.gamesWithoutData.length > 0 && result.status !== "no-data" && (
          <p className="mt-1 text-sm text-muted">Aucun benchmark exploitable pour {result.gamesWithoutData.join(", ")} : l&apos;objectif n&apos;a pas pu être vérifié pour ce jeu, et aucun chiffre n&apos;est inventé.</p>
        )}
        <p className="mt-1 text-xs text-muted">{result.candidatesEvaluated.toLocaleString("fr-CH")} configurations compatibles passées en revue dans ce style.</p>
      </div>

      {result.compromises.length > 0 && (
        <Card className="mb-4">
          <h2 className="text-base font-semibold">Compromis possibles</h2>
          <ul className="mt-3 space-y-2">
            {result.compromises.map((c) => (
              <li key={c.message} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-sm">
                <span>{c.message}</span>
                {Object.keys(c.patch).length > 0 && (
                  <Button variant="primary" onClick={() => router.push(`/resultats?${recommendQuery({ ...input, ...c.patch })}`)}>Essayer</Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {result.proposals.length > 0 && (
        <div className={`grid gap-4 ${result.proposals.length === 1 ? "mx-auto max-w-xl" : result.proposals.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
          {result.proposals.map((p) => (
            <ProposalCard key={p.encoded} proposal={p} input={input} selected={selection.includes(p.encoded)} canSelect={selection.length < 2} onSelect={() => toggle(p.encoded)} />
          ))}
        </div>
      )}

      {result.proposals.length > 1 && (
        <div className="sticky bottom-3 z-30 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-raised/95 px-4 py-3 backdrop-blur">
          <p className="text-sm text-muted">{selected.length === 2 ? "Deux configurations sélectionnées." : `Cochez « Comparer » sur deux configurations (${selected.length}/2).`}</p>
          {compareHref ? <Link href={compareHref} className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/85">Comparer →</Link> : <Button disabled variant="primary">Comparer →</Button>}
        </div>
      )}

      <DemoNotice className="mt-6" />
    </PageShell>
  );
}

export default function ResultsPage() {
  return (
    <Suspense>
      <Results />
    </Suspense>
  );
}
