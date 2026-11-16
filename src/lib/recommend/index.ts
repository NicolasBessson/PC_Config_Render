import { buildIds, buildPrice, encodeBuild, estimatePower, type Build, type BuildIds, type CompleteBuild, type PowerEstimate } from "../build";
import { catalog, getGame, resolutionSchema, styleSchema, type Benchmarks, type Resolution, type Style } from "../catalog";
import { checkBuild, type CompatibilityReport } from "../compat";
import { evaluateUpgradability, type Upgradability } from "../insights";
import { estimateFps, type FpsEstimate, type FpsResult } from "../perf/estimate";
import { z } from "zod";

export const recommendInputSchema = z.object({
  budget: z.number().min(300).max(20000),
  gameIds: z.array(z.string()).min(1).max(5),
  resolution: resolutionSchema,
  targetFps: z.number().int().min(30).max(500),
  style: styleSchema,
});
export type RecommendInput = z.infer<typeof recommendInputSchema>;

export type Profile = "economique" | "equilibree" | "performance" | "meilleur-effort";

export const PROFILE_LABELS: Record<Profile, string> = {
  economique: "Économique",
  equilibree: "Équilibrée",
  performance: "Performance",
  "meilleur-effort": "Meilleur possible dans le budget",
};

export interface GamePerformance {
  gameId: string;
  gameName: string;
  result: FpsResult;
  /** `null` lorsque les données sont insuffisantes : la cible ne peut pas être vérifiée. */
  meetsTarget: boolean | null;
}

export interface Proposal {
  profile: Profile;
  ids: BuildIds;
  encoded: string;
  build: CompleteBuild;
  price: number;
  compat: CompatibilityReport;
  performance: GamePerformance[];
  power: PowerEstimate;
  upgradability: Upgradability;
  meetsTarget: boolean;
  strengths: string[];
  compromises: string[];
}

export interface Compromise {
  kind: "budget" | "resolution" | "fps" | "style";
  message: string;
  /** Paramètres à appliquer pour suivre ce compromis. */
  patch: Partial<RecommendInput>;
}

export interface Recommendation {
  /** ok = cible atteinte · no-solution = cible irréalisable · no-data = cible invérifiable. */
  status: "ok" | "no-solution" | "no-data";
  message: string;
  proposals: Proposal[];
  compromises: Compromise[];
  /** Jeux demandés pour lesquels aucun benchmark n'existe. */
  gamesWithoutData: string[];
  candidatesEvaluated: number;
}

interface Candidate {
  build: CompleteBuild;
  price: number;
  warnings: number;
  key: string;
}

interface Scored extends Candidate {
  /** Moyenne géométrique des FPS estimés sur les jeux documentés. */
  score: number;
  /** FPS estimé dans le jeu le plus exigeant. */
  minFps: number;
}

const RESOLUTIONS: Resolution[] = ["1080p", "1440p", "4K"];
const STANDARD_TARGETS = [240, 144, 120, 60, 30];
const candidateCache = new Map<Style, Candidate[]>();

/**
 * Énumère toutes les configurations du catalogue pour un style et écarte les
 * incompatibles (section 5.4). Le stockage n'intervient dans aucune règle :
 * la compatibilité est donc vérifiée avant de le décliner.
 */
