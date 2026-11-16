import { CATEGORIES, CORE_CATEGORIES, getComponent, styleSchema, type Category, type ComponentByCategory, type CoreCategory, type Style } from "./catalog";

/** Une configuration : un composant (ou rien) par catégorie. */
export type Build = { [K in Category]: ComponentByCategory[K] | null } & {
  /** Nombre de ventilateurs supplémentaires (1 par défaut lorsqu'un modèle est choisi). */
  fanCount?: number;
};
export type BuildIds = Partial<Record<Category, string>> & { fanCount?: number };
/** Complète : les huit catégories indispensables sont choisies ; les ventilateurs restent facultatifs. */
export type CompleteBuild = { [K in CoreCategory]: ComponentByCategory[K] } & Pick<Build, "fans" | "fanCount">;

export const MAX_EXTRA_FANS = 6;
export const EMPTY_BUILD: Build = { cpu: null, gpu: null, motherboard: null, ram: null, storage: null, psu: null, cooler: null, case: null, fans: null };

export const fanCountOf = (build: Pick<Build, "fans" | "fanCount">) => (build.fans ? Math.min(MAX_EXTRA_FANS, Math.max(1, build.fanCount ?? 1)) : 0);

export function resolveBuild(ids: BuildIds): Build {
  const build = { ...EMPTY_BUILD };
  for (const category of CATEGORIES) {
    (build as Record<Category, unknown>)[category] = getComponent(category, ids[category]) ?? null;
  }
  if (build.fans) build.fanCount = fanCountOf({ fans: build.fans, fanCount: ids.fanCount });
  return build;
}

export function buildIds(build: Build): BuildIds {
  const ids: BuildIds = {};
  for (const category of CATEGORIES) {
    const component = build[category];
    if (component) ids[category] = component.id;
  }
  if (build.fans) ids.fanCount = fanCountOf(build);
  return ids;
}

export function isComplete(build: Build): build is CompleteBuild {
  return CORE_CATEGORIES.every((category) => build[category] !== null);
}

/** Prix d'une ligne : les ventilateurs supplémentaires sont multipliés par leur nombre. */
export function componentPrice(build: Build, category: Category): number {
  const component = build[category];
  if (!component) return 0;
  return category === "fans" ? component.priceChf * fanCountOf(build) : component.priceChf;
}

export function buildPrice(build: Build): number {
  return CATEGORIES.reduce((sum, category) => sum + componentPrice(build, category), 0);
}

/**
 * Encodage pour le partage par URL : les identifiants dans l'ordre des
 * catégories, séparés par des points. Court, lisible et sans état serveur.
 */
export function encodeBuild(ids: BuildIds): string {
  const tokens: string[] = CORE_CATEGORIES.map((category) => ids[category] ?? "");
  // Les ventilateurs, facultatifs, n'allongent le lien que s'ils sont choisis.
  if (ids.fans) tokens.push(ids.fans, String(ids.fanCount ?? 1));
  return tokens.join(".");
}

/** Décode et valide : un identifiant inconnu est ignoré, jamais deviné. */
export function decodeBuild(encoded: string | null | undefined): BuildIds {
  const ids: BuildIds = {};
  if (!encoded || encoded.length > 400) return ids;
  const parts = encoded.split(".");
  CATEGORIES.forEach((category, i) => {
    const id = parts[i];
    if (id && getComponent(category, id)) ids[category] = id;
  });
  if (ids.fans) {
    const count = Number(parts[CATEGORIES.length]);
    ids.fanCount = Number.isInteger(count) && count >= 1 && count <= MAX_EXTRA_FANS ? count : 1;
  }
  return ids;
}

export function parseStyle(value: string | null | undefined): Style | null {
  const parsed = styleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Consommation du reste du système (carte mère, RAM, SSD, ventilateurs). */
export const REST_OF_SYSTEM_W = 75;
/** Marge exigée entre la consommation estimée et la puissance de l'alimentation. */
export const PSU_MARGIN = 0.25;

export interface PowerEstimate {
  cpuW: number;
  gpuW: number;
  restW: number;
  totalW: number;
  /** Puissance d'alimentation minimale, marge comprise. */
  requiredW: number;
}

export function estimatePower(build: Build): PowerEstimate | null {
  if (!build.cpu || !build.gpu) return null;
  const totalW = build.cpu.powerW + build.gpu.powerW + REST_OF_SYSTEM_W;
  return { cpuW: build.cpu.powerW, gpuW: build.gpu.powerW, restW: REST_OF_SYSTEM_W, totalW, requiredW: Math.ceil(totalW * (1 + PSU_MARGIN)) };
}

export const formatChf = (value: number) => `${Math.round(value).toLocaleString("fr-CH").replace(/ | |’/g, "'")} CHF`;
