"use client";

import { useMemo } from "react";
import type { Build } from "@/lib/build";
import { ANCHOR, BOARD, RAM_SLOT_Z } from "../layout";
import { Glow, Label, Part, Pick, Repeat, useScene, useTint, type Vec3 } from "./context";
import { box, cylinder, rbox } from "./geometry";

const X = BOARD.x;
const { cpuY, cpuZ } = BOARD;
const HALF_PI = Math.PI / 2;

/** Carte mère générique : socket, étages d'alimentation, emplacements, connecteurs arrière. */
export function Motherboard({ build }: { build: Build }) {
  const { mat, palette, layout } = useScene();
  const board = layout.board;
  const heatsink = useTint(board?.colors?.heatsink, mat.heatsink, 0.82, 0.3);
  const accent = useTint(board?.colors?.accent, mat.satin, 0.4, 0.4);

  const details = useMemo(() => {
    if (!board) return null;
    const { bottom, front } = board;
    const capacitors: { p: Vec3; r: Vec3 }[] = [];
    for (let i = 0; i < 9; i++) capacitors.push({ p: [X + 5, cpuY + 39, cpuZ - 42 + i * 9.5], r: [0, 0, HALF_PI] });
    for (let i = 0; i < 6; i++) capacitors.push({ p: [X + 5, cpuY - 26 + i * 9.5, cpuZ - 41], r: [0, 0, HALF_PI] });
    const vrmFins = Array.from({ length: 10 }, (_, i) => ({ p: [X + 26, cpuY + 58, cpuZ - 50 + i * 10] as Vec3 }));
    const clips = RAM_SLOT_Z.flatMap((z) => [cpuY + 73, cpuY - 69].map((y) => ({ p: [X + 5, y, z] as Vec3 })));
    const usb = [190, 176, 162, 148].flatMap((y) => [-86, -70].map((x) => ({ p: [x, y, ANCHOR.back - 1.2] as Vec3 })));
    const screws = [[BOARD.top - 8, BOARD.back + 8], [BOARD.top - 8, front - 8], [bottom + 8, BOARD.back + 8], [bottom + 8, front - 8], [cpuY - 66, front - 8], [cpuY - 66, BOARD.back + 60]].map(
      ([y, z]) => ({ p: [X + 1.2, y, z] as Vec3, r: [0, 0, HALF_PI] as Vec3 }),
    );
    // Emplacements PCIe : le premier, renforcé, reçoit la carte graphique.
    const pcie = [28, 28 - 2 * 20.32, 28 - 4 * 20.32].filter((y) => y > bottom + 8);
    return { capacitors, vrmFins, clips, usb, screws, pcie };
  }, [board]);

  if (!board || !details || !build.motherboard) return null;
  const { height, depth, bottom, front } = board;

  return (
    <group>
     <Pick category="motherboard">
      <Part g={box(2, height, depth)} m={mat.pcb} p={[X - 1, BOARD.top - height / 2, BOARD.back + depth / 2]} />
      <Repeat g={cylinder(3, 3, 2.4, 10)} m={mat.steel} items={details.screws} />

      {/* Socket et son cadre de rétention */}
      <Part g={rbox(5, 58, 58, 2)} m={mat.steel} p={[X + 2.5, cpuY, cpuZ]} />
      <Part g={box(5.6, 42, 42)} m={mat.dark} p={[X + 2.8, cpuY, cpuZ]} shadow={false} />
      {/* Liseré à la couleur d'accent du modèle */}
      <Part g={box(1, 3, 70)} m={accent} p={[X + 22.6, cpuY + 58, cpuZ - 5]} shadow={false} />

      {/* Étages d'alimentation : dissipateurs à ailettes et condensateurs */}
      <Part g={rbox(22, 22, 100, 2)} m={heatsink} p={[X + 11, cpuY + 58, cpuZ - 5]} />
      <Repeat g={box(8, 22, 5)} m={heatsink} items={details.vrmFins} />
      <Repeat g={cylinder(3.3, 3.3, 10, 10)} m={mat.dark} items={details.capacitors} />

      {/* Carénage des connecteurs arrière */}
      <Part g={rbox(40, 134, 40, 6)} m={mat.satin} p={[X + 20, cpuY + 10, BOARD.back + 21]} />
      <mesh geometry={rbox(1.6, 92, 3, 0.8)} position={[X + 40.4, cpuY + 10, BOARD.back + 30]}>
        <Glow on={palette.lit.cooler} offset={0.25} />
      </mesh>
      <Part g={box(40, 150, 14)} m={mat.dark} p={[X + 22, 124, BOARD.back - 9]} shadow={false} />
      <Part g={box(46, 160, 0.8)} m={mat.steel} p={[-78, 124, ANCHOR.back - 0.2]} shadow={false} />
      <Repeat g={box(13, 6, 2)} m={mat.dark} items={details.usb} />
      <Part g={rbox(17, 14, 2, 1)} m={mat.dark} p={[-78, 124, ANCHOR.back - 1.2]} shadow={false} />
      {[104, 92, 80].map((y) => (
        <Part key={y} g={cylinder(3.2, 3.2, 2, 14)} m={mat.gold} p={[-78, y, ANCHOR.back - 1.2]} r={[HALF_PI, 0, 0]} shadow={false} />
      ))}

      {/* Emplacements mémoire */}
      {RAM_SLOT_Z.map((z) => (
        <Part key={z} g={box(5, 140, 6.4)} m={mat.slot} p={[X + 2.5, cpuY + 2, z]} shadow={false} />
      ))}
      <Repeat g={box(10, 6, 7)} m={mat.plastic} items={details.clips} />

      {/* Connecteurs d'alimentation 24 et 8 broches */}
      <Part g={rbox(14, 54, 9, 1)} m={mat.dark} p={[X + 7, cpuY - 16, front - 8]} />
      <Part g={rbox(12, 12, 21, 1)} m={mat.dark} p={[X + 6, BOARD.top - 9, -150]} />

      {/* Emplacements PCIe */}
      {details.pcie.map((y, i) => (
        <Part key={y} g={box(11, 8, 92)} m={i === 0 ? mat.nickel : mat.slot} p={[X + 5.5, y, BOARD.back + 70]} shadow={false} />
      ))}

      {/* Dissipateurs M.2 et chipset */}
      {bottom < -60 && <Part g={rbox(5, 24, 86, 2)} m={heatsink} p={[X + 2.5, -34, cpuZ + 34]} />}
      <Part g={rbox(10, 64, 64, 4)} m={heatsink} p={[X + 5, bottom + 52, front - 48]} />
      <mesh geometry={rbox(1.2, 3, 44, 0.6)} position={[X + 10.4, bottom + 36, front - 48]}>
        <Glow on={palette.lit.cooler} offset={0.85} />
      </mesh>
      {bottom < 0 && <Part g={cylinder(10, 10, 3, 24)} m={mat.nickel} p={[X + 1.5, 4, cpuZ + 96]} r={[0, 0, HALF_PI]} shadow={false} />}

      <Label category="motherboard" name={build.motherboard.name} position={[X + 14, bottom + 52, front - 30]} />
     </Pick>
      <Pick category={build.storage ? "storage" : "motherboard"}>
        <Part g={rbox(5, 24, 86, 2)} m={heatsink} p={[X + 2.5, 64, cpuZ + 34]} />
      </Pick>
      {layout.cpu && !layout.cooler && (
        <Pick category="cpu">
          <Part g={rbox(5, 38, 38, 1.5)} m={mat.nickel} p={[X + 6.5, cpuY, cpuZ]} />
        </Pick>
      )}
      {build.cpu && <Label category="cpu" name={build.cpu.name} position={[X + 30, cpuY - 72, cpuZ - 30]} />}
      {build.storage && <Label category="storage" name={build.storage.name} position={[X + 8, 64, cpuZ + 78]} />}
    </group>
  );
}
