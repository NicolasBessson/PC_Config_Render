"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Build } from "@/lib/build";
import { ANCHOR, PSU_SIZE } from "../layout";
import { Label, Part, Pick, Repeat, useScene, useTint, type Vec3 } from "./context";
import { box, perforated, rbox, tube } from "./geometry";
import { psuLabelTexture } from "./textures";

const BACK = ANCHOR.back;

/** Alimentation générique : seule la puissance, issue du catalogue, figure sur l'étiquette. */
export function Psu({ build }: { build: Build }) {
  const { mat, palette, layout, exploded } = useScene();
  const psu = layout.psu;
  const P = { ...layout.frame.psu, ...PSU_SIZE };
  const body = useTint(psu?.color, mat.tank, 0.4, 0.45);
  const light = palette.part === "#f4f5f7";
  const label = useMemo(
    () => (psu ? new THREE.MeshStandardMaterial({ map: psuLabelTexture(psu.wattage, light), roughness: 0.6, metalness: 0.1 }) : null),
    [psu, light],
  );
  useEffect(() => () => label?.dispose(), [label]);
  const sockets = useMemo(() => {
    const items: { p: Vec3 }[] = [];
    for (let row = 0; row < 2; row++) for (let column = 0; column < 5; column++) items.push({ p: [P.x - 50 + column * 25, P.y + 16 - row * 30, P.z + P.depth / 2 + 1] });
    return items;
  }, [P.x, P.y, P.z, P.depth]);

  // Faisceau qui quitte la face modulaire vers le passe-câbles du plateau.
  const harness = useMemo(() => {
    const zFace = P.z + P.depth / 2;
    return [-1, 0, 1].map((lane) => tube([[P.x - 28 + lane * 22, P.y + 14, zFace + 2], [P.x - 34 + lane * 18, P.y + 16, zFace + 46], [P.x - 70 + lane * 8, P.y + 22, zFace + 84], [-102, P.y + 30 + lane * 6, zFace + 104]], 5.2));
  }, [P.x, P.y, P.z, P.depth]);
  useEffect(() => () => harness.forEach((geometry) => geometry.dispose()), [harness]);

  if (!psu || !label || !build.psu) return null;
  return (
    <Pick category="psu">
      <Part g={rbox(P.width, P.height, P.depth, 2)} m={body} p={[P.x, P.y, P.z]} />
      <mesh material={label} position={[P.x + P.width / 2 + 0.4, P.y, P.z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[122, 61]} />
      </mesh>
      <Repeat g={box(16, 10, 3)} m={mat.dark} items={sockets} />
      {P.mount === "rear" && !exploded && harness.map((geometry, i) => <mesh key={i} geometry={geometry} material={mat.cable} castShadow />)}
      {/* Face arrière : grille, interrupteur et prise secteur */}
      {P.mount === "rear" && (
        <>
      <Part g={box(P.width - 4, P.height - 4, 1)} m={mat.steel} p={[P.x, P.y, BACK + 1]} shadow={false} />
      <Part g={box(94, 68, 1)} m={mat.dark} p={[P.x - 22, P.y, BACK + 0.2]} shadow={false} />
      <Part g={perforated(92, 66, 5)} m={mat.mesh} p={[P.x - 22, P.y, BACK - 0.6]} shadow={false} />
      <Part g={rbox(13, 19, 3, 1.5)} m={mat.rubber} p={[P.x + 50, P.y + 20, BACK - 0.6]} shadow={false} />
      <Part g={rbox(27, 21, 3, 2)} m={mat.rubber} p={[P.x + 48, P.y - 16, BACK - 0.6]} shadow={false} />
        </>
      )}
      <Label category="psu" name={build.psu.name} position={[P.x + P.width / 2 + 16, P.y, P.z]} />
    </Pick>
  );
}
