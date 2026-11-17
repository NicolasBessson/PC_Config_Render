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
  /** Retouches de matériaux du fichier, par nom : un circuit imprimé déclaré métallique, par exemple, brille comme un miroir. */
  tune?: MaterialTune[];
}

export interface MaterialTune {
  match: RegExp;
  metalness?: number;
  roughness?: number;
  /** Ignorer les textures de métal et de rugosité du fichier : seules les valeurs ci-dessus comptent. */
  uniform?: boolean;
  /** Force des reflets d'une matière non métallique (1 = normale). */
  specular?: number;
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

/**
 * Ventilateurs de boîtier. L'axe de rotation est l'axe y du fichier, moyeu visible côté +y.
 * `size` est le côté du cadre dans le fichier, `center` le centre du moyeu. `spin` désigne les
 * nœuds du rotor (pales, moyeu), qui tournent ; `glow` les matériaux des bandes lumineuses.
 */
export interface FanModel extends PartModel {
  size: number;
  center: Axis;
  spin: RegExp;
  glow?: RegExp;
}
const UNI_FAN = { size: 0.905, center: [0.679, 0.12, -1.591] as Axis, spin: /^Object_(4|6|10|14)$/, glow: /^material$/ };
export const FAN_MODELS: Record<string, FanModel> = {
  "uni-fan-sl120-black": {
    file: "/models/lian-li-uni-fan-sl120-black.glb",
    credit: { title: "Lian Li UNI FAN SL120 RGB BLACK", author: "DIEKO", url: "https://sketchfab.com/3d-models/lian-li-uni-fan-sl120-rgb-black-5abd0d8e89ea4241b7216f4b6d5a2ca4", license: BY },
    ...UNI_FAN,
  },
  "uni-fan-sl120-white": {
    file: "/models/lian-li-uni-fan-sl120-white.glb",
    credit: { title: "Lian Li UNI FAN SL120 RGB WHITE", author: "DIEKO", url: "https://sketchfab.com/3d-models/lian-li-uni-fan-sl120-rgb-white-151c28bb1bc9483a92728815cb0628ea", license: BY },
    ...UNI_FAN,
  },
};

/**
 * Cartes mères. Le circuit est à plat dans le fichier : x va de l'arrière vers l'avant du boîtier,
 * z du haut vers le bas, y s'éloigne de la carte. Une carte réelle n'a pas son socket ni ses
 * emplacements là où la carte générique les dessine : la scène lit donc ses repères ici
 * (voir `anchorsFor` dans layout.ts), en coordonnées du fichier.
 */
export interface MotherboardModel extends PartModel {
  /** Dans le fichier : bord arrière (x), face du circuit (y), bord haut (z). */
  origin: Axis;
  /** Millimètres par unité : profondeur (x), épaisseur (y), hauteur (z). */
  scale: Axis;
  /** Étendue du circuit dans le fichier : profondeur (x) et hauteur (z). */
  size: [number, number];
  /** Centre du socket (x, z). */
  cpu: [number, number];
  /** Centre de chacun des emplacements mémoire en x, du plus proche du socket au plus éloigné, et leur milieu en z. */
  ramX: number[];
  ramZ: number;
  /** Milieu du connecteur 24 broches en z. */
  atxZ: number;
  /** Dissipateur M.2 principal : étendue en x, milieu en z. */
  m2: { x: [number, number]; z: number };
}
export const MOTHERBOARD_MODELS: Record<string, MotherboardModel> = {
  "b550-aorus-elite-v2": {
    file: "/models/gigabyte-b550-aorus-elite-v2.glb",
    credit: { title: "B550 AORUS ELITE V2 model", author: "exitmonad", url: "https://sketchfab.com/3d-models/b550-aorus-elite-v2-model-59f6b9b39f5d401b8beee8ff0c28e88e", license: BY },
    origin: [-1.636, -0.067, -1.922],
    // Le fichier n'est pas aux proportions exactes de la carte : la profondeur est calée sur le processeur
    // (40 mm de côté), la hauteur sur le premier emplacement PCIe, qui doit tomber face à la carte graphique.
    scale: [71.3, 68, 62.29],
    size: [3.26, 4.657],
    cpu: [0.0515, -0.5035],
    ramX: [0.8085, 0.9365, 1.0525, 1.1685],
    ramZ: -0.551,
    atxZ: -0.502,
    m2: { x: [-1.28, 0.229], z: 0.589 },
    // Le circuit est déclaré métallique et poli dans le fichier : il reflète alors le studio comme un miroir et paraît
    // gris clair, voire blanc, dans les styles sombres. Un vernis de circuit imprimé est mat, non métallique, peu réfléchissant.
    tune: [{ match: /^main$/, metalness: 0, roughness: 0.75, uniform: true, specular: 0.3 }],
  },
};

const REGISTRIES: Record<string, PartModel>[] = [CASE_MODELS, RAM_MODELS, GPU_MODELS, CPU_MODELS, STORAGE_MODELS, COOLER_MODELS, MOTHERBOARD_MODELS, FAN_MODELS];

/** Crédit du modèle 3D d'un composant, s'il en a un. */
export function modelCredit(id: string | null | undefined): ModelCredit | null {
  if (!id) return null;
  return REGISTRIES.find((registry) => registry[id])?.[id].credit ?? null;
}

/** Tous les crédits, sans doublon : à afficher sur le site. */
export const ALL_MODEL_CREDITS: ModelCredit[] = REGISTRIES.flatMap((registry) => Object.values(registry))
  .map((model) => model.credit)
  .filter((credit, index, list) => list.findIndex((other) => other.url === credit.url) === index);
