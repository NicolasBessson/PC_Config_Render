"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useSyncExternalStore } from "react";
import type { Build } from "@/lib/build";
import type { Style } from "@/lib/catalog";
import { DEFAULT_VIEW, VIEW_ORDER, VIEWS, type ViewId } from "./camera";
import type { Quality } from "./PcCanvas";
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
  /** Barre d'outils : vues, vitre, étiquettes, qualité, capture. */
  toolbar?: boolean;
  interactive?: boolean;
  autoRotate?: boolean;
  animate?: boolean;
  className?: string;
}

const subscribeNever = () => () => {};
/** Les appareils tactiles démarrent en rendu allégé ; l'utilisateur peut toujours changer. */
const isTouchDevice = () => window.matchMedia("(pointer: coarse)").matches;

export function Viewer({ build, style, lighting, toolbar = true, interactive = true, autoRotate = false, animate = true, className = "" }: ViewerProps) {
  const container = useRef<HTMLDivElement>(null);
  const [showPanel, setShowPanel] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [view, setView] = useState<{ id: ViewId; nonce: number }>({ id: DEFAULT_VIEW, nonce: 0 });
  const touch = useSyncExternalStore(subscribeNever, isTouchDevice, () => false);
  /** Fluidité mesurée insuffisante : on allège, sauf si l'utilisateur a choisi lui-même. */
  const [declined, setDeclined] = useState(false);
  const [choice, setChoice] = useState<Quality | null>(null);
  const quality: Quality = choice ?? (declined || touch ? "low" : "high");

  const capture = () => {
    const canvas = container.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "pc-architect.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  const goTo = (id: ViewId) => setView((previous) => ({ id, nonce: previous.nonce + 1 }));
  const reset = () => {
    goTo(DEFAULT_VIEW);
    setShowPanel(true);
  };

  return (
    <div ref={container} className={`viewer-stage relative overflow-hidden rounded-2xl border border-line ${className}`}>
      <PcCanvas
        build={build} style={style} lighting={lighting} showPanel={showPanel} showLabels={showLabels}
        interactive={interactive} autoRotate={autoRotate} animate={animate}
        view={view.id} viewNonce={view.nonce} quality={quality}
        onDecline={choice ? undefined : () => setDeclined(true)}
      />
      <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-line bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted backdrop-blur" title="Les modèles 3D sont génériques : ils reprennent les dimensions du catalogue, pas l'apparence exacte des produits.">
        Rendu illustratif · modèles génériques
      </span>
      {toolbar && (
        <>
          <div role="group" aria-label="Vues" className="absolute right-3 top-3 flex gap-0.5 rounded-full border border-line bg-black/60 p-0.5 text-xs backdrop-blur max-sm:top-11">
            {VIEW_ORDER.map((id) => (
              <ToolButton key={id} active={view.id === id} onClick={() => goTo(id)}>{VIEWS[id].label}</ToolButton>
            ))}
          </div>
          <div className="absolute inset-x-2 bottom-3 flex justify-center">
            <div className="flex max-w-full gap-0.5 overflow-x-auto rounded-full border border-line bg-black/60 p-1 text-xs backdrop-blur">
              <ToolButton onClick={reset}>Réinitialiser</ToolButton>
              <ToolButton active={!showPanel} onClick={() => setShowPanel((v) => !v)}>{showPanel ? "Retirer la vitre" : "Remettre la vitre"}</ToolButton>
              <ToolButton active={showLabels} onClick={() => setShowLabels((v) => !v)}>Étiquettes</ToolButton>
              <ToolButton onClick={() => setChoice(quality === "high" ? "low" : "high")}>Qualité : {quality === "high" ? "haute" : "légère"}</ToolButton>
              <ToolButton onClick={capture}>Capture</ToolButton>
            </div>
          </div>
        </>
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
            <span className={`mt-2 block truncate font-medium text-ink ${compact ? "text-xs sm:text-sm" : "text-sm"}`}>{palette.label}</span>
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
