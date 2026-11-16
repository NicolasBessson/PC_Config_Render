import type { Style } from "@/lib/catalog";

export type LightMode = "off" | "fixed" | "rainbow";
export interface Lighting {
  mode: LightMode;
  color: string;
}

export interface StylePalette {
  label: string;
  tagline: string;
  chassis: string;
  /** Pièces plastiques : carénage du GPU, ventilateurs, cache d'alimentation. */
  part: string;
  pcb: string;
  heatsink: string;
  glass: string;
  glassOpacity: number;
  front: "mesh" | "solid";
  /** Éléments lumineux actifs dans ce style lorsque l'éclairage est allumé. */
  lit: { fans: boolean; strips: boolean; ram: boolean; cooler: boolean };
  /** Facteur appliqué à l'éclairage de scène : un boîtier blanc renvoie bien plus de lumière. */
  exposure: number;
  /** Intensité de la lumière colorée diffusée dans le boîtier. */
  glow: number;
  lighting: Lighting;
  /** Pastille de couleur pour les sélecteurs. */
  swatch: string;
}

/** Les quatre déclinaisons du boîtier générique (section 7.3). */
export const STYLES: Record<Style, StylePalette> = {
  noir: {
    label: "Noir", tagline: "Sobre et discret, éclairage blanc léger",
    chassis: "#121317", part: "#1b1d22", pcb: "#171a20", heatsink: "#3b3f47", exposure: 1.25,
    glass: "#0b0e14", glassOpacity: 0.24, front: "mesh",
    lit: { fans: false, strips: true, ram: false, cooler: false }, glow: 0.8,
    lighting: { mode: "fixed", color: "#ffffff" }, swatch: "linear-gradient(135deg,#2a2d33,#08090b)",
  },
  blanc: {
    label: "Blanc", tagline: "Lumineux, composants blancs",
    chassis: "#dfe2e6", part: "#f4f5f7", pcb: "#9aa2ad", heatsink: "#c3c8cf", exposure: 0.6,
    glass: "#dfe9f5", glassOpacity: 0.1, front: "mesh",
    lit: { fans: true, strips: true, ram: false, cooler: false }, glow: 0.5,
    lighting: { mode: "fixed", color: "#dbeafe" }, swatch: "linear-gradient(135deg,#ffffff,#cfd4da)",
  },
  minimaliste: {
    label: "Minimaliste", tagline: "Façade pleine, verre fumé, aucune lumière",
    chassis: "#3a3d43", part: "#1c1e22", pcb: "#16181d", heatsink: "#4a4e55", exposure: 1.15,
    glass: "#050608", glassOpacity: 0.5, front: "solid",
    lit: { fans: false, strips: true, ram: false, cooler: false }, glow: 0.3,
    lighting: { mode: "off", color: "#ffffff" }, swatch: "linear-gradient(135deg,#565a62,#2b2e33)",
  },
  rgb: {
    label: "RGB", tagline: "Ventilateurs, RAM et bandeaux lumineux",
    chassis: "#0b0b0e", part: "#16171b", pcb: "#111318", heatsink: "#2b2e35", exposure: 1,
    glass: "#0a0c12", glassOpacity: 0.12, front: "mesh",
    lit: { fans: true, strips: true, ram: true, cooler: true }, glow: 1,
    lighting: { mode: "rainbow", color: "#2f6bff" }, swatch: "linear-gradient(135deg,#ff2d6f,#7c3aed 45%,#22d3ee)",
  },
};

export const STYLE_ORDER: Style[] = ["noir", "blanc", "minimaliste", "rgb"];
export const LIGHT_COLORS = ["#ffffff", "#2f6bff", "#22d3ee", "#22c55e", "#f59e0b", "#ff2d6f", "#a855f7"];
