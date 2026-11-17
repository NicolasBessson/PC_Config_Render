"use client";

import { Component, Suspense, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

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

function Loaded({ file, matrix, hide }: { file: string; matrix: THREE.Matrix4; hide?: RegExp }) {
  // Pas de décodeur Draco : il serait téléchargé depuis un serveur externe.
  const { scene } = useGLTF(file, false);
  const object = useMemo(() => {
    // Copie par instance : plusieurs visualiseurs peuvent afficher le même fichier.
    const copy = scene.clone(true);
    copy.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return copy;
  }, [scene]);
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
      mesh.visible = !(hide && hide.test(name));
    });
  }, [object, hide]);
  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      <primitive object={object} />
    </group>
  );
}

/**
 * Modèle 3D d'un produit réel, placé dans la scène par une matrice (axes,
 * échelle, position). `hide` masque les matériaux dont le nom correspond.
 */
export function GltfModel({ file, matrix, hide, fallback = null }: { file: string; matrix: THREE.Matrix4; hide?: RegExp; fallback?: ReactNode }) {
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Loaded file={file} matrix={matrix} hide={hide} />
      </Suspense>
    </ModelBoundary>
  );
}
