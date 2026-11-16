"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, PageShell } from "@/components/ui";
import { StylePicker } from "@/components/viewer/Viewer";
import { STYLES } from "@/components/viewer/styles";
import { formatChf } from "@/lib/build";
import { games, type Resolution, type Style } from "@/lib/catalog";
import { recommendQuery } from "@/lib/query";

const RESOLUTIONS: { id: Resolution; label: string; hint: string }[] = [
  { id: "1080p", label: "1080p", hint: "Full HD — l'écran le plus courant" },
  { id: "1440p", label: "1440p", hint: "QHD — plus net, le bon équilibre" },
  { id: "4K", label: "4K", hint: "Ultra HD — très exigeant" },
];
const FPS_PRESETS = [
  { value: 60, hint: "Fluide" },
  { value: 120, hint: "Très fluide" },
  { value: 144, hint: "Écrans 144 Hz" },
  { value: 240, hint: "Compétitif" },
];
const STEPS = ["Budget", "Jeux", "Résolution", "Fluidité", "Style"];

const choice = (active: boolean) => `rounded-xl border p-4 text-left transition ${active ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-white/25"}`;

export default function AssistedPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState(1500);
  const [gameIds, setGameIds] = useState<string[]>([]);
  const [resolution, setResolution] = useState<Resolution>("1440p");
  const [targetFps, setTargetFps] = useState(60);
  const [style, setStyle] = useState<Style>("noir");

  const valid = [budget >= 300 && budget <= 20000, gameIds.length > 0, true, targetFps >= 30 && targetFps <= 500, true][step];
  const last = step === STEPS.length - 1;
  const next = () => {
    if (!valid) return;
    if (last) router.push(`/resultats?${recommendQuery({ budget, gameIds, resolution, targetFps, style })}`);
    else setStep(step + 1);
  };
  const toggleGame = (id: string) => setGameIds((list) => (list.includes(id) ? list.filter((g) => g !== id) : [...list, id]));

  return (
    <PageShell title="Configuration assistée" intro="Cinq questions. Pas besoin de connaître les composants : le moteur s'en charge.">
      <div className="mx-auto max-w-3xl">
        <ol className="mb-6 flex gap-1.5">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <button type="button" disabled={i > step} onClick={() => setStep(i)} className="w-full text-left disabled:cursor-default">
                <span className={`block h-1 rounded-full ${i <= step ? "bg-accent" : "bg-white/10"}`} />
                <span className={`mt-1.5 hidden text-xs sm:block ${i === step ? "text-ink" : "text-muted"}`}>
                  {i + 1}. {label}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-soft">
            Étape {step + 1} sur {STEPS.length}
          </p>

          {step === 0 && (
            <div>
              <h2 className="mt-2 text-xl font-semibold">Quel est votre budget ?</h2>
              <p className="mt-1 text-sm text-muted">Pour la tour seule, sans écran ni périphériques.</p>
              <div className="mt-6 flex items-baseline gap-2">
                <input
                  type="number" inputMode="numeric" min={300} max={20000} step={50} value={budget} aria-label="Budget en CHF"
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-40 rounded-xl border border-line bg-bg px-4 py-3 font-mono text-3xl font-semibold outline-none focus:border-accent"
                />
                <span className="text-lg text-muted">CHF</span>
              </div>
              <input type="range" min={700} max={3500} step={50} value={Math.min(Math.max(budget, 700), 3500)} onChange={(e) => setBudget(Number(e.target.value))} className="mt-5 w-full" aria-label="Budget" />
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{formatChf(700)}</span>
                <span>{formatChf(3500)}</span>
              </div>
              {!valid && <p className="mt-3 text-sm text-fail">Indiquez un budget entre 300 et 20&apos;000 CHF.</p>}
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="mt-2 text-xl font-semibold">À quoi voulez-vous jouer ?</h2>
              <p className="mt-1 text-sm text-muted">Un ou plusieurs jeux. La configuration devra tenir l&apos;objectif dans chacun.</p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {games.map((game) => {
                  const active = gameIds.includes(game.id);
                  return (
                    <button key={game.id} type="button" onClick={() => toggleGame(game.id)} aria-pressed={active} className={choice(active)}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{game.name}</span>
                        <span className={`grid h-5 w-5 place-items-center rounded-md border text-xs ${active ? "border-accent bg-accent text-white" : "border-line"}`}>{active ? "✓" : ""}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {game.genre} · qualité « {game.preset} »
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="mt-2 text-xl font-semibold">Sur quel écran ?</h2>
              <p className="mt-1 text-sm text-muted">La résolution de votre écran. Plus elle est élevée, plus la carte graphique travaille.</p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
                {RESOLUTIONS.map((r) => (
                  <button key={r.id} type="button" onClick={() => setResolution(r.id)} aria-pressed={resolution === r.id} className={choice(resolution === r.id)}>
                    <span className="block font-mono text-lg font-semibold">{r.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{r.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="mt-2 text-xl font-semibold">Quelle fluidité visez-vous ?</h2>
              <p className="mt-1 text-sm text-muted">En images par seconde (FPS). 60 suffit pour la plupart des jeux ; les jeux compétitifs profitent de plus.</p>
              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {FPS_PRESETS.map((preset) => (
                  <button key={preset.value} type="button" onClick={() => setTargetFps(preset.value)} aria-pressed={targetFps === preset.value} className={choice(targetFps === preset.value)}>
                    <span className="block font-mono text-lg font-semibold">{preset.value} FPS</span>
                    <span className="mt-0.5 block text-xs text-muted">{preset.hint}</span>
                  </button>
                ))}
              </div>
              <label className="mt-4 flex items-center gap-3 text-sm text-muted">
                Autre valeur
                <input type="number" min={30} max={500} value={targetFps} onChange={(e) => setTargetFps(Math.round(Number(e.target.value)))} className="w-24 rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-ink outline-none focus:border-accent" />
                FPS
              </label>
              {!valid && <p className="mt-3 text-sm text-fail">Indiquez une valeur entre 30 et 500 FPS.</p>}
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="mt-2 text-xl font-semibold">Quel style vous plaît ?</h2>
              <p className="mt-1 text-sm text-muted">Chaque proposition sera affichée en 3D dans ce style. Vous pourrez en changer ensuite.</p>
              <div className="mt-5">
                <StylePicker value={style} onChange={setStyle} />
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>
              ← Retour
            </Button>
            <Button variant="primary" onClick={next} disabled={!valid} className="px-6">
              {last ? "Voir mes configurations" : "Continuer →"}
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          {formatChf(budget)} · {gameIds.length ? games.filter((g) => gameIds.includes(g.id)).map((g) => g.name).join(", ") : "aucun jeu choisi"} · {resolution} · {targetFps} FPS · style {STYLES[style].label}
        </p>
      </div>
    </PageShell>
  );
}
