"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type { Build } from "@/lib/build";
import type { Category, Style } from "@/lib/catalog";
import { ANCHOR, frontFanHeights, layoutScene, REAR_FAN } from "./layout";
import { Cables } from "./scene/Cables";
import { Chassis } from "./scene/Chassis";
import { Cooler } from "./scene/Cooler";
import { Ctx, glowColor, glowLevel, Label, Pick, useScene, useTint } from "./scene/context";
import { Fan } from "./scene/Fan";
import { Gpu } from "./scene/Gpu";
import { createMaterials, disposeMaterials } from "./scene/materials";
import { Motherboard } from "./scene/Motherboard";
import { Psu } from "./scene/Psu";
import { Ram } from "./scene/Ram";
import { STYLES, type Lighting } from "./styles";

/** Lumière colorée diffusée dans le boîtier par l'éclairage : deux sources, pas davantage. */
function InnerLights() {
  const { palette, lighting, animate, layout } = useScene();
  const a = useRef<THREE.PointLight>(null);
  const b = useRef<THREE.PointLight>(null);
  const time = useRef(0);
  const base = 15 * palette.glow;
  useFrame((_, delta) => {
    if (!animate || (lighting.mode !== "rainbow" && lighting.mode !== "breath")) return;
    time.current += delta;
    const level = glowLevel(lighting, time.current);
    if (a.current) {
      a.current.color.copy(glowColor(lighting, 0.1, time.current));
      a.current.intensity = base * level;
    }
    if (b.current) {
      b.current.color.copy(glowColor(lighting, 0.6, time.current));
      b.current.intensity = base * 0.8 * level;
    }
  });
  if (lighting.mode === "off") return null;
  const level = glowLevel(lighting);
  const x = layout.frame.right - 45;
  return (
    <>
      <pointLight ref={a} position={[x, 200, 30]} color={glowColor(lighting, 0.1)} intensity={base * level} distance={7} decay={1.6} />
      <pointLight ref={b} position={[x, layout.frame.shroudTop + 56, 70]} color={glowColor(lighting, 0.6)} intensity={base * 0.8 * level} distance={6} decay={1.6} />
    </>
  );
}

/** Ventilateurs supplémentaires : en façade à la suite de ceux du boîtier, puis sous le dessus. */
function ExtraFans({ build }: { build: Build }) {
  const { layout, mat } = useScene();
  const extra = layout.extraFans;
  const tint = useTint(extra?.color, mat.plastic, 0.05, 0.55);
  if (!extra || !build.fans || extra.front + extra.top === 0) return null;
  const { frame, fans } = layout;
  const frontY = frontFanHeights(fans.front + extra.front, extra.size).slice(fans.front);
  const topZ = Array.from({ length: extra.top }, (_, i) => -196 + extra.size / 2 + i * (extra.size + 2));
  return (
    <Pick category="fans">
      {frontY.map((y, i) => (
        <Fan key={`f${y}`} position={[frame.cx, y, frame.frontFanZ]} axis="z" size={extra.size} lit={extra.rgb} offset={0.2 + i * 0.1} material={tint} />
      ))}
      {topZ.map((z, i) => (
        <Fan key={`t${z}`} position={[30, ANCHOR.top - 17, z]} axis="-y" size={extra.size} lit={extra.rgb} offset={0.4 + i * 0.1} material={tint} />
      ))}
      <Label category="fans" name={`${extra.front + extra.top} × ${build.fans.name}`} position={extra.top > 0 ? [30, ANCHOR.top - 40, topZ[0]] : [frame.cx, frontY[0], frame.frontFanZ - 30]} />
    </Pick>
  );
}

export interface PcSceneProps {
  build: Build;
  style: Style;
  lighting: Lighting;
  showPanel?: boolean;
  showLabels?: boolean;
  animate?: boolean;
  /** Composant sélectionné : contour lumineux et étiquette. */
  selected?: Category | null;
  /** Fourni, il rend les composants cliquables. */
  onSelect?: (category: Category | null) => void;
  /** Vue éclatée : les composants s'écartent du boîtier, la vitre et les câbles sont retirés. */
  exploded?: boolean;
}

/*
 * Assemble la scène à partir de la description produite par `layoutScene`.
 * Rendu ILLUSTRATIF : modèles génériques aux cotes et aux couleurs du
 * catalogue. Il ne remplace pas le moteur de compatibilité.
 */
export function PcScene({ build, style, lighting, showPanel = true, showLabels = false, animate = true, selected = null, onSelect, exploded = false }: PcSceneProps) {
  const palette = STYLES[style];
  const mat = useMemo(() => createMaterials(palette), [palette]);
  useEffect(() => () => disposeMaterials(mat), [mat]);
  const layout = useMemo(() => layoutScene(build, style), [build, style]);
  const moving = animate && lighting.animated;
  const context = useMemo(
    () => ({ palette, lighting, animate: moving, mat, layout, labels: showLabels, selected, onSelect, exploded }),
    [palette, lighting, moving, mat, layout, showLabels, selected, onSelect, exploded],
  );

  const { frame, fans } = layout;
  const frontRadiator = layout.cooler?.kind === "aio" && layout.cooler.mount === "front" ? layout.cooler : null;
  // Ventilateurs lumineux : ceux du boîtier s'il en fournit, sinon selon le style.
  const caseLit = fans.rgb ?? palette.lit.fans;
  const frontLit = frontRadiator ? frontRadiator.rgb : caseLit;

  return (
    <Ctx.Provider value={context}>
      {/* Le boîtier est centré sur le socle, posé sur ses pieds, quelles que soient ses dimensions. */}
      {/*
        Échelle négative en z : les cotes de la scène placent la façade côté +z, ce qui donnait un PC en
        miroir. Le retournement remet la façade à droite quand on regarde la vitre, comme en vrai.
      */}
      <group scale={[0.01, 0.01, -0.01]} position={[0, 0.1, 0]}>
        <group position={[-frame.cx, -(frame.bottom + ANCHOR.top), -frame.cz]}>
          <Chassis build={build} style={style} showPanel={showPanel && !exploded} />
          <Motherboard build={build} />
          <Cooler build={build} />
          <Gpu build={build} />
          <Ram build={build} />
          <Psu build={build} />
          {!exploded && <Cables />}
          <Pick category="case">
            <Fan position={[REAR_FAN.x, REAR_FAN.y, REAR_FAN.z]} axis="z" size={fans.rearSize} lit={caseLit} offset={0} />
            {frontFanHeights(fans.front, fans.frontSize).map((y, i) => (
              <Fan key={y} position={[frame.cx, y, frame.frontFanZ]} axis="z" size={fans.frontSize} lit={frontLit} offset={0.5 + i * 0.1} />
            ))}
          </Pick>
          <ExtraFans build={build} />
          {/* Lumière d'appoint neutre : l'intérieur reste lisible même sans éclairage RGB. */}
          <pointLight position={[frame.right - 28, 110, 30]} color="#ffffff" intensity={7 * palette.exposure} distance={8} decay={1.5} />
          <InnerLights />
        </group>
      </group>
    </Ctx.Provider>
  );
}
