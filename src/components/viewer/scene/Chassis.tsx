"use client";

import type { Style } from "@/lib/catalog";
import { CASE, PSU, REAR_FAN, SHROUD_FRONT, SHROUD_TOP, SLOT_PITCH } from "../layout";
import { Glow, Part, Repeat, useScene, type Vec3 } from "./context";
import { box, cylinder, panel, perforated, rbox, torus, type Hole } from "./geometry";

const { width: W, height: H, depth: D } = CASE;
const HALF_PI = Math.PI / 2;

/** Ouvertures du panneau arrière : ventilateur, connecteurs, emplacements, alimentation. */
const BACK_HOLES: Hole[] = [
  { x: REAR_FAN.x, y: REAR_FAN.y, radius: 57 },
  { x: -78, y: 124, w: 46, h: 160, r: 2 },
  { x: PSU.x, y: PSU.y, w: PSU.width - 4, h: PSU.height - 4, r: 2 },
  ...Array.from({ length: 7 }, (_, i) => ({ x: -38, y: 28 - i * SLOT_PITCH, w: 118, h: 13, r: 1.5 })),
];
const TOP_VENT = { x: 10, z: -20, w: 172, d: 330 };
const SHROUD_LENGTH = SHROUD_FRONT + D / 2 - 4;
const SHROUD_Z = (SHROUD_FRONT - D / 2 + 4) / 2;
const GROMMETS: Vec3[] = [[-102.5, 150, 58], [-102.5, 60, 58], [-102.5, -40, 58]];

