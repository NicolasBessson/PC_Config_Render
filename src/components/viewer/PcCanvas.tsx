"use client";

import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshReflectorMaterial, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
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

/** Studio de repli, entièrement procédural : affiché pendant le chargement de l'image de studio, ou si elle manque. */
function ProceduralStudio({ intensity }: { intensity: number }) {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={intensity}>
      <color attach="background" args={["#05060a"]} />
      <Lightformer form="rect" intensity={3.2} position={[0, 8, 1]} scale={[10, 6, 1]} rotation={[Math.PI / 2, 0, 0]} />
      <Lightformer form="rect" intensity={2.6} position={[8, 2.5, -3]} scale={[2.2, 9, 1]} rotation={[0, -Math.PI / 2, 0]} />
      <Lightformer form="rect" intensity={1.6} position={[8, 2.5, 4]} scale={[1.2, 9, 1]} rotation={[0, -Math.PI / 2, 0]} />
      <Lightformer form="rect" intensity={1.1} position={[-3, 2, -8]} scale={[6, 6, 1]} rotation={[0, Math.PI, 0]} color="#9dbcff" />
      <Lightformer form="rect" intensity={0.9} position={[-2, 3, 8]} scale={[7, 5, 1]} color="#c9d6ff" />
      <Lightformer form="ring" intensity={1.4} position={[-7, 4, 0]} scale={3} rotation={[0, Math.PI / 2, 0]} color="#ffe9d2" />
    </Environment>
  );
}

class EnvironmentBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Image de studio servie depuis le site lui-même : aucun appel à un serveur tiers. */
const STUDIO_HDRI = "/hdri/studio_small_03_1k.hdr";

function StudioEnvironment({ intensity, turn = 0 }: { intensity: number; turn?: number }) {
  const fallback = <ProceduralStudio intensity={intensity} />;
  return (
    <EnvironmentBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Environment files={STUDIO_HDRI} environmentIntensity={intensity} environmentRotation={[0, turn, 0]} />
      </Suspense>
    </EnvironmentBoundary>
  );
}

/**
 * Rendu photo : la photo de studio est tournée pour que sa lampe principale entre par la vitre,
 * du côté de l'observateur. Sans cela, l'intérieur — que la lumière n'atteint plus qu'en passant
 * réellement par les ouvertures — reste dans l'ombre.
 */
const PHOTO_TURN = (-70 * Math.PI) / 180;

/** Nombre de passes au bout duquel le rendu photo est considéré comme terminé. */
export const PHOTO_SAMPLES = 320;

/*
 * Rendu photo : lancer de rayons progressif (three-gpu-pathtracer). La lumière
 * rebondit réellement — les éléments lumineux éclairent l'intérieur, la vitre
 * réfléchit et laisse passer, les ombres sont douces. La bibliothèque n'est
 * chargée qu'à la demande. Déplacer la caméra relance le calcul.
 */