export function enumerateCandidates(style: Style): Candidate[] {
  const cached = candidateCache.get(style);
  if (cached) return cached;
  const candidates: Candidate[] = [];
  const empty: Build = { cpu: null, gpu: null, motherboard: null, ram: null, storage: null, psu: null, cooler: null, case: null };
  for (const pcCase of catalog.case.filter((c) => c.style === style)) {
    for (const cpu of catalog.cpu) {
      for (const motherboard of catalog.motherboard) {
        if (checkBuild({ ...empty, case: pcCase, cpu, motherboard }).failures.length > 0) continue;
        for (const ram of catalog.ram) {
          if (checkBuild({ ...empty, motherboard, ram }).failures.length > 0) continue;
          for (const cooler of catalog.cooler) {
            if (checkBuild({ ...empty, case: pcCase, cpu, cooler }).failures.length > 0) continue;
            for (const gpu of catalog.gpu) {
              for (const psu of catalog.psu) {
                const partial: Build = { ...empty, case: pcCase, cpu, motherboard, ram, cooler, gpu, psu };
                const report = checkBuild(partial);
                if (report.failures.length > 0) continue;
                for (const storage of catalog.storage) {
                  const build = { ...partial, storage } as CompleteBuild;
                  candidates.push({ build, price: buildPrice(build), warnings: report.warnings.length, key: encodeBuild(buildIds(build)) });
                }
              }
            }
          }
        }
      }
    }
  }
  candidateCache.set(style, candidates);
  return candidates;
}

const pairKey = (c: Candidate) => `${c.build.cpu.id}|${c.build.gpu.id}`;

/** Ordre total et stable : à données identiques, résultat identique. */
function pick<T extends Candidate>(list: T[], compare: (a: T, b: T) => number): T | undefined {
  let best: T | undefined;
  for (const item of list) {
    if (!best) { best = item; continue; }
    const order = compare(item, best) || item.warnings - best.warnings || item.price - best.price || (item.key < best.key ? -1 : 1);
    if (order < 0) best = item;
  }
  return best;
}

