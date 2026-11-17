"use client";

import { useMemo } from "react";
import type { Build } from "@/lib/build";
import type { Style } from "@/lib/catalog";
import { ANCHOR, PSU_SIZE, REAR_FAN, SLOT_PITCH } from "../layout";
import { Glow, Label, Part, Pick, Repeat, useScene, type Vec3 } from "./context";
import * as THREE from "three";
import { CASE_MODELS } from "../models";
import { box, cylinder, panel, perforated, rbox, torus, type Hole } from "./geometry";
import { GltfModel } from "./GltfModel";

const HALF_PI = Math.PI / 2;

/**
 * Boîtier générique aux dimensions extérieures du boîtier choisi : structure
 * en tôle, façade, vitre, cache d'alimentation. Il n'en reproduit pas le dessin exact.
 */
function ParametricChassis({ build, style, showPanel }: { build: Build; style: Style; showPanel: boolean }) {
  const { mat, palette, layout } = useScene();
  const f = layout.frame;
  const { width: W, height: H, depth: D, cx, cy, cz } = f;
  const front = f.frontStyle ?? palette.front;
  const occupied = layout.gpu?.slots ?? 0;
  const covers = Array.from({ length: f.slots }, (_, i) => i).filter((i) => i >= occupied).map((i) => ({ p: [-38, 28 - i * SLOT_PITCH, ANCHOR.back] as Vec3 }));

  // Ouvertures du panneau arrière, en coordonnées centrées sur le boîtier.
  const backHoles: Hole[] = [
    { x: REAR_FAN.x - cx, y: REAR_FAN.y - cy, radius: layout.fans.rearSize / 2 - 3 },
    { x: -78 - cx, y: 124 - cy, w: 46, h: 160, r: 2 },
    ...Array.from({ length: f.slots }, (_, i) => ({ x: -38 - cx, y: 28 - i * SLOT_PITCH - cy, w: 118, h: 13, r: 1.5 })),
  ];
  if (f.psu.mount === "rear") backHoles.push({ x: f.psu.x - cx, y: f.psu.y - cy, w: PSU_SIZE.width - 4, h: PSU_SIZE.height - 4, r: 2 });

  const vent = { w: W - 58, d: D - 130 };
  const trayHeight = ANCHOR.top - 4 - f.shroudTop;
  const shroudLength = f.shroudFront - ANCHOR.back - 4;
  const shroudZ = (f.shroudFront + ANCHOR.back + 4) / 2;
  const shroudHeight = f.shroudTop - f.bottom - 4;
  const shroudY = f.bottom + 4 + shroudHeight / 2;
  const grommets = [150, 60, -40].filter((y) => y - 40 > f.shroudTop);
  const rearGrille = layout.fans.rearSize - 4;
  // Ouïes du cache d'alimentation, au-dessus de l'alimentation.
  const shroudVents = Array.from({ length: 9 }, (_, i) => ({ p: [cx - 20, f.shroudTop + 1.6, ANCHOR.back + 36 + i * 11] as Vec3 }));
  // Vis visibles à l'arrière : fixation de l'alimentation et du ventilateur.
  const half = layout.fans.rearSize / 2 - 7.5;
  const rearScrews: { p: Vec3; r: Vec3 }[] = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => ({ p: [REAR_FAN.x + sx * half, REAR_FAN.y + sy * half, ANCHOR.back - 2.4], r: [HALF_PI, 0, 0] }));
  if (f.psu.mount === "rear") for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rearScrews.push({ p: [f.psu.x + sx * 69, f.psu.y + sy * 37, ANCHOR.back - 2.4], r: [HALF_PI, 0, 0] });

  return (
    <Pick category="case">
      {/* Enveloppe : coordonnées centrées sur le boîtier */}
      <group position={[cx, cy, cz]}>
        <Part g={rbox(3, H, D, 1.5)} m={mat.chassis} p={[-W / 2, 0, 0]} />
        <Part g={rbox(W, 4, D, 2)} m={mat.chassis} p={[0, -H / 2, 0]} />
        <Part g={panel(W, H, 4, backHoles)} m={mat.chassis} p={[0, 0, -D / 2]} />
        <Part g={panel(W, D, 4, [{ x: 8, y: -20, w: vent.w, h: vent.d, r: 8 }], 6)} m={mat.chassis} p={[0, H / 2, 0]} r={[HALF_PI, 0, 0]} />
        <Part g={perforated(vent.w, vent.d)} m={mat.mesh} p={[8, H / 2 + 0.5, -20]} r={[-HALF_PI, 0, 0]} shadow={false} />
        {/* Montants et longerons côté vitre */}
        <Part g={box(8, H - 8, 8)} m={mat.chassis} p={[W / 2 - 5, 0, D / 2 - 4]} />
        <Part g={box(8, H - 8, 8)} m={mat.chassis} p={[W / 2 - 5, 0, -D / 2 + 6]} />
        <Part g={box(8, 8, D - 8)} m={mat.chassis} p={[W / 2 - 5, H / 2 - 6, 0]} />
        <Part g={box(8, 8, D - 8)} m={mat.chassis} p={[W / 2 - 5, -H / 2 + 6, 0]} />

        {/* Façade */}
        {front === "solid" ? (
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

        {/* Pieds */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <Part g={rbox(W - 26, 15, 36, 5)} m={mat.chassis} p={[0, -H / 2 - 8, side * (D / 2 - 62)]} />
            <Part g={rbox(W - 40, 3, 28, 1.5)} m={mat.rubber} p={[0, -H / 2 - 16, side * (D / 2 - 62)]} shadow={false} />
          </group>
        ))}

        {/* Connectique du dessus */}
        <Part g={cylinder(8, 8, 2.4, 28)} m={mat.steel} p={[W / 2 - 49, H / 2 + 2.6, D / 2 - 34]} shadow={false} />
        <mesh geometry={torus(8, 1.1, 32)} position={[W / 2 - 49, H / 2 + 3.6, D / 2 - 34]} rotation={[HALF_PI, 0, 0]}>
          <Glow strength={1.8} />
        </mesh>
        {[79, 101].map((dx) => (
          <Part key={dx} g={rbox(14, 2, 6.5, 1)} m={mat.dark} p={[W / 2 - dx, H / 2 + 2.2, D / 2 - 34]} shadow={false} />
        ))}
        <Part g={cylinder(3.2, 3.2, 2, 16)} m={mat.dark} p={[W / 2 - 121, H / 2 + 2.2, D / 2 - 34]} shadow={false} />

        {/* Panneau latéral en verre trempé : il ne doit pas intercepter les clics */}
        {showPanel && (
          <group>
            <mesh geometry={rbox(3, H - 6, D - 6, 1.2)} material={mat.glass} position={[W / 2 + 1.5, 0, 0]} renderOrder={10} raycast={() => null} />
            {[-1, 1].map((side) => (
              <Part key={side} g={box(0.5, 13, D - 6)} m={mat.dark} p={[W / 2 - 0.4, side * (H / 2 - 9.5), 0]} shadow={false} />
            ))}
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sy, sz]) => (
              <Part key={`${sy}${sz}`} g={cylinder(5.5, 5.5, 5, 18)} m={mat.steel} p={[W / 2 + 4.5, sy * (H / 2 - 14), sz * (D / 2 - 14)]} r={[0, 0, HALF_PI]} shadow={false} />
            ))}
          </group>
        )}

        {palette.lit.strips && (
          <mesh geometry={rbox(3.5, 3.5, D - 90, 1.5)} position={[W / 2 - 14, H / 2 - 12, 0]}>
            <Glow offset={0.1} />
          </mesh>
        )}
      </group>

      {/* Rails de fixation des ventilateurs frontaux */}
      {[-1, 1].map((side) => (
        <Part key={side} g={box(6, H - 60, 2)} m={mat.chassis} p={[cx + side * (layout.fans.frontSize / 2 - 7.5), cy + 8, f.frontFanZ + 13.5]} />
      ))}
      {/* Plateau de la carte mère et passe-câbles */}
      <Part g={box(2, trayHeight, 376)} m={mat.chassis} p={[-104, f.shroudTop + trayHeight / 2, -38]} />
      {grommets.map((y) => (
        <Part key={y} g={rbox(3, 74, 22, 1.5)} m={mat.rubber} p={[-102.5, y, 58]} shadow={false} />
      ))}
      <Part g={rbox(3, 14, 56, 1.5)} m={mat.rubber} p={[-102.5, 224, -150]} shadow={false} />

      {/* Panneau arrière : grille du ventilateur et caches des emplacements libres */}
      <Part g={perforated(rearGrille, rearGrille, 9)} m={mat.mesh} p={[REAR_FAN.x, REAR_FAN.y, ANCHOR.back - 1]} shadow={false} />
      {covers.length > 0 && <Repeat g={box(116, 11.5, 1.4)} m={mat.steel} items={covers} />}
      <Repeat g={cylinder(3.4, 3.4, 1.6, 12)} m={mat.steel} items={rearScrews} />
      {/* Vis moletées du panneau latéral et filtre à poussière sous l'alimentation */}
      {[-1, 1].map((side) => (
        <Part key={side} g={cylinder(5, 5, 9, 16)} m={mat.steel} p={[f.right - 5, cy + side * (H / 2 - 60), ANCHOR.back - 6]} r={[HALF_PI, 0, 0]} shadow={false} />
      ))}
      <Part g={rbox(W - 60, 2, 150, 1)} m={mat.dark} p={[cx, f.bottom - 3, ANCHOR.back + 96]} shadow={false} />
      {!layout.board && <Part g={box(46, 160, 1)} m={mat.steel} p={[-78, 124, ANCHOR.back]} shadow={false} />}

      {/* Cache d'alimentation, lorsque le boîtier en possède un */}
      {f.shroud && (
        <>
          <Part g={box(W - 10, 3, shroudLength)} m={mat.satin} p={[cx, f.shroudTop, shroudZ]} />
          <Part g={panel(shroudLength, shroudHeight - 2, 3, [{ x: -(f.psu.z - shroudZ), y: f.psu.y - shroudY, w: 112, h: 60, r: 4 }], 1)} m={mat.satin} p={[f.right - 8, shroudY, shroudZ]} r={[0, HALF_PI, 0]} />
          <Part g={box(W - 10, shroudHeight - 2, 3)} m={mat.satin} p={[cx, shroudY, f.shroudFront]} />
          <Part g={rbox(46, 2.4, 18, 1)} m={mat.rubber} p={[f.right - 57, f.shroudTop + 1.6, 40]} shadow={false} />
          <Repeat g={rbox(60, 0.8, 4, 0.4)} m={mat.dark} items={shroudVents} />
          {style === "rgb" && (
            <mesh geometry={rbox(3.5, 3.5, shroudLength - 40, 1.5)} position={[f.right - 14, f.shroudTop + 3.4, shroudZ]}>
              <Glow offset={0.6} />
            </mesh>
          )}
        </>
      )}
      {build.case && <Label category="case" name={build.case.name} position={[f.right, ANCHOR.top + 28, f.front - 70]} />}
    </Pick>
  );
}

const GLASS = /glass/i;

/**
 * Boîtier : le modèle 3D du produit réel lorsqu'il existe, sinon la forme
 * générique. Le modèle est posé sur les repères de la scène (plateau, dessus,
 * arrière) ; les axes du fichier sont permutés et mis à l'échelle en millimètres.
 */
export function Chassis(props: { build: Build; style: Style; showPanel: boolean }) {
  const { layout } = useScene();
  const model = layout.frame.model ? CASE_MODELS[layout.frame.model] : null;
  const matrix = useMemo(() => {
    if (!model) return null;
    const u = model.unit;
    // x du fichier = profondeur, z du fichier = largeur (vitre côté +z).
    return new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, u), new THREE.Vector3(0, u, 0), new THREE.Vector3(u, 0, 0)).setPosition(...model.offset);
  }, [model]);
  if (!model || !matrix) return <ParametricChassis {...props} />;
  const f = layout.frame;
  return (
    <Pick category="case">
      <GltfModel file={model.file} matrix={matrix} hide={props.showPanel ? undefined : GLASS} fallback={null} />
      {props.build.case && <Label category="case" name={props.build.case.name} position={[f.right, ANCHOR.top + 28, f.front - 70]} />}
    </Pick>
  );
}
