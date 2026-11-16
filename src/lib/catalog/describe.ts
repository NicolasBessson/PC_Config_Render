import type { Category, ComponentByCategory } from "./index";

const capacity = (gb: number) => (gb >= 1000 ? `${gb / 1000} To` : `${gb} Go`);

const DESCRIBE: { [K in Category]: (c: ComponentByCategory[K]) => string } = {
  cpu: (c) => `${c.socket} · ${c.cores} cœurs / ${c.threads} threads · ${c.tdpW} W`,
  gpu: (c) => `${c.vramGb} Go · ${c.lengthMm} mm · ${c.powerW} W`,
  motherboard: (c) => `${c.socket} · ${c.formFactor} · ${c.ramType}`,
  ram: (c) => `${c.type} · ${c.capacityGb} Go · ${c.speedMhz} MHz CL${c.cl}${c.rgb ? " · RGB" : ""}`,
  storage: (c) => `${c.interface} · ${capacity(c.capacityGb)}`,
  psu: (c) => `${c.wattage} W · ${c.efficiency} · ${c.has12v2x6 ? "12V-2x6" : `${c.pcie8pin} × 8 broches`}`,
  cooler: (c) => (c.type === "aio" ? `Watercooling AIO · radiateur ${c.radiatorMm} mm` : `Ventirad · ${c.heightMm} mm de haut`) + (c.rgb ? " · RGB" : ""),
  case: (c) => `${c.formFactors.join(" / ")} · GPU ≤ ${c.gpuMaxLengthMm} mm · style ${c.style}`,
};

/** Résumé en une ligne des caractéristiques qui comptent pour le choix. */
export function describeComponent<K extends Category>(category: K, component: ComponentByCategory[K]): string {
  return DESCRIBE[category](component);
}
