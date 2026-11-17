/*
 * Modèles 3D de produits réels, créés par des tiers et publiés sous licence
 * Creative Commons Attribution. Module pur : uniquement des données.
 *
 * Chaque modèle doit être crédité (auteur, titre, lien, licence) partout où
 * il est affiché : c'est la condition de la licence. Les marques restent la
 * propriété de leurs détenteurs ; ces modèles ne sont pas des fichiers
 * officiels des fabricants.
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
}

export interface PartModel {
  file: string;
  credit: ModelCredit;
}

const BY = "CC BY 4.0" as const;

/** Boîtiers, par identifiant de catalogue. */
export const CASE_MODELS: Record<string, CaseModel> = {
  "4000d-airflow": {
    file: "/models/corsair-4000d-airflow.glb",
    credit: { title: "Corsair 4000D Airflow (Free)", author: "Kirigami", url: "https://sketchfab.com/3d-models/corsair-4000d-airflow-free-34df3ba96cf94e71accdb5779c4b8694", license: BY },
    unit: 1000,
    offset: [-6, -209, -22],
    frame: { right: 95, bottom: -195, front: 206, shroudTop: -97 },
    psuX: -14,
  },
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

/** Crédit du modèle 3D d'un composant, s'il en a un. */
export function modelCredit(id: string | null | undefined): ModelCredit | null {
  if (!id) return null;
  return CASE_MODELS[id]?.credit ?? RAM_MODELS[id]?.credit ?? null;
}

/** Tous les crédits, sans doublon : à afficher sur le site. */
export const ALL_MODEL_CREDITS: ModelCredit[] = [...Object.values(CASE_MODELS), ...Object.values(RAM_MODELS)]
  .map((model) => model.credit)
  .filter((credit, index, list) => list.findIndex((other) => other.url === credit.url) === index);
