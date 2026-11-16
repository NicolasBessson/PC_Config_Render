"use client";

import { useEffect, useMemo } from "react";
import { BOARD, GPU_BACK, GPU_TOP, GPU_WIDTH, SHROUD_TOP } from "../layout";
import { useScene, type Vec3 } from "./context";
import { tube } from "./geometry";

const X = BOARD.x;

/** Câblage simplifié : 24 broches, 8 broches processeur et alimentation de la carte graphique. */
export function Cables() {
  const { mat, layout } = useScene();
  const { board, gpu, cables } = layout;

  const geometries = useMemo(() => {
    const list: ReturnType<typeof tube>[] = [];
    if (board && cables.atx24) {
      const y = BOARD.cpuY - 16, front = board.front;
      for (const dy of [-13, 0, 13]) {
        list.push(tube([[X + 12, y + dy, front - 8], [X + 34, y + dy, front - 4], [X + 36, y + dy, front + 22], [X - 4, y + dy, front + 28]], 5.4));
      }
    }
    if (board && cables.eps) {
      list.push(tube([[X + 11, BOARD.top - 9, -150], [X + 24, BOARD.top + 2, -150], [X + 20, BOARD.top + 17, -150], [X - 4, BOARD.top + 18, -150]], 4.6));
    }
    if (gpu && cables.gpu > 0) {
      const x1 = X + GPU_WIDTH;
      const zc = GPU_BACK + 4 + (gpu.length - 4) / 2 + (gpu.length - 4) * 0.18;
      const radius = gpu.connector === "8pin" ? 4.6 : 6;
      for (let i = 0; i < cables.gpu; i++) {
        const dz = (i - (cables.gpu - 1) / 2) * 12;
        const points: Vec3[] = [[x1, GPU_TOP - 8.5, zc + dz], [x1 + 26, GPU_TOP - 11, zc + dz + 3], [x1 + 31, GPU_TOP - 66, zc + dz + 12], [66, SHROUD_TOP + 34, zc + dz + 22], [60, SHROUD_TOP - 3, zc + dz + 24]];
        list.push(tube(points, radius));
      }
    }
    return list;
  }, [board, gpu, cables]);

  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries]);

  return (
    <group>
      {geometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={mat.cable} castShadow />
      ))}
    </group>
  );
}