export function recommend(rawInput: RecommendInput, data?: Benchmarks): Recommendation {
  const input = recommendInputSchema.parse(rawInput);
  const candidates = enumerateCandidates(input.style);
  const memo = new Map<string, FpsResult>();
  const fpsOf = (cpuId: string, gpuId: string, gameId: string, resolution: Resolution) => {
    const key = `${cpuId}|${gpuId}|${gameId}|${resolution}`;
    let result = memo.get(key);
    if (!result) {
      result = estimateFps({ cpuId, gpuId, gameId, resolution }, data);
      memo.set(key, result);
    }
    return result;
  };
  const fpsFor = (c: Candidate, gameId: string, resolution: Resolution) => fpsOf(c.build.cpu.id, c.build.gpu.id, gameId, resolution);

  /** Jeux pour lesquels au moins un couple CPU/GPU du catalogue dispose d'une estimation. */
  const documentedGames = (resolution: Resolution) =>
    input.gameIds.filter((gameId) => catalog.cpu.some((cpu) => catalog.gpu.some((gpu) => fpsOf(cpu.id, gpu.id, gameId, resolution).kind === "estimate")));

  /** Ne garde que les configurations estimables dans tous les jeux documentés. */
  const score = (resolution: Resolution, gameIds: string[], list: Candidate[] = candidates): Scored[] => {
    const scored: Scored[] = [];
    for (const c of list) {
      const estimates: FpsEstimate[] = [];
      for (const gameId of gameIds) {
        const result = fpsFor(c, gameId, resolution);
        if (result.kind === "estimate") estimates.push(result);
      }
      if (estimates.length !== gameIds.length) continue;
      const fps = estimates.map((e) => e.fps);
      scored.push({ ...c, score: Math.exp(fps.reduce((sum, f) => sum + Math.log(f), 0) / fps.length), minFps: Math.min(...fps) });
    }
    return scored;
  };

  const games = documentedGames(input.resolution);
  const gamesWithoutData = input.gameIds.filter((id) => !games.includes(id)).map((id) => getGame(id)?.name ?? id);

  if (games.length === 0) {
    return {
      status: "no-data",
      message: "Aucun benchmark exploitable n'existe pour les jeux choisis : la cible de FPS ne peut pas être vérifiée. Nous préférons ne rien proposer plutôt qu'inventer un chiffre.",
      proposals: [], compromises: [], gamesWithoutData, candidatesEvaluated: candidates.length,
    };
  }

  const scored = score(input.resolution, games);
  const inBudget = scored.filter((c) => c.price <= input.budget);
  const meeting = inBudget.filter((c) => c.minFps >= input.targetFps);

  const toProposal = (c: Scored, profile: Profile): Proposal => {
    const performance: GamePerformance[] = input.gameIds.map((gameId) => {
      const result = fpsFor(c, gameId, input.resolution);
      return { gameId, gameName: getGame(gameId)?.name ?? gameId, result, meetsTarget: result.kind === "estimate" ? result.fps >= input.targetFps : null };
    });
    const upgradability = evaluateUpgradability(c.build);
    const compat = checkBuild(c.build);
    const proposal: Proposal = {
      profile, ids: buildIds(c.build), encoded: c.key, build: c.build, price: c.price, compat, performance,
      power: estimatePower(c.build)!, upgradability, meetsTarget: c.minFps >= input.targetFps, strengths: [], compromises: [],
    };
    describe(proposal, input);
    return proposal;
  };

  if (meeting.length === 0) {
    const compromises: Compromise[] = [];
    const anyBudget = pick(scored.filter((c) => c.minFps >= input.targetFps), (a, b) => a.price - b.price);
    if (anyBudget) {
      const budget = Math.ceil(anyBudget.price / 50) * 50;
      compromises.push({ kind: "budget", message: `Augmenter le budget à ${budget} CHF : la cible devient atteignable.`, patch: { budget } });
    } else {
      compromises.push({ kind: "budget", message: "Augmenter le budget ne suffit pas : aucune configuration du catalogue n'atteint cette cible dans ce style.", patch: {} });
    }
    for (const resolution of RESOLUTIONS.slice(0, RESOLUTIONS.indexOf(input.resolution)).reverse()) {
      const lowerGames = documentedGames(resolution);
      if (lowerGames.length === 0) continue;
      if (score(resolution, lowerGames).some((c) => c.price <= input.budget && c.minFps >= input.targetFps)) {
        compromises.push({ kind: "resolution", message: `Jouer en ${resolution} : la cible de ${input.targetFps} FPS est atteignable dans le budget.`, patch: { resolution } });
        break;
      }
    }
    const best = pick(inBudget, (a, b) => b.minFps - a.minFps || b.score - a.score);
    if (best) {
      const target = STANDARD_TARGETS.find((t) => t <= best.minFps && t < input.targetFps);
      if (target) compromises.push({ kind: "fps", message: `Viser ${target} FPS : atteignable avec ce budget en ${input.resolution}.`, patch: { targetFps: target } });
    }
    const cheapest = pick(scored, (a, b) => a.price - b.price);
    const message = best
      ? `Aucune configuration du catalogue n'atteint ${input.targetFps} FPS en ${input.resolution} pour ${input.budget} CHF. La meilleure atteint environ ${Math.round(best.minFps)} FPS dans le jeu le plus exigeant.`
      : `Ce budget ne permet aucune configuration complète du catalogue${cheapest ? ` (minimum : ${cheapest.price} CHF)` : ""}.`;
    for (const style of styleSchema.options) {
      if (style === input.style) continue;
      if (score(input.resolution, games, enumerateCandidates(style)).some((c) => c.price <= input.budget && c.minFps >= input.targetFps)) {
        compromises.push({ kind: "style", message: `Choisir le style « ${style} » : son boîtier accepte des composants qui atteignent la cible dans le budget.`, patch: { style } });
        break;
      }
    }
    return { status: "no-solution", message, proposals: best ? [toProposal(best, "meilleur-effort")] : [], compromises, gamesWithoutData, candidatesEvaluated: candidates.length };
  }

  // Sélection des trois propositions (section 5.4).
  const economique = pick(meeting, (a, b) => a.price - b.price || b.score - a.score)!;
  const performance = pick(meeting, (a, b) => b.score - a.score || a.price - b.price)!;
  const chosen: { c: Scored; profile: Profile }[] = [{ c: economique, profile: "economique" }];
  const taken = new Set([pairKey(economique)]);
  if (!taken.has(pairKey(performance))) taken.add(pairKey(performance));
  // Rapport performances/prix, pondéré par la capacité d'évolution et la mémoire :
  // l'équilibre tient aussi à la qualité des composants, pas au seul prix.
  const value = (c: Scored) => (c.score / c.price) * (1 + 0.1 * evaluateUpgradability(c.build).score) * (c.build.ram.capacityGb >= 32 ? 1.05 : 1);
  // Elle se situe entre les deux autres : jamais plus chère que « Performance ».
  const equilibree = pick(meeting.filter((c) => !taken.has(pairKey(c)) && c.price <= performance.price), (a, b) => value(b) - value(a));
  if (equilibree) chosen.push({ c: equilibree, profile: "equilibree" });
  if (pairKey(performance) !== pairKey(economique)) chosen.push({ c: performance, profile: "performance" });

  const proposals = chosen.map(({ c, profile }) => toProposal(c, profile));
  const message = proposals.length === 3
    ? `Trois configurations compatibles atteignent ${input.targetFps} FPS en ${input.resolution} dans votre budget.`
    : `${proposals.length === 1 ? "Une seule configuration réellement différente atteint" : "Deux configurations réellement différentes atteignent"} la cible dans votre budget. Nous n'affichons pas de quasi-doublons.`;
  return { status: "ok", message, proposals, compromises: [], gamesWithoutData, candidatesEvaluated: candidates.length };
}

