import { z } from "zod";

/** Champs communs à toutes les fiches composants. */
const base = {
  id: z.string().regex(/^[a-z0-9-]+$/),
  brand: z.string(),
  name: z.string(),
  /** Prix indicatif en CHF. */
  priceChf: z.number().positive(),
  /** Date du relevé de prix (ISO). `null` = prix de démonstration, non relevé. */
  priceDate: z.string().nullable(),
  /** `true` lorsque TOUTES les caractéristiques utiles au configurateur ont été confirmées par une source constructeur. */
  verified: z.boolean(),
  /** Date de la vérification (ISO). */
  verifiedAt: z.string().nullable().optional(),
  /** Source constructeur consultée. */
  source: z.object({ label: z.string(), url: z.string().url() }).nullable().optional(),
  /** Champs que la source ne permet pas de confirmer : la fiche reste alors non vérifiée. */
  unconfirmed: z.array(z.string()).optional(),
  specUrl: z.string().url().nullable(),
};

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);

export const socketSchema = z.enum(["AM5", "LGA1700"]);
export const ramTypeSchema = z.enum(["DDR4", "DDR5"]);
export const formFactorSchema = z.enum(["ATX", "mATX", "ITX"]);
export const styleSchema = z.enum(["noir", "blanc", "minimaliste", "rgb"]);
export const resolutionSchema = z.enum(["1080p", "1440p", "4K"]);

export const cpuSchema = z.object({
  ...base,
  socket: socketSchema,
  cores: z.number().int().positive(),
  threads: z.number().int().positive(),
  tdpW: z.number().positive(),
  /** Puissance maximale du package (PPT / PL2), utilisée pour l'alimentation. */
  powerW: z.number().positive(),
});

export const gpuSchema = z.object({
  ...base,
  chipset: z.string(),
  vramGb: z.number().positive(),
  powerW: z.number().positive(),
  lengthMm: z.number().positive(),
  /** Épaisseur en nombre de slots PCI. */
  slots: z.number().positive(),
  fans: z.number().int().min(1).max(3),
  power: z.object({
    connector: z.enum(["8pin", "12v-2x6"]),
    count: z.number().int().positive(),
    /** Nombre de connecteurs 8 broches requis par l'adaptateur, s'il existe. */
    adapter8pin: z.number().int().positive().nullable(),
  }),
  /** Apparence du modèle 3D : couleurs et largeur de la carte. Aucun logo. */
  visual: z.object({ shroud: hex, accent: hex, backplate: hex, widthMm: z.number().positive() }).optional(),
});

export const motherboardSchema = z.object({
  ...base,
  socket: socketSchema,
  chipset: z.string(),
  formFactor: formFactorSchema,
  ramType: ramTypeSchema,
  ramSlots: z.number().int().positive(),
  m2Slots: z.number().int().nonnegative(),
  /** Processeurs pouvant nécessiter une mise à jour du BIOS. */
  biosUpdateFor: z.array(z.string()),
  /** La plateforme accepte-t-elle encore de futures générations de processeurs ? */
  upgradePath: z.boolean(),
  visual: z.object({ pcb: hex, heatsink: hex, accent: hex }).optional(),
});

export const ramSchema = z.object({
  ...base,
  type: ramTypeSchema,
  capacityGb: z.number().positive(),
  modules: z.number().int().positive(),
  speedMhz: z.number().positive(),
  cl: z.number().positive(),
  heightMm: z.number().positive(),
  rgb: z.boolean(),
  visual: z.object({ spreader: hex }).optional(),
});

export const storageSchema = z.object({
  ...base,
  interface: z.enum(["M.2 NVMe", "SATA"]),
  capacityGb: z.number().positive(),
});

export const psuSchema = z.object({
  ...base,
  wattage: z.number().positive(),
  efficiency: z.string(),
  formFactor: z.enum(["ATX", "SFX"]),
  pcie8pin: z.number().int().nonnegative(),
  has12v2x6: z.boolean(),
  modular: z.boolean(),
  visual: z.object({ body: hex }).optional(),
});

