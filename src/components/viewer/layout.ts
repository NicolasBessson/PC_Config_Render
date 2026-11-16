import type { Build } from "@/lib/build";
import type { Style } from "@/lib/catalog";

/*
 * Description de la scène 3D, déduite de la configuration.
 *
 * Module pur (aucune dépendance à Three.js ni à React) : c'est ici qu'est
 * décidé CE QUI est affiché et OÙ. Les composants de `scene/` ne font que
 * dessiner cette description, ce qui permet de la tester sans navigateur.
 *
 * Cotes en millimètres. Axes : x = largeur (vitre côté +x), y = hauteur,
 * z = profondeur (façade côté +z).
 *
 * Tous les modèles sont GÉNÉRIQUES : ils reprennent les dimensions du
 * catalogue, pas l'apparence exacte d'un produit.
 */

export const CASE = { width: 230, height: 480, depth: 460, wall: 4 } as const;
/** Surface de la carte mère et position du socket. */
export const BOARD = { x: -99, top: 206, back: -212, cpuY: 126, cpuZ: -107 } as const;
export const BOARD_SIZE = { ATX: [305, 244], mATX: [244, 244], ITX: [170, 170] } as const;
/** Dessus du cache d'alimentation. */
export const SHROUD_TOP = -136;
/** Le cache s'arrête avant la chambre des ventilateurs frontaux. */
export const SHROUD_FRONT = 168;
/** Plan arrière des ventilateurs frontaux : rien ne doit le dépasser. */
export const FRONT_FAN_BACK = 200;
export const FRONT_FAN_Z = 213;
export const REAR_FAN = { x: 8, y: BOARD.cpuY, z: -213 } as const;
/** Bord supérieur de la carte graphique (plaque arrière). */
export const GPU_TOP = 34;
export const GPU_BACK = -222;
export const GPU_WIDTH = 126;
export const PSU = { x: 20, y: -193, z: -146, width: 150, height: 86, depth: 160 } as const;
/** Pas des emplacements d'extension à l'arrière. */
export const SLOT_PITCH = 20.32;
export const RAM_SLOT_Z = [60, 70, 80, 90].map((offset) => BOARD.cpuZ + offset);

export interface GpuLayout {
  length: number;
  thickness: number;
  fans: number;
  /** Extrémité avant de la carte. */
  frontZ: number;
  /** Nombre d'emplacements arrière occupés. */
  slots: number;
  connector: "8pin" | "12v-2x6";
  cables: number;
}

export type CoolerLayout =
  | { kind: "air"; height: number; towers: 1 | 2; topX: number; rgb: boolean }
  | { kind: "aio"; radiator: number; mount: "top" | "front"; fans: number; fanSize: 120 | 140; length: number; rgb: boolean };

export interface SceneLayout {
  /** Les représentations sont génériques : à afficher comme telles. */
  generic: true;
  board: { formFactor: keyof typeof BOARD_SIZE; height: number; depth: number; bottom: number; front: number } | null;
  cpu: boolean;
  gpu: GpuLayout | null;
  cooler: CoolerLayout | null;
  ram: { modules: number; slots: number[]; height: number; rgb: boolean } | null;
  storage: boolean;
  psu: { wattage: number } | null;
  /** Ventilateurs de boîtier, hors refroidissement du processeur. */
  fans: { front: number; rear: number };
  cables: { atx24: boolean; eps: boolean; gpu: number };
}

/** Deux barrettes vont dans les emplacements 2 et 4, comme le recommandent les cartes mères. */
function ramSlots(modules: number): number[] {
  if (modules >= 4) return [0, 1, 2, 3];
  if (modules === 2) return [1, 3];
  if (modules === 3) return [0, 1, 3];
  return [1];
}

export function layoutScene(build: Build, style: Style): SceneLayout {
  const { motherboard, gpu, cooler, ram, psu, case: pcCase } = build;

  let board: SceneLayout["board"] = null;
  if (motherboard) {
    const [height, depth] = BOARD_SIZE[motherboard.formFactor];
    board = { formFactor: motherboard.formFactor, height, depth, bottom: BOARD.top - height, front: BOARD.back + depth };
  }

  let gpuLayout: GpuLayout | null = null;
  if (gpu) {
    gpuLayout = {
      length: gpu.lengthMm,
      thickness: gpu.slots * 20,
      fans: gpu.fans,
      frontZ: GPU_BACK + gpu.lengthMm,
      slots: Math.ceil(gpu.slots),
      connector: gpu.power.connector,
      cables: gpu.power.count,
    };
  }

  let coolerLayout: CoolerLayout | null = null;
  if (cooler) {
    if (cooler.type === "aio" && cooler.radiatorMm) {
      const size = cooler.radiatorMm;
      // Le radiateur va en haut si le boîtier le permet, sinon en façade.
      const fitsTop = !pcCase || pcCase.radiators.top.includes(size);
      const fitsFront = pcCase?.radiators.front.includes(size) ?? false;
      const fanSize = size % 140 === 0 ? 140 : 120;
      coolerLayout = { kind: "aio", radiator: size, mount: fitsTop || !fitsFront ? "top" : "front", fans: size / fanSize, fanSize, length: size + 37, rgb: cooler.rgb };
    } else {
      const height = cooler.heightMm ?? 155;
      coolerLayout = { kind: "air", height, towers: (cooler.tdpRatingW ?? 0) >= 200 ? 2 : 1, topX: BOARD.x + height, rgb: cooler.rgb };
    }
  }

  const frontRadiator = coolerLayout?.kind === "aio" && coolerLayout.mount === "front" ? coolerLayout : null;

  return {
    generic: true,
    board,
    cpu: Boolean(build.cpu),
    gpu: gpuLayout,
    cooler: coolerLayout,
    ram: ram ? { modules: ram.modules, slots: ramSlots(ram.modules), height: ram.heightMm, rgb: ram.rgb } : null,
    storage: Boolean(build.storage),
    psu: psu ? { wattage: psu.wattage } : null,
    // Un radiateur en façade utilise ses propres ventilateurs à la place de ceux du boîtier.
    fans: { front: frontRadiator ? frontRadiator.fans : style === "minimaliste" ? 2 : 3, rear: 1 },
    cables: { atx24: Boolean(motherboard && psu), eps: Boolean(motherboard && psu), gpu: gpu && psu ? gpu.power.count : 0 },
  };
}

/** Hauteurs des ventilateurs frontaux, du haut vers le bas. */
export function frontFanHeights(count: number, size = 120): number[] {
  const top = 210 - size / 2;
  return Array.from({ length: count }, (_, i) => top - i * (size + 2));
}
