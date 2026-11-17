"use client";

import type { Build } from "@/lib/build";
import { BOARD, RAM_SLOT_Z } from "../layout";
import { Glow, Label, Part, Pick, useScene, useTint } from "./context";
import { useMemo } from "react";
import * as THREE from "three";
import { RAM_MODELS, type RamModel } from "../models";
import { box, ramSpreader, rbox } from "./geometry";
import { GltfModel } from "./GltfModel";

/** Pose un modèle de barrette dans son emplacement : `anchor` (point du fichier) arrive sur la carte mère, en (y, z). */
function ramMatrix(model: RamModel, y: number, z: number) {
  const [bx, by, bz] = model.basis.map((axis) => new THREE.Vector3(...axis).multiplyScalar(model.unit));
  const matrix = new THREE.Matrix4().makeBasis(bx, by, bz);
  const anchor = new THREE.Vector3(...model.anchor).applyMatrix4(matrix);
  return matrix.setPosition(BOARD.x - anchor.x, y - anchor.y, z - anchor.z);
}

/** Barrettes de mémoire : une par module du kit, dans les emplacements recommandés. */
export function Ram({ build }: { build: Build }) {
  const { mat, layout } = useScene();
  const ram = layout.ram;
  const spreader = useTint(ram?.color, mat.heatsink, 0.7, 0.35);
  const model = ram?.model ? RAM_MODELS[ram.model] : null;
  const matrices = useMemo(() => (model && ram ? ram.slots.map((slot) => ramMatrix(model, BOARD.cpuY + 2, RAM_SLOT_Z[slot])) : []), [ram, model]);
  if (!ram || !build.ram) return null;
  // Seul un kit réellement RGB s'illumine.
  const lit = ram.rgb;
  const y = BOARD.cpuY + 2;
  return (
    <Pick category="ram">
      {ram.slots.map((slot, i) => {
        const z = RAM_SLOT_Z[slot];
        const generic = (
          <group key={slot}>
            <Part g={box(6, 133, 1.4)} m={mat.pcb} p={[BOARD.x + 3, y, z]} shadow={false} />
            <Part g={ramSpreader(ram.height)} m={spreader} p={[BOARD.x, y, z]} />
            {lit && (
              <mesh geometry={rbox(7, 110, 6.6, 2.4)} position={[BOARD.x + ram.height - 4.5, y, z]}>
                <Glow offset={0.45 + i * 0.08} />
              </mesh>
            )}
          </group>
        );
        return model ? <GltfModel key={slot} file={model.file} matrix={matrices[i]} glow={lit ? model.glow : undefined} glowOffset={0.45 + i * 0.08} fallback={generic} /> : generic;
      })}
      <Label category="ram" name={build.ram.name} position={[BOARD.x + ram.height + 6, y - 44, RAM_SLOT_Z[3] + 10]} />
    </Pick>
  );
}
