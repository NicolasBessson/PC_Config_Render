"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { componentPrice, fanCountOf, formatChf, type Build } from "@/lib/build";
import { CATEGORY_LABELS, type Category, type Style } from "@/lib/catalog";
import { describeComponent } from "@/lib/catalog/describe";
import { checkBuild } from "@/lib/compat";
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
  const [selected, setSelected] = useState<Category | null>(null);
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
        selected={toolbar ? selected : null}
        onSelect={toolbar && interactive ? setSelected : undefined}
      />
      {toolbar && selected && build[selected] && <ComponentCard build={build} category={selected} onClose={() => setSelected(null)} />}
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

const CARD_TONE = { ok: "text-ok", warn: "text-warn", fail: "text-fail" } as const;
const CARD_STATUS = { ok: "Compatible", warn: "À vérifier", fail: "Incompatible" } as const;

/** Fiche du composant cliqué : uniquement des données du catalogue, signalées comme non vérifiées le cas échéant. */
function ComponentCard({ build, category, onClose }: { build: Build; category: Category; onClose: () => void }) {
  const component = build[category]!;
  const diagnostics = useMemo(() => checkBuild(build).diagnostics.filter((d) => d.involves.includes(category)), [build, category]);
  const worst = diagnostics.some((d) => d.status === "fail") ? "fail" : diagnostics.some((d) => d.status === "warn") ? "warn" : "ok";
  const issues = diagnostics.filter((d) => d.status !== "ok");
  return (
    <aside className="absolute left-3 top-12 z-10 w-64 max-w-[calc(100%-1.5rem)] rounded-xl border border-line bg-black/75 p-3 text-xs backdrop-blur max-sm:top-20" aria-label="Composant sélectionné">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">{CATEGORY_LABELS[category]}</span>
        <button type="button" onClick={onClose} aria-label="Fermer la fiche" className="-mr-1 -mt-1 rounded px-1.5 text-base leading-none text-muted hover:text-ink">×</button>
      </div>
      <p className="mt-0.5 text-sm font-medium leading-snug text-ink">{component.name}</p>
      <dl className="mt-2 space-y-1 text-muted">
        <div className="flex justify-between gap-3"><dt>Fabricant</dt><dd className="text-ink">{component.brand}</dd></div>
        <div className="flex justify-between gap-3"><dt>Prix indicatif</dt><dd className="font-mono text-ink">{category === "fans" ? `${fanCountOf(build)} × ${formatChf(component.priceChf)}` : formatChf(componentPrice(build, category))}</dd></div>
        <div className="flex justify-between gap-3"><dt>Compatibilité</dt><dd className={diagnostics.length ? CARD_TONE[worst] : ""}>{diagnostics.length ? CARD_STATUS[worst] : "Non évaluée"}</dd></div>
      </dl>
      <p className="mt-2 text-ink">{describeComponent(category, component as never)}</p>
      {issues.map((d) => (
        <p key={d.ruleId} className={`mt-1.5 leading-snug ${CARD_TONE[d.status]}`}>{d.message}</p>
      ))}
      <p className="mt-2 border-t border-line pt-2 text-[11px] leading-snug text-muted">
        {component.verified
          ? `Fiche vérifiée${component.verifiedAt ? ` le ${new Date(component.verifiedAt).toLocaleDateString("fr-CH")}` : ""}. `
          : component.source
            ? `Fiche partiellement vérifiée${component.unconfirmed?.length ? ` (non confirmé : ${component.unconfirmed.join(", ")})` : ""}. `
            : "Fiche non vérifiée : caractéristiques à confirmer auprès du fabricant. "}
        {component.source && (
          <a href={component.source.url} target="_blank" rel="noreferrer" className="text-sky-300 underline">
            {component.source.label}
          </a>
        )}
        {component.source && ". "}
        {component.priceDate === null && "Prix non relevé. "}
        Modèle 3D générique, aux cotes du catalogue.
      </p>
    </aside>
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
  { id: "fixed", label: "Fixe" },
  { id: "breath", label: "Respiration" },
  { id: "rainbow", label: "Cycle" },
];

function Swatches({ label, value, onPick }: { label: string; value: string; onPick: (color: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 text-xs text-muted">{label}</span>
      {LIGHT_COLORS.map((color) => (
        <button key={color} type="button" aria-label={`${label} ${color}`} onClick={() => onPick(color)} className={`h-6 w-6 rounded-full border-2 transition ${value === color ? "border-white" : "border-white/15 hover:border-white/50"}`} style={{ background: color }} />
      ))}
      <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border-2 border-white/15" title="Couleur personnalisée" style={{ background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)" }}>
        <input type="color" value={value} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`${label} personnalisée`} />
      </label>
    </div>
  );
}

/** Éclairage : effet, deux couleurs, intensité, et possibilité de couper les animations. */
export function LightingPicker({ value, onChange }: { value: Lighting; onChange: (lighting: Lighting) => void }) {
  // Choisir une couleur en mode « éteint » ou « cycle » repasse en couleur fixe, pour que l'effet soit visible.
  const colored = (patch: Partial<Lighting>): Lighting => ({ ...value, ...patch, mode: value.mode === "off" || value.mode === "rainbow" ? "fixed" : value.mode });
  return (
    <div className="space-y-3">
      <div className="flex w-fit max-w-full overflow-x-auto rounded-full border border-line bg-surface p-0.5 text-xs">
        {MODES.map((mode) => (
          <button key={mode.id} type="button" onClick={() => onChange({ ...value, mode: mode.id })} aria-pressed={value.mode === mode.id} className={`whitespace-nowrap rounded-full px-3 py-1.5 transition ${value.mode === mode.id ? "bg-accent text-white" : "text-muted hover:text-ink"}`}>
            {mode.label}
          </button>
        ))}
      </div>
      <Swatches label="Principale" value={value.color} onPick={(color) => onChange(colored({ color, color2: value.color2 === value.color ? color : value.color2 }))} />
      <Swatches label="Secondaire" value={value.color2} onPick={(color2) => onChange(colored({ color2 }))} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <label className="flex items-center gap-2">
          Intensité
          <input type="range" min={30} max={150} step={10} value={Math.round(value.intensity * 100)} onChange={(e) => onChange({ ...value, intensity: Number(e.target.value) / 100 })} className="w-32" aria-label="Intensité de l'éclairage" />
          <span className="w-9 font-mono text-ink">{Math.round(value.intensity * 100)} %</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={value.animated} onChange={(e) => onChange({ ...value, animated: e.target.checked })} className="accent-[var(--color-accent)]" />
          Animations
        </label>
      </div>
    </div>
  );
}
