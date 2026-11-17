/*
 * Modèles 3D de produits réels, créés par des tiers et publiés sous licence
 * Creative Commons Attribution. Module pur : uniquement des données.
 *
 * Chaque modèle doit être crédité (auteur, titre, lien, licence) partout où
 * il est affiché : c'est la condition de la licence. Les marques restent la
 * propriété de leurs détenteurs ; ces modèles ne sont pas des fichiers
 * officiels des fabricants.
 *
 * Placement : la scène est affichée en miroir (voir PcScene). Chaque modèle
 * doit donc être posé avec une matrice de déterminant NÉGATIF, sinon il
 * apparaît inversé et ses inscriptions se lisent à l'envers.
 */
export interface ModelCredit {
  title: string;
  author: string;
  url: string;
  license: "CC BY 4.0";
}

export interface CaseModel {
  file: string;
  credit: ModelCredit;
  /** Millimètres par unité du fichier. */
  unit: number;
  /** Décalage, en millimètres, qui amène le plateau, le dessus et l'arrière du modèle sur les repères de la scène. */
  offset: [number, number, number];
  /** Repères mesurés sur le modèle : plan de la vitre, fond de la caisse, façade, dessus du cache d'alimentation. */
  frame: { right: number; bottom: number; front: number; shroudTop: number };
  /** Position latérale de l'alimentation, pour qu'elle reste sous le cache du modèle. */
  psuX: number;
  /** Couleur appliquée à la carrosserie, pour une variante de teinte du même boîtier. */
  tint?: string;
}

export interface PartModel {
  file: string;
  credit: ModelCredit;
}

const BY = "CC BY 4.0" as const;

const KIRIGAMI_4000D: Omit<CaseModel, "tint"> = {
  file: "/models/corsair-4000d-airflow.glb",
  credit: { title: "Corsair 4000D Airflow (Free)", author: "Kirigami", url: "https://sketchfab.com/3d-models/corsair-4000d-airflow-free-34df3ba96cf94e71accdb5779c4b8694", license: BY },
  unit: 1000,
  offset: [-6, -209, -22],
  frame: { right: 95, bottom: -195, front: 206, shroudTop: -97 },
  psuX: -14,
};

/** Boîtiers, par identifiant de catalogue. La version blanche est le même modèle, reteinté. */
export const CASE_MODELS: Record<string, CaseModel> = {
  "4000d-airflow": KIRIGAMI_4000D,
  "4000d-airflow-white": { ...KIRIGAMI_4000D, tint: "#e6e8eb" },
};

type Axis = [number, number, number];

/**
 * Barrette de mémoire. `basis` indique vers quel axe de la scène part chaque axe du fichier
 * (x, y puis z) ; `unit` donne les millimètres par unité du fichier ; `anchor` est le point du
 * fichier posé sur la carte mère, au centre de l'emplacement. `glow` désigne les matériaux de
 * la barre lumineuse, qui prennent la couleur de l'éclairage choisi.
 */
export interface RamModel extends PartModel {
  basis: [Axis, Axis, Axis];
  unit: number;
  anchor: Axis;
  glow?: RegExp;
}

const LPX: RamModel = {
  file: "/models/corsair-vengeance-lpx.glb",
  credit: { title: "RAM Corsair Vengeance LPX", author: "supahot", url: "https://sketchfab.com/3d-models/ram-corsair-vengeance-lpx-ee11e1926e514075a70642ecb5dc5c2d", license: BY },
  // Longueur du fichier (z) vers le haut, épaisseur (y) en profondeur, hauteur (−x, contacts côté +x) en s'éloignant de la carte mère.
  basis: [[-1, 0, 0], [0, 0, -1], [0, 1, 0]],
  unit: 133 / 4.569,
  anchor: [-0.538, 1.522, -1.0365],
};

/** T-Force Delta RGB : longueur selon x, hauteur selon y (contacts en bas), épaisseur selon z. */
const DELTA_RGB = {
  basis: [[0, 1, 0], [1, 0, 0], [0, 0, 1]] as [Axis, Axis, Axis],
  unit: 144.2 / 22.817,
  anchor: [0.3525, -0.689, 0.1095] as Axis,
  glow: /^Material\.005$/,
};

/** Barrettes de mémoire, par identifiant de catalogue. */
export const RAM_MODELS: Record<string, RamModel> = {
  "ddr4-16-lpx": LPX,
  "ddr4-32-lpx": LPX,
  "ddr5-32-delta-rgb-black": {
    file: "/models/teamgroup-delta-rgb-ddr5-black.glb",
    credit: { title: "DDR5 RAM - Teamgroup T-Force Black", author: "PolyDavid", url: "https://sketchfab.com/3d-models/ddr5-ram-teamgroup-t-force-black-268614943df3411bb6487a9601adc03f", license: BY },
    ...DELTA_RGB,
  },
  "ddr5-32-delta-rgb-white": {
    file: "/models/teamgroup-delta-rgb-ddr5-white.glb",
    credit: { title: "DDR5 RAM - Teamgroup T-Force White", author: "PolyDavid", url: "https://sketchfab.com/3d-models/ddr5-ram-teamgroup-t-force-white-198540480d3241f6be95d7e57f53b90a", license: BY },
    ...DELTA_RGB,
  },
};

