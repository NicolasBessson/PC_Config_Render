"use client";

import { useMemo } from "react";
import type { Build } from "@/lib/build";
import { BOARD, frontFanHeights } from "../layout";
import { Glow, Label, Part, Repeat, useScene, type Vec3 } from "./context";
import { box, cylinder, rbox, torus, tube } from "./geometry";
import { Fan } from "./Fan";

const X = BOARD.x;
const { cpuY, cpuZ } = BOARD;
const HALF_PI = Math.PI / 2;

function AirCooler({ height, towers, lit }: { height: number; towers: 1 | 2; lit: boolean }) {
  const { mat } = useScene();
  const topX = X + height;
  const y = cpuY + 6;
  const towerZ = towers === 2 ? [cpuZ - 38, cpuZ + 30] : [cpuZ - 8];
  const fanZ = towers === 2 ? cpuZ - 4 : cpuZ + 28;
  const stackStart = X + 44, stackEnd = topX - 6;

  const parts = useMemo(() => {
    const fins: { p: Vec3 }[] = [];
    for (const z of towerZ) for (let x = stackStart; x <= stackEnd; x += 3.6) fins.push({ p: [x, y, z] });
    const pipeLength = topX - (X + 16);
    const pipes = towerZ.flatMap((z) => [-42, -14, 14, 42].map((dy) => ({ p: [X + 16 + pipeLength / 2, y + dy, z] as Vec3, r: [0, 0, HALF_PI] as Vec3 })));
    const caps = towerZ.flatMap((z) => [-42, -14, 14, 42].map((dy) => ({ p: [topX + 1.2, y + dy, z] as Vec3, r: [0, 0, HALF_PI] as Vec3 })));
    return { fins, pipes, caps, pipeLength };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- towerZ dépend uniquement de `towers`
  }, [height, towers]);

  return (
    <group>
      <Part g={rbox(15, 46, 46, 2)} m={mat.nickel} p={[X + 11.5, cpuY, cpuZ]} />
      <Part g={rbox(8, 20, 92, 2)} m={mat.steel} p={[X + 8, cpuY, cpuZ]} />
      <Repeat g={box(1.1, 122, 45)} m={mat.fin} items={parts.fins} />
      <Repeat g={cylinder(3, 3, parts.pipeLength, 10)} m={mat.nickel} items={parts.pipes} />
      <Repeat g={cylinder(2.2, 3.4, 3, 12)} m={mat.nickel} items={parts.caps} />
      {towerZ.map((z) => (
        <Part key={z} g={rbox(4, 124, 47, 1.6)} m={mat.satin} p={[topX - 2, y, z]} />
      ))}
      {towerZ.map((z) => (
        <mesh key={`logo${z}`} geometry={rbox(1, 3, 26, 0.5)} position={[topX + 0.4, y - 50, z]}>
          <Glow on={lit} offset={0.35} />
        </mesh>
      ))}
      <Fan axis="z" position={[(stackStart + stackEnd) / 2, y, fanZ]} lit={lit} offset={0.35} />
    </group>
  );
}

