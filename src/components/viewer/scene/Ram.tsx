"use client";

import type { Build } from "@/lib/build";
import { BOARD, RAM_SLOT_Z } from "../layout";
import { Glow, Label, Part, Pick, useScene, useTint } from "./context";
import { useMemo } from "react";
import * as THREE from "three";
import { RAM_MODELS } from "../models";
import { box, ramSpreader, rbox } from "./geometry";
import { GltfModel } from "./GltfModel";

/*
 * Placement du modèle Vengeance LPX : la longueur du fichier (axe z) devient la longueur de la barrette (y),
 * son épaisseur (y) devient z, et sa hauteur (−x, contacts côté +x) s'éloigne de la carte mère.
 * Échelle : 133 mm de long pour 4,569 unités.
 */
const LPX_SCALE = 133 / 4.569;
function lpxMatrix(y: number, z: number) {
  const k = LPX_SCALE;
  const matrix = new THREE.Matrix4().makeBasis(new THREE.Vector3(-k, 0, 0), new THREE.Vector3(0, 0, -k), new THREE.Vector3(0, k, 0));
  return matrix.setPosition(BOARD.x - 0.538 * k, y + 1.0365 * k, z + 1.522 * k);
}

/** Barrettes de mémoire : une par module du kit, dans les emplacements recommandés. */
export function Ram({ build }: { build: Build }) {
  const { mat, layout } = useScene();
  const ram = layout.ram;
  const spreader = useTint(ram?.color, mat.heatsink, 0.7, 0.35);
  const matrices = useMemo(() => (ram?.slots ?? []).map((slot) => lpxMatrix(BOARD.cpuY + 2, RAM_SLOT_Z[slot])), [ram]);
  if (!ram || !build.ram) return null;
  // Seul un kit réellement RGB s'illumine.
  const lit = ram.rgb;
  const y = BOARD.cpuY + 2;
  const model = ram.model ? RAM_MODELS[ram.model] : null;
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
        return model ? <GltfModel key={slot} file={model.file} matrix={matrices[i]} fallback={generic} /> : generic;
      })}
      <Label category="ram" name={build.ram.name} position={[BOARD.x + ram.height + 6, y - 44, RAM_SLOT_Z[3] + 10]} />
    </Pick>
  );
}
