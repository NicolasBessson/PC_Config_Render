"use client";

import { useMemo } from "react";
import type { Build } from "@/lib/build";
import { BOARD, CASE, GPU_BACK, GPU_TOP, GPU_WIDTH, SLOT_PITCH } from "../layout";
import { Glow, Label, Part, Repeat, useScene, type Vec3 } from "./context";
import { box, panel, rbox, torus } from "./geometry";
import { Rotor } from "./Fan";

const HALF_PI = Math.PI / 2;

/**
 * Carte graphique générique, au gabarit du catalogue : longueur, épaisseur
 * et nombre de ventilateurs. L'apparence ne reproduit aucun modèle précis.
 */
export function Gpu({ build }: { build: Build }) {
  const { mat, layout } = useScene();
  const gpu = layout.gpu;

  const shape = useMemo(() => {
    if (!gpu) return null;
    const x0 = BOARD.x + 4, x1 = BOARD.x + GPU_WIDTH;
    const width = x1 - x0, cx = (x0 + x1) / 2;
    const length = gpu.length - 4, z0 = GPU_BACK + 4, zc = z0 + length / 2;
    const top = GPU_TOP, bottom = top - gpu.thickness;
    const fanRadius = Math.min(47, length / gpu.fans / 2 - 7, width / 2 - 9);
    const fanZ = Array.from({ length: gpu.fans }, (_, i) => z0 + (length / gpu.fans) * (i + 0.5));
    const finHeight = gpu.thickness - 24;
    const fins: { p: Vec3 }[] = [];
    for (let z = z0 + 8; z < z0 + length - 8; z += 3.4) fins.push({ p: [cx, bottom + 18 + finHeight / 2, z] });
    return { x1, width, cx, length, z0, zc, top, bottom, fanRadius, fanZ, finHeight, fins };
  }, [gpu]);

  if (!gpu || !shape || !build.gpu) return null;
  const { x1, width, cx, length, z0, zc, top, bottom, fanRadius, fanZ, finHeight, fins } = shape;
  const thickness = gpu.thickness;
  const bracketHeight = gpu.slots * SLOT_PITCH - 6;
  const bracketY = 28 - ((gpu.slots - 1) * SLOT_PITCH) / 2;
  const connectorZ = zc + length * 0.18;

  return (
    <group>
      {/* Plaque arrière, avec son ouverture de ventilation */}
      <Part g={rbox(width, 2.6, length, 1.2)} m={mat.heatsink} p={[cx, top - 1.3, zc]} />
      <Part g={box(width - 34, 0.6, length * 0.2)} m={mat.dark} p={[cx, top + 0.1, z0 + length * 0.85]} shadow={false} />
      <Part g={box(width * 0.55, 0.5, 2)} m={mat.dark} p={[cx - 12, top + 0.1, z0 + length * 0.3]} shadow={false} />
      {/* Circuit imprimé et dissipateur à ailettes */}
      <Part g={box(width - 6, 1.6, length * 0.74)} m={mat.pcb} p={[cx - 3, top - 4.4, z0 + length * 0.37]} shadow={false} />
      <Repeat g={box(width - 12, finHeight, 1.1)} m={mat.fin} items={fins} />
      {/* Carénage : dessous percé pour les ventilateurs, bandeau latéral, embout */}
      <Part g={panel(width, length, 3, fanZ.map((z) => ({ x: 0, y: z - zc, radius: fanRadius })), 4)} m={mat.plastic} p={[cx, bottom + 1.5, zc]} r={[HALF_PI, 0, 0]} />
      <Part g={rbox(3, thickness * 0.42, length, 1.4)} m={mat.plastic} p={[x1 - 1.5, bottom + thickness * 0.21, zc]} />
      <Part g={rbox(3.6, 6, length * 0.6, 1.2)} m={mat.satin} p={[x1 - 1.2, bottom + thickness * 0.42, zc - length * 0.12]} shadow={false} />
      <Part g={rbox(3, 5, length, 1.2)} m={mat.heatsink} p={[x1 - 1.5, top - 5.2, zc]} shadow={false} />
      <Part g={rbox(width, thickness - 3, 4, 1.5)} m={mat.plastic} p={[cx, (top + bottom) / 2, z0 + length - 2]} />
      <Part g={box(width, thickness - 6, 8)} m={mat.plastic} p={[cx, (top + bottom) / 2, GPU_BACK]} shadow={false} />
      {/* Signature lumineuse sur la tranche */}
      <mesh geometry={rbox(1.4, 5, length * 0.3, 0.7)} position={[x1 + 0.5, bottom + thickness * 0.2, zc + length * 0.06]}>
        <Glow offset={0.75} />
      </mesh>
      {/* Ventilateurs */}
      {fanZ.map((z) => (
        <group key={z} position={[cx, bottom + 9, z]} rotation={[HALF_PI, 0, 0]}>
          <Rotor size={fanRadius * 2 + 8} speed={7} blades={11} />
          <mesh geometry={torus(fanRadius, 1.6, 40)} material={mat.satin} position={[0, 0, 9]} />
        </group>
      ))}
      {/* Équerre et sorties vidéo, visibles depuis l'arrière */}
      <Part g={box(118, bracketHeight, 1.5)} m={mat.steel} p={[-38, bracketY, -CASE.depth / 2 + 1]} shadow={false} />
      {[-82, -60, -38, -14].map((x) => (
        <Part key={x} g={rbox(17, 6.5, 3, 1)} m={mat.dark} p={[x, 28, -CASE.depth / 2 - 0.6]} shadow={false} />
      ))}
      {gpu.slots > 1 && [3.5, -3.5].map((dy) => <Part key={dy} g={box(96, 2.6, 1)} m={mat.dark} p={[-38, 28 - SLOT_PITCH + dy, -CASE.depth / 2 - 0.2]} shadow={false} />)}
      {/* Connecteur d'alimentation */}
      <Part g={rbox(9, 9, gpu.connector === "8pin" ? 13 * gpu.cables : 24, 1)} m={mat.dark} p={[x1 - 4.5, top - 8.5, connectorZ]} shadow={false} />

      <Label category="gpu" name={`${build.gpu.chipset} · ${build.gpu.lengthMm} mm`} position={[x1 + 8, (top + bottom) / 2, z0 + length - 34]} />
    </group>
  );
}
