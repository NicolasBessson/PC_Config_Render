"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { CATEGORY_LABELS, type Category } from "@/lib/catalog";
import type { SceneLayout } from "../layout";
import type { Lighting, StylePalette } from "../styles";
import { exposureSafe, photoAlbedo, plasticSpecular, type Materials } from "./materials";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { brushedTexture, grainTexture } from "./textures";

export interface SceneContext {
  palette: StylePalette;
  lighting: Lighting;
  animate: boolean;
  mat: Materials;
  layout: SceneLayout;
  labels: boolean;
  selected: Category | null;
  onSelect?: (category: Category | null) => void;
  /** Vue éclatée : les composants s'écartent du boîtier. */
  exploded: boolean;
  /** Rendu photo par lancer de rayons : la scène est figée et les matériaux deviennent physiques. */
  photo: boolean;
}

export const Ctx = createContext<SceneContext | null>(null);

export function useScene(): SceneContext {
  const value = useContext(Ctx);
  if (!value) throw new Error("useScene doit être utilisé à l'intérieur de PcScene");
  return value;
}

export type Vec3 = [number, number, number];

/** Couleur d'un élément lumineux : un sur deux prend la couleur secondaire. */
export function glowColor(lighting: Lighting, offset: number, time = 0) {
  if (lighting.mode === "rainbow") return new THREE.Color().setHSL((offset + time * 0.07) % 1, 1, 0.55);
  return new THREE.Color(Math.round(offset * 10) % 2 === 1 ? lighting.color2 : lighting.color);
}

/** Facteur d'intensité : réglage de l'utilisateur, modulé par l'effet « respiration ». */
export function glowLevel(lighting: Lighting, time = 0) {
  const breath = lighting.mode === "breath" ? 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * 1.7)) : 1;
  return lighting.intensity * breath;
}

/** Matériau lumineux : fixe, respiration ou cycle de couleurs ; éteint sinon. */
/** En rendu photo, les éléments lumineux éclairent réellement la scène : il leur faut la puissance d'une vraie LED. */
const PHOTO_GLOW = 6;

export function Glow({ on = true, offset = 0, strength: baseStrength = 3.4 }: { on?: boolean; offset?: number; strength?: number }) {
  const { lighting, animate, photo } = useScene();
  const strength = baseStrength * (photo ? PHOTO_GLOW : 1);
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  const time = useRef(0);
  const lit = on && lighting.mode !== "off";
  const color = useMemo(() => glowColor(lighting, offset), [lighting, offset]);
  const moving = lit && animate && (lighting.mode === "rainbow" || lighting.mode === "breath");
  useFrame((_, delta) => {
    if (!moving || !ref.current) return;
    time.current += delta;
    if (lighting.mode === "rainbow") {
      ref.current.emissive.copy(glowColor(lighting, offset, time.current));
      ref.current.color.copy(ref.current.emissive);
    }
    ref.current.emissiveIntensity = strength * glowLevel(lighting, time.current);
  });
  return (
    <meshStandardMaterial ref={ref} color={lit ? color : "#2a2d33"} emissive={lit ? color : "#000000"} emissiveIntensity={lit ? strength * glowLevel(lighting) : 0} toneMapped={false} roughness={0.4} />
  );
}

/** Matériau à la couleur propre d'un produit ; à défaut, le matériau du style. */
export function useTint(color: string | null | undefined, fallback: THREE.Material, metalness = 0.3, roughness = 0.5): THREE.Material {
  const { photo, palette } = useScene();
  const exposure = palette.exposure;
  const material = useMemo(() => {
    if (!color) return null;
    // Même grain que les matériaux de style ; les pièces métalliques reçoivent un brossage.
    const relief = metalness > 0.6 ? { roughnessMap: brushedTexture(), bumpMap: brushedTexture(), bumpScale: 0.35, roughness: Math.max(roughness, 0.48) } : { bumpMap: grainTexture(), bumpScale: 0.5 };
    // Une pièce non métallique reçoit les mêmes reflets atténués que les plastiques du style.
    const tinted = metalness > 0.6 ? new THREE.MeshStandardMaterial({ color, metalness, roughness, ...relief }) : new THREE.MeshPhysicalMaterial({ color, metalness, roughness, ...relief, specularIntensity: plasticSpecular(exposure, photo) });
    exposureSafe(tinted.color, exposure);
    if (photo) photoAlbedo(tinted.color);
    return tinted;
  }, [color, metalness, roughness, photo, exposure]);
  useEffect(() => () => material?.dispose(), [material]);
  return material ?? fallback;
}

/** Maillage simple : géométrie et matériau partagés, ombres activées par défaut. */
export function Part({ g, m, p, r, s, shadow = true }: { g: THREE.BufferGeometry; m: THREE.Material; p?: Vec3; r?: Vec3; s?: Vec3 | number; shadow?: boolean }) {
  return <mesh geometry={g} material={m} position={p} rotation={r} scale={s} castShadow={shadow} receiveShadow={shadow} />;
}

const dummy = new THREE.Object3D();

/**
 * Répétition d'une même pièce en un seul appel de rendu (ailettes, condensateurs, vis).
 * Le lancer de rayons ne connaît pas l'instanciation : en rendu photo, les copies sont
 * donc fusionnées en un maillage ordinaire.
 */
