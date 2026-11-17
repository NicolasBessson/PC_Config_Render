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

/** Barrettes de mémoire, par identifiant de catalogue. */
export const RAM_MODELS: Record<string, PartModel> = Object.fromEntries(
  ["ddr4-16-lpx", "ddr4-32-lpx"].map((id) => [
    id,
    {
      file: "/models/corsair-vengeance-lpx.glb",
      credit: { title: "RAM Corsair Vengeance LPX", author: "supahot", url: "https://sketchfab.com/3d-models/ram-corsair-vengeance-lpx-ee11e1926e514075a70642ecb5dc5c2d", license: BY },
    },
  ]),
);

/**
 * Cartes graphiques. Les trois échelles amènent la longueur, la hauteur et
 * l'épaisseur du fichier sur les cotes du catalogue ; `edges` donne, dans le
 * fichier, le plan de l'équerre, le bord côté carte mère et la plaque arrière
 * (les ventilateurs sont du côté opposé, vers +x).
 */
export interface GpuModel extends PartModel {
  /** Étendues du corps de la carte dans le fichier : longueur (z), hauteur (y), épaisseur (x). */
  size: { length: number; height: number; thickness: number };
  edges: { bracketZ: number; boardY: number; backplateX: number };
}
export const GPU_MODELS: Record<string, GpuModel> = {
  "arc-b580": {
    file: "/models/intel-arc-b580.glb",
    credit: { title: "Intel Arc B580 Graphics Card", author: "PolyDavid", url: "https://sketchfab.com/3d-models/intel-arc-b580-graphics-card-3251ad158ee44a7e9802cb378b4d281a", license: BY },
    size: { length: 7.812, height: 3.009, thickness: 2.07 },
    edges: { bracketZ: 3.285, boardY: -1.236, backplateX: -1.187 },
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

const REGISTRIES: Record<string, PartModel>[] = [CASE_MODELS, RAM_MODELS, GPU_MODELS, CPU_MODELS, STORAGE_MODELS];

/** Crédit du modèle 3D d'un composant, s'il en a un. */
export function modelCredit(id: string | null | undefined): ModelCredit | null {
  if (!id) return null;
  return REGISTRIES.find((registry) => registry[id])?.[id].credit ?? null;
}

/** Tous les crédits, sans doublon : à afficher sur le site. */
export const ALL_MODEL_CREDITS: ModelCredit[] = REGISTRIES.flatMap((registry) => Object.values(registry))
  .map((model) => model.credit)
  .filter((credit, index, list) => list.findIndex((other) => other.url === credit.url) === index);
