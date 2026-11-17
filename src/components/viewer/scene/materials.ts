import * as THREE from "three";
import type { StylePalette } from "../styles";
import { brushedTexture, finsTexture, grainTexture, pcbTexture, perforationTexture } from "./textures";

/*
 * Bibliothèque de matériaux d'un style. Une vingtaine de matériaux partagés
 * par toute la scène, au lieu d'un matériau par objet.
 */
export function createMaterials(palette: StylePalette) {
  const standard = (parameters: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(parameters);
  const light = palette.part === "#f4f5f7";
  // Relief fin : aucune surface réelle n'est parfaitement lisse.
  const grain = { bumpMap: grainTexture(), bumpScale: 0.6 };
  const brushed = { roughnessMap: brushedTexture(), bumpMap: brushedTexture(), bumpScale: 0.35 };
  return {
    /** Tôle peinte du châssis. */
    chassis: standard({ color: palette.chassis, metalness: 0.4, roughness: 0.56, ...grain }),
    /** Tôle perforée : façade, dessus, grilles. */
    mesh: standard({ color: palette.chassis, metalness: 0.6, roughness: 0.42, alphaMap: perforationTexture(), alphaTest: 0.5, side: THREE.DoubleSide }),
    /** Plastique mat : carénages, cadres de ventilateur. */
    plastic: standard({ color: palette.part, metalness: 0.02, roughness: 0.62, ...grain }),
    /** Plastique satiné : caches, capots. */
    satin: standard({ color: palette.part, metalness: 0.2, roughness: 0.36, ...grain, bumpScale: 0.3 }),
    rubber: standard({ color: "#08090a", metalness: 0, roughness: 0.95, ...grain }),
    /** Verre trempé : vernis de surface et reflets marqués, comme une vraie vitre teintée. */
    glass: new THREE.MeshPhysicalMaterial({ color: palette.glass, transparent: true, opacity: palette.glassOpacity, metalness: 0, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.02, reflectivity: 0.5, specularIntensity: 1, envMapIntensity: 0.5, depthWrite: false }),
    pcb: standard({ color: palette.pcb, map: pcbTexture(), bumpMap: pcbTexture(), bumpScale: 0.5, metalness: 0.25, roughness: 0.62 }),
    heatsink: standard({ color: palette.heatsink, metalness: 0.85, roughness: 0.5, ...brushed }),
    fin: standard({ color: palette.fin, metalness: 0.88, roughness: 0.28 }),
    /** Acier brut : équerres, caches d'emplacements, vis. */
    steel: standard({ color: "#9a9ea6", metalness: 0.92, roughness: 0.5, ...brushed }),
    nickel: standard({ color: "#cfd3d9", metalness: 1, roughness: 0.16 }),
    /** Noir satiné : ports, connecteurs, emplacements. */
    dark: standard({ color: "#0c0d10", metalness: 0.3, roughness: 0.55 }),
    slot: standard({ color: light ? "#3a3f47" : "#1c1e23", metalness: 0.2, roughness: 0.6 }),
    cable: standard({ color: palette.cable, metalness: 0, roughness: 0.82, ...grain, bumpScale: 1.2 }),
    blade: standard({ color: palette.blade, metalness: 0.05, roughness: 0.42 }),
    /** Pales translucides des ventilateurs lumineux. */
    bladeLit: standard({ color: "#f1f3f6", metalness: 0, roughness: 0.35, transparent: true, opacity: 0.6 }),
    radiator: standard({ color: light ? "#e1e4e8" : "#17181c", map: finsTexture(), metalness: 0.5, roughness: 0.55 }),
    tank: standard({ color: light ? "#eceef1" : "#111215", metalness: 0.35, roughness: 0.5, ...grain }),
    gold: standard({ color: "#d4a94a", metalness: 1, roughness: 0.3 }),
    mirror: standard({ color: "#0a0b0d", metalness: 0.9, roughness: 0.05 }),
  };
}

export type Materials = ReturnType<typeof createMaterials>;

export function disposeMaterials(materials: Materials) {
  for (const material of Object.values(materials)) material.dispose();
}
