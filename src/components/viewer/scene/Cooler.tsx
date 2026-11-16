"use client";

import { useMemo } from "react";
import type * as THREE from "three";
import type { Build } from "@/lib/build";
import { ANCHOR, BOARD, frontFanHeights, type CoolerLayout, type Frame } from "../layout";
import { Glow, Label, Part, Pick, Repeat, useScene, useTint, type Vec3 } from "./context";
import { box, cylinder, rbox, torus, tube } from "./geometry";
import { Fan } from "./Fan";

const X = BOARD.x;
const { cpuY, cpuZ } = BOARD;
const HALF_PI = Math.PI / 2;

interface Skin {
  fin: THREE.Material;
  top: THREE.Material;
  fan: THREE.Material | undefined;
}

function AirCooler({ cooler, lit, skin }: { cooler: Extract<CoolerLayout, { kind: "air" }>; lit: boolean; skin: Skin }) {
  const { mat } = useScene();
  const { towers, fans, fanSize, topX } = cooler;
  const y = cpuY + 6;
  const span = fanSize + 2; // largeur des ailettes, à la mesure du ventilateur
  const stackStart = X + 44, stackEnd = topX - 6;

  const parts = useMemo(() => {
    const towerZ = towers === 2 ? [cpuZ - 38, cpuZ + 30] : [cpuZ - 8];
    // Double tour : un ventilateur entre les tours, le second en façade. Simple tour : en façade.
    const fanZ = towers === 2 ? [cpuZ - 4, cpuZ + 66].slice(0, fans) : [cpuZ + 28];
    const fins: { p: Vec3 }[] = [];
    for (const z of towerZ) for (let x = stackStart; x <= stackEnd; x += 3.6) fins.push({ p: [x, y, z] });
    const pipeLength = topX - (X + 16);
    const pipeY = [-0.35, -0.12, 0.12, 0.35].map((k) => k * span);
    const pipes = towerZ.flatMap((z) => pipeY.map((dy) => ({ p: [X + 16 + pipeLength / 2, y + dy, z] as Vec3, r: [0, 0, HALF_PI] as Vec3 })));
    const caps = towerZ.flatMap((z) => pipeY.map((dy) => ({ p: [topX + 1.2, y + dy, z] as Vec3, r: [0, 0, HALF_PI] as Vec3 })));
    return { towerZ, fanZ, fins, pipes, caps, pipeLength };
  }, [towers, fans, span, stackStart, stackEnd, topX, y]);

  return (
    <group>
      <Part g={rbox(15, 46, 46, 2)} m={mat.nickel} p={[X + 11.5, cpuY, cpuZ]} />
      <Part g={rbox(8, 20, 92, 2)} m={mat.steel} p={[X + 8, cpuY, cpuZ]} />
      <Repeat g={box(1.1, span, 45)} m={skin.fin} items={parts.fins} />
      <Repeat g={cylinder(3, 3, parts.pipeLength, 10)} m={mat.nickel} items={parts.pipes} />
      <Repeat g={cylinder(2.2, 3.4, 3, 12)} m={mat.nickel} items={parts.caps} />
      {parts.towerZ.map((z) => (
        <Part key={z} g={rbox(4, span + 2, 47, 1.6)} m={skin.top} p={[topX - 2, y, z]} />
      ))}
      {parts.fanZ.map((z, i) => (
        <Fan key={z} axis="z" size={fanSize} position={[(stackStart + stackEnd) / 2, y, z]} lit={lit} offset={0.3 + i * 0.1} material={skin.fan} />
      ))}
    </group>
  );
}