function PhotoTracer({ signature, onProgress }: { signature: string; onProgress?: (samples: number) => void }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as Controls | null;
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const get = useThree((state) => state.get);
  const tracer = useRef<import("three-gpu-pathtracer").WebGLPathTracer | null>(null);
  const reported = useRef(-1);

  useEffect(() => {
    let cancelled = false;
    let instance: import("three-gpu-pathtracer").WebGLPathTracer | null = null;
    let finish: ReturnType<typeof import("./photoFinish").createPhotoFinish> | null = null;
    let restoreEnvironment: (() => void) | null = null;
    // Même rendu des couleurs que la qualité haute, pour que l'image finale ne change pas de teinte.
    const renderer = get().gl;
    const previousToneMapping = renderer.toneMapping;
    renderer.toneMapping = THREE.NeutralToneMapping;
    reported.current = -1;
    onProgress?.(0);
    // Deux images d'attente : la scène doit avoir pris sa forme « photo » avant d'être figée.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(async () => {
        try {
          const [{ WebGLPathTracer }, { createPhotoFinish }, { softenEnvironment }] = await Promise.all([import("three-gpu-pathtracer"), import("./photoFinish"), import("./softenEnvironment")]);
          if (cancelled) return;
          // La photo de studio contient une lampe petite et très vive : elle donnerait des ombres dures et
          // beaucoup de grain. Adoucie, elle se comporte comme une grande boîte à lumière.
          const world = get().scene;
          const original = world.environment;
          const softened = original ? softenEnvironment(original) : null;
          if (softened) {
            world.environment = softened;
            restoreEnvironment = () => {
              if (world.environment === softened) world.environment = original;
              softened.dispose();
            };
          }
          const created = new WebGLPathTracer(renderer);
          instance = created;
          // Affichage : une fois l'aperçu basse définition estompé, l'image passe par la finition (grain, points isolés).
          const finisher = createPhotoFinish();
          finish = finisher;
          const blit = created.renderToCanvasCallback;
          created.renderToCanvasCallback = (target, canvasRenderer, quad) => {
            if (quad.material.opacity < 1) blit(target, canvasRenderer, quad);
            else finisher.render(canvasRenderer, target.texture, created.samples);
          };
          instance.bounces = 6;
          instance.transmissiveBounces = 6;
          instance.filterGlossyFactor = 0.5;
          instance.tiles.set(2, 2); // l'image est calculée par quarts : l'interface reste réactive
          instance.dynamicLowRes = true; // aperçu basse définition pendant les déplacements
          instance.lowResScale = 0.25;
          instance.setScene(scene, camera);
          tracer.current = instance;
          invalidate();
        } catch (error) {
          console.error("Rendu photo indisponible", error);
          onProgress?.(-1);
        }
      });
    });
    invalidate();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      tracer.current = null;
      instance?.dispose();
      finish?.dispose();
      restoreEnvironment?.();
      renderer.toneMapping = previousToneMapping;
    };
    // `signature` résume tout ce qui change la scène : le calcul repart de zéro quand elle change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [get, scene, camera, invalidate, signature]);

  // Un déplacement de caméra ou un changement de taille invalide l'image en cours.
  useEffect(() => {
    if (!controls) return;
    const restart = () => {
      tracer.current?.updateCamera();
      invalidate();
    };
    const target = controls as unknown as { addEventListener(type: string, listener: () => void): void; removeEventListener(type: string, listener: () => void): void };
    target.addEventListener("change", restart);
    return () => target.removeEventListener("change", restart);
  }, [controls, invalidate]);
  useEffect(() => {
    tracer.current?.updateCamera();
    invalidate();
  }, [size, invalidate]);

  // Priorité 1 : ce rendu remplace celui de react-three-fiber tant que le mode photo est actif.
  useFrame(() => {
    const instance = tracer.current;
    if (!instance) {
      gl.render(scene, camera); // aperçu classique pendant la préparation
      return;
    }
    if (instance.samples >= PHOTO_SAMPLES) return;
    instance.renderSample();
    const done = Math.min(PHOTO_SAMPLES, Math.floor(instance.samples));
    if (done !== reported.current) {
      reported.current = done;
      onProgress?.(done);
    }
    invalidate();
  }, 1);
  return null;
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
  /** Avancement du rendu photo, en passes ; −1 s'il n'a pas pu démarrer. */
  onPhotoProgress?: (samples: number) => void;
}

