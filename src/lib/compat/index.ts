import { isComplete, type Build } from "../build";
import type { Category, ComponentByCategory } from "../catalog";
import { RULES, type Diagnostic, type Status } from "./rules";

export { RULES } from "./rules";
export type { Diagnostic, Rule, Status } from "./rules";

/** État global : les trois niveaux du cahier des charges, plus « incomplète ». */
export type OverallStatus = "compatible" | "a-verifier" | "incompatible" | "incomplete";

export interface CompatibilityReport {
  status: OverallStatus;
  diagnostics: Diagnostic[];
  failures: Diagnostic[];
  warnings: Diagnostic[];
}

export const STATUS_LABELS: Record<OverallStatus, string> = {
  compatible: "Compatible",
  "a-verifier": "À vérifier",
  incompatible: "Incompatible",
  incomplete: "Incomplète",
};

/**
 * Vérifie une configuration, même partielle. Moteur déterministe : mêmes
 * composants, même rapport. Aucune dépendance à l'interface ni à une IA.
 */
export function checkBuild(build: Build): CompatibilityReport {
  const diagnostics: Diagnostic[] = [];
  for (const rule of RULES) {
    const result = rule.check(build);
    if (result) diagnostics.push({ ruleId: rule.id, ruleVersion: rule.version, title: rule.title, involves: rule.involves, ...result });
  }
  const failures = diagnostics.filter((d) => d.status === "fail");
  const warnings = diagnostics.filter((d) => d.status === "warn");
  let status: OverallStatus;
  if (failures.length > 0) status = "incompatible";
  else if (!isComplete(build)) status = "incomplete";
  else if (warnings.length > 0) status = "a-verifier";
  else status = "compatible";
  return { status, diagnostics, failures, warnings };
}

/**
 * Évalue un composant candidat dans le contexte de la configuration en cours :
 * pire statut des règles qui le concernent, et les raisons associées.
 */
export function checkCandidate<K extends Category>(build: Build, category: K, candidate: ComponentByCategory[K]): { status: Status; reasons: string[] } {
  const trial = { ...build, [category]: candidate } as Build;
  const relevant = checkBuild(trial).diagnostics.filter((d) => d.involves.includes(category));
  const failures = relevant.filter((d) => d.status === "fail");
  if (failures.length > 0) return { status: "fail", reasons: failures.map((d) => d.message) };
  const warnings = relevant.filter((d) => d.status === "warn");
  if (warnings.length > 0) return { status: "warn", reasons: warnings.map((d) => d.message) };
  return { status: "ok", reasons: [] };
}
