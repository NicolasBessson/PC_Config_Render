/*
 * Vues prédéfinies de la caméra. Coordonnées en unités de scène
 * (1 unité = 100 mm), autour du centre du boîtier.
 */
export type ViewId = "trois-quarts" | "cote" | "interieur" | "arriere";

export interface CameraView {
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

export const VIEWS: Record<ViewId, CameraView> = {
  "trois-quarts": { label: "3/4", position: [10.4, 2.7, 8], target: [0, -0.1, 0] },
  cote: { label: "Côté", position: [13.4, 0.5, 0.2], target: [0, -0.1, 0] },
  interieur: { label: "Intérieur", position: [7.6, 1.5, 1.6], target: [-0.3, 0.55, -0.45] },
  arriere: { label: "Arrière", position: [3.4, 2, -12.6], target: [0, -0.1, 0] },
};

export const VIEW_ORDER: ViewId[] = ["trois-quarts", "cote", "interieur", "arriere"];
export const DEFAULT_VIEW: ViewId = "trois-quarts";

/*
 * Limites de navigation. Le boîtier tient dans une sphère de rayon ~3,6 :
 * une distance minimale supérieure garantit que la caméra ne le traverse pas.
 */
export const CAMERA_LIMITS = {
  minDistance: 4.6,
  maxDistance: 20,
  /** Ni à la verticale, ni sous le socle. */
  minPolarAngle: Math.PI * 0.12,
  maxPolarAngle: Math.PI * 0.53,
} as const;
