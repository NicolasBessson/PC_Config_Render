"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { Build } from "@/lib/build";
import type { Style } from "@/lib/catalog";
import { LIGHT_COLORS, STYLE_ORDER, STYLES, type Lighting, type LightMode } from "./styles";

// Le moteur 3D n'est chargé que sur les pages qui l'affichent, côté navigateur.
const PcCanvas = dynamic(() => import("./PcCanvas"), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center text-xs text-muted">Chargement du rendu 3D…</div>,
});

interface ViewerProps {
  build: Build;
  style: Style;
  lighting: Lighting;
  /** Barre d'outils : panneau latéral, étiquettes, capture. */
  toolbar?: boolean;
  interactive?: boolean;
  autoRotate?: boolean;
  animate?: boolean;
  className?: string;
}

export function Viewer({ build, style, lighting, toolbar = true, interactive = true, autoRotate = false, animate = true, className = "" }: ViewerProps) {
  const container = useRef<HTMLDivElement>(null);
  const [showPanel, setShowPanel] = useState(true);
  const [showLabels, setShowLabels] = useState(false);

  const capture = () => {
    const canvas = container.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "pc-architect.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div ref={container} className={`viewer-stage relative overflow-hidden rounded-2xl border border-line ${className}`}>
      <PcCanvas build={build} style={style} lighting={lighting} showPanel={showPanel} showLabels={showLabels} interactive={interactive} autoRotate={autoRotate} animate={animate} />
      <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-line bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted backdrop-blur">
        Rendu illustratif
      </span>
      {toolbar && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-line bg-black/60 p-1 text-xs backdrop-blur">
          <ToolButton active={!showPanel} onClick={() => setShowPanel((v) => !v)}>{showPanel ? "Retirer la vitre" : "Remettre la vitre"}</ToolButton>
          <ToolButton active={showLabels} onClick={() => setShowLabels((v) => !v)}>Étiquettes</ToolButton>
          <ToolButton onClick={capture}>Capture</ToolButton>
        </div>
      )}
    </div>
  );
}

function ToolButton({ active = false, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`whitespace-nowrap rounded-full px-3 py-1.5 transition ${active ? "bg-accent text-white" : "text-ink hover:bg-white/10"}`}>
      {children}
    </button>
  );
}

export function StylePicker({ value, onChange, compact = false }: { value: Style; onChange: (style: Style) => void; compact?: boolean }) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}>
      {STYLE_ORDER.map((style) => {
        const palette = STYLES[style];
        const active = style === value;
        return (
          <button
            key={style}
            type="button"
            onClick={() => onChange(style)}
            aria-pressed={active}
            className={`rounded-xl border p-2.5 text-left transition ${active ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-white/25"}`}
          >
            <span className="block h-8 w-full rounded-lg border border-white/10" style={{ background: palette.swatch }} />
            <span className="mt-2 block text-sm font-medium text-ink">{palette.label}</span>
            {!compact && <span className="mt-0.5 block text-xs leading-snug text-muted">{palette.tagline}</span>}
          </button>
        );
      })}
    </div>
  );
}

const MODES: { id: LightMode; label: string }[] = [
  { id: "off", label: "Éteint" },
  { id: "fixed", label: "Couleur fixe" },
  { id: "rainbow", label: "Arc-en-ciel" },
];

export function LightingPicker({ value, onChange }: { value: Lighting; onChange: (lighting: Lighting) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex rounded-full border border-line bg-surface p-0.5 text-xs">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange({ ...value, mode: mode.id })}
            aria-pressed={value.mode === mode.id}
            className={`rounded-full px-3 py-1.5 transition ${value.mode === mode.id ? "bg-accent text-white" : "text-muted hover:text-ink"}`}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        {LIGHT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Couleur ${color}`}
            onClick={() => onChange({ mode: "fixed", color })}
            className={`h-6 w-6 rounded-full border-2 transition ${value.mode === "fixed" && value.color === color ? "border-white" : "border-white/15 hover:border-white/50"}`}
            style={{ background: color }}
          />
        ))}
        <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border-2 border-white/15" title="Couleur personnalisée" style={{ background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)" }}>
          <input type="color" value={value.color} onChange={(e) => onChange({ mode: "fixed", color: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Couleur personnalisée" />
        </label>
      </div>
    </div>
  );
}
