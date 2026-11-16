import { describe, expect, it } from "vitest";
import { buildPrice, decodeBuild, encodeBuild, isComplete, resolveBuild, type BuildIds } from "./build";
import { checkBuild } from "./compat";
import { layoutScene } from "@/components/viewer/layout";

const BASE: BuildIds = {
  cpu: "r5-7600", gpu: "rtx-5070", motherboard: "b650-tomahawk", ram: "ddr5-32-vengeance",
  storage: "nv3-1tb", psu: "rm750e", cooler: "pa120-se", case: "4000d-airflow",
};
const build = (overrides: BuildIds = {}) => resolveBuild({ ...BASE, ...overrides });
const fanRule = (overrides: BuildIds) => checkBuild(build(overrides)).diagnostics.find((d) => d.ruleId === "fans-case");

describe("ventilateurs supplémentaires", () => {
  it("sont facultatifs : une configuration reste complète sans eux", () => {
    expect(isComplete(build())).toBe(true);
    expect(checkBuild(build()).status).toBe("compatible");
    expect(fanRule({})).toBeUndefined();
  });

  it("comptent dans le prix selon leur nombre", () => {
    const base = buildPrice(build());
    expect(buildPrice(build({ fans: "arctic-p12-pwm-pst", fanCount: 3 }))).toBe(base + 3 * 8);
    expect(buildPrice(build({ fans: "arctic-p12-pwm-pst" }))).toBe(base + 8); // un seul par défaut
  });

  it("vérifie les emplacements libres du boîtier", () => {
    // 4000D : 3 × 120 en façade (1 fourni) + 2 en haut = 4 libres.
    expect(fanRule({ fans: "arctic-p12-pwm-pst", fanCount: 4 })?.status).toBe("ok");
    const tooMany = fanRule({ fans: "arctic-p12-pwm-pst", fanCount: 5 });
    expect(tooMany?.status).toBe("fail");
    expect(tooMany?.message).toContain("4 emplacement(s)");
    expect(checkBuild(build({ fans: "arctic-p12-pwm-pst", fanCount: 5 })).status).toBe("incompatible");
  });

  it("un radiateur occupe sa position", () => {
    // AIO 240 en haut du 4000D : il ne reste que la façade (2 libres).
    expect(fanRule({ cooler: "lf3-240", fans: "arctic-p12-pwm-pst", fanCount: 2 })?.status).toBe("ok");
    expect(fanRule({ cooler: "lf3-240", fans: "arctic-p12-pwm-pst", fanCount: 3 })?.status).toBe("fail");
  });

  it("tient compte de la taille des ventilateurs", () => {
    // AP201 : aucun emplacement en façade, 2 × 140 en haut.
    const ap201 = { case: "ap201-tg", motherboard: "b650m-ds3h" };
    expect(fanRule({ ...ap201, fans: "arctic-p14-pwm-pst", fanCount: 2 })?.status).toBe("ok");
    expect(fanRule({ ...ap201, fans: "arctic-p14-pwm-pst", fanCount: 3 })?.status).toBe("fail");
  });

  it("signale un boîtier dont les emplacements ne sont pas documentés", () => {
    const b = build({ fans: "arctic-p12-pwm-pst" });
    const undocumented = { ...b, case: { ...b.case!, fanSlots: undefined } };
    expect(checkBuild(undocumented).diagnostics.find((d) => d.ruleId === "fans-case")?.status).toBe("warn");
  });

  it("se partagent par URL, sans allonger les liens existants", () => {
    expect(encodeBuild(BASE).split(".")).toHaveLength(8);
    const ids = { ...BASE, fans: "arctic-p12-argb", fanCount: 3 };
    expect(encodeBuild(ids).endsWith(".arctic-p12-argb.3")).toBe(true);
    expect(decodeBuild(encodeBuild(ids))).toEqual(ids);
    expect(decodeBuild(encodeBuild(BASE))).toEqual(BASE); // un ancien lien reste valide
    expect(decodeBuild(`${encodeBuild(BASE)}.arctic-p12-argb.99`).fanCount).toBe(1); // nombre invalide ignoré
    expect(decodeBuild(`${encodeBuild(BASE)}.inconnu.2`).fans).toBeUndefined();
  });

  it("apparaissent dans la scène 3D, en façade puis en haut", () => {
    expect(layoutScene(build(), "noir").extraFans).toBeNull();
    // 4000D : 1 ventilateur de 120 fourni en façade, 2 emplacements libres à la suite.
    expect(layoutScene(build({ fans: "arctic-p12-argb", fanCount: 3 }), "noir").extraFans).toMatchObject({ front: 2, top: 1, size: 120, rgb: true });
    // Un radiateur en haut prend la place : tout va en façade.
    expect(layoutScene(build({ cooler: "lf3-240", fans: "arctic-p12-pwm-pst", fanCount: 2 }), "noir").extraFans).toMatchObject({ front: 2, top: 0 });
    // Lancool : façade équipée en 160 mm, les 120 mm vont donc en haut.
    expect(layoutScene(build({ case: "lancool-216-rgb", fans: "arctic-p12-pwm-pst", fanCount: 2 }), "rgb").extraFans).toMatchObject({ front: 0, top: 2 });
  });
});