function LiquidCooler({ cooler, frame, lit, skin }: { cooler: Extract<CoolerLayout, { kind: "aio" }>; frame: Frame; lit: boolean; skin: Skin }) {
  const { mat, palette } = useScene();
  const { mount, fans, fanSize, length, thickness } = cooler;
  const width = fanSize + 2;
  const coreLength = length - 46;
  const topY = ANCHOR.top - 4 - thickness / 2;
  const frontZ = frame.frontFanBack - thickness / 2;

  const geometry = useMemo(() => {
    const frontY = frontFanHeights(fans, fanSize);
    const centerY = frontY.reduce((sum, v) => sum + v, 0) / frontY.length;
    const topCenterZ = -196 + length / 2;
    const end: Vec3 = mount === "top" ? [30, ANCHOR.top - 6 - thickness, topCenterZ + length / 2 - 12] : [frame.cx, centerY + length / 2 - 12, frontZ - thickness / 2 - 2];
    const tubes = [-1, 1].map((side) => {
      const offset = side * 11;
      const points: Vec3[] =
        mount === "top"
          ? [[X + 36, cpuY + side * 9, cpuZ + 28], [X + 72, cpuY - 22, cpuZ + 76], [end[0] + offset - 8, end[1] - 55, end[2] - 34], [end[0] + offset, end[1], end[2]]]
          : [[X + 36, cpuY + side * 9, cpuZ + 28], [X + 76, cpuY - 26, cpuZ + 92], [end[0] + offset + 4, end[1] - 26, end[2] - 34], [end[0] + offset, end[1], end[2]]];
      return { geometry: tube(points, 6.4), fitting: points[3] };
    });
    return { centerY, topCenterZ, tubes };
  }, [mount, fans, fanSize, length, thickness, frame.cx, frontZ]);

  const { centerY, topCenterZ, tubes } = geometry;
  return (
    <group>
      {/* Pompe sur le processeur */}
      <Part g={rbox(5, 86, 86, 8)} m={mat.steel} p={[X + 7, cpuY, cpuZ]} />
      <Part g={cylinder(35, 37, 32, 48)} m={skin.top} p={[X + 25, cpuY, cpuZ]} r={[0, 0, HALF_PI]} />
      <Part g={cylinder(31, 31, 5, 48)} m={mat.mirror} p={[X + 42.5, cpuY, cpuZ]} r={[0, 0, HALF_PI]} shadow={false} />
      <mesh geometry={torus(31.5, 2.2)} position={[X + 43.5, cpuY, cpuZ]} rotation={[0, HALF_PI, 0]}>
        <Glow on={lit} offset={0.3} />
      </mesh>
      {/* Tuyaux gainés et raccords */}
      {tubes.map((item, i) => (
        <group key={i}>
          <mesh geometry={item.geometry} material={mat.rubber} castShadow />
          <Part g={cylinder(8.5, 8.5, 12, 16)} m={mat.steel} p={item.fitting} r={mount === "top" ? [0, 0, 0] : [HALF_PI, 0, 0]} shadow={false} />
        </group>
      ))}
      {/* Radiateur : faisceau d'ailettes entre deux réservoirs, à l'épaisseur du modèle */}
      {mount === "top" ? (
        <group>
          <Part g={box(width, thickness, coreLength)} m={mat.radiator} p={[30, topY, topCenterZ]} />
          {[-1, 1].map((side) => (
            <Part key={side} g={rbox(width, thickness, 23, 3)} m={skin.top} p={[30, topY, topCenterZ + side * (length / 2 - 11.5)]} />
          ))}
          {Array.from({ length: fans }, (_, i) => (
            <Fan key={i} axis="-y" size={fanSize} position={[30, topY - thickness / 2 - 12.5, topCenterZ - ((fans - 1) * fanSize) / 2 + i * fanSize]} lit={lit || palette.lit.fans} offset={0.2 + i * 0.1} material={skin.fan} />
          ))}
        </group>
      ) : (
        <group>
          <Part g={box(width, coreLength, thickness)} m={mat.radiator} p={[frame.cx, centerY, frontZ]} />
          {[-1, 1].map((side) => (
            <Part key={side} g={rbox(width, 23, thickness, 3)} m={skin.top} p={[frame.cx, centerY + side * (length / 2 - 11.5), frontZ]} />
          ))}
        </group>
      )}
    </group>
  );
}

/** Refroidissement du processeur, à la forme du modèle : tours, ventilateurs, épaisseur du radiateur. */
export function Cooler({ build }: { build: Build }) {
  const { mat, layout } = useScene();
  const cooler = layout.cooler;
  const fin = useTint(cooler?.colors?.fin, mat.fin, 0.88, 0.28);
  const top = useTint(cooler?.colors?.top, mat.satin, 0.35, 0.4);
  const fanTint = useTint(cooler?.colors?.fan, mat.plastic, 0.05, 0.55);
  if (!cooler || !build.cooler) return null;
  const skin: Skin = { fin, top, fan: cooler.colors ? fanTint : undefined };
  // Seul un refroidissement réellement RGB s'illumine.
  const lit = cooler.rgb;
  return (
    <Pick category="cooler">
      {cooler.kind === "air" ? <AirCooler cooler={cooler} lit={lit} skin={skin} /> : <LiquidCooler cooler={cooler} frame={layout.frame} lit={lit} skin={skin} />}
      <Label
        category="cooler"
        name={build.cooler.name}
        position={cooler.kind === "air" ? [cooler.topX + 6, cpuY + 52, cpuZ] : cooler.mount === "top" ? [96, 214, -40] : [X + 52, cpuY + 44, cpuZ]}
      />
    </Pick>
  );
}
