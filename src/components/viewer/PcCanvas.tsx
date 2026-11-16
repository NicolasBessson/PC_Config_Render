"use client";

import { Component, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { PcScene, type PcSceneProps } from "./PcScene";
import { STYLES } from "./styles";

function detectWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function ViewerFallback({ reason }: { reason: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm font-medium text-ink">Rendu 3D indisponible</p>
      <p className="max-w-xs text-xs text-muted">{reason} Toutes les données de la configuration restent accessibles sur cette page.</p>
    </div>
  );
}

/** Une erreur du rendu 3D ne doit jamais rendre la page inutilisable. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <ViewerFallback reason="Le modèle n'a pas pu être chargé." /> : this.props.children;
  }
}

export interface PcCanvasProps extends PcSceneProps {
  interactive?: boolean;
  autoRotate?: boolean;
}

export default function PcCanvas({ interactive = true, autoRotate = false, animate = true, ...scene }: PcCanvasProps) {
  const [supported] = useState(detectWebGL);
  const exposure = STYLES[scene.style].exposure;
  if (!supported) return <ViewerFallback reason="Votre navigateur ou votre appareil ne prend pas en charge WebGL." />;
  return (
    <Boundary>
      <Canvas
        dpr={[1, 2]}
        frameloop={animate ? "always" : "demand"}
        camera={{ position: [10.4, 2.7, 8], fov: 30 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.55 * exposure} />
        <directionalLight position={[7, 8, 6]} intensity={2.1 * exposure} />
        <directionalLight position={[-5, 3, -5]} intensity={0.45 * exposure} />
        <Environment resolution={64} frames={1} environmentIntensity={exposure}>
          <Lightformer intensity={2.2} position={[6, 4, 2]} scale={[6, 8, 1]} rotation={[0, -Math.PI / 2, 0]} />
          <Lightformer intensity={1.2} position={[0, 6, 0]} scale={[8, 8, 1]} rotation={[Math.PI / 2, 0, 0]} />
          <Lightformer intensity={0.6} position={[-4, 1, 6]} scale={[5, 5, 1]} color="#8fb4ff" />
        </Environment>
        <PcScene animate={animate} {...scene} />
        {/* Socle */}
        <mesh position={[0, -2.66, 0]}>
          <cylinderGeometry args={[3.7, 3.8, 0.1, 64]} />
          <meshStandardMaterial color="#0c0f15" roughness={0.55} metalness={0.5} />
        </mesh>
        <mesh position={[0, -2.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.56, 3.6, 96]} />
          <meshBasicMaterial color="#2f6bff" toneMapped={false} />
        </mesh>
        <OrbitControls
          makeDefault
          enabled={interactive}
          enablePan={false}
          target={[0, -0.1, 0]}
          minDistance={5}
          maxDistance={20}
          maxPolarAngle={Math.PI * 0.58}
          autoRotate={autoRotate && animate}
          autoRotateSpeed={0.8}
        />
      </Canvas>
    </Boundary>
  );
}
