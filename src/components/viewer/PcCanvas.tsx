"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { CAMERA_LIMITS, DEFAULT_VIEW, VIEWS, type ViewId } from "./camera";
import { PcScene, type PcSceneProps } from "./PcScene";
import { backdropTexture } from "./scene/textures";
import { STYLES } from "./styles";

export type Quality = "high" | "low";

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

type Controls = { target: THREE.Vector3; update(): void; addEventListener(type: "start", listener: () => void): void; removeEventListener(type: "start", listener: () => void): void };

const offset = new THREE.Vector3();
const current = new THREE.Spherical();

/*
 * Transitions entre les vues. L'interpolation se fait en coordonnées
 * sphériques autour de la cible : la caméra tourne autour du PC au lieu de
 * couper en ligne droite, et ne peut donc pas le traverser.
 */
function CameraRig({ view, nonce, interactive, autoRotate }: { view: ViewId; nonce: number; interactive: boolean; autoRotate: boolean }) {
  const controls = useRef<Controls | null>(null);
  const goal = useRef<{ target: THREE.Vector3; spherical: THREE.Spherical } | null>(null);
  const first = useRef(true);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (first.current) {
      first.current = false; // la caméra démarre déjà sur la vue par défaut
      return;
    }
    const preset = VIEWS[view];
    const target = new THREE.Vector3(...preset.target);
    goal.current = { target, spherical: new THREE.Spherical().setFromVector3(new THREE.Vector3(...preset.position).sub(target)) };
    invalidate();
  }, [view, nonce, invalidate]);

  useEffect(() => {
    const instance = controls.current;
    if (!instance) return;
    const cancel = () => {
      goal.current = null; // l'utilisateur reprend la main
    };
    instance.addEventListener("start", cancel);
    return () => instance.removeEventListener("start", cancel);
  }, []);

  useFrame((_, delta) => {
    const destination = goal.current, instance = controls.current;
    if (!destination || !instance) return;
    const k = 1 - Math.exp(-5.5 * Math.min(delta, 0.05));
    current.setFromVector3(offset.copy(camera.position).sub(instance.target));
    let turn = destination.spherical.theta - current.theta;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn)); // chemin le plus court
    const done = Math.abs(turn) < 0.002 && Math.abs(destination.spherical.radius - current.radius) < 0.01 && Math.abs(destination.spherical.phi - current.phi) < 0.002;
    if (done) {
      current.copy(destination.spherical);
      instance.target.copy(destination.target);
      goal.current = null;
    } else {
      current.radius += (destination.spherical.radius - current.radius) * k;
      current.phi += (destination.spherical.phi - current.phi) * k;
      current.theta += turn * k;
      instance.target.lerp(destination.target, k);
    }
    camera.position.setFromSpherical(current).add(instance.target);
    instance.update();
    invalidate();
  });

  return (
    <OrbitControls
      ref={controls as never}
      makeDefault
      enabled={interactive}
      enablePan={false}
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.75}
      zoomSpeed={0.6}
      target={VIEWS[DEFAULT_VIEW].target}
      {...CAMERA_LIMITS}
      autoRotate={autoRotate}
      autoRotateSpeed={0.8}
    />
  );
}

export interface PcCanvasProps extends PcSceneProps {
  interactive?: boolean;
  autoRotate?: boolean;
  view?: ViewId;
  /** Incrémenté pour rejouer la transition vers la même vue (réinitialisation). */
  viewNonce?: number;
  quality?: Quality;
  /** Appelé lorsque la fluidité mesurée est insuffisante. */
  onDecline?: () => void;
}

export default function PcCanvas({ interactive = true, autoRotate = false, animate: animateProp = true, view = DEFAULT_VIEW, viewNonce = 0, quality = "high", onDecline, ...scene }: PcCanvasProps) {
  const [supported] = useState(detectWebGL);
  // « Animations désactivées » : plus aucun mouvement, et le rendu ne se fait qu'à la demande.
  const animate = animateProp && scene.lighting.animated;
  useEffect(() => () => void (document.body.style.cursor = ""), []);
  const exposure = STYLES[scene.style].exposure;
  if (!supported) return <ViewerFallback reason="Votre navigateur ou votre appareil ne prend pas en charge WebGL." />;
  const high = quality === "high";
  return (
    <Boundary>
      <Canvas
        dpr={high ? [1, 2] : 1}
        shadows={high}
        frameloop={animate ? "always" : "demand"}
        camera={{ position: VIEWS[DEFAULT_VIEW].position, fov: 30, near: 0.5, far: 80 }}
        gl={{ antialias: !high, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        onPointerMissed={() => scene.onSelect?.(null)}
      >
        <primitive attach="background" object={backdropTexture()} />
        {animate && onDecline && <PerformanceMonitor onDecline={onDecline} flipflops={2} />}
        <ambientLight intensity={0.5 * exposure} />
        {/* Lumière principale, basse et latérale : elle entre par la vitre et porte les ombres. */}
        <directionalLight
          position={[10, 4.2, 5.5]}
          intensity={2.3 * exposure}
          castShadow={high}
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.03}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
          shadow-camera-near={1}
          shadow-camera-far={30}
        />
        <directionalLight position={[-6, 6, -7]} intensity={0.7 * exposure} />
        <directionalLight position={[2, 9, 1]} intensity={0.5 * exposure} />
        <Environment resolution={128} frames={1} environmentIntensity={0.9 * exposure}>
          <Lightformer intensity={2.4} position={[7, 3, 2]} scale={[5, 9, 1]} rotation={[0, -Math.PI / 2, 0]} />
          <Lightformer intensity={1.4} position={[0, 7, 0]} scale={[9, 9, 1]} rotation={[Math.PI / 2, 0, 0]} />
          <Lightformer intensity={0.9} position={[-3, 1, 7]} scale={[6, 5, 1]} color="#8fb4ff" />
          <Lightformer intensity={0.7} position={[-2, 2, -7]} scale={[6, 5, 1]} rotation={[0, Math.PI, 0]} color="#c9d6ff" />
        </Environment>
        <PcScene animate={animate} {...scene} />
        {/* Socle */}
        <mesh position={[0, -2.67, 0]} receiveShadow>
          <cylinderGeometry args={[3.7, 3.8, 0.1, 72]} />
          <meshStandardMaterial color="#090b10" roughness={0.78} metalness={0.25} />
        </mesh>
        <mesh position={[0, -2.615, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.56, 3.6, 96]} />
          <meshBasicMaterial color="#2f6bff" toneMapped={false} />
        </mesh>
        <CameraRig view={view} nonce={viewNonce} interactive={interactive} autoRotate={autoRotate && animate} />
        {high && (
          <EffectComposer multisampling={4} enableNormalPass={false}>
            <Bloom mipmapBlur intensity={0.7} luminanceThreshold={1.6} luminanceSmoothing={0.3} radius={0.72} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        )}
      </Canvas>
    </Boundary>
  );
}
