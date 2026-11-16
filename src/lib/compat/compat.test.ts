import { describe, expect, it } from "vitest";
import { resolveBuild, type BuildIds } from "../build";
import { catalog } from "../catalog";
import { checkBuild, checkCandidate, RULES } from "./index";

/** Configuration de référence : compatible, sans aucun avertissement. */
const BASE: BuildIds = {
  cpu: "r5-7600", gpu: "rx-9060xt", motherboard: "b650-tomahawk", ram: "ddr5-32-vengeance",
  storage: "nv3-1tb", psu: "rm750e", cooler: "pa120-se", case: "4000d-airflow",
};
const check = (overrides: BuildIds = {}) => checkBuild(resolveBuild({ ...BASE, ...overrides }));
const statusOf = (ruleId: string, overrides: BuildIds = {}) => check(overrides).diagnostics.find((d) => d.ruleId === ruleId)?.status;

describe("moteur de compatibilité", () => {
  it("déclare compatible une configuration sans conflit", () => {
    const report = check();
    expect(report.status).toBe("compatible");
    expect(report.failures).toHaveLength(0);
    expect(report.warnings).toHaveLength(0);
  });

  it("chaque règle a un identifiant unique et une version", () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const rule of RULES) expect(rule.version).toBeGreaterThanOrEqual(1);
  });

  it("règle 1 — socket processeur / carte mère (test d'acceptation B)", () => {
    expect(statusOf("cpu-socket")).toBe("ok");
    const report = check({ cpu: "i5-14600kf" });
    expect(report.status).toBe("incompatible");
    const diagnostic = report.failures.find((d) => d.ruleId === "cpu-socket");
    expect(diagnostic?.message).toContain("LGA1700");
    expect(diagnostic?.message).toContain("AM5");
  });

  it("règle 2 — génération de RAM", () => {
    expect(statusOf("ram-type")).toBe("ok");
    expect(statusOf("ram-type", { ram: "ddr4-32-lpx" })).toBe("fail");
    expect(statusOf("ram-type", { cpu: "i5-12400f", motherboard: "b760m-ddr4", ram: "ddr4-32-lpx" })).toBe("ok");
  });

  it("règle 3 — format de la carte mère accepté par le boîtier", () => {
    expect(statusOf("motherboard-case")).toBe("ok");
    expect(statusOf("motherboard-case", { case: "ap201-tg" })).toBe("fail");
    expect(statusOf("motherboard-case", { case: "ap201-tg", motherboard: "b650m-ds3h" })).toBe("ok");
  });

  it("règle 4 — longueur de la carte graphique", () => {
    expect(statusOf("gpu-length", { gpu: "rtx-5080", psu: "rm850x" })).toBe("ok");
    expect(statusOf("gpu-length", { gpu: "rtx-5080", psu: "rm850x", case: "ap201-tg", motherboard: "b650m-ds3h" })).toBe("fail");
  });

  it("règle 5 — hauteur du ventirad, radiateur et socket du refroidissement", () => {
    expect(statusOf("cooler-fit")).toBe("ok");
    expect(statusOf("cooler-socket")).toBe("ok");
    // AIO 360 : accepté par le 4000D, refusé par le H5 Flow.
    expect(statusOf("cooler-fit", { cooler: "lf3-360-argb" })).toBe("ok");
    expect(statusOf("cooler-fit", { cooler: "lf3-360-argb", case: "h5-flow-white" })).toBe("fail");
    // Ventirad trop haut.
    const tall = { ...catalog.cooler.find((c) => c.id === "nh-d15")!, heightMm: 171 };
    const build = { ...resolveBuild(BASE), cooler: tall };
    expect(checkBuild(build).failures.map((d) => d.ruleId)).toContain("cooler-fit");
    // Socket non supporté.
    const am4Only = { ...tall, heightMm: 150, sockets: ["LGA1700" as const] };
    expect(checkBuild({ ...resolveBuild(BASE), cooler: am4Only }).failures.map((d) => d.ruleId)).toContain("cooler-socket");
  });

  it("règle 6 — puissance de l'alimentation avec marge", () => {
    expect(statusOf("psu-wattage")).toBe("ok");
    // 9800X3D (162 W) + RTX 5080 (360 W) + 75 W = 597 W ; +25 % = 747 W.
    const heavy = { cpu: "r7-9800x3d", gpu: "rtx-5080" };
    expect(statusOf("psu-wattage", { ...heavy, psu: "pp12m-650" })).toBe("fail");
    expect(statusOf("psu-wattage", { ...heavy, psu: "rm750e" })).toBe("ok");
    expect(check({ ...heavy, psu: "pp12m-650" }).failures[0].message).toContain("747 W");
  });

  it("règle 7 — connecteurs d'alimentation du GPU", () => {
    expect(statusOf("psu-connectors")).toBe("ok");
    expect(statusOf("psu-connectors", { gpu: "rtx-5070" })).toBe("ok"); // 12V-2x6 natif
    expect(statusOf("psu-connectors", { gpu: "rtx-5070", psu: "cx550" })).toBe("warn"); // via adaptateur 2×8
    expect(statusOf("psu-connectors", { gpu: "rtx-5070ti", psu: "cx550" })).toBe("fail"); // adaptateur 3×8, 2 disponibles
    expect(statusOf("psu-connectors", { gpu: "rx-9070xt", psu: "cx550" })).toBe("ok"); // 2×8 broches
  });

  it("retourne « à vérifier » pour les vérifications reportées", () => {
    expect(statusOf("cpu-bios", { cpu: "r7-9800x3d" })).toBe("warn");
    expect(check({ cpu: "r5-9600x" }).status).toBe("a-verifier");
    expect(statusOf("cooler-capacity", { cpu: "r7-9800x3d", cooler: "pure-rock-2" })).toBe("warn");
    expect(statusOf("ram-cooler-clearance", { cooler: "nh-d15", ram: "ddr5-32-tridentz5-rgb" })).toBe("warn");
    // AIO 360 uniquement en façade (H5 Flow modifié) + longue carte : conflit possible.
    const frontOnly = { ...catalog.case.find((c) => c.id === "4000d-airflow")!, radiators: { front: [360], top: [] } };
    const build = { ...resolveBuild({ ...BASE, gpu: "rtx-5080", psu: "rm850x", cooler: "lf3-360-argb" }), case: frontOnly };
    expect(checkBuild(build).warnings.map((d) => d.ruleId)).toContain("gpu-front-radiator");
  });

  it("une configuration partielle n'est jamais présentée comme compatible", () => {
    const report = checkBuild(resolveBuild({ cpu: "r5-7600", motherboard: "b650-tomahawk" }));
    expect(report.status).toBe("incomplete");
    expect(report.diagnostics.map((d) => d.ruleId)).toEqual(["cpu-socket", "cpu-bios"]);
  });

  it("évalue un composant candidat dans le contexte de la sélection", () => {
    const build = resolveBuild({ cpu: "r5-7600" });
    const z790 = catalog.motherboard.find((m) => m.id === "z790-tomahawk")!;
    const b650 = catalog.motherboard.find((m) => m.id === "b650-tomahawk")!;
    expect(checkCandidate(build, "motherboard", z790).status).toBe("fail");
    expect(checkCandidate(build, "motherboard", b650).status).toBe("ok");
  });

  it("est déterministe", () => {
    expect(check({ cpu: "r7-9800x3d", gpu: "rtx-5080" })).toEqual(check({ cpu: "r7-9800x3d", gpu: "rtx-5080" }));
  });
});
