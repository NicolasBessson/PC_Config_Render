"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { CATEGORY_LABELS, type Category } from "@/lib/catalog";
import type { SceneLayout } from "../layout";
import type { Lighting, StylePalette } from "../styles";
import type { Materials } from "./materials";

export interface SceneContext {
  palette: StylePalette;
  lighting: Lighting;
  animate: boolean;
  mat: Materials;
  layout: SceneLayout;
  labels: boolean;
  selected: Category | null;
  onSelect?: (category: Category | null) => void;
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
export function Glow({ on = true, offset = 0, strength = 3.4 }: { on?: boolean; offset?: number; strength?: number }) {
  const { lighting, animate } = useScene();
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
  const material = useMemo(() => (color ? new THREE.MeshStandardMaterial({ color, metalness, roughness }) : null), [color, metalness, roughness]);
  useEffect(() => () => material?.dispose(), [material]);
  return material ?? fallback;
}

/** Maillage simple : géométrie et matériau partagés, ombres activées par défaut. */
export function Part({ g, m, p, r, s, shadow = true }: { g: THREE.BufferGeometry; m: THREE.Material; p?: Vec3; r?: Vec3; s?: Vec3 | number; shadow?: boolean }) {
  return <mesh geometry={g} material={m} position={p} rotation={r} scale={s} castShadow={shadow} receiveShadow={shadow} />;
}

const dummy = new THREE.Object3D();

/** Répétition d'une même pièce en un seul appel de rendu (ailettes, condensateurs, vis). */
export function Repeat({ g, m, items }: { g: THREE.BufferGeometry; m: THREE.Material; items: { p: Vec3; r?: Vec3 }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
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
  }, [items]);
  return <instancedMesh key={items.length} ref={ref} args={[g, m, items.length]} castShadow receiveShadow />;
}

/** Rend un composant cliquable. La sélection est signalée par son étiquette et par la fiche. */
export function Pick({ category, children }: { category: Category; children: ReactNode }) {
  const { selected, onSelect } = useScene();
  if (!onSelect) return <group>{children}</group>;
  return (
      <group
        onClick={(event) => {
          event.stopPropagation();
          onSelect(selected === category ? null : category);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        {children}
      </group>
  );
}

export function Label({ category, name, position }: { category: Category; name: string; position: Vec3 }) {
  const { labels, selected } = useScene();
  if (!labels && selected !== category) return null;
  return (
    <Html position={position} center zIndexRange={[20, 0]} className="pointer-events-none select-none">
      <div className={`whitespace-nowrap rounded-md border px-2 py-1 text-[11px] leading-tight text-white shadow-lg backdrop-blur ${selected === category ? "border-sky-400 bg-sky-950/85" : "border-white/15 bg-black/75"}`}>
        <span className="block text-[9px] font-semibold uppercase tracking-wider text-sky-300">{CATEGORY_LABELS[category]}</span>
        {name}
      </div>
    </Html>
  );
}