export const coolerSchema = z.object({
  ...base,
  type: z.enum(["air", "aio"]),
  heightMm: z.number().positive().nullable(),
  radiatorMm: z.number().positive().nullable(),
  sockets: z.array(socketSchema),
  tdpRatingW: z.number().positive().nullable(),
  /** Hauteur de RAM admise sous le ventirad ; `null` = inconnue ou sans objet. */
  ramClearanceMm: z.number().positive().nullable(),
  rgb: z.boolean(),
  visual: z.object({ fin: hex, top: hex, fan: hex, fans: z.number().int().min(1).max(3), fanSize: z.union([z.literal(120), z.literal(140)]), radiatorThicknessMm: z.number().positive().optional() }).optional(),
});

const slotCount = z.object({ "120": z.number().int().min(0), "140": z.number().int().min(0) });

export const caseSchema = z.object({
  ...base,
  style: styleSchema,
  formFactors: z.array(formFactorSchema),
  gpuMaxLengthMm: z.number().positive(),
  coolerMaxHeightMm: z.number().positive(),
  radiators: z.object({ front: z.array(z.number()), top: z.array(z.number()) }),
  psuFormFactor: z.enum(["ATX", "SFX"]),
  /** Emplacements de ventilateurs en façade et en haut, par taille. Absent = inconnu. */
  fanSlots: z.object({ front: slotCount, top: slotCount }).optional(),
  /** Dimensions extérieures, utilisées par le rendu 3D. */
  dimensionsMm: z.object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() }).optional(),
  visual: z
    .object({
      front: z.enum(["mesh", "solid"]),
      /** Cache d'alimentation en bas du boîtier. */
      shroud: z.boolean(),
      psu: z.enum(["rear", "front"]),
      /** Ventilateurs fournis avec le boîtier. */
      frontFans: z.number().int().min(0).max(3),
      frontFanSize: z.union([z.literal(120), z.literal(140), z.literal(160)]),
      rearFanSize: z.union([z.literal(120), z.literal(140)]),
      fansRgb: z.boolean(),
    })
    .optional(),
});

export const fanSchema = z.object({
  ...base,
  sizeMm: z.union([z.literal(120), z.literal(140)]),
  rgb: z.boolean(),
  connector: z.string(),
  visual: z.object({ frame: hex }).optional(),
});

export const gameSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Preset graphique de référence du MVP (un seul par jeu). */
  preset: z.string(),
  genre: z.string(),
});

const seriesBase = {
  id: z.string(),
  sourceId: z.string(),
  gameId: z.string(),
  resolution: resolutionSchema,
  preset: z.string(),
  date: z.string().nullable(),
  /** FPS moyens mesurés par cette source dans ces conditions, par composant. */
  fps: z.record(z.string(), z.number().positive()),
};

export const benchmarksSchema = z.object({
  notice: z.string(),
  referenceGpuId: z.string(),
  referenceCpuId: z.string(),
  sources: z.array(z.object({ id: z.string(), name: z.string(), url: z.string().url().nullable(), demo: z.boolean() })),
  gpuSeries: z.array(z.object({ ...seriesBase, testCpuId: z.string() })),
  cpuSeries: z.array(z.object({ ...seriesBase, testGpuId: z.string() })),
  gpuAnchors: z.array(z.object({ gameId: z.string(), resolution: resolutionSchema, preset: z.string(), seriesId: z.string(), fps: z.number().positive() })),
  cpuAnchors: z.array(z.object({ gameId: z.string(), preset: z.string(), seriesId: z.string(), fps: z.number().positive() })),
});

export type Cpu = z.infer<typeof cpuSchema>;
export type Gpu = z.infer<typeof gpuSchema>;
export type Motherboard = z.infer<typeof motherboardSchema>;
export type Ram = z.infer<typeof ramSchema>;
export type Storage = z.infer<typeof storageSchema>;
export type Psu = z.infer<typeof psuSchema>;
export type Cooler = z.infer<typeof coolerSchema>;
export type Case = z.infer<typeof caseSchema>;
export type CaseFan = z.infer<typeof fanSchema>;
export type Game = z.infer<typeof gameSchema>;
export type Benchmarks = z.infer<typeof benchmarksSchema>;
export type Style = z.infer<typeof styleSchema>;
export type Resolution = z.infer<typeof resolutionSchema>;
export type Socket = z.infer<typeof socketSchema>;
