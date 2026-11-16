import { z } from "zod";
import cpusJson from "../../../data/cpus.json";
import gpusJson from "../../../data/gpus.json";
import motherboardsJson from "../../../data/motherboards.json";
import ramJson from "../../../data/ram.json";
import storageJson from "../../../data/storage.json";
import psusJson from "../../../data/psus.json";
import coolersJson from "../../../data/coolers.json";
import casesJson from "../../../data/cases.json";
import fansJson from "../../../data/fans.json";
import gamesJson from "../../../data/games.json";
import benchmarksJson from "../../../data/benchmarks.json";
import {
  benchmarksSchema, caseSchema, coolerSchema, cpuSchema, fanSchema, gameSchema, gpuSchema, motherboardSchema,
  psuSchema, ramSchema, storageSchema,
  type Case, type CaseFan, type Cooler, type Cpu, type Gpu, type Motherboard, type Psu, type Ram, type Storage,
} from "./schema";

export * from "./schema";

/** Les catégories d'une configuration, dans l'ordre d'affichage. */
export const CATEGORIES = ["cpu", "gpu", "motherboard", "ram", "storage", "psu", "cooler", "case", "fans"] as const;
/** Catégories indispensables : les ventilateurs supplémentaires sont facultatifs. */
export const CORE_CATEGORIES = ["cpu", "gpu", "motherboard", "ram", "storage", "psu", "cooler", "case"] as const;
export type CoreCategory = (typeof CORE_CATEGORIES)[number];
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  cpu: "Processeur",
  gpu: "Carte graphique",
  motherboard: "Carte mère",
  ram: "Mémoire RAM",
  storage: "Stockage",
  psu: "Alimentation",
  cooler: "Refroidissement",
  case: "Boîtier",
  fans: "Ventilateurs supplémentaires",
};

export interface ComponentByCategory {
  cpu: Cpu;
  gpu: Gpu;
  motherboard: Motherboard;
  ram: Ram;
  storage: Storage;
  psu: Psu;
  cooler: Cooler;
  case: Case;
  fans: CaseFan;
}
export type AnyComponent = ComponentByCategory[Category];

// Les fichiers JSON sont validés au chargement : une fiche invalide fait
// échouer le démarrage plutôt que de produire un résultat silencieusement faux.
export const catalog: { [K in Category]: ComponentByCategory[K][] } = {
  cpu: z.array(cpuSchema).parse(cpusJson),
  gpu: z.array(gpuSchema).parse(gpusJson),
  motherboard: z.array(motherboardSchema).parse(motherboardsJson),
  ram: z.array(ramSchema).parse(ramJson),
  storage: z.array(storageSchema).parse(storageJson),
  psu: z.array(psuSchema).parse(psusJson),
  cooler: z.array(coolerSchema).parse(coolersJson),
  case: z.array(caseSchema).parse(casesJson),
  fans: z.array(fanSchema).parse(fansJson),
};

export const games = z.array(gameSchema).parse(gamesJson);
export const benchmarks = benchmarksSchema.parse(benchmarksJson);

const indexes = Object.fromEntries(
  CATEGORIES.map((category) => [category, new Map(catalog[category].map((c) => [c.id, c]))]),
) as unknown as { [K in Category]: Map<string, ComponentByCategory[K]> };

export function getComponent<K extends Category>(category: K, id: string | null | undefined): ComponentByCategory[K] | undefined {
  return id ? indexes[category].get(id) : undefined;
}

export function getGame(id: string) {
  return games.find((g) => g.id === id);
}

const allComponents = CATEGORIES.flatMap((category) => catalog[category] as AnyComponent[]);
/** État de la vérification du catalogue, affiché tel quel dans l'interface. */
export const catalogStats = {
  total: allComponents.length,
  verified: allComponents.filter((c) => c.verified).length,
  /** Source consultée, mais au moins un champ non confirmé. */
  partial: allComponents.filter((c) => !c.verified && c.source).length,
  pricesChecked: allComponents.filter((c) => c.priceDate !== null).length,
};

/** Vrai tant qu'au moins une fiche n'a pas été vérifiée ou qu'un prix n'a pas été relevé. */
export const catalogIsDemo = CATEGORIES.some((category) => catalog[category].some((c) => !c.verified || c.priceDate === null));
