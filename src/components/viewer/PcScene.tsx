"use client";

import { createContext, useContext, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Build } from "@/lib/build";
import { CATEGORY_LABELS, type Category, type Style } from "@/lib/catalog";
import { STYLES, type Lighting, type StylePalette } from "./styles";

/*
 * Boîtier moyen-tour générique, modélisé en géométrie paramétrique.
 * Toutes les cotes sont en millimètres ; le groupe racine est mis à l'échelle.
 * Axes : x = largeur (vitre côté +x), y = hauteur, z = profondeur (façade côté +z).
 * Rendu ILLUSTRATIF : il ne remplace pas le moteur de compatibilité.
 */
const W = 230, H = 480, D = 460;
const BOARD_X = -99; // surface de la carte mère
const BOARD_TOP = 210, BOARD_BACK = -218;
const CPU_Y = 130, CPU_Z = -113;
const BOARD_SIZE = { ATX: [305, 244], mATX: [244, 244], ITX: [170, 170] } as const;

interface SceneContext {
  palette: StylePalette;
  lighting: Lighting;
  animate: boolean;
}
const Ctx = createContext<SceneContext>({ palette: STYLES.noir, lighting: STYLES.noir.lighting, animate: false });

function glowColor(lighting: Lighting, offset: number, time = 0) {
  return lighting.mode === "rainbow" ? new THREE.Color().setHSL((offset + time * 0.07) % 1, 1, 0.55) : new THREE.Color(lighting.color);
}

/** Matériau lumineux : couleur fixe ou arc-en-ciel animé, éteint sinon. */
function Glow({ on = true, offset = 0 }: { on?: boolean; offset?: number }) {
  const { lighting, animate } = useContext(Ctx);
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  const time = useRef(0);
  const lit = on && lighting.mode !== "off";
  const color = useMemo(() => glowColor(lighting, offset), [lighting, offset]);
  useFrame((_, delta) => {
    if (!lit || !animate || lighting.mode !== "rainbow" || !ref.current) return;
    time.current += delta;
    ref.current.emissive.copy(glowColor(lighting, offset, time.current));
    ref.current.color.copy(ref.current.emissive);
  });
  return (
    <meshStandardMaterial ref={ref} color={lit ? color : "#23262b"} emissive={lit ? color : "#000000"} emissiveIntensity={lit ? 1.6 : 0} toneMapped={false} roughness={0.45} />
  );
}

function Box({ size, position, color, metalness = 0.3, roughness = 0.6 }: { size: [number, number, number]; position: [number, number, number]; color: string; metalness?: number; roughness?: number }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  );
}

