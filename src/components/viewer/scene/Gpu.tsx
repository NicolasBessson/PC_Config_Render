"use client";

import { useMemo } from "react";
import type { Build } from "@/lib/build";
import { ANCHOR, BOARD, GPU_BACK, GPU_TOP, SLOT_PITCH } from "../layout";
import { Glow, Label, Part, Pick, Repeat, useScene, useTint, type Vec3 } from "./context";
import * as THREE from "three";
import { GPU_MODELS } from "../models";
import { box, cylinder, panel, rbox, torus } from "./geometry";
import { GltfModel } from "./GltfModel";
import { Rotor } from "./Fan";

const HALF_PI = Math.PI / 2;

/**
 * Carte graphique générique, au gabarit du catalogue : longueur, épaisseur
 * et nombre de ventilateurs. L'apparence ne reproduit aucun modèle précis.
 */
export function Gpu({ build }: { build: Build }) {
  const { mat, layout } = useScene();
  const gpu = layout.gpu;
  // Couleurs propres au modèle choisi ; à défaut, celles du style.
  const shroud = useTint(gpu?.colors?.shroud, mat.plastic, 0.1, 0.55);
  const accent = useTint(gpu?.colors?.accent, mat.satin, 0.5, 0.35);
  const backplate = useTint(gpu?.colors?.backplate, mat.heatsink, 0.75, 0.35);

  const shape = useMemo(() => {
    if (!gpu) return null;
    const x0 = BOARD.x + 4, x1 = BOARD.x + gpu.width;
    const width = x1 - x0, cx = (x0 + x1) / 2;
    const length = gpu.length - 4, z0 = GPU_BACK + 4, zc = z0 + length / 2;
    const top = GPU_TOP, bottom = top - gpu.thickness;
    const fanRadius = Math.min(47, length / gpu.fans / 2 - 7, width / 2 - 9);
    const fanZ = Array.from({ length: gpu.fans }, (_, i) => z0 + (length / gpu.fans) * (i + 0.5));
    const finHeight = gpu.thickness - 24;
    const fins: { p: Vec3 }[] = [];
    for (let z = z0 + 8; z < z0 + length - 8; z += 3.4) fins.push({ p: [cx, bottom + 18 + finHeight / 2, z] });
    // Vis de la plaque arrière et nervures obliques du carénage, entre les ventilateurs.
    const screws: { p: Vec3 }[] = [];
    for (const kx of [-0.36, 0.36]) for (const kz of [0.08, 0.36, 0.64, 0.92]) screws.push({ p: [cx + kx * width, top + 0.4, z0 + length * kz] });
    const ribs: { p: Vec3; r: Vec3 }[] = [];
    for (let i = 0; i <= gpu.fans; i++) {
      const z = z0 + (length / gpu.fans) * i;
      if (z < z0 + 12 || z > z0 + length - 12) continue;
      for (const side of [-1, 1]) ribs.push({ p: [cx + side * width * 0.2, bottom - 0.6, z], r: [0, side * 0.6, 0] });
    }
    const vents: { p: Vec3; r: Vec3 }[] = [];
    for (let z = z0 + length * 0.62; z < z0 + length - 14; z += 9) vents.push({ p: [x1 + 0.2, bottom + gpu.thickness * 0.2, z], r: [0.5, 0, 0] });
    return { x1, width, cx, length, z0, zc, top, bottom, fanRadius, fanZ, finHeight, fins, screws, ribs, vents };
  }, [gpu]);

  const model = gpu?.model ? GPU_MODELS[gpu.model] : null;
  // Modèle réel : longueur du fichier (z, équerre côté +z) vers l'arrière du boîtier, hauteur en s'éloignant de la
  // carte mère, épaisseur vers le bas (ventilateurs en dessous). Chaque axe est mis à la cote du catalogue.
  const matrix = useMemo(() => {
    if (!gpu || !model) return null;
    const kl = gpu.length / model.size.length, kh = (gpu.width - 4) / model.size.height, kt = gpu.thickness / model.size.thickness;
    const x = BOARD.x + 4 - kh * model.edges.board, z = GPU_BACK + kl * model.edges.bracketZ;
    const length = new THREE.Vector3(0, 0, -kl);
    // Dans les deux cas le déterminant est négatif : la scène étant affichée en miroir, le modèle retrouve son sens réel.
    return model.thicknessAxis === "x"
      ? new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -kt, 0), new THREE.Vector3(kh, 0, 0), length).setPosition(x, GPU_TOP + kt * model.edges.backplate, z)
      : new THREE.Matrix4().makeBasis(new THREE.Vector3(kh, 0, 0), new THREE.Vector3(0, kt, 0), length).setPosition(x, GPU_TOP - kt * model.edges.backplate, z);
  }, [gpu, model]);

  if (!gpu || !shape || !build.gpu) return null;
  const { x1, width, cx, length, z0, zc, top, bottom, fanRadius, fanZ, finHeight, fins, screws, ribs, vents } = shape;
  const thickness = gpu.thickness;
  const bracketHeight = gpu.slots * SLOT_PITCH - 6;
  const bracketY = 28 - ((gpu.slots - 1) * SLOT_PITCH) / 2;
  const connectorZ = zc + length * 0.18;

  const generic = (
    <>
      {/* Plaque arrière, avec son ouverture de ventilation */}
      <Part g={rbox(width, 2.6, length, 1.2)} m={backplate} p={[cx, top - 1.3, zc]} />
      <Part g={box(width - 34, 0.6, length * 0.2)} m={mat.dark} p={[cx, top + 0.1, z0 + length * 0.85]} shadow={false} />
      <Part g={box(width * 0.55, 0.5, 2)} m={mat.dark} p={[cx - 12, top + 0.1, z0 + length * 0.3]} shadow={false} />
      <Repeat g={cylinder(2.2, 2.2, 1.4, 10)} m={mat.steel} items={screws} />
      {ribs.length > 0 && <Repeat g={rbox(width * 0.5, 2.2, 5, 1)} m={accent} items={ribs} />}
      {/* Circuit imprimé et dissipateur à ailettes */}
      <Part g={box(width - 6, 1.6, length * 0.74)} m={mat.pcb} p={[cx - 3, top - 4.4, z0 + length * 0.37]} shadow={false} />
      <Repeat g={box(width - 12, finHeight, 1.1)} m={mat.fin} items={fins} />
      {/* Carénage : dessous percé pour les ventilateurs, bandeau latéral, embout */}
      <Part g={panel(width, length, 3, fanZ.map((z) => ({ x: 0, y: z - zc, radius: fanRadius })), 4)} m={shroud} p={[cx, bottom + 1.5, zc]} r={[HALF_PI, 0, 0]} />
      <Part g={rbox(3, thickness * 0.42, length, 1.4)} m={shroud} p={[x1 - 1.5, bottom + thickness * 0.21, zc]} />
      {/* Arêtes chanfreinées du carénage, côté vitre et côté carte mère */}
      <Part g={rbox(9, 2.6, length - 6, 1.2)} m={shroud} p={[x1 - 4, bottom + 3.4, zc]} r={[0, 0, Math.PI / 4]} />
      <Part g={rbox(9, 2.6, length - 6, 1.2)} m={shroud} p={[x1 - width + 4, bottom + 3.4, zc]} r={[0, 0, -Math.PI / 4]} />
      {/* Ouïes obliques du bandeau latéral */}
      <Repeat g={box(0.8, thickness * 0.24, 3)} m={mat.dark} items={vents} />
      <Part g={rbox(3.6, 6, length * 0.6, 1.2)} m={accent} p={[x1 - 1.2, bottom + thickness * 0.42, zc - length * 0.12]} shadow={false} />
      <Part g={rbox(3, 5, length, 1.2)} m={backplate} p={[x1 - 1.5, top - 5.2, zc]} shadow={false} />
      <Part g={rbox(width, thickness - 3, 4, 1.5)} m={shroud} p={[cx, (top + bottom) / 2, z0 + length - 2]} />
      <Part g={box(width, thickness - 6, 8)} m={shroud} p={[cx, (top + bottom) / 2, GPU_BACK]} shadow={false} />
      {/* Signature lumineuse sur la tranche */}
      <mesh geometry={rbox(1.4, 5, length * 0.3, 0.7)} position={[x1 + 0.5, bottom + thickness * 0.2, zc + length * 0.06]}>
        <Glow offset={0.75} />
      </mesh>
      {/* Ventilateurs */}
      {fanZ.map((z) => (
        <group key={z} position={[cx, bottom + 9, z]} rotation={[HALF_PI, 0, 0]}>
          <Rotor size={fanRadius * 2 + 8} speed={7} blades={11} />
          <mesh geometry={torus(fanRadius, 1.6, 40)} material={accent} position={[0, 0, 9]} />
          <mesh geometry={torus(fanRadius + 3.5, 2.4, 40)} material={shroud} position={[0, 0, 7.5]} castShadow />
        </group>
      ))}
      {/* Équerre et sorties vidéo, visibles depuis l'arrière */}
      <Part g={box(118, bracketHeight, 1.5)} m={mat.steel} p={[-38, bracketY, ANCHOR.back + 1]} shadow={false} />
      {[-82, -60, -38, -14].map((x) => (
        <Part key={x} g={rbox(17, 6.5, 3, 1)} m={mat.dark} p={[x, 28, ANCHOR.back - 0.6]} shadow={false} />
      ))}
      {gpu.slots > 1 && [3.5, -3.5].map((dy) => <Part key={dy} g={box(96, 2.6, 1)} m={mat.dark} p={[-38, 28 - SLOT_PITCH + dy, ANCHOR.back - 0.2]} shadow={false} />)}
      {/* Connecteur d'alimentation */}
      <Part g={rbox(9, 9, gpu.connector === "8pin" ? 13 * gpu.cables : 24, 1)} m={mat.dark} p={[x1 - 4.5, top - 8.5, connectorZ]} shadow={false} />

    </>
  );
  return (
    <Pick category="gpu">
      {model && matrix ? <GltfModel file={model.file} matrix={matrix} fallback={generic} /> : generic}
      <Label category="gpu" name={`${build.gpu.chipset} · ${build.gpu.lengthMm} mm`} position={[x1 + 8, (top + bottom) / 2, z0 + length - 34]} />
    </Pick>
  );
}
