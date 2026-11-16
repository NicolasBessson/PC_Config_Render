import { estimatePower, type CompleteBuild } from "./build";

export type UpgradeLevel = "Bonne" | "Moyenne" | "Limitée";

export interface Upgradability {
  level: UpgradeLevel;
  score: number;
  reasons: string[];
}

/** Capacité d'évolution, déduite uniquement des fiches techniques. */
export function evaluateUpgradability(build: CompleteBuild): Upgradability {
  const reasons: string[] = [];
  let score = 0;
  if (build.motherboard.upgradePath) {
    score += 2;
    reasons.push(`Socket ${build.motherboard.socket} : de futurs processeurs resteront compatibles.`);
  } else {
    reasons.push(`Socket ${build.motherboard.socket} en fin de vie : changer de processeur imposera de changer la carte mère.`);
  }
  const power = estimatePower(build);
  const headroom = power ? build.psu.wattage - power.requiredW : 0;
  if (headroom >= 100) {
    score += 1;
    reasons.push(`L'alimentation garde environ ${Math.floor(headroom / 10) * 10} W de réserve pour une carte graphique plus puissante.`);
  } else {
    reasons.push("L'alimentation est dimensionnée au plus juste : une carte graphique plus puissante demandera de la remplacer.");
  }
  if (build.ram.type === "DDR5") score += 1;
  else reasons.push("Mémoire DDR4 : non réutilisable sur une plateforme plus récente.");
  const freeSlots = build.motherboard.ramSlots - build.ram.modules;
  if (freeSlots > 0) reasons.push(`${freeSlots} emplacements de RAM libres.`);
  const level: UpgradeLevel = score >= 3 ? "Bonne" : score === 2 ? "Moyenne" : "Limitée";
  return { level, score, reasons };
}