export default function PcCanvas({ interactive = true, autoRotate = false, animate: animateProp = true, view = DEFAULT_VIEW, viewNonce = 0, quality = "high", onDecline, onPhotoProgress, ...scene }: PcCanvasProps) {
  const [supported] = useState(detectWebGL);
  // « Animations désactivées » : plus aucun mouvement, et le rendu ne se fait qu'à la demande.
  const photo = Boolean(scene.photo);
  // Le rendu photo fige la scène : un lancer de rayons a besoin d'une image immobile.
  const animate = animateProp && scene.lighting.animated && !photo;
  useEffect(() => () => void (document.body.style.cursor = ""), []);
  const exposure = STYLES[scene.style].exposure;
  if (!supported) return <ViewerFallback reason="Votre navigateur ou votre appareil ne prend pas en charge WebGL." />;
  const high = quality === "high" && !photo;
  const photoSignature = photo
    ? JSON.stringify([Object.values(scene.build).map((component) => (component && typeof component === "object" ? component.id : component)), scene.style, scene.lighting, scene.showPanel, scene.exploded])
    : "";
  return (
    <Boundary>
      <Canvas
        dpr={high ? [1, 2] : photo ? [1, 1.5] : 1}
        shadows={high}
        frameloop={animate ? "always" : "demand"}
        camera={{ position: VIEWS[DEFAULT_VIEW].position, fov: 30, near: 0.5, far: 80 }}
        gl={{ antialias: !high, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        onPointerMissed={() => scene.onSelect?.(null)}
      >
        {photo ? <color attach="background" args={["#090b11"]} /> : <primitive attach="background" object={backdropTexture()} />}
        {animate && onDecline && <PerformanceMonitor onDecline={onDecline} flipflops={2} />}
        {!photo && (
          <>
        <ambientLight intensity={0.15 * exposure} />
        {/* Lumière principale, basse et latérale : elle entre par la vitre et porte les ombres. */}
        <directionalLight
          position={[10, 4.2, -5.5]}
          intensity={2.3 * exposure}
          castShadow={high}
          shadow-mapSize={[2048, 2048]}
          shadow-radius={5}
          shadow-bias={-0.0004}
          shadow-normalBias={0.03}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
          shadow-camera-near={1}
          shadow-camera-far={30}
        />
        <directionalLight position={[-6, 6, 7]} intensity={0.28 * exposure} />
        <directionalLight position={[2, 9, 1]} intensity={0.2 * exposure} />
          </>
        )}
        {/* Éclairage par l'image : une vraie photo de studio (Poly Haven, CC0) éclaire la scène et se reflète dans la vitre et les métaux. */}
        <StudioEnvironment intensity={(photo ? 1.25 : 1.3) * exposure} turn={photo ? PHOTO_TURN : 0} />
        <PcScene animate={animate} {...scene} />
        {/* Socle : en qualité haute, sa surface reflète le PC de façon diffuse. */}
        <mesh position={[0, -2.67, 0]} receiveShadow>
          <cylinderGeometry args={[3.7, 3.8, 0.1, 72]} />
          {photo ? (
            // Rendu photo : un plateau mat et sombre. Avec ses reflets rasants d'origine, il renverrait la lampe arrière et paraîtrait gris clair.
            <meshPhysicalMaterial color="#14171d" roughness={0.8} metalness={0} specularIntensity={0.3} />
          ) : (
            <meshStandardMaterial color="#090b10" roughness={0.78} metalness={0.25} />
          )}
        </mesh>
        {high && (
          <mesh position={[0, -2.618, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[3.55, 72]} />
            <MeshReflectorMaterial resolution={512} mirror={0.55} blur={[320, 90]} mixBlur={1} mixStrength={2.4} depthScale={0.6} minDepthThreshold={0.5} maxDepthThreshold={1.3} color="#0b0d12" metalness={0.55} roughness={0.72} />
          </mesh>
        )}
        <mesh position={[0, -2.615, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.56, 3.6, 96]} />
          <meshBasicMaterial color="#2f6bff" toneMapped={false} />
        </mesh>
        <CameraRig view={view} nonce={viewNonce} interactive={interactive} autoRotate={autoRotate && animate} />
        {photo && <PhotoTracer signature={photoSignature} onProgress={onPhotoProgress} />}
        {high && (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            {/* Occlusion ambiante : assombrit les recoins et ancre les pièces les unes sur les autres. */}
            <N8AO aoRadius={0.42} distanceFalloff={0.8} intensity={1.5} quality="medium" halfRes color="#03040b" />
            <Bloom mipmapBlur intensity={0.7} luminanceThreshold={1.6} luminanceSmoothing={0.3} radius={0.72} />
            {/* Rendu « neutre » : il conserve les teintes saturées de l'éclairage RGB, que les courbes filmiques délavent. */}
            <ToneMapping mode={ToneMappingMode.NEUTRAL} />
            <Vignette offset={0.32} darkness={0.5} />
            <SMAA />
          </EffectComposer>
        )}
      </Canvas>
    </Boundary>
  );
}
