"use client";

import type { Build } from "@/lib/build";
import { BOARD, RAM_SLOT_Z } from "../layout";
import { Glow, Label, Part, Pick, useScene, useTint } from "./context";
import { box, ramSpreader, rbox } from "./geometry";

/** Barrettes de mémoire : une par module du kit, dans les emplacements recommandés. */
export function Ram({ build }: { build: Build }) {
  const { mat, layout } = useScene();
  const ram = layout.ram;
  const spreader = useTint(ram?.color, mat.heatsink, 0.7, 0.35);
  if (!ram || !build.ram) return null;
  // Seul un kit réellement RGB s'illumine.
  const lit = ram.rgb;
  const y = BOARD.cpuY + 2;
  return (
    <Pick category="ram">
      {ram.slots.map((slot, i) => {
        const z = RAM_SLOT_Z[slot];
        return (
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
      })}
      <Label category="ram" name={build.ram.name} position={[BOARD.x + ram.height + 6, y - 44, RAM_SLOT_Z[3] + 10]} />
    </Pick>
  );
}
