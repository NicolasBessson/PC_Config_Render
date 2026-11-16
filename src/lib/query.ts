import { decodeBuild, encodeBuild, parseStyle, type BuildIds } from "./build";
import { games, resolutionSchema, type Resolution, type Style } from "./catalog";
import { recommendInputSchema, type RecommendInput } from "./recommend";
import type { Lighting, LightMode } from "@/components/viewer/styles";
import { STYLES } from "@/components/viewer/styles";

type Params = { get(name: string): string | null };

/** Lit et valide les critères du questionnaire depuis l'URL. `null` si invalides. */
export function parseRecommendInput(params: Params): RecommendInput | null {
  const known = new Set(games.map((g) => g.id));
  const parsed = recommendInputSchema.safeParse({
    budget: Number(params.get("budget")),
    gameIds: (params.get("jeux") ?? "").split(",").filter((id) => known.has(id)),
    resolution: params.get("res"),
    targetFps: Number(params.get("fps")),
    style: params.get("style"),
  });
  return parsed.success ? parsed.data : null;
}

export function recommendQuery(input: RecommendInput): string {
  return new URLSearchParams({
    budget: String(input.budget), jeux: input.gameIds.join(","), res: input.resolution, fps: String(input.targetFps), style: input.style,
  }).toString();
}

export interface ViewState {
  ids: BuildIds;
  style: Style;
  lighting: Lighting;
  resolution: Resolution;
  targetFps: number | null;
}

const LIGHT_MODES: LightMode[] = ["off", "fixed", "breath", "rainbow"];
const hexParam = (value: string | null) => (value && /^[0-9a-f]{6}$/i.test(value) ? `#${value}` : null);

/** État d'une configuration affichée (fiche, mode manuel), entièrement porté par l'URL. */
export function parseViewState(params: Params, fallbackStyle: Style = "noir"): ViewState {
  const ids = decodeBuild(params.get("b"));
  const style = parseStyle(params.get("style")) ?? fallbackStyle;
  const mode = LIGHT_MODES.find((m) => m === params.get("lum"));
  const preset = STYLES[style].lighting;
  const intensity = Number(params.get("li"));
  const lighting: Lighting = {
    mode: mode ?? preset.mode,
    color: hexParam(params.get("c")) ?? preset.color,
    color2: hexParam(params.get("c2")) ?? hexParam(params.get("c")) ?? preset.color2,
    intensity: Number.isFinite(intensity) && intensity >= 30 && intensity <= 150 ? intensity / 100 : preset.intensity,
    animated: params.get("anim") !== "0",
  };
  const resolution = resolutionSchema.safeParse(params.get("res"));
  const fps = Number(params.get("fps"));
  return { ids, style, lighting, resolution: resolution.success ? resolution.data : "1440p", targetFps: Number.isInteger(fps) && fps >= 30 && fps <= 500 ? fps : null };
}

export function viewQuery(state: ViewState): string {
  const params = new URLSearchParams({ b: encodeBuild(state.ids), style: state.style, lum: state.lighting.mode, c: state.lighting.color.slice(1), res: state.resolution });
  if (state.lighting.color2 !== state.lighting.color) params.set("c2", state.lighting.color2.slice(1));
  if (state.lighting.intensity !== 1) params.set("li", String(Math.round(state.lighting.intensity * 100)));
  if (!state.lighting.animated) params.set("anim", "0");
  if (state.targetFps) params.set("fps", String(state.targetFps));
  return params.toString();
}