/** Points forts et compromis : des constats tirés des données, pas d'un modèle de langage. */
function describe(p: Proposal, input: RecommendInput) {
  const { build } = p;
  const estimates = p.performance.filter((g) => g.result.kind === "estimate") as (GamePerformance & { result: FpsEstimate })[];
  const minRatio = Math.min(...estimates.map((g) => g.result.fps / input.targetFps));

  if (p.meetsTarget && minRatio >= 1.2) p.strengths.push(`Dépasse la cible de ${input.targetFps} FPS avec au moins ${Math.floor((minRatio - 1) * 100)} % de marge.`);
  const left = input.budget - p.price;
  if (left >= 100) p.strengths.push(`Laisse ${Math.floor(left / 10) * 10} CHF du budget.`);
  if (build.gpu.vramGb >= 16) p.strengths.push(`${build.gpu.vramGb} Go de mémoire vidéo : à l'aise avec les textures élevées.`);
  if (p.upgradability.level === "Bonne") p.strengths.push("Bonne capacité d'évolution (socket, mémoire, alimentation).");
  if (build.storage.capacityGb >= 2000) p.strengths.push("2 To de stockage.");
  if (build.ram.capacityGb >= 32) p.strengths.push("32 Go de RAM.");

  if (!p.meetsTarget) p.compromises.push(`N'atteint pas la cible de ${input.targetFps} FPS.`);
  else if (minRatio < 1.1) {
    const tight = estimates.filter((g) => g.result.fps / input.targetFps < 1.1).map((g) => g.gameName);
    p.compromises.push(`Marge faible par rapport à la cible dans ${tight.join(", ")}.`);
  }
  if (build.gpu.vramGb <= 8) p.compromises.push(`${build.gpu.vramGb} Go de mémoire vidéo : limite pour les textures élevées au-delà du 1080p.`);
  const cpuBound = estimates.filter((g) => g.result.limitedBy === "cpu").map((g) => g.gameName);
  if (cpuBound.length > 0) p.compromises.push(`Le processeur limite les performances dans ${cpuBound.join(", ")}.`);
  if (build.ram.capacityGb < 32) p.compromises.push(`${build.ram.capacityGb} Go de RAM : suffisant aujourd'hui, juste pour les prochaines années.`);
  if (build.storage.capacityGb < 2000) p.compromises.push("1 To de stockage : quelques gros jeux suffisent à le remplir.");
  if (p.upgradability.level === "Limitée") p.compromises.push("Capacité d'évolution limitée.");
  for (const warning of p.compat.warnings) p.compromises.push(`À vérifier — ${warning.title.toLowerCase()}.`);
}