function LiquidCooler({ mount, fans, fanSize, length, lit }: { mount: "top" | "front"; fans: number; fanSize: number; length: number; lit: boolean }) {
  const { mat, palette } = useScene();
  const width = fanSize + 2;
  const coreLength = length - 46;

  const geometry = useMemo(() => {
    const frontY = frontFanHeights(fans, fanSize);
    const centerY = frontY.reduce((sum, v) => sum + v, 0) / frontY.length;
    const topCenterZ = -196 + length / 2;
    const end: Vec3 = mount === "top" ? [30, 207, topCenterZ + length / 2 - 12] : [0, centerY + length / 2 - 12, 171];
    const tubes = [-1, 1].map((side) => {
      const offset = side * 11;
      const points: Vec3[] =
        mount === "top"
          ? [[X + 36, cpuY + side * 9, cpuZ + 28], [X + 72, cpuY - 22, cpuZ + 76], [end[0] + offset - 8, 152, end[2] - 34], [end[0] + offset, end[1], end[2]]]
          : [[X + 36, cpuY + side * 9, cpuZ + 28], [X + 76, cpuY - 26, cpuZ + 92], [offset + 4, end[1] - 26, 138], [offset, end[1], end[2]]];
      return { geometry: tube(points, 6.4), fitting: points[3] };
    });
    return { centerY, topCenterZ, tubes };
  }, [mount, fans, fanSize, length]);

  const { centerY, topCenterZ, tubes } = geometry;
  return (
    <group>
      {/* Pompe sur le processeur */}
      <Part g={rbox(5, 86, 86, 8)} m={mat.steel} p={[X + 7, cpuY, cpuZ]} />
      <Part g={cylinder(35, 37, 32, 48)} m={mat.plastic} p={[X + 25, cpuY, cpuZ]} r={[0, 0, HALF_PI]} />
      <Part g={cylinder(31, 31, 5, 48)} m={mat.mirror} p={[X + 42.5, cpuY, cpuZ]} r={[0, 0, HALF_PI]} shadow={false} />
      <mesh geometry={torus(31.5, 2.2)} position={[X + 43.5, cpuY, cpuZ]} rotation={[0, HALF_PI, 0]}>
        <Glow on={lit} offset={0.35} />
      </mesh>
      {/* Tuyaux gainés et raccords */}
      {tubes.map((item, i) => (
        <group key={i}>
          <mesh geometry={item.geometry} material={mat.rubber} castShadow />
          <Part g={cylinder(8.5, 8.5, 12, 16)} m={mat.steel} p={item.fitting} r={mount === "top" ? [0, 0, 0] : [HALF_PI, 0, 0]} shadow={false} />
        </group>
      ))}
      {/* Radiateur : faisceau d'ailettes entre deux réservoirs */}
      {mount === "top" ? (
        <group>
          <Part g={box(width, 27, coreLength)} m={mat.radiator} p={[30, 222.5, topCenterZ]} />
          {[-1, 1].map((side) => (
            <Part key={side} g={rbox(width, 27, 23, 3)} m={mat.tank} p={[30, 222.5, topCenterZ + side * (length / 2 - 11.5)]} />
          ))}
          {Array.from({ length: fans }, (_, i) => (
            <Fan key={i} axis="-y" size={fanSize} position={[30, 196.5, topCenterZ - ((fans - 1) * fanSize) / 2 + i * fanSize]} lit={lit || palette.lit.fans} offset={0.2 + i * 0.12} />
          ))}
        </group>
      ) : (
        <group>
          <Part g={box(width, coreLength, 27)} m={mat.radiator} p={[0, centerY, 186.5]} />
          {[-1, 1].map((side) => (
            <Part key={side} g={rbox(width, 23, 27, 3)} m={mat.tank} p={[0, centerY + side * (length / 2 - 11.5), 186.5]} />
          ))}
        </group>
      )}
    </group>
  );
}

/** Refroidissement du processeur : ventirad à une ou deux tours, ou watercooling AIO. */
export function Cooler({ build }: { build: Build }) {
  const { palette, layout } = useScene();
  const cooler = layout.cooler;
  if (!cooler || !build.cooler) return null;
  const lit = cooler.rgb || palette.lit.cooler;
  return (
    <group>
      {cooler.kind === "air" ? (
        <AirCooler height={cooler.height} towers={cooler.towers} lit={lit} />
      ) : (
        <LiquidCooler mount={cooler.mount} fans={cooler.fans} fanSize={cooler.fanSize} length={cooler.length} lit={lit} />
      )}
      <Label
        category="cooler"
        name={build.cooler.name}
        position={cooler.kind === "air" ? [cooler.topX + 6, cpuY + 52, cpuZ] : cooler.mount === "top" ? [96, 214, -40] : [X + 52, cpuY + 44, cpuZ]}
      />
    </group>
  );
}
