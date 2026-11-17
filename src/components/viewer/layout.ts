import { fanCountOf, type Build } from "@/lib/build";
import type { Style } from "@/lib/catalog";
import { CASE_MODELS, CPU_MODELS, GPU_MODELS, RAM_MODELS, STORAGE_MODELS } from "./models";

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

/** Dimensions du boîtier générique, utilisées tant qu'aucun boîtier n'est choisi. */
export const CASE = { width: 230, height: 480, depth: 460, wall: 4 } as const;
/*
 * Le repère est ancré au coin haut-arrière côté carte mère : ces trois plans
 * ne bougent pas. La vitre, la façade et le fond se déplacent avec les
 * dimensions réelles du boîtier choisi (voir `Frame`).
 */
export const ANCHOR = { top: 240, back: -230, tray: -115 } as const;
/** Surface de la carte mère et position du socket. */
export const BOARD = { x: -99, top: 206, back: -212, cpuY: 126, cpuZ: -107 } as const;
export const BOARD_SIZE = { ATX: [305, 244], mATX: [244, 244], ITX: [170, 170] } as const;
export const REAR_FAN = { x: 8, y: BOARD.cpuY, z: -213 } as const;
/** Bord supérieur de la carte graphique (plaque arrière). */
export const GPU_TOP = 34;
export const GPU_BACK = -222;
export const GPU_WIDTH = 126;
export const PSU_SIZE = { width: 150, height: 86, depth: 160 } as const;
/** Pas des emplacements d'extension à l'arrière. */
export const SLOT_PITCH = 20.32;
export const RAM_SLOT_Z = [60, 70, 80, 90].map((offset) => BOARD.cpuZ + offset);

/** Enveloppe du boîtier et repères qui en dépendent. */
export interface Frame {
  width: number;
  height: number;
  depth: number;
  /** Plan de la vitre (x), du fond (y) et de la façade (z). */
  right: number;
  bottom: number;
  front: number;
  /** Centre du boîtier. */
  cx: number;
  cy: number;
  cz: number;
  /** Façade imposée par le boîtier ; `null` = celle du style. */
  frontStyle: "mesh" | "solid" | null;
  shroud: boolean;
  /** Dessus du cache d'alimentation, ou plancher s'il n'y en a pas. */
  shroudTop: number;
  shroudFront: number;
  frontFanZ: number;
  /** Plan arrière des ventilateurs frontaux : rien ne doit le dépasser. */
  frontFanBack: number;
  psu: { x: number; y: number; z: number; mount: "rear" | "front" };
  /** Emplacements d'extension à l'arrière. */
  slots: number;
  /** Identifiant du modèle 3D réel du boîtier, s'il en existe un. */
  model: string | null;
}

export function frameFor(pcCase: Build["case"]): Frame {
  // Un modèle réel impose ses propres repères, mesurés sur le fichier.
  const model = pcCase ? CASE_MODELS[pcCase.id] : undefined;
  const nominal = pcCase?.dimensionsMm ?? CASE;
  const right = model?.frame.right ?? ANCHOR.tray + nominal.width;
  const bottom = model?.frame.bottom ?? ANCHOR.top - nominal.height;
  const front = model?.frame.front ?? ANCHOR.back + nominal.depth;
  const width = right - ANCHOR.tray, height = ANCHOR.top - bottom, depth = front - ANCHOR.back;
  const cx = ANCHOR.tray + width / 2;
  const shroud = pcCase?.visual?.shroud ?? true;
  const mount = pcCase?.visual?.psu ?? "rear";
  return {
    width, height, depth, right, bottom, front,
    cx, cy: ANCHOR.top - height / 2, cz: ANCHOR.back + depth / 2,
    frontStyle: pcCase?.visual?.front ?? null,
    shroud,
    shroudTop: model?.frame.shroudTop ?? (shroud ? bottom + 104 : bottom + 4),
    shroudFront: front - 62,
    frontFanZ: front - 17,
    frontFanBack: front - 30,
    psu: { x: model?.psuX ?? Math.min(cx + 20, right - 6 - PSU_SIZE.width / 2), y: bottom + 47, z: mount === "rear" ? ANCHOR.back + 84 : front - 40 - PSU_SIZE.depth / 2, mount },
    slots: !pcCase || pcCase.formFactors.includes("ATX") ? 7 : 4,
    model: model && pcCase ? pcCase.id : null,
  };
}

