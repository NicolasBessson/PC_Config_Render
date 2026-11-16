"use client";

import { useMemo, useState } from "react";
import { resolveBuild } from "@/lib/build";
import type { Style } from "@/lib/catalog";
import { StylePicker, Viewer } from "./viewer/Viewer";
import { STYLES } from "./viewer/styles";

const SHOWCASE = {
  cpu: "r7-7800x3d", gpu: "rtx-5070ti", motherboard: "b650-tomahawk", ram: "ddr5-32-tridentz5-rgb",
  storage: "990pro-2tb", psu: "rm850x", cooler: "lf3-360-argb", case: "lancool-216-rgb",
};

/** Le même PC, décliné dans les quatre styles : la promesse du produit en un clic. */
export function HeroViewer() {
  const [style, setStyle] = useState<Style>("rgb");
  const build = useMemo(() => resolveBuild(SHOWCASE), []);
  return (
    <div>
      <Viewer build={build} style={style} lighting={STYLES[style].lighting} autoRotate toolbar={false} className="aspect-square w-full sm:aspect-[5/4]" />
      <div className="mt-3">
        <StylePicker value={style} onChange={setStyle} compact />
      </div>
      <p className="mt-2 text-center text-xs text-muted">Même configuration, quatre styles. Faites tourner le PC, zoomez, changez de style.</p>
    </div>
  );
}
