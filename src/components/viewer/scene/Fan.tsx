"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { Glow, Part, useScene, type Vec3 } from "./context";
import { cylinder, disc, fanFrame, fanRotor, torus } from "./geometry";

const ROTATION: Record<"x" | "y" | "z" | "-z" | "-y", Vec3> = {
  z: [0, 0, 0],
  "-z": [0, Math.PI, 0],
  y: [-Math.PI / 2, 0, 0],
  "-y": [Math.PI / 2, 0, 0],
  x: [0, Math.PI / 2, 0],
};

/** Rotor seul, pour les ventilateurs intégrés (carte graphique). */
export function Rotor({ size, speed = 5, lit = false, blades = 9, material }: { size: number; speed?: number; lit?: boolean; blades?: number; material?: THREE.Material }) {
  const { mat, animate } = useScene();
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (animate && ref.current) ref.current.rotation.z -= delta * speed;
  });
  return (
    <group ref={ref}>
      <mesh geometry={fanRotor(size, blades)} material={lit ? mat.bladeLit : material ?? mat.blade} castShadow />
      <mesh geometry={disc(size * 0.13)} material={mat.nickel} position={[0, 0, 8.7]} />
    </group>
  );
}

/**
 * Ventilateur de boîtier ou de refroidissement. `axis` est la direction vers
 * laquelle la face avant (celle du moyeu visible) est tournée. `material`
 * donne la couleur propre au produit.
 */
export function Fan({ position, axis = "z", size = 120, lit = false, offset = 0, material }: { position: Vec3; axis?: keyof typeof ROTATION; size?: number; lit?: boolean; offset?: number; material?: THREE.Material }) {
  const { mat } = useScene();
  return (
    <group position={position} rotation={ROTATION[axis]}>
      <Part g={fanFrame(size)} m={material ?? mat.plastic} />
      <Rotor size={size} lit={lit} material={material} />
      {lit &&
        [11.5, -11.5].map((z) => (
          <mesh key={z} geometry={torus(size / 2 - 5.5, 2.4)} position={[0, 0, z]}>
            <Glow offset={offset} />
          </mesh>
        ))}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => (
        <mesh key={`${sx}${sy}`} geometry={cylinder(3.2, 3.2, 26, 10)} material={mat.rubber} position={[sx * (size / 2 - 7), sy * (size / 2 - 7), 0]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
    </group>
  );
}
