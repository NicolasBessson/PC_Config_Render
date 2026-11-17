import * as THREE from "three";
import type { StylePalette } from "../styles";
import { braidNormal, brushedNormal, brushedTexture, finsTexture, grainNormal, pcbNormal, pcbTexture, perforationTexture } from "./textures";

/*
 * Bibliothèque de matériaux d'un style. Une vingtaine de matériaux partagés
 * par toute la scène, au lieu d'un matériau par objet.
 */
const WHITE = new THREE.Color("#ffffff");

/**
 * Rendu photo : les noirs des palettes renvoient moins de 1 % de la lumière, bien moins qu'un
 * vrai plastique ou une vraie peinture noire (3 à 5 %). Sans effet en rendu classique, où les
 * lumières compensent ; en lancer de rayons, l'intérieur resterait noir et les LED n'éclaireraient rien.
 */
export function photoAlbedo(color: THREE.Color): THREE.Color {
  return color.lerp(WHITE, 0.022);
}

/** Luminance relative d'une couleur linéaire. */
export function luminance(color: THREE.Color): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

/** Exposition du style blanc : celle pour laquelle une couleur réelle s'affiche telle quelle. */
const REFERENCE_EXPOSURE = 0.21;

/**
 * Les styles sombres sont éclairés bien plus fort que le style blanc (`exposure`), comme un
 * photographe pose plus longtemps devant un boîtier noir. Une pièce claire — ventirad
 * gris, carte blanche, modèle réel — y serait brûlée. Les teintes moyennes et claires sont
 * donc ramenées à ce qu'elles donneraient sous l'éclairage de référence ; les noirs gardent
 * l'essentiel de la surexposition, qui fait ressortir leurs détails. La transition est
 * continue et l'ordre des clartés conservé. `weight` est la clarté moyenne de la texture.
 */
export function exposureSafe(color: THREE.Color, exposure: number, weight = 1): THREE.Color {
  const boost = exposure / REFERENCE_EXPOSURE;
  if (boost <= 1) return color;
  const level = luminance(color) * weight;
  return color.multiplyScalar((1 + (boost - 1) * Math.exp(-level / 0.06)) / boost);
}

/**
 * Force des reflets des matières non métalliques. Dans un style sombre, l'éclairage plus fort y
 * allume un reflet du studio qui fait paraître gris clair un plastique noir : les reflets sont
 * atténués d'autant. En rendu photo la lumière est simulée, rien n'est à corriger.
 */
export function plasticSpecular(exposure: number, photo = false): number {
  return photo ? 1 : Math.min(1, (1.7 * REFERENCE_EXPOSURE) / exposure);
}

export function createMaterials(palette: StylePalette, photo = false) {
  const standard = (parameters: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(parameters);
  // Plastiques, caoutchouc, gaines : reflets adaptés à l'exposition du style (voir `plasticSpecular`).
  const specularIntensity = plasticSpecular(palette.exposure, photo);
  const plasticLike = (parameters: THREE.MeshStandardMaterialParameters) => new THREE.MeshPhysicalMaterial({ ...parameters, specularIntensity });
  const light = palette.part === "#f4f5f7";
  // Relief fin : aucune surface réelle n'est parfaitement lisse.
  // Cartes de normales plutôt que simple relief : le lancer de rayons du rendu photo ne connaît que les premières.
  const relief = (strength: number) => new THREE.Vector2(strength, strength);
  const grain = { normalMap: grainNormal(), normalScale: relief(0.22) };
  const brushed = { roughnessMap: brushedTexture(), normalMap: brushedNormal(), normalScale: relief(0.16) };
  const materials = {
    /** Tôle peinte du châssis. */
    chassis: standard({ color: palette.chassis, metalness: 0.4, roughness: 0.56, ...grain }),
    /** Tôle perforée : façade, dessus, grilles. */
    mesh: standard({ color: palette.chassis, metalness: 0.6, roughness: 0.42, alphaMap: perforationTexture(), alphaTest: 0.5, side: THREE.DoubleSide }),
    /** Plastique mat : carénages, cadres de ventilateur. */
    plastic: plasticLike({ color: palette.part, metalness: 0.02, roughness: 0.62, ...grain }),
    /** Plastique satiné : caches, capots. */
    satin: plasticLike({ color: palette.part, metalness: 0.2, roughness: 0.36, ...grain, normalScale: relief(0.11) }),
    rubber: plasticLike({ color: "#08090a", metalness: 0, roughness: 0.95, ...grain }),
    /** Verre trempé : vernis de surface et reflets marqués, comme une vraie vitre teintée. */
    glass: photo
      ? // Rendu photo : un vrai verre, traversé et réfléchi par la lumière. Sa teinte dépend du style (verre fumé ou clair).
        // Épaisseur nulle : traité comme une lame mince, sans réfraction — un verre épais voile l'intérieur.
        new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setScalar(Math.sqrt(Math.max(0.12, 1 - palette.glassOpacity * 1.5))), transmission: 1, ior: 1.5, thickness: 0, roughness: 0, metalness: 0 })
      : new THREE.MeshPhysicalMaterial({ color: palette.glass, transparent: true, opacity: palette.glassOpacity, metalness: 0, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.02, reflectivity: 0.5, specularIntensity: 1, envMapIntensity: 0.5, depthWrite: false }),
    pcb: standard({ color: palette.pcb, map: pcbTexture(), normalMap: pcbNormal(), normalScale: relief(0.35), metalness: 0.25, roughness: 0.62 }),
    heatsink: standard({ color: palette.heatsink, metalness: 0.85, roughness: 0.5, ...brushed }),
    fin: standard({ color: palette.fin, metalness: 0.88, roughness: 0.28 }),
    /** Acier brut : équerres, caches d'emplacements, vis. */
    steel: standard({ color: "#9a9ea6", metalness: 0.92, roughness: 0.5, ...brushed }),
    nickel: standard({ color: "#cfd3d9", metalness: 1, roughness: 0.16 }),
    /** Noir satiné : ports, connecteurs, emplacements. */
    dark: plasticLike({ color: "#0c0d10", metalness: 0.3, roughness: 0.55 }),
    slot: plasticLike({ color: light ? "#3a3f47" : "#1c1e23", metalness: 0.2, roughness: 0.6 }),
    /** Gaine tressée : le relief des brins croisés accroche la lumière. */
    cable: plasticLike({ color: palette.cable, metalness: 0, roughness: 0.82, normalMap: braidNormal(), normalScale: relief(0.9) }),
    blade: plasticLike({ color: palette.blade, metalness: 0.05, roughness: 0.42 }),
    /** Pales translucides des ventilateurs lumineux. */
    bladeLit: standard({ color: "#f1f3f6", metalness: 0, roughness: 0.35, transparent: true, opacity: 0.6 }),
    radiator: standard({ color: light ? "#e1e4e8" : "#17181c", map: finsTexture(), metalness: 0.5, roughness: 0.55 }),
    tank: plasticLike({ color: light ? "#eceef1" : "#111215", metalness: 0.35, roughness: 0.5, ...grain }),
    gold: standard({ color: "#d4a94a", metalness: 1, roughness: 0.3 }),
    mirror: standard({ color: "#0a0b0d", metalness: 0.9, roughness: 0.05 }),
  };
  if (photo) {
    for (const material of Object.values(materials)) if (material !== materials.glass) photoAlbedo(material.color);
  }
  return materials;
}

export type Materials = ReturnType<typeof createMaterials>;

export function disposeMaterials(materials: Materials) {
  for (const material of Object.values(materials)) material.dispose();
}
