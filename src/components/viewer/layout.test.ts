import { describe, expect, it } from "vitest";
import { resolveBuild, type BuildIds } from "@/lib/build";
import { catalog } from "@/lib/catalog";
import { BOARD, CASE, FRONT_FAN_BACK, frontFanHeights, GPU_TOP, layoutScene, SHROUD_TOP } from "./layout";

const BASE: BuildIds = {
  cpu: "r5-7600", gpu: "rtx-5070", motherboard: "b650-tomahawk", ram: "ddr5-32-vengeance",
  storage: "nv3-1tb", psu: "rm750e", cooler: "pa120-se", case: "4000d-airflow",
};
const scene = (overrides: BuildIds = {}, style: Parameters<typeof layoutScene>[1] = "noir") => layoutScene(resolveBuild({ ...BASE, ...overrides }), style);

describe("correspondance entre la configuration et la scène 3D", () => {
  it("signale toujours que les modèles sont génériques", () => {
    expect(scene().generic).toBe(true);
    expect(layoutScene(resolveBuild({}), "rgb").generic).toBe(true);
  });

  it("n'affiche que les composants choisis", () => {
    const empty = layoutScene(resolveBuild({}), "noir");
    expect(empty).toMatchObject({ board: null, cpu: false, gpu: null, cooler: null, ram: null, psu: null, storage: false });
    expect(empty.cables).toEqual({ atx24: false, eps: false, gpu: 0 });
    const partial = layoutScene(resolveBuild({ gpu: "rtx-5070" }), "noir");
    expect(partial.gpu).not.toBeNull();
    expect(partial.board).toBeNull();
  });

  it("donne à la carte graphique le gabarit du catalogue", () => {
    for (const gpu of catalog.gpu) {
      const layout = scene({ gpu: gpu.id }).gpu!;
      expect(layout.length).toBe(gpu.lengthMm);
      expect(layout.thickness).toBe(gpu.slots * 20);
      expect(layout.fans).toBe(gpu.fans);
      expect(layout.cables).toBe(gpu.power.count);
      expect(layout.connector).toBe(gpu.power.connector);
    }
    expect(scene({ gpu: "rtx-5080" }).gpu!.length).toBeGreaterThan(scene({ gpu: "rtx-5060" }).gpu!.length);
    expect(scene({ gpu: "rtx-5080" }).gpu!.slots).toBe(4); // 3,5 emplacements arrondis au supérieur
  });

  it("aucune carte graphique du catalogue ne traverse le boîtier générique", () => {
    for (const gpu of catalog.gpu) {
      const layout = scene({ gpu: gpu.id }).gpu!;
      // Reste la place d'un radiateur de façade derrière les ventilateurs.
      expect(layout.frontZ).toBeLessThan(FRONT_FAN_BACK - 55);
      expect(GPU_TOP - layout.thickness).toBeGreaterThan(SHROUD_TOP + 10);
    }
  });

  it("aucun ventirad du catalogue ne traverse la vitre", () => {
    for (const cooler of catalog.cooler.filter((c) => c.type === "air")) {
      const layout = scene({ cooler: cooler.id }).cooler!;
      if (layout.kind !== "air") throw new Error("ventirad attendu");
      expect(layout.height).toBe(cooler.heightMm);
      expect(layout.topX).toBe(BOARD.x + cooler.heightMm!);
      expect(layout.topX).toBeLessThan(CASE.width / 2 - 10);
    }
    expect(scene({ cooler: "pure-rock-2" }).cooler).toMatchObject({ kind: "air", towers: 1 });
    expect(scene({ cooler: "nh-d15" }).cooler).toMatchObject({ kind: "air", towers: 2 });
  });

  it("place le radiateur là où le boîtier l'accepte", () => {
    // Lancool 216 : 360 mm accepté en haut.
    expect(scene({ cooler: "lf3-360-argb", case: "lancool-216-rgb" }).cooler).toMatchObject({ kind: "aio", radiator: 360, mount: "top", fans: 3, fanSize: 120 });
    // 4000D : 360 mm uniquement en façade.
    expect(scene({ cooler: "lf3-360-argb", case: "4000d-airflow" }).cooler).toMatchObject({ kind: "aio", mount: "front", fans: 3 });
    expect(scene({ cooler: "lf3-240", case: "4000d-airflow" }).cooler).toMatchObject({ kind: "aio", radiator: 240, mount: "top", fans: 2 });
    // Sans boîtier choisi : montage en haut par défaut.
    expect(layoutScene(resolveBuild({ cooler: "lf3-360-argb" }), "noir").cooler).toMatchObject({ mount: "top" });
  });

  it("un radiateur de 280 mm reçoit deux ventilateurs de 140 mm", () => {
    const cooler = { ...catalog.cooler.find((c) => c.id === "lf3-240")!, radiatorMm: 280 };
    const layout = layoutScene({ ...resolveBuild(BASE), cooler }, "noir").cooler;
    expect(layout).toMatchObject({ kind: "aio", fans: 2, fanSize: 140 });
  });

  it("adapte les ventilateurs de façade au style et au radiateur", () => {
    expect(scene({}, "rgb").fans).toEqual({ front: 3, rear: 1 });
    expect(scene({}, "minimaliste").fans.front).toBe(2);
    // Un radiateur en façade apporte ses propres ventilateurs, quel que soit le style.
    expect(scene({ cooler: "lf3-360-argb", case: "4000d-airflow" }, "minimaliste").fans.front).toBe(3);
  });

  it("installe les barrettes dans les emplacements recommandés", () => {
    expect(scene().ram).toMatchObject({ modules: 2, slots: [1, 3], rgb: false });
    expect(scene({ ram: "ddr5-32-tridentz5-rgb" }).ram).toMatchObject({ rgb: true, height: 44 });
    const four = { ...catalog.ram[0], modules: 4 };
    expect(layoutScene({ ...resolveBuild(BASE), ram: four }, "noir").ram!.slots).toEqual([0, 1, 2, 3]);
  });

  it("dimensionne la carte mère selon son format", () => {
    expect(scene().board).toMatchObject({ formFactor: "ATX", height: 305, depth: 244 });
    expect(scene({ motherboard: "b650m-ds3h" }).board).toMatchObject({ formFactor: "mATX", height: 244 });
    expect(scene({ motherboard: "b650m-ds3h" }).board!.bottom).toBeGreaterThan(scene().board!.bottom);
  });

  it("ne tire des câbles que si l'alimentation est présente", () => {
    expect(scene().cables).toEqual({ atx24: true, eps: true, gpu: 1 });
    expect(scene({ gpu: "rx-9070xt" }).cables.gpu).toBe(2);
    const noPsu = layoutScene(resolveBuild({ ...BASE, psu: undefined }), "noir");
    expect(noPsu.cables).toEqual({ atx24: false, eps: false, gpu: 0 });
    expect(scene().psu).toEqual({ wattage: 750 });
  });

  it("garde les ventilateurs de façade à l'intérieur du boîtier", () => {
    for (const [count, size] of [[3, 120], [2, 120], [2, 140]] as const) {
      const heights = frontFanHeights(count, size);
      expect(heights).toHaveLength(count);
      expect(Math.max(...heights) + size / 2).toBeLessThanOrEqual(CASE.height / 2 - 4);
      expect(Math.min(...heights) - size / 2).toBeGreaterThanOrEqual(-CASE.height / 2 + 4);
    }
  });

  it("est déterministe", () => {
    expect(scene({ gpu: "rtx-5080" }, "rgb")).toEqual(scene({ gpu: "rtx-5080" }, "rgb"));
  });
});