/**
 * Cartes graphiques. Les trois échelles amènent la longueur, la hauteur et
 * l'épaisseur du fichier sur les cotes du catalogue. La longueur suit toujours
 * l'axe z du fichier, équerre côté +z. `thicknessAxis` dit quel axe porte
 * l'épaisseur : "x" (ventilateurs côté +x, hauteur selon y) ou "y"
 * (ventilateurs côté −y, hauteur selon x). `edges` donne, dans le fichier, le
 * plan de l'équerre, le bord côté carte mère (sur l'axe de la hauteur) et la
 * plaque arrière (sur l'axe de l'épaisseur).
 */
export interface GpuModel extends PartModel {
  thicknessAxis: "x" | "y";
  /** Étendues du corps de la carte dans le fichier. */
  size: { length: number; height: number; thickness: number };
  edges: { bracketZ: number; board: number; backplate: number };
}
export const GPU_MODELS: Record<string, GpuModel> = {
  "arc-b580": {
    file: "/models/intel-arc-b580.glb",
    credit: { title: "Intel Arc B580 Graphics Card", author: "PolyDavid", url: "https://sketchfab.com/3d-models/intel-arc-b580-graphics-card-3251ad158ee44a7e9802cb378b4d281a", license: BY },
    thicknessAxis: "x",
    size: { length: 7.812, height: 3.009, thickness: 2.07 },
    edges: { bracketZ: 3.285, board: -1.236, backplate: -1.187 },
  },
  "rtx-5090-fe": {
    file: "/models/nvidia-rtx-5090-fe.glb",
    credit: { title: "NVIDIA RTX 5090 Founders Edition", author: "PolyDavid", url: "https://sketchfab.com/3d-models/nvidia-rtx-5090-founders-edition-5934a7ddfa144951ac66eb8cab13f220", license: BY },
    thicknessAxis: "y",
    size: { length: 26.494, height: 11.182, thickness: 3.13 },
    edges: { bracketZ: 13.36, board: -6.354, backplate: 1.164 },
  },
};

/**
 * Ventirads. La hauteur suit l'axe y du fichier (semelle en bas), le flux d'air l'axe z.
 * `height` est la hauteur du fichier, de la semelle au sommet ; `base` le centre de la semelle.
 */
export interface CoolerModel extends PartModel {
  height: number;
  base: Axis;
}
export const COOLER_MODELS: Record<string, CoolerModel> = {
  "freezer-34-esports-duo": {
    file: "/models/arctic-freezer-34-esports-duo.glb",
    credit: { title: "Arctic Freezer (AMD)", author: "Nouraiz", url: "https://sketchfab.com/3d-models/arctic-freezer-amd-5b06c10634c049b9865e6036abf2d4ac", license: BY },
    height: 0.735,
    base: [-0.014, -0.088, -0.011],
  },
};

/** Processeurs : puce posée à plat dans le fichier, `side` = largeur du fichier pour 40 mm réels. */
export interface CpuModel extends PartModel {
  side: number;
  /** Quarts de tour à appliquer pour que le marquage se lise à l'endroit, vu côté vitre. */
  turn: 0 | 1 | 2 | 3;
}
export const CPU_MODELS: Record<string, CpuModel> = {
  "r5-7600": {
    file: "/models/amd-ryzen-5-7600.glb",
    credit: { title: "AMD Ryzen 5 7600 CPU chip (AM5 socket)", author: "arsdever", url: "https://sketchfab.com/3d-models/amd-ryzen-5-7600-cpu-chip-am5-socket-a05c2732e0b847c2967e2c9282abd5f9", license: BY },
    side: 0.04,
    turn: 1,
  },
  "r7-9800x3d": {
    file: "/models/amd-ryzen-7-9800x3d.glb",
    credit: { title: "AMD 9800x3D CPU - SUPER LOW POLY", author: "PolyDavid", url: "https://sketchfab.com/3d-models/amd-9800x3d-cpu-super-low-poly-3851621aed404adaa5b11efde67d5dc4", license: BY },
    side: 6.496,
    turn: 2,
  },
};

/** SSD M.2 : `length` = longueur du fichier pour 80 mm réels. */
export interface StorageModel extends PartModel {
  length: number;
}
export const STORAGE_MODELS: Record<string, StorageModel> = {
  "990pro-2tb": {
    file: "/models/samsung-990-pro.glb",
    credit: { title: "Samsung 990 PRO SSD", author: "PolyDavid", url: "https://sketchfab.com/3d-models/samsung-990-pro-ssd-6ada64c9ba734e499978a084e68ec3df", license: BY },
    length: 4.289,
  },
};

const REGISTRIES: Record<string, PartModel>[] = [CASE_MODELS, RAM_MODELS, GPU_MODELS, CPU_MODELS, STORAGE_MODELS, COOLER_MODELS];

/** Crédit du modèle 3D d'un composant, s'il en a un. */
export function modelCredit(id: string | null | undefined): ModelCredit | null {
  if (!id) return null;
  return REGISTRIES.find((registry) => registry[id])?.[id].credit ?? null;
}

/** Tous les crédits, sans doublon : à afficher sur le site. */
export const ALL_MODEL_CREDITS: ModelCredit[] = REGISTRIES.flatMap((registry) => Object.values(registry))
  .map((model) => model.credit)
  .filter((credit, index, list) => list.findIndex((other) => other.url === credit.url) === index);
