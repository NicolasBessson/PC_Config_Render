"use client";

import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneWithSkeletons } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { MaterialTune } from "../models";
import { Glow, useScene } from "./context";
import { exposureSafe, photoAlbedo } from "./materials";

/** Si le fichier du modèle ne se charge pas, on retombe sur la forme générique : la scène ne casse jamais. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const BODY = /body|plastic|dust/i;

/** Clarté moyenne d'une texture de couleur, mesurée une fois sur une vignette de 8 × 8 pixels. */
const brightness = new WeakMap<THREE.Texture, number>();
function textureBrightness(texture: THREE.Texture | null): number {
  if (!texture) return 1;
  const known = brightness.get(texture);
  if (known !== undefined) return known;
  let value = 0.5;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 8;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      context.drawImage(texture.image as CanvasImageSource, 0, 0, 8, 8);
      const pixels = context.getImageData(0, 0, 8, 8).data;
      let sum = 0;
      const color = new THREE.Color();
      for (let i = 0; i < pixels.length; i += 4) {
        color.setRGB(pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255, THREE.SRGBColorSpace);
        sum += 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
      }
      value = sum / 64;
    }
  } catch {
    // Image illisible : on garde une clarté moyenne.
  }
  brightness.set(texture, value);
  return value;
}

/*
 * Les fichiers sont compressés : leurs sommets sont stockés en entiers. Le rendu classique s'en
 * accommode, mais le lancer de rayons fusionne toute la scène en un seul maillage et exige des
 * nombres flottants partout. Chaque géométrie est donc convertie une fois, puis réutilisée.
 */
const plain = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function plainGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const known = plain.get(geometry);
  if (known) return known;
  let result = geometry;
  const packed = Object.values(geometry.attributes).some((attribute) => !(attribute.array instanceof Float32Array) || (attribute as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute);
  if (packed) {
    result = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      const values = new Float32Array(attribute.count * attribute.itemSize);
      for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) values[i * attribute.itemSize + c] = attribute.getComponent(i, c);
      result.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize));
    }
    result.setIndex(geometry.index);
    for (const group of geometry.groups) result.addGroup(group.start, group.count, group.materialIndex);
    result.boundingBox = geometry.boundingBox?.clone() ?? null;
    result.boundingSphere = geometry.boundingSphere?.clone() ?? null;
  }
  plain.set(geometry, result);
  return result;
}

/**
 * L'intérieur du boîtier reçoit, en plus de l'éclairage général, les lumières d'ambiance des LED et la
 * lumière d'appoint : environ trois fois plus de lumière que l'extérieur. Les pièces montées à
 * l'intérieur sont adaptées en conséquence, sinon un circuit imprimé noir paraît gris clair.
 */
const INTERIOR_LIGHT = 3;

/** Puissance maximale des éléments lumineux d'un modèle (logo, voyants) : visibles, sans éblouir. */
const MAX_EMISSIVE = 1.3;

/** Partie tournante d'un modèle (rotor de ventilateur) : nœuds concernés, centre et axe dans le fichier. */
export interface Spin {
  match: RegExp;
  center: [number, number, number];
  axis: "x" | "y" | "z";
  speed?: number;
}

const PIVOT = "__pivot";

interface LoadedProps {
  file: string;
  matrix: THREE.Matrix4;
  hide?: RegExp;
  tint?: string;
  glow?: RegExp;
  glowOffset: number;
  tune?: MaterialTune[];
  spin?: Spin;
  photo: boolean;
  /** Exposition du style : les matériaux clairs du modèle y sont adaptés. */
  exposure: number;
  interior: boolean;
}