/** Boîtier moyen-tour générique : structure en tôle, façade, vitre, cache d'alimentation. */
export function Chassis({ style, showPanel }: { style: Style; showPanel: boolean }) {
  const { mat, palette, layout } = useScene();
  const occupied = layout.gpu?.slots ?? 0;
  const covers = Array.from({ length: 7 }, (_, i) => i).filter((i) => i >= occupied).map((i) => ({ p: [-38, 28 - i * SLOT_PITCH, -D / 2] as Vec3 }));

  return (
    <group>
      {/* Structure en tôle */}
      <Part g={rbox(3, H, D, 1.5)} m={mat.chassis} p={[-W / 2, 0, 0]} />
      <Part g={rbox(W, 4, D, 2)} m={mat.chassis} p={[0, -H / 2, 0]} />
      <Part g={panel(W, H, 4, BACK_HOLES)} m={mat.chassis} p={[0, 0, -D / 2]} />
      <Part g={panel(W, D, 4, [{ x: TOP_VENT.x, y: TOP_VENT.z, w: TOP_VENT.w, h: TOP_VENT.d, r: 8 }], 6)} m={mat.chassis} p={[0, H / 2, 0]} r={[HALF_PI, 0, 0]} />
      <Part g={perforated(TOP_VENT.w, TOP_VENT.d)} m={mat.mesh} p={[TOP_VENT.x, H / 2 + 0.5, TOP_VENT.z]} r={[-HALF_PI, 0, 0]} shadow={false} />
      {/* Montants et longerons côté vitre */}
      <Part g={box(8, H - 8, 8)} m={mat.chassis} p={[W / 2 - 5, 0, D / 2 - 4]} />
      <Part g={box(8, H - 8, 8)} m={mat.chassis} p={[W / 2 - 5, 0, -D / 2 + 6]} />
      <Part g={box(8, 8, D - 8)} m={mat.chassis} p={[W / 2 - 5, H / 2 - 6, 0]} />
      <Part g={box(8, 8, D - 8)} m={mat.chassis} p={[W / 2 - 5, -H / 2 + 6, 0]} />

      {/* Plateau de la carte mère et passe-câbles */}
      <Part g={box(2, H - 8 - (SHROUD_TOP + H / 2), 376)} m={mat.chassis} p={[-104, (H / 2 - 4 + SHROUD_TOP) / 2, -38]} />
      {GROMMETS.map((p) => (
        <Part key={p[1]} g={rbox(3, 74, 22, 1.5)} m={mat.rubber} p={p} shadow={false} />
      ))}
      <Part g={rbox(3, 14, 56, 1.5)} m={mat.rubber} p={[-102.5, 224, -150]} shadow={false} />

      {/* Façade */}
      {palette.front === "solid" ? (
        <>
          <Part g={rbox(W, H, 9, 3)} m={mat.chassis} p={[0, 0, D / 2 + 3]} />
          <Part g={box(W - 70, 1.6, 0.8)} m={mat.steel} p={[0, -H / 2 + 44, D / 2 + 7.6]} shadow={false} />
          {[-1, 1].map((side) => (
            <Part key={side} g={box(1.5, H - 70, 10)} m={mat.dark} p={[side * (W / 2 + 0.2), 0, D / 2 - 8]} shadow={false} />
          ))}
        </>
      ) : (
        <>
          <Part g={panel(W, H, 7, [{ x: 0, y: 0, w: W - 34, h: H - 42, r: 8 }], 5)} m={mat.chassis} p={[0, 0, D / 2 + 2]} />
          <Part g={perforated(W - 34, H - 42, 5)} m={mat.mesh} p={[0, 0, D / 2 + 3]} shadow={false} />
        </>
      )}

      {/* Panneau arrière : grille du ventilateur et caches des emplacements libres */}
      <Part g={perforated(116, 116, 9)} m={mat.mesh} p={[REAR_FAN.x, REAR_FAN.y, -D / 2 - 1]} shadow={false} />
      {covers.length > 0 && <Repeat g={box(116, 11.5, 1.4)} m={mat.steel} items={covers} />}
      {!layout.board && <Part g={box(46, 160, 1)} m={mat.steel} p={[-78, 124, -D / 2]} shadow={false} />}

      {/* Cache d'alimentation */}
      <Part g={box(W - 10, 3, SHROUD_LENGTH)} m={mat.satin} p={[0, SHROUD_TOP, SHROUD_Z]} />
      <Part g={panel(SHROUD_LENGTH, 98, 3, [{ x: -(PSU.z - SHROUD_Z), y: PSU.y + 187, w: 112, h: 60, r: 4 }], 1)} m={mat.satin} p={[W / 2 - 8, -187, SHROUD_Z]} r={[0, HALF_PI, 0]} />
      <Part g={box(W - 10, 98, 3)} m={mat.satin} p={[0, -187, SHROUD_FRONT]} />
      <Part g={rbox(46, 2.4, 18, 1)} m={mat.rubber} p={[58, SHROUD_TOP + 1.6, 40]} shadow={false} />

      {/* Pieds */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Part g={rbox(W - 26, 15, 36, 5)} m={mat.chassis} p={[0, -H / 2 - 8, side * (D / 2 - 62)]} />
          <Part g={rbox(W - 40, 3, 28, 1.5)} m={mat.rubber} p={[0, -H / 2 - 16, side * (D / 2 - 62)]} shadow={false} />
        </group>
      ))}

      {/* Connectique du dessus */}
      <Part g={cylinder(8, 8, 2.4, 28)} m={mat.steel} p={[66, H / 2 + 2.6, 196]} shadow={false} />
      <mesh geometry={torus(8, 1.1, 32)} position={[66, H / 2 + 3.6, 196]} rotation={[HALF_PI, 0, 0]}>
        <Glow strength={1.8} />
      </mesh>
      {[36, 14].map((x) => (
        <Part key={x} g={rbox(14, 2, 6.5, 1)} m={mat.dark} p={[x, H / 2 + 2.2, 196]} shadow={false} />
      ))}
      <Part g={cylinder(3.2, 3.2, 2, 16)} m={mat.dark} p={[-6, H / 2 + 2.2, 196]} shadow={false} />

      {/* Panneau latéral en verre trempé, bords peints et vis moletées */}
      {showPanel && (
        <group>
          <mesh geometry={rbox(3, H - 6, D - 6, 1.2)} material={mat.glass} position={[W / 2 + 1.5, 0, 0]} renderOrder={10} />
          {[-1, 1].map((side) => (
            <Part key={side} g={box(0.5, 13, D - 6)} m={mat.dark} p={[W / 2 - 0.4, side * (H / 2 - 9.5), 0]} shadow={false} />
          ))}
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sy, sz]) => (
            <Part key={`${sy}${sz}`} g={cylinder(5.5, 5.5, 5, 18)} m={mat.steel} p={[W / 2 + 4.5, sy * (H / 2 - 14), sz * (D / 2 - 14)]} r={[0, 0, HALF_PI]} shadow={false} />
          ))}
        </group>
      )}

      {/* Bandeaux lumineux */}
      {palette.lit.strips && (
        <>
          <mesh geometry={rbox(3.5, 3.5, D - 90, 1.5)} position={[W / 2 - 14, H / 2 - 12, 0]}>
            <Glow offset={0.1} />
          </mesh>
          {style === "rgb" && (
            <mesh geometry={rbox(3.5, 3.5, SHROUD_LENGTH - 40, 1.5)} position={[W / 2 - 14, SHROUD_TOP + 3.4, SHROUD_Z]}>
              <Glow offset={0.6} />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}
