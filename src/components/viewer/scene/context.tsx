"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useRef } from "react";
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
}

export const Ctx = createContext<SceneContext | null>(null);

export function useScene(): SceneContext {
  const value = useContext(Ctx);
  if (!value) throw new Error("useScene doit être utilisé à l'intérieur de PcScene");
  return value;
}

export type Vec3 = [number, number, number];

export function glowColor(lighting: Lighting, offset: number, time = 0) {
  return lighting.mode === "rainbow" ? new THREE.Color().setHSL((offset + time * 0.07) % 1, 1, 0.55) : new THREE.Color(lighting.color);
}

/** Matériau lumineux : couleur fixe ou arc-en-ciel animé, éteint sinon. Assez intense pour rayonner. */
export function Glow({ on = true, offset = 0, strength = 3.4 }: { on?: boolean; offset?: number; strength?: number }) {
  const { lighting, animate } = useScene();
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  const time = useRef(0);
  const lit = on && lighting.mode !== "off";
  const color = useMemo(() => glowColor(lighting, offset), [lighting, offset]);
  useFrame((_, delta) => {
    if (!lit || !animate || lighting.mode !== "rainbow" || !ref.current) return;
    time.current += delta;
    ref.current.emissive.copy(glowColor(lighting, offset, time.current));
    ref.current.color.copy(ref.current.emissive);
  });
  return <meshStandardMaterial ref={ref} color={lit ? color : "#2a2d33"} emissive={lit ? color : "#000000"} emissiveIntensity={lit ? strength : 0} toneMapped={false} roughness={0.4} />;
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

export function Label({ category, name, position }: { category: Category; name: string; position: Vec3 }) {
  const { labels } = useScene();
  if (!labels) return null;
  return (
    <Html position={position} center zIndexRange={[20, 0]} className="pointer-events-none select-none">
      <div className="whitespace-nowrap rounded-md border border-white/15 bg-black/75 px-2 py-1 text-[11px] leading-tight text-white shadow-lg backdrop-blur">
        <span className="block text-[9px] font-semibold uppercase tracking-wider text-sky-300">{CATEGORY_LABELS[category]}</span>
        {name}
      </div>
    </Html>
  );
}