function Loaded({ file, matrix, hide, tint, glow, glowOffset, tune, spin, photo, exposure, interior }: LoadedProps) {
  const { animate } = useScene();
  // Pas de décodeur Draco : il serait téléchargé depuis un serveur externe.
  const { scene } = useGLTF(file, false);
  const object = useMemo(() => {
    // Copie par instance : plusieurs visualiseurs peuvent afficher le même fichier. Certaines pièces sont
    // articulées (processeur, levier du socket) : la copie doit conserver leur squelette, sinon elles se déplacent.
    const copy = cloneWithSkeletons(scene);
    // Un matériau du fichier donne un seul matériau adapté, partagé par tous les maillages qui l'utilisent.
    const adapted = new Map<THREE.Material, THREE.Material>();
    const adapt = (source: THREE.MeshStandardMaterial): THREE.Material => {
      const known = adapted.get(source);
      if (known) return known;
      const name = source.name ?? "";
      let result: THREE.Material;
      if (photo && /glass/i.test(name) && source.transparent) {
        // Rendu photo : la vitre du modèle devient un vrai verre légèrement fumé.
        result = new THREE.MeshPhysicalMaterial({ name, color: new THREE.Color().setScalar(0.86), transmission: 1, ior: 1.5, thickness: 0, roughness: 0, metalness: 0 });
      } else {
        let material = source.clone();
        for (const rule of tune ?? []) {
          if (!rule.match.test(name)) continue;
          if (rule.metalness !== undefined) material.metalness = rule.metalness;
          if (rule.roughness !== undefined) material.roughness = rule.roughness;
          if (rule.uniform) {
            material.metalnessMap = null;
            material.roughnessMap = null;
          }
          // Les reflets d'une matière non métallique ne se règlent que sur un matériau « physique ».
          if (rule.specular !== undefined) {
            const { color, map, normalMap, normalScale, roughness, metalness, roughnessMap, metalnessMap, side } = material;
            material.dispose();
            material = new THREE.MeshPhysicalMaterial({ name, color, map, normalMap, normalScale, roughness, metalness, roughnessMap, metalnessMap, side, specularIntensity: rule.specular });
          }
        }
        // Variante de teinte : la carrosserie est recolorée.
        if (tint && BODY.test(name)) {
          material.color.set(tint);
          material.map = null;
        }
        if (material.color) {
          // En rendu photo, la lumière est simulée : l'intérieur ne reçoit que ce qui y entre réellement.
          exposureSafe(material.color, exposure * (interior && !photo ? INTERIOR_LIGHT : 1), textureBrightness(material.map));
          // Rendu photo : un noir uni absolu ne renvoie aucune lumière ; il reçoit le même minimum que les matériaux de la scène.
          if (photo && !material.map) photoAlbedo(material.color);
        }
        if (material.emissiveIntensity > MAX_EMISSIVE) material.emissiveIntensity = MAX_EMISSIVE;
        result = material;
      }
      adapted.set(source, result);
      return result;
    };
    copy.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.geometry = plainGeometry(mesh.geometry);
      mesh.material = adapt(mesh.material as THREE.MeshStandardMaterial);
    });
    // Rotor : ses nœuds sont rattachés à un pivot placé sur l'axe, sans changer leur position.
    if (spin) {
      copy.updateMatrixWorld(true);
      const pivot = new THREE.Group();
      pivot.name = PIVOT;
      pivot.position.set(...spin.center);
      copy.add(pivot);
      pivot.updateMatrixWorld(true);
      const moving: THREE.Object3D[] = [];
      copy.traverse((node) => {
        if ((node as THREE.Mesh).isMesh && spin.match.test(node.name)) moving.push(node);
      });
      for (const node of moving) pivot.attach(node);
    }
    return copy;
  }, [scene, tint, tune, spin, photo, exposure, interior]);
  const pivot = useRef<THREE.Object3D | null>(null);
  useEffect(() => {
    pivot.current = object.getObjectByName(PIVOT) ?? null;
  }, [object]);
  useFrame((_, delta) => {
    if (animate && spin && pivot.current) pivot.current.rotation[spin.axis] -= delta * (spin.speed ?? 5);
  });
  // Les matériaux adaptés appartiennent à cette copie : ils sont libérés avec elle.
  useEffect(
    () => () => {
      const seen = new Set<THREE.Material>();
      object.traverse((node) => {
        const material = (node as THREE.Mesh).material as THREE.Material | undefined;
        if (material && !seen.has(material)) {
          seen.add(material);
          material.dispose();
        }
      });
    },
    [object],
  );
  // Parties lumineuses (barre d'une barrette RGB…) : redessinées avec le matériau lumineux de la scène,
  // pour suivre la couleur, l'intensité et l'effet choisis par l'utilisateur.
  const glowParts = useMemo(() => {
    if (!glow) return [];
    const parts: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
    object.updateMatrixWorld(true);
    object.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && glow.test((mesh.material as THREE.Material).name ?? "")) parts.push({ geometry: mesh.geometry, matrix: mesh.matrixWorld.clone() });
    });
    return parts;
  }, [object, glow]);
  useMemo(() => {
    object.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = (mesh.material as THREE.Material).name ?? "";
      const glass = /glass/i.test(name);
      // La vitre du modèle ne projette pas d'ombre et ne doit pas intercepter les clics.
      if (glass) {
        mesh.castShadow = false;
        mesh.raycast = () => undefined;
        mesh.renderOrder = 10;
      }
      mesh.visible = !(hide && hide.test(name)) && !(glow && glow.test(name));
    });
  }, [object, hide, glow]);
  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      <primitive object={object} />
      {glowParts.map((part, index) => (
        <mesh key={index} geometry={part.geometry} matrix={part.matrix} matrixAutoUpdate={false}>
          <Glow offset={glowOffset} strength={2.6} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Modèle 3D d'un produit réel, placé dans la scène par une matrice (axes,
 * échelle, position). `hide` masque les matériaux dont le nom correspond.
 */
export function GltfModel({
  file,
  matrix,
  hide,
  tint,
  glow,
  glowOffset = 0,
  tune,
  spin,
  interior = true,
  fallback = null,
}: {
  file: string;
  matrix: THREE.Matrix4;
  hide?: RegExp;
  tint?: string;
  glow?: RegExp;
  glowOffset?: number;
  tune?: MaterialTune[];
  spin?: Spin;
  /** Pièce montée dans le boîtier (par défaut) ; `false` pour le boîtier lui-même. */
  interior?: boolean;
  fallback?: ReactNode;
}) {
  const { photo, palette } = useScene();
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Loaded file={file} matrix={matrix} hide={hide} tint={tint} glow={glow} glowOffset={glowOffset} tune={tune} spin={spin} photo={photo} exposure={palette.exposure} interior={interior} />
      </Suspense>
    </ModelBoundary>
  );
}