const frameGeometries = new Map<number, THREE.ExtrudeGeometry>();
/** Cadre de ventilateur : carré aux coins arrondis, percé d'un disque. */
function fanFrame(size: number) {
  let geometry = frameGeometries.get(size);
  if (!geometry) {
    const h = size / 2, r = 10;
    const shape = new THREE.Shape();
    shape.moveTo(-h + r, -h);
    shape.lineTo(h - r, -h); shape.quadraticCurveTo(h, -h, h, -h + r);
    shape.lineTo(h, h - r); shape.quadraticCurveTo(h, h, h - r, h);
    shape.lineTo(-h + r, h); shape.quadraticCurveTo(-h, h, -h, h - r);
    shape.lineTo(-h, -h + r); shape.quadraticCurveTo(-h, -h, -h + r, -h);
    const hole = new THREE.Path();
    hole.absarc(0, 0, h - 4, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    geometry = new THREE.ExtrudeGeometry(shape, { depth: 25, bevelEnabled: false, curveSegments: 24 });
    geometry.translate(0, 0, -12.5);
    frameGeometries.set(size, geometry);
  }
  return geometry;
}

const FAN_ROTATION = { z: [0, 0, 0], y: [Math.PI / 2, 0, 0], x: [0, Math.PI / 2, 0] } as const;

function Fan({ position, axis = "z", size = 120, lit = false, offset = 0 }: { position: [number, number, number]; axis?: "x" | "y" | "z"; size?: number; lit?: boolean; offset?: number }) {
  const { palette, animate } = useContext(Ctx);
  const blades = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (animate && blades.current) blades.current.rotation.z += delta * 5;
  });
  const radius = size / 2 - 6;
  const bladeLength = radius - 18;
  return (
    <group position={position} rotation={FAN_ROTATION[axis] as unknown as [number, number, number]}>
      <mesh geometry={fanFrame(size)}>
        <meshStandardMaterial color={palette.part} roughness={0.7} metalness={0.1} />
      </mesh>
      {[-11, 11].map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <torusGeometry args={[radius, 2.6, 8, 48]} />
          <Glow on={lit} offset={offset} />
        </mesh>
      ))}
      <group ref={blades}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[18, 18, 20, 24]} />
          <meshStandardMaterial color={palette.part} roughness={0.5} />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => (
          <group key={i} rotation={[0, 0, (i * Math.PI * 2) / 9]}>
            <mesh position={[16 + bladeLength / 2, 0, 0]} rotation={[0.55, 0, 0]}>
              <boxGeometry args={[bladeLength, 24, 1.6]} />
              <meshStandardMaterial color={palette.part} roughness={0.55} transparent opacity={lit ? 0.82 : 1} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Label({ category, name, position, show }: { category: Category; name: string; position: [number, number, number]; show: boolean }) {
  if (!show) return null;
  return (
    <Html position={position} center zIndexRange={[20, 0]} className="pointer-events-none select-none">
      <div className="whitespace-nowrap rounded-md border border-white/15 bg-black/75 px-2 py-1 text-[11px] leading-tight text-white shadow-lg backdrop-blur">
        <span className="block text-[9px] font-semibold uppercase tracking-wider text-sky-300">{CATEGORY_LABELS[category]}</span>
        {name}
      </div>
    </Html>
  );
}

function Chassis({ style, showPanel }: { style: Style; showPanel: boolean }) {
  const { palette } = useContext(Ctx);
  const c = palette.chassis;
  const slats = useMemo(() => Array.from({ length: 21 }, (_, i) => -W / 2 + 15 + i * 10), []);
  return (
    <group>
      <Box size={[W, 4, D]} position={[0, H / 2, 0]} color={c} metalness={0.45} roughness={0.5} />
      <Box size={[W, 4, D]} position={[0, -H / 2, 0]} color={c} metalness={0.45} roughness={0.5} />
      <Box size={[W, H, 4]} position={[0, 0, -D / 2]} color={c} metalness={0.45} roughness={0.5} />
      <Box size={[4, H, D]} position={[-W / 2, 0, 0]} color={c} metalness={0.45} roughness={0.5} />
      {/* Montants de la façade */}
      <Box size={[8, H, 8]} position={[W / 2 - 4, 0, D / 2]} color={c} metalness={0.45} roughness={0.5} />
      <Box size={[8, H, 8]} position={[-W / 2 + 4, 0, D / 2]} color={c} metalness={0.45} roughness={0.5} />
      {palette.front === "solid" ? (
        <>
          <Box size={[W, H, 8]} position={[0, 0, D / 2 + 4]} color={c} metalness={0.6} roughness={0.35} />
          <Box size={[W - 60, 2, 1]} position={[0, -H / 2 + 46, D / 2 + 8.5]} color="#8b9099" metalness={0.8} roughness={0.3} />
        </>
      ) : (
        <>
          <Box size={[W, 14, 10]} position={[0, H / 2 - 7, D / 2 + 3]} color={c} metalness={0.45} roughness={0.5} />
          <Box size={[W, 14, 10]} position={[0, -H / 2 + 7, D / 2 + 3]} color={c} metalness={0.45} roughness={0.5} />
          {slats.map((x) => (
            <Box key={x} size={[3.2, H - 28, 5]} position={[x, 0, D / 2 + 4]} color={c} metalness={0.5} roughness={0.45} />
          ))}
        </>
      )}
      {/* Pieds */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <Box key={`${sx}${sz}`} size={[34, 12, 46]} position={[sx * (W / 2 - 30), -H / 2 - 8, sz * (D / 2 - 50)]} color="#0a0a0c" roughness={0.9} metalness={0} />
      ))}
      {/* Cache d'alimentation : plateau complet, flanc fermé à l'avant */}
      <Box size={[W - 8, 3, D - 8]} position={[0, -136, 0]} color={palette.part} roughness={0.7} metalness={0.2} />
      <Box size={[3, 98, 262]} position={[W / 2 - 6, -187, 64]} color={palette.part} roughness={0.7} metalness={0.2} />
      {/* Bouton et voyant en façade */}
      <mesh position={[W / 2 - 30, H / 2 + 2.5, D / 2 - 40]}>
        <cylinderGeometry args={[7, 7, 2, 24]} />
        <Glow />
      </mesh>
      {/* Panneau latéral vitré */}
      {showPanel && (
        <mesh position={[W / 2 + 0.5, 0, 0]} renderOrder={10}>
          <boxGeometry args={[3, H - 6, D - 6]} />
          <meshStandardMaterial color={palette.glass} transparent opacity={palette.glassOpacity} roughness={0.06} metalness={0.2} depthWrite={false} />
        </mesh>
      )}
      {/* Bandeaux lumineux */}
      {palette.lit.strips && (
        <>
          <mesh position={[W / 2 - 12, H / 2 - 8, 0]}>
            <boxGeometry args={[4, 4, D - 50]} />
            <Glow offset={0.1} />
          </mesh>
          {style === "rgb" && (
            <mesh position={[W / 2 - 12, -131, 60]}>
              <boxGeometry args={[4, 4, 250]} />
              <Glow offset={0.6} />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}

function Motherboard({ build, labels }: { build: Build; labels: boolean }) {
  const { palette } = useContext(Ctx);
  const board = build.motherboard;
  if (!board) return null;
  const [h, d] = BOARD_SIZE[board.formFactor];
  const cy = BOARD_TOP - h / 2, cz = BOARD_BACK + d / 2;
  return (
    <group>
      <Box size={[3, h, d]} position={[BOARD_X - 1.5, cy, cz]} color={palette.pcb} roughness={0.8} metalness={0.1} />
      {/* Dissipateurs du VRM, cache des connecteurs arrière, socket */}
      <Box size={[26, 22, 104]} position={[BOARD_X + 13, CPU_Y + 62, CPU_Z - 4]} color={palette.heatsink} metalness={0.7} roughness={0.35} />
      <Box size={[34, 118, 34]} position={[BOARD_X + 17, CPU_Y + 4, BOARD_BACK + 19]} color={palette.heatsink} metalness={0.7} roughness={0.35} />
      <Box size={[5, 46, 46]} position={[BOARD_X + 2.5, CPU_Y, CPU_Z]} color="#8c9097" metalness={0.9} roughness={0.25} />
      {/* Chipset et connecteurs PCIe */}
      <Box size={[9, 54, 54]} position={[BOARD_X + 4.5, BOARD_TOP - h + 50, BOARD_BACK + d - 50]} color={palette.heatsink} metalness={0.7} roughness={0.35} />
      {[30, -30].filter((y) => y > BOARD_TOP - h + 8).map((y) => (
        <Box key={y} size={[9, 7, 92]} position={[BOARD_X + 4.5, y, BOARD_BACK + 70]} color="#1b1d22" roughness={0.6} metalness={0.2} />
      ))}
      <Label show={labels} category="motherboard" name={board.name} position={[BOARD_X + 10, BOARD_TOP - h + 50, BOARD_BACK + d - 30]} />
    </group>
  );
}

function Cooler({ build, labels }: { build: Build; labels: boolean }) {
  const { palette } = useContext(Ctx);
  const cooler = build.cooler;
  const tube = useMemo(() => {
    if (cooler?.type !== "aio" || !cooler.radiatorMm) return null;
    const length = cooler.radiatorMm + 37;
    const end = -205 + length - 18;
    return [-12, 12].map((dz) => new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(BOARD_X + 40, CPU_Y + dz * 0.6, CPU_Z + 26),
        new THREE.Vector3(BOARD_X + 78, CPU_Y - 8 + dz, CPU_Z + 80),
        new THREE.Vector3(8, CPU_Y + 30, end - 30 + dz),
        new THREE.Vector3(20, 200, end + dz * 0.4),
      ]), 40, 6.5, 10, false,
    ));
  }, [cooler]);
  if (!cooler) return null;
  const lit = cooler.rgb || palette.lit.cooler;

  if (cooler.type === "aio" && cooler.radiatorMm) {
    const length = cooler.radiatorMm + 37;
    const zc = -205 + length / 2;
    const count = cooler.radiatorMm / 120;
    return (
      <group>
        <mesh position={[BOARD_X + 26, CPU_Y, CPU_Z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[36, 38, 44, 40]} />
          <meshStandardMaterial color={palette.part} roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh position={[BOARD_X + 49, CPU_Y, CPU_Z]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[27, 3, 10, 48]} />
          <Glow on={lit} offset={0.35} />
        </mesh>
        {tube?.map((geometry, i) => (
          <mesh key={i} geometry={geometry}>
            <meshStandardMaterial color="#0c0d0f" roughness={0.85} />
          </mesh>
        ))}
        <Box size={[122, 27, length]} position={[20, 221, zc]} color={palette.part === "#f4f5f7" ? "#e8eaed" : "#121316"} roughness={0.7} metalness={0.3} />
        {Array.from({ length: count }, (_, i) => (
          <Fan key={i} axis="y" position={[20, 194, zc - ((count - 1) * 120) / 2 + i * 120]} lit={lit || palette.lit.fans} offset={0.2 + i * 0.12} />
        ))}
        <Label show={labels} category="cooler" name={cooler.name} position={[70, 215, zc]} />
      </group>
    );
  }

  const height = cooler.heightMm ?? 155;
  const dual = (cooler.tdpRatingW ?? 0) >= 200;
  const stackX = height - 38;
  const plates = Math.floor(stackX / 6.5);
  const towers = dual ? [-34, 34] : [-8];
  const fanZ = dual ? 0 : 30;
  const top = BOARD_X + height;
  return (
    <group>
      <Box size={[16, 42, 42]} position={[BOARD_X + 13, CPU_Y, CPU_Z]} color="#9a9ea6" metalness={0.9} roughness={0.25} />
      {towers.map((dz) => (
        <group key={dz}>
          {Array.from({ length: plates }, (_, i) => (
            <Box key={i} size={[1.4, 124, 40]} position={[BOARD_X + 40 + i * 6.5, CPU_Y + 6, CPU_Z + dz]} color={palette.part === "#f4f5f7" ? "#eef0f2" : "#8f949c"} metalness={0.85} roughness={0.3} />
          ))}
          <Box size={[4, 126, 42]} position={[top - 2, CPU_Y + 6, CPU_Z + dz]} color={palette.part} metalness={0.5} roughness={0.4} />
          {[-14, 14].map((dy) => (
            <mesh key={dy} position={[BOARD_X + 20 + stackX / 2, CPU_Y + 6 + dy * 3, CPU_Z + dz]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[3, 3, stackX + 36, 10]} />
              <meshStandardMaterial color="#b9793f" metalness={0.9} roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
      <Fan axis="z" position={[BOARD_X + 40 + stackX / 2, CPU_Y + 6, CPU_Z + fanZ]} lit={lit} offset={0.35} />
      <Label show={labels} category="cooler" name={cooler.name} position={[top + 4, CPU_Y + 50, CPU_Z]} />
    </group>
  );
}

function Gpu({ build, labels }: { build: Build; labels: boolean }) {
  const { palette } = useContext(Ctx);
  const gpu = build.gpu;
  if (!gpu) return null;
  const length = gpu.lengthMm, thickness = gpu.slots * 20, width = 126;
  const top = 44, cy = top - thickness / 2, cx = BOARD_X + width / 2, cz = BOARD_BACK + length / 2;
  const fanRadius = Math.min(46, length / gpu.fans / 2 - 6);
  return (
    <group>
      <Box size={[width, thickness - 4, length]} position={[cx, cy - 2, cz]} color={palette.part} roughness={0.55} metalness={0.25} />
      <Box size={[width, 3, length]} position={[cx, top - 1.5, cz]} color={palette.heatsink} metalness={0.75} roughness={0.35} />
      <Box size={[width + 10, thickness + 14, 2]} position={[cx, cy - 4, BOARD_BACK - 3]} color="#a4a8ae" metalness={0.9} roughness={0.3} />
      {/* Bandeau lumineux sur la tranche visible */}
      <mesh position={[BOARD_X + width + 0.6, cy + thickness / 2 - 12, cz + length * 0.08]}>
        <boxGeometry args={[1.5, 7, length * 0.42]} />
        <Glow offset={0.75} />
      </mesh>
      {Array.from({ length: gpu.fans }, (_, i) => {
        const z = BOARD_BACK + (length / gpu.fans) * (i + 0.5);
        return (
          <group key={i} position={[cx, cy - thickness / 2 - 1, z]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh>
              <torusGeometry args={[fanRadius, 3, 8, 40]} />
              <meshStandardMaterial color="#0b0c0e" roughness={0.6} />
            </mesh>
            <mesh>
              <circleGeometry args={[fanRadius - 2, 9]} />
              <meshStandardMaterial color="#1e2126" roughness={0.5} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      <Label show={labels} category="gpu" name={`${gpu.chipset} · ${gpu.lengthMm} mm`} position={[BOARD_X + width + 6, cy, BOARD_BACK + length - 30]} />
    </group>
  );
}

function Ram({ build, labels }: { build: Build; labels: boolean }) {
  const { palette } = useContext(Ctx);
  const ram = build.ram;
  if (!ram) return null;
  const lit = ram.rgb || palette.lit.ram;
  return (
    <group>
      {Array.from({ length: ram.modules }, (_, i) => {
        const z = CPU_Z + 76 + i * 17;
        return (
          <group key={i}>
            <Box size={[ram.heightMm - 6, 133, 7]} position={[BOARD_X + (ram.heightMm - 6) / 2, CPU_Y + 4, z]} color={palette.part === "#f4f5f7" ? "#e6e8eb" : "#1d1f24"} metalness={0.6} roughness={0.4} />
            <mesh position={[BOARD_X + ram.heightMm - 3, CPU_Y + 4, z]}>
              <boxGeometry args={[6, 133, 7]} />
              <Glow on={lit} offset={0.45 + i * 0.08} />
            </mesh>
          </group>
        );
      })}
      <Label show={labels} category="ram" name={ram.name} position={[BOARD_X + ram.heightMm + 4, CPU_Y - 40, CPU_Z + 90]} />
    </group>
  );
}

function Rest({ build, labels }: { build: Build; labels: boolean }) {
  const { palette } = useContext(Ctx);
  return (
    <group>
      {build.cpu && !build.cooler && (
        <Box size={[4, 38, 38]} position={[BOARD_X + 7, CPU_Y, CPU_Z]} color="#c9ccd1" metalness={0.95} roughness={0.2} />
      )}
      {build.cpu && <Label show={labels} category="cpu" name={build.cpu.name} position={[BOARD_X + 30, CPU_Y - 74, CPU_Z - 30]} />}
      {build.storage && (
        <>
          <Box size={[6, 22, 80]} position={[BOARD_X + 3, 57, CPU_Z + 28]} color={palette.heatsink} metalness={0.8} roughness={0.3} />
          <Label show={labels} category="storage" name={build.storage.name} position={[BOARD_X + 8, 57, CPU_Z + 70]} />
        </>
      )}
      {build.psu && (
        <>
          <Box size={[150, 86, 150]} position={[0, -191, -148]} color={palette.part === "#f4f5f7" ? "#e9ebee" : "#0d0e11"} roughness={0.6} metalness={0.35} />
          <Box size={[1, 44, 96]} position={[75.6, -191, -148]} color={palette.heatsink} metalness={0.6} roughness={0.4} />
          <Label show={labels} category="psu" name={build.psu.name} position={[80, -191, -148]} />
        </>
      )}
    </group>
  );
}

/** Lumière colorée diffusée dans le boîtier par l'éclairage. */
function InnerLights() {
  const { palette, lighting, animate } = useContext(Ctx);
  const a = useRef<THREE.PointLight>(null);
  const b = useRef<THREE.PointLight>(null);
  const time = useRef(0);
  useFrame((_, delta) => {
    if (!animate || lighting.mode !== "rainbow") return;
    time.current += delta;
    a.current?.color.copy(glowColor(lighting, 0.1, time.current));
    b.current?.color.copy(glowColor(lighting, 0.6, time.current));
  });
  if (lighting.mode === "off") return null;
  const intensity = 14 * palette.glow;
  return (
    <>
      <pointLight ref={a} position={[60, 190, 40]} color={glowColor(lighting, 0.1)} intensity={intensity} distance={7} decay={1.6} />
      <pointLight ref={b} position={[60, -90, 60]} color={glowColor(lighting, 0.6)} intensity={intensity * 0.8} distance={6} decay={1.6} />
    </>
  );
}

export interface PcSceneProps {
  build: Build;
  style: Style;
  lighting: Lighting;
  showPanel?: boolean;
  showLabels?: boolean;
  animate?: boolean;
}

export function PcScene({ build, style, lighting, showPanel = true, showLabels = false, animate = true }: PcSceneProps) {
  const palette = STYLES[style];
  const context = useMemo(() => ({ palette, lighting, animate }), [palette, lighting, animate]);
  const frontFans = [150, 28, -94];
  return (
    <Ctx.Provider value={context}>
      <group scale={0.01} position={[0, 0.1, 0]}>
        <Chassis style={style} showPanel={showPanel} />
        <Motherboard build={build} labels={showLabels} />
        <Cooler build={build} labels={showLabels} />
        <Gpu build={build} labels={showLabels} />
        <Ram build={build} labels={showLabels} />
        <Rest build={build} labels={showLabels} />
        <Fan position={[-8, CPU_Y, -D / 2 + 17]} lit={palette.lit.fans} offset={0} />
        {frontFans.map((y, i) => (
          <Fan key={y} position={[0, y, D / 2 - 16]} lit={palette.lit.fans} offset={0.5 + i * 0.14} />
        ))}
        {build.case && <Label show={showLabels} category="case" name={build.case.name} position={[W / 2, H / 2 + 26, D / 2 - 60]} />}
        <InnerLights />
      </group>
    </Ctx.Provider>
  );
}
