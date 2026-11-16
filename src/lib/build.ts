import { CATEGORIES, getComponent, styleSchema, type Category, type ComponentByCategory, type Style } from "./catalog";

/** Une configuration : un composant (ou rien) par catégorie. */
export type Build = { [K in Category]: ComponentByCategory[K] | null };
export type BuildIds = Partial<Record<Category, string>>;
export type CompleteBuild = { [K in Category]: ComponentByCategory[K] };

export const EMPTY_BUILD: Build = { cpu: null, gpu: null, motherboard: null, ram: null, storage: null, psu: null, cooler: null, case: null };

export function resolveBuild(ids: BuildIds): Build {
  const build = { ...EMPTY_BUILD };
  for (const category of CATEGORIES) {
    (build as Record<Category, unknown>)[category] = getComponent(category, ids[category]) ?? null;
  }
  return build;
}

export function buildIds(build: Build): BuildIds {
  const ids: BuildIds = {};
  for (const category of CATEGORIES) {
    const component = build[category];
    if (component) ids[category] = component.id;
  }
  return ids;
}

export function isComplete(build: Build): build is CompleteBuild {
  return CATEGORIES.every((category) => build[category] !== null);
}

export function buildPrice(build: Build): number {
  return CATEGORIES.reduce((sum, category) => sum + (build[category]?.priceChf ?? 0), 0);
}

/**
 * Encodage pour le partage par URL : les identifiants dans l'ordre des
 * catégories, séparés par des points. Court, lisible et sans état serveur.
 */
export function encodeBuild(ids: BuildIds): string {
  return CATEGORIES.map((category) => ids[category] ?? "").join(".");
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