export function Repeat({ g, m, items }: { g: THREE.BufferGeometry; m: THREE.Material; items: { p: Vec3; r?: Vec3 }[] }) {
  const { photo } = useScene();
  const ref = useRef<THREE.InstancedMesh>(null);
  const merged = useMemo(() => {
    if (!photo || items.length === 0) return null;
    const copies = items.map((item) => {
      dummy.position.set(...item.p);
      dummy.rotation.set(...(item.r ?? [0, 0, 0]));
      dummy.updateMatrix();
      return g.clone().applyMatrix4(dummy.matrix);
    });
    const geometry = mergeGeometries(copies);
    copies.forEach((copy) => copy.dispose());
    return geometry;
  }, [photo, g, items]);
  useEffect(() => () => merged?.dispose(), [merged]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((item, i) => {
      dummy.position.set(...item.p);
      dummy.rotation.set(...(item.r ?? [0, 0, 0]));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, merged]);
  if (merged) return <mesh geometry={merged} material={m} castShadow receiveShadow />;
  return <instancedMesh key={items.length} ref={ref} args={[g, m, items.length]} castShadow receiveShadow />;
}

const unitEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
// Couleur au-delà du seuil du halo : le cadre rayonne en qualité haute, reste net en qualité légère.
const highlightMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color("#8fb4ff").multiplyScalar(5), toneMapped: false });
const bounds = new THREE.Box3();
const inverse = new THREE.Matrix4();

/** Cadre lumineux épousant l'encombrement du composant sélectionné. */
function Highlight({ target }: { target: React.RefObject<THREE.Group | null> }) {
  const frame = useRef<THREE.LineSegments>(null);
  const { layout, labels } = useScene();
  useLayoutEffect(() => {
    const group = target.current, lines = frame.current;
    if (!group || !lines || !group.parent) return;
    group.updateWorldMatrix(true, true);
    // Encombrement mesuré dans le repère du parent, où le cadre est dessiné.
    bounds.setFromObject(group).applyMatrix4(inverse.copy(group.parent.matrixWorld).invert());
    bounds.getCenter(lines.position);
    bounds.getSize(lines.scale).addScalar(6);
  }, [target, layout, labels]);
  return <lineSegments ref={frame} geometry={unitEdges} material={highlightMaterial} raycast={() => null} />;
}

/*
 * Vue éclatée : déplacement de chaque catégorie, en millimètres. Les pièces
 * sortent côté vitre, dans l'ordre inverse du montage.
 */
export const EXPLODE_OFFSET: Record<Category, Vec3> = {
  case: [0, 0, 0],
  motherboard: [70, 0, 0],
  storage: [150, -30, 60],
  cpu: [150, 0, 0],
  ram: [190, 40, 90],
  cooler: [330, 60, -20],
  gpu: [260, -70, 20],
  psu: [200, -40, -60],
  fans: [60, 90, 120],
};
const goal = new THREE.Vector3();

/** Rend un composant cliquable, l'entoure d'un cadre lorsqu'il est sélectionné, et l'anime en vue éclatée. */
export function Pick({ category, children }: { category: Category; children: ReactNode }) {
  const { selected, onSelect, exploded, photo } = useScene();
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    goal.set(...EXPLODE_OFFSET[category]).multiplyScalar(exploded ? 1 : 0);
    // Rendu photo : pas de transition, la scène doit être en place avant d'être figée.
    if (photo || node.position.distanceToSquared(goal) < 0.01) {
      node.position.copy(goal);
      return;
    }
    node.position.lerp(goal, 1 - Math.exp(-6 * Math.min(delta, 0.05)));
    invalidate(); // nécessaire en rendu à la demande
  });
  const interactive = Boolean(onSelect);
  return (
    <>
      <group
        ref={group}
        onClick={
          interactive
            ? (event) => {
                event.stopPropagation();
                onSelect?.(selected === category ? null : category);
              }
            : undefined
        }
        onPointerOver={
          interactive
            ? (event) => {
                event.stopPropagation();
                document.body.style.cursor = "pointer";
              }
            : undefined
        }
        onPointerOut={interactive ? () => void (document.body.style.cursor = "") : undefined}
      >
        {children}
      </group>
      {interactive && selected === category && !exploded && !photo && <Highlight target={group} />}
    </>
  );
}

export function Label({ category, name, position }: { category: Category; name: string; position: Vec3 }) {
  const { labels, selected, exploded } = useScene();
  // En vue éclatée, chaque pièce est nommée d'office.
  if (!labels && !exploded && selected !== category) return null;
  return (
    <Html position={position} center zIndexRange={[20, 0]} className="pointer-events-none select-none">
      <div className={`whitespace-nowrap rounded-md border px-2 py-1 text-[11px] leading-tight text-white shadow-lg backdrop-blur ${selected === category ? "border-sky-400 bg-sky-950/85" : "border-white/15 bg-black/75"}`}>
        <span className="block text-[9px] font-semibold uppercase tracking-wider text-sky-300">{CATEGORY_LABELS[category]}</span>
        {name}
      </div>
    </Html>
  );
}