export interface GpuLayout {
  length: number;
  thickness: number;
  /** Hauteur de la carte, mesurée depuis la carte mère. */
  width: number;
  fans: number;
  /** Extrémité avant de la carte. */
  frontZ: number;
  /** Nombre d'emplacements arrière occupés. */
  slots: number;
  connector: "8pin" | "12v-2x6";
  cables: number;
  colors: { shroud: string; accent: string; backplate: string } | null;
  /** Identifiant du modèle 3D réel de la carte, s'il en existe un. */
  model: string | null;
}

export type CoolerLayout =
  | { kind: "air"; height: number; towers: 1 | 2; topX: number; rgb: boolean; fans: number; fanSize: 120 | 140; colors: CoolerColors | null }
  | { kind: "aio"; radiator: number; mount: "top" | "front"; fans: number; fanSize: 120 | 140; length: number; thickness: number; rgb: boolean; colors: CoolerColors | null };
export interface CoolerColors {
  fin: string;
  top: string;
  fan: string;
}

export interface SceneLayout {
  /** Les représentations sont génériques : à afficher comme telles. */
  generic: true;
  frame: Frame;
  board: { formFactor: keyof typeof BOARD_SIZE; height: number; depth: number; bottom: number; front: number; colors: { pcb: string; heatsink: string; accent: string } | null } | null;
  cpu: boolean;
  /** Modèles 3D réels du processeur et du SSD, s'ils existent. */
  cpuModel: string | null;
  storageModel: string | null;
  gpu: GpuLayout | null;
  cooler: CoolerLayout | null;
  ram: { modules: number; slots: number[]; height: number; rgb: boolean; color: string | null; model: string | null } | null;
  storage: boolean;
  psu: { wattage: number; color: string | null } | null;
  /** Ventilateurs de boîtier, hors refroidissement du processeur. `rgb: null` = selon le style. */
  fans: { front: number; frontSize: number; rear: number; rearSize: number; rgb: boolean | null };
  /** Ventilateurs supplémentaires choisis : d'abord en façade sous ceux du boîtier, puis en haut. */
  extraFans: { front: number; top: number; size: 120 | 140; rgb: boolean; color: string | null } | null;
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
  const frame = frameFor(pcCase);

  let board: SceneLayout["board"] = null;
  if (motherboard) {
    const [height, depth] = BOARD_SIZE[motherboard.formFactor];
    board = { formFactor: motherboard.formFactor, height, depth, bottom: BOARD.top - height, front: BOARD.back + depth, colors: motherboard.visual ?? null };
  }

  let gpuLayout: GpuLayout | null = null;
  if (gpu) {
    gpuLayout = {
      length: gpu.lengthMm,
      thickness: gpu.slots * 20,
      width: gpu.visual?.widthMm ?? GPU_WIDTH,
      fans: gpu.fans,
      frontZ: GPU_BACK + gpu.lengthMm,
      slots: Math.ceil(gpu.slots),
      connector: gpu.power.connector,
      cables: gpu.power.count,
      colors: gpu.visual ? { shroud: gpu.visual.shroud, accent: gpu.visual.accent, backplate: gpu.visual.backplate } : null,
      model: GPU_MODELS[gpu.id] ? gpu.id : null,
    };
  }

