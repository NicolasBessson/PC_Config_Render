import { benchmarks as defaultBenchmarks, type Benchmarks, type Resolution } from "../catalog";

/** Marge minimale appliquée autour de l'estimation (section 6.4, point 5). */
export const MIN_MARGIN = 0.1;

export type Confidence = "élevée" | "moyenne" | "faible";

export interface FpsEstimate {
  kind: "estimate";
  /** Estimation centrale : min(limite GPU, limite CPU). */
  fps: number;
  low: number;
  high: number;
  gpuLimit: number;
  cpuLimit: number;
  limitedBy: "gpu" | "cpu";
  preset: string;
  confidence: Confidence;
  /** Noms des sources ayant servi au calcul. */
  sources: string[];
  /** Vrai si au moins une source est un jeu de données de démonstration. */
  demo: boolean;
}

export interface InsufficientData {
  kind: "insufficient";
  reason: string;
}

export type FpsResult = FpsEstimate | InsufficientData;

interface Limit {
  fps: number;
  low: number;
  high: number;
  sourceIds: string[];
  spread: number;
  preset: string;
}

type Series = { sourceId: string; fps: Record<string, number> };

const geometricMean = (values: number[]) => Math.exp(values.reduce((sum, v) => sum + Math.log(v), 0) / values.length);

/**
 * Étapes 1 à 3 de la méthode : normalisation par source (chaque mesure est
 * divisée par celle du composant de référence dans la même série), agrégation
 * par moyenne géométrique, puis ancrage sur une mesure absolue documentée.
 */
function limitFor(componentId: string, referenceId: string, series: Series[], anchor: { fps: number; preset: string } | undefined): Limit | null {
  if (!anchor) return null;
  const ratios: number[] = [];
  const sourceIds: string[] = [];
  for (const s of series) {
    const value = s.fps[componentId];
    const reference = s.fps[referenceId];
    if (value === undefined || reference === undefined) continue; // jamais de comparaison entre sources
    ratios.push(value / reference);
    sourceIds.push(s.sourceId);
  }
  if (ratios.length === 0) return null;
  const relative = geometricMean(ratios);
  const fps = anchor.fps * relative;
  // Fourchette : écart entre les sources, avec une marge minimale.
  const low = Math.min(anchor.fps * Math.min(...ratios), fps * (1 - MIN_MARGIN));
  const high = Math.max(anchor.fps * Math.max(...ratios), fps * (1 + MIN_MARGIN));
  const spread = Math.max(...ratios) / Math.min(...ratios) - 1;
  return { fps, low, high, sourceIds: [...new Set(sourceIds)], spread, preset: anchor.preset };
}

export interface EstimateInput {
  cpuId: string;
  gpuId: string;
  gameId: string;
  resolution: Resolution;
}

/**
 * Estime les FPS d'un couple processeur / carte graphique dans un jeu.
 * Ne retourne jamais de chiffre inventé : sans mesure exploitable, le
 * résultat est « données insuffisantes » avec la raison.
 */
export function estimateFps({ cpuId, gpuId, gameId, resolution }: EstimateInput, data: Benchmarks = defaultBenchmarks): FpsResult {
  const gpuSeries = data.gpuSeries.filter((s) => s.gameId === gameId && s.resolution === resolution);
  const cpuSeries = data.cpuSeries.filter((s) => s.gameId === gameId);
  if (gpuSeries.length === 0) return { kind: "insufficient", reason: "Aucun benchmark exploitable pour ce jeu à cette résolution." };

  const gpu = limitFor(gpuId, data.referenceGpuId, gpuSeries, data.gpuAnchors.find((a) => a.gameId === gameId && a.resolution === resolution));
  if (!gpu) return { kind: "insufficient", reason: "Aucun benchmark exploitable pour cette carte graphique dans ce jeu." };

  const cpu = limitFor(cpuId, data.referenceCpuId, cpuSeries, data.cpuAnchors.find((a) => a.gameId === gameId));
  if (!cpu) return { kind: "insufficient", reason: "Aucun benchmark exploitable pour ce processeur dans ce jeu." };

  // Étape 4 : le composant le plus lent fixe le résultat.
  const limitedBy = gpu.fps <= cpu.fps ? "gpu" : "cpu";
  const limiting = limitedBy === "gpu" ? gpu : cpu;
  const sourceIds = [...new Set([...gpu.sourceIds, ...cpu.sourceIds])];
  const sources = sourceIds.map((id) => data.sources.find((s) => s.id === id)).filter((s) => s !== undefined);

  let confidence: Confidence = "faible";
  if (limiting.sourceIds.length >= 2) confidence = limiting.spread <= MIN_MARGIN ? "élevée" : "moyenne";

  return {
    kind: "estimate",
    fps: Math.round(limiting.fps),
    low: Math.round(Math.min(gpu.low, cpu.low)),
    high: Math.round(Math.min(gpu.high, cpu.high)),
    gpuLimit: Math.round(gpu.fps),
    cpuLimit: Math.round(cpu.fps),
    limitedBy,
    preset: gpu.preset,
    confidence,
    sources: sources.map((s) => s.name),
    demo: sources.some((s) => s.demo),
  };
}
