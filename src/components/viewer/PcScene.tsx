"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type { Build } from "@/lib/build";
import type { Style } from "@/lib/catalog";
import { CASE, FRONT_FAN_Z, frontFanHeights, layoutScene, REAR_FAN } from "./layout";
import { Cables } from "./scene/Cables";
import { Chassis } from "./scene/Chassis";
import { Cooler } from "./scene/Cooler";
import { Ctx, glowColor, Label, useScene } from "./scene/context";
import { Fan } from "./scene/Fan";
import { Gpu } from "./scene/Gpu";
import { createMaterials, disposeMaterials } from "./scene/materials";
import { Motherboard } from "./scene/Motherboard";
import { Psu } from "./scene/Psu";
import { Ram } from "./scene/Ram";
import { STYLES, type Lighting } from "./styles";

/** Lumière colorée diffusée dans le boîtier par l'éclairage : deux sources, pas davantage. */
function InnerLights() {
  const { palette, lighting, animate } = useScene();
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
  const intensity = 15 * palette.glow;
  return (
    <>
      <pointLight ref={a} position={[70, 200, 30]} color={glowColor(lighting, 0.1)} intensity={intensity} distance={7} decay={1.6} />
      <pointLight ref={b} position={[70, -80, 70]} color={glowColor(lighting, 0.6)} intensity={intensity * 0.8} distance={6} decay={1.6} />
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

/*
 * Assemble la scène à partir de la description produite par `layoutScene`.
 * Rendu ILLUSTRATIF : modèles génériques aux cotes du catalogue. Il ne
 * remplace pas le moteur de compatibilité.
 */
export function PcScene({ build, style, lighting, showPanel = true, showLabels = false, animate = true }: PcSceneProps) {
  const palette = STYLES[style];
  const mat = useMemo(() => createMaterials(palette), [palette]);
  useEffect(() => () => disposeMaterials(mat), [mat]);
  const layout = useMemo(() => layoutScene(build, style), [build, style]);
  const context = useMemo(() => ({ palette, lighting, animate, mat, layout, labels: showLabels }), [palette, lighting, animate, mat, layout, showLabels]);

  const frontRadiator = layout.cooler?.kind === "aio" && layout.cooler.mount === "front" ? layout.cooler : null;
  const fanSize = frontRadiator?.fanSize ?? 120;
  const frontLit = palette.lit.fans || Boolean(frontRadiator?.rgb);

  return (
    <Ctx.Provider value={context}>
      <group scale={0.01} position={[0, 0.1, 0]}>
        <Chassis style={style} showPanel={showPanel} />
        <Motherboard build={build} />
        <Cooler build={build} />
        <Gpu build={build} />
        <Ram build={build} />
        <Psu build={build} />
        <Cables />
        <Fan position={[REAR_FAN.x, REAR_FAN.y, REAR_FAN.z]} axis="z" lit={palette.lit.fans} offset={0} />
        {frontFanHeights(layout.fans.front, fanSize).map((y, i) => (
          <Fan key={y} position={[0, y, FRONT_FAN_Z]} axis="z" size={fanSize} lit={frontLit} offset={0.5 + i * 0.14} />
        ))}
        {build.case && <Label category="case" name={build.case.name} position={[CASE.width / 2, CASE.height / 2 + 28, CASE.depth / 2 - 70]} />}
        <InnerLights />
      </group>
    </Ctx.Provider>
  );
}
