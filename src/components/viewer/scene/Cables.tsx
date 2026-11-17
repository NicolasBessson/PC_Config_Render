"use client";

import { useEffect, useMemo } from "react";
import type * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BOARD, GPU_BACK, GPU_TOP } from "../layout";
import { Part, useScene, type Vec3 } from "./context";
import { rbox, tube } from "./geometry";

const X = BOARD.x;

interface Comb {
  p: Vec3;
  size: Vec3;
}

/**
 * Nappe de fils gainés : les fils suivent le même trajet, décalés côte à
 * côte sur deux rangées, comme sur un câble à gaine individuelle.
 * `axis` est la direction dans laquelle les fils sont alignés.
 */
function ribbon(path: Vec3[], wires: number, axis: "y" | "z", pitch = 4.2, radius = 1.9): THREE.TubeGeometry[] {
  const perRow = Math.ceil(wires / 2);
  const list: THREE.TubeGeometry[] = [];
  for (let i = 0; i < wires; i++) {
    const row = i < perRow ? 0 : 1;
    const lane = (i % perRow) - (perRow - 1) / 2;
    list.push(
      tube(
        path.map(([x, y, z], step) => {
          // La seconde rangée passe derrière la première, sauf au connecteur où elles se rejoignent.
          const depth = row * pitch * (step === 0 ? 0.6 : 1);
          return axis === "y" ? [x - depth, y + lane * pitch, z] : [x - depth * 0.4, y - depth, z + lane * pitch];
        }) as Vec3[],
        radius,
        6,
      ),
    );
  }
  return list;
}

/** Câblage gainé fil par fil, avec ses peignes : 24 broches, 8 broches processeur et carte graphique. */
export function Cables() {
  const { mat, layout } = useScene();
  const { board, gpu, cables, frame, anchors } = layout;

  const { harness, combs } = useMemo(() => {
    const wires: THREE.TubeGeometry[] = [];
    const combs: Comb[] = [];
    if (board && cables.atx24) {
      const y = anchors.atxY, front = board.front;
      wires.push(...ribbon([[X + 12, y, front - 8], [X + 34, y, front - 4], [X + 36, y, front + 22], [X - 2, y, front + 28]], 12, "y"));
      combs.push({ p: [X + 37, y, front + 9], size: [3, 30, 5] });
    }
    if (board && cables.eps) {
      wires.push(...ribbon([[X + 11, BOARD.top - 9, -150], [X + 24, BOARD.top + 2, -150], [X + 20, BOARD.top + 17, -150], [X - 2, BOARD.top + 18, -150]], 8, "z"));
    }
    if (gpu && cables.gpu > 0) {
      const x1 = X + gpu.width;
      const zc = GPU_BACK + 4 + (gpu.length - 4) / 2 + (gpu.length - 4) * 0.18;
      const floor = frame.shroudTop;
      const drop = Math.min(x1 + 40, frame.right - 30);
      const count = gpu.connector === "8pin" ? 8 : 12;
      for (let i = 0; i < cables.gpu; i++) {
        const dz = (i - (cables.gpu - 1) / 2) * 20;
        wires.push(...ribbon([[x1, GPU_TOP - 8.5, zc + dz], [x1 + 26, GPU_TOP - 11, zc + dz + 3], [x1 + 31, GPU_TOP - 66, zc + dz + 12], [drop, floor + 34, zc + dz + 22], [drop - 6, floor - 3, zc + dz + 24]], count, "z"));
        const width = Math.ceil(count / 2) * 4.2 + 4;
        combs.push({ p: [x1 + 31.5, GPU_TOP - 62, zc + dz + 11.5], size: [10, 3.2, width] });
        combs.push({ p: [(x1 + 31 + drop) / 2 + 2, (GPU_TOP - 66 + floor + 34) / 2, zc + dz + 17], size: [10, 3.2, width] });
      }
    }
    // Tous les fils en un seul maillage : un seul appel de rendu, quel que soit leur nombre.
    const harness = wires.length > 0 ? mergeGeometries(wires) : null;
    wires.forEach((geometry) => geometry.dispose());
    return { harness, combs };
  }, [board, gpu, cables, frame, anchors]);

  useEffect(() => () => harness?.dispose(), [harness]);

  return (
    <group>
      {harness && <mesh geometry={harness} material={mat.cable} castShadow />}
      {combs.map((comb, i) => (
        <Part key={i} g={rbox(...comb.size, 1)} m={mat.dark} p={comb.p} shadow={false} />
      ))}
    </group>
  );
}