  let coolerLayout: CoolerLayout | null = null;
  if (cooler) {
    const colors = cooler.visual ? { fin: cooler.visual.fin, top: cooler.visual.top, fan: cooler.visual.fan } : null;
    if (cooler.type === "aio" && cooler.radiatorMm) {
      const size = cooler.radiatorMm;
      // Le radiateur va en haut si le boîtier le permet, sinon en façade.
      const fitsTop = !pcCase || pcCase.radiators.top.includes(size);
      const fitsFront = pcCase?.radiators.front.includes(size) ?? false;
      const fanSize = size % 140 === 0 ? 140 : 120;
      coolerLayout = {
        kind: "aio", radiator: size, mount: fitsTop || !fitsFront ? "top" : "front", fans: size / fanSize, fanSize,
        length: size + 37, thickness: cooler.visual?.radiatorThicknessMm ?? 27, rgb: cooler.rgb, colors,
      };
    } else {
      const height = cooler.heightMm ?? 155;
      const towers = (cooler.tdpRatingW ?? 0) >= 200 ? 2 : 1;
      coolerLayout = { kind: "air", height, towers, topX: BOARD.x + height, rgb: cooler.rgb, fans: cooler.visual?.fans ?? 1, fanSize: cooler.visual?.fanSize ?? 120, colors };
    }
  }

  const frontRadiator = coolerLayout?.kind === "aio" && coolerLayout.mount === "front" ? coolerLayout : null;
  const caseFans = pcCase?.visual;
  const frontCount = frontRadiator ? frontRadiator.fans : caseFans ? caseFans.frontFans : style === "minimaliste" ? 2 : 3;
  const frontSize = frontRadiator ? frontRadiator.fanSize : caseFans?.frontFanSize ?? 120;

  let extraFans: SceneLayout["extraFans"] = null;
  if (build.fans) {
    const size = build.fans.sizeMm;
    const slots = pcCase?.fanSlots;
    const topTaken = coolerLayout?.kind === "aio" && coolerLayout.mount === "top";
    // En façade : seulement à la suite de ventilateurs de même taille, dans la limite des emplacements.
    const frontFree = frontRadiator || frontSize !== size ? 0 : Math.max(0, (slots ? slots.front[String(size) as "120" | "140"] : 3) - frontCount);
    const topFree = topTaken ? 0 : slots ? slots.top[String(size) as "120" | "140"] : 2;
    const count = fanCountOf(build);
    const front = Math.min(count, frontFree);
    extraFans = { front, top: Math.min(count - front, topFree), size, rgb: build.fans.rgb, color: build.fans.visual?.frame ?? null };
  }

  return {
    generic: true,
    frame,
    board,
    cpu: Boolean(build.cpu),
    cpuModel: build.cpu && CPU_MODELS[build.cpu.id] ? build.cpu.id : null,
    storageModel: build.storage && STORAGE_MODELS[build.storage.id] ? build.storage.id : null,
    gpu: gpuLayout,
    cooler: coolerLayout,
    ram: ram ? { modules: ram.modules, slots: ramSlots(ram.modules), height: ram.heightMm, rgb: ram.rgb, color: ram.visual?.spreader ?? null, model: RAM_MODELS[ram.id] ? ram.id : null } : null,
    storage: Boolean(build.storage),
    psu: psu ? { wattage: psu.wattage, color: psu.visual?.body ?? null } : null,
    fans: {
      // Un radiateur en façade utilise ses propres ventilateurs à la place de ceux du boîtier.
      front: frontCount,
      frontSize,
      rear: 1,
      rearSize: caseFans?.rearFanSize ?? 120,
      rgb: caseFans ? caseFans.fansRgb : null,
    },
    extraFans,
    cables: { atx24: Boolean(motherboard && psu), eps: Boolean(motherboard && psu), gpu: gpu && psu ? gpu.power.count : 0 },
  };
}

/** Hauteurs des ventilateurs frontaux, du haut vers le bas. */
export function frontFanHeights(count: number, size = 120): number[] {
  const top = ANCHOR.top - 30 - size / 2;
  return Array.from({ length: count }, (_, i) => top - i * (size + 2));
}
