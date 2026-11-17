import { describe, expect, it } from "vitest";
import { resolveBuild, type BuildIds } from "@/lib/build";
import { catalog } from "@/lib/catalog";
import { ANCHOR, BOARD, CASE, frameFor, frontFanHeights, GENERIC_ANCHORS, GPU_TOP, layoutScene } from "./layout";
import { ALL_MODEL_CREDITS, CASE_MODELS, COOLER_MODELS, CPU_MODELS, GPU_MODELS, modelCredit, MOTHERBOARD_MODELS, RAM_MODELS, STORAGE_MODELS } from "./models";

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

  it("une carte graphique que le boîtier accepte ne le traverse jamais", () => {
    for (const pcCase of catalog.case) {
      const frame = frameFor(pcCase);
      for (const gpu of catalog.gpu.filter((g) => g.lengthMm <= pcCase.gpuMaxLengthMm)) {
        const layout = scene({ gpu: gpu.id, case: pcCase.id }).gpu!;
        expect(layout.frontZ, `${gpu.id} dans ${pcCase.id}`).toBeLessThan(frame.frontFanBack);
        expect(BOARD.x + layout.width, `${gpu.id} dans ${pcCase.id}`).toBeLessThan(frame.right - 4);
      }
    }
    // Sous la carte la plus épaisse, il reste le cache d'alimentation du boîtier générique.
    expect(GPU_TOP - 70).toBeGreaterThan(frameFor(null).shroudTop + 10);
  });

  it("donne au boîtier ses dimensions extérieures", () => {
    const generic = frameFor(null);
    expect(generic).toMatchObject({ width: CASE.width, height: CASE.height, depth: CASE.depth, cx: 0, cy: 0, cz: 0, shroud: true, slots: 7 });
    // Les boîtiers dotés d'un modèle réel suivent les repères de ce modèle (test dédié plus bas).
    for (const pcCase of catalog.case.filter((c) => !CASE_MODELS[c.id])) {
      const frame = frameFor(pcCase);
      expect(frame).toMatchObject(pcCase.dimensionsMm!);
      expect(frame.right - ANCHOR.tray).toBe(pcCase.dimensionsMm!.width);
      expect(ANCHOR.top - frame.bottom).toBe(pcCase.dimensionsMm!.height);
      expect(frame.front - ANCHOR.back).toBe(pcCase.dimensionsMm!.depth);
      // L'alimentation reste à l'intérieur de l'enveloppe.
      expect(frame.psu.x + 75).toBeLessThan(frame.right);
      expect(frame.psu.y - 43).toBeGreaterThanOrEqual(frame.bottom);
    }
    const lancool = frameFor(catalog.case.find((c) => c.id === "lancool-216-rgb")!);
    const ap201 = frameFor(catalog.case.find((c) => c.id === "ap201-tg")!);
    expect(lancool.height).toBeGreaterThan(ap201.height);
    // Boîtier mATX sans cache : alimentation à l'avant, quatre emplacements.
    expect(ap201).toMatchObject({ shroud: false, slots: 4 });
    expect(ap201.psu.mount).toBe("front");
  });

  it("un boîtier doté d'un modèle réel suit les repères de ce modèle", () => {
    const pcCase = catalog.case.find((c) => c.id === "4000d-airflow")!;
    const frame = frameFor(pcCase);
    const model = CASE_MODELS["4000d-airflow"];
    expect(frame.model).toBe("4000d-airflow");
    expect(frame).toMatchObject(model.frame);
    // Le modèle reste proche des dimensions annoncées par le fabricant (pieds et façade compris ou non).
    expect(Math.abs(frame.width - pcCase.dimensionsMm!.width)).toBeLessThan(25);
    expect(Math.abs(frame.depth - pcCase.dimensionsMm!.depth)).toBeLessThan(25);
    // Le ventirad le plus haut admis par ce boîtier tient sous la vitre du modèle.
    expect(BOARD.x + pcCase.coolerMaxHeightMm).toBeLessThanOrEqual(frame.right);
    // L'alimentation reste sous le cache du modèle, donc en deçà de la vitre.
    expect(frame.psu.x + 75).toBeLessThan(frame.right - 20);
    expect(frameFor(null).model).toBeNull();
  });

  it("chaque modèle réel est crédité, et ses identifiants existent au catalogue", () => {
    for (const id of Object.keys(CASE_MODELS)) expect(catalog.case.some((c) => c.id === id), id).toBe(true);
    for (const id of Object.keys(RAM_MODELS)) expect(catalog.ram.some((r) => r.id === id), id).toBe(true);
    for (const id of Object.keys(GPU_MODELS)) expect(catalog.gpu.some((g) => g.id === id), id).toBe(true);
    for (const id of Object.keys(CPU_MODELS)) expect(catalog.cpu.some((c) => c.id === id), id).toBe(true);
    for (const id of Object.keys(STORAGE_MODELS)) expect(catalog.storage.some((c) => c.id === id), id).toBe(true);
    for (const id of Object.keys(COOLER_MODELS)) expect(catalog.cooler.some((c) => c.id === id), id).toBe(true);
    expect(ALL_MODEL_CREDITS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(ALL_MODEL_CREDITS.map((credit) => credit.url)).size).toBe(ALL_MODEL_CREDITS.length);
    for (const credit of ALL_MODEL_CREDITS) {
      expect(credit.license).toBe("CC BY 4.0");
      expect(credit.author.length).toBeGreaterThan(0);
      expect(credit.url.startsWith("https://sketchfab.com/3d-models/")).toBe(true);
    }
    expect(modelCredit("4000d-airflow")?.author).toBe("Kirigami");
    expect(modelCredit("ddr4-32-lpx")?.author).toBe("supahot");
    expect(modelCredit("rtx-5070")).toBeNull();
    expect(scene({ ram: "ddr4-32-lpx", motherboard: "b760m-ddr4", cpu: "i5-12400f" }).ram!.model).toBe("ddr4-32-lpx");
    expect(scene().ram!.model).toBeNull();
    // La scène sait quels composants ont un modèle réel.
    const real = scene({ cpu: "r7-9800x3d", gpu: "arc-b580", storage: "990pro-2tb", case: "4000d-airflow-white" });
    expect(real).toMatchObject({ cpuModel: "r7-9800x3d", storageModel: "990pro-2tb" });
    expect(real.gpu!.model).toBe("arc-b580");
    expect(real.frame.model).toBe("4000d-airflow-white");
    expect(CASE_MODELS["4000d-airflow-white"].tint).toBeDefined();
    expect(CASE_MODELS["4000d-airflow"].tint).toBeUndefined();
    expect(scene()).toMatchObject({ cpuModel: "r5-7600", storageModel: null });
    expect(scene().gpu!.model).toBeNull();
  });

  it("RTX 5090 FE, T-Force Delta RGB et Freezer 34 : la scène utilise leurs modèles réels", () => {
    const real = scene({ gpu: "rtx-5090-fe", psu: "rm1000x", ram: "ddr5-32-delta-rgb-black", cooler: "freezer-34-esports-duo" });
    expect(real.gpu).toMatchObject({ model: "rtx-5090-fe", length: 304, width: 137, thickness: 40 });
    expect(real.ram).toMatchObject({ model: "ddr5-32-delta-rgb-black", rgb: true });
    expect(real.cooler).toMatchObject({ kind: "air", model: "freezer-34-esports-duo", height: 157 });
    expect(scene({ ram: "ddr5-32-delta-rgb-white" }).ram!.model).toBe("ddr5-32-delta-rgb-white");
    // Un ventirad sans modèle garde sa forme générique.
    expect(scene({ cooler: "pa120-se" }).cooler).toMatchObject({ kind: "air", model: null });
  });

  it("carte mère réelle : le socket, la mémoire et les câbles suivent ses repères, pas ceux de la carte générique", () => {
    const am4 = { cpu: "r5-5600", motherboard: "b550-aorus-elite-v2", ram: "ddr4-32-lpx", cooler: "freezer-34-esports-duo" };
    const real = scene(am4);
    const generic = scene();
    expect(real.board!.model).toBe("b550-aorus-elite-v2");
    expect(generic.board!.model).toBeNull();
    expect(generic.anchors).toEqual(GENERIC_ANCHORS);
    // Le socket du modèle n'est pas là où la carte générique le dessine.
    expect(real.anchors.cpuZ).toBeGreaterThan(GENERIC_ANCHORS.cpuZ + 10);
    expect(real.anchors.cpuY).toBeLessThan(GENERIC_ANCHORS.cpuY);
    // Tous les repères restent sur le circuit, dans l'ordre attendu.
    const { anchors, board } = real;
    expect(anchors.cpuZ).toBeGreaterThan(BOARD.back);
    expect(anchors.cpuY).toBeLessThan(BOARD.top);
    expect(anchors.ramZ).toHaveLength(4);
    for (let i = 1; i < 4; i++) expect(anchors.ramZ[i]).toBeGreaterThan(anchors.ramZ[i - 1] + 7); // emplacements distincts
    expect(anchors.ramZ[0]).toBeGreaterThan(anchors.cpuZ + 30); // la mémoire est devant le socket
    expect(anchors.ramZ[3]).toBeLessThan(board!.front);
    expect(anchors.m2.y).toBeLessThan(anchors.cpuY - 40); // le dissipateur M.2 est sous le socket
    expect(anchors.m2.y).toBeGreaterThan(GPU_TOP); // et au-dessus de la carte graphique
    // Le circuit garde un format ATX plausible et ne traverse pas le fond du boîtier.
    expect(board!.height).toBeGreaterThan(280);
    expect(board!.height).toBeLessThanOrEqual(305);
    expect(board!.depth).toBeGreaterThan(225);
    expect(board!.depth).toBeLessThanOrEqual(244);
    // Le premier emplacement PCIe du modèle tombe face à la carte graphique (à moins de 6 mm de son circuit).
    const model = MOTHERBOARD_MODELS["b550-aorus-elite-v2"];
    const slotY = BOARD.top - (0.8876 - model.origin[2]) * model.scale[2];
    expect(Math.abs(slotY - (GPU_TOP - 3))).toBeLessThan(6);
    expect(modelCredit("b550-aorus-elite-v2")?.author).toBe("exitmonad");
    for (const id of Object.keys(MOTHERBOARD_MODELS)) expect(catalog.motherboard.some((m) => m.id === id), id).toBe(true);
  });

  it("chaque barrette réelle est posée en miroir (déterminant négatif), sinon ses inscriptions seraient inversées", () => {
    for (const [id, model] of Object.entries(RAM_MODELS)) {
      const [[a, b, c], [d, e, f], [g, h, i]] = model.basis;
      // Colonnes de la matrice : déterminant d'une base orthonormée, ±1.
      const determinant = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
      expect(determinant, id).toBe(-1);
      expect(model.unit, id).toBeGreaterThan(0);
    }
    // Seules les barrettes RGB déclarent une barre lumineuse.
    expect(RAM_MODELS["ddr5-32-delta-rgb-black"].glow).toBeDefined();
    expect(RAM_MODELS["ddr4-32-lpx"].glow).toBeUndefined();
  });

  it("reprend l'apparence propre à chaque produit", () => {
    expect(scene({ gpu: "rx-9070xt" }).gpu!.colors).toEqual({ shroud: "#17181b", accent: "#c1272d", backplate: "#232428" });
    expect(scene({ gpu: "rtx-5080" }).gpu!.width).toBeGreaterThan(scene({ gpu: "rtx-5060" }).gpu!.width);
    expect(scene({ cooler: "nh-d15" }).cooler).toMatchObject({ fans: 2, fanSize: 140 });
    expect(scene({ cooler: "pure-rock-2" }).cooler).toMatchObject({ fans: 1, fanSize: 120 });
    expect(scene({ cooler: "lf3-240", case: "lancool-216-rgb" }).cooler).toMatchObject({ thickness: 38 });
    expect(scene({ ram: "ddr5-32-tridentz5-rgb" }).ram!.color).toBe("#8d9299");
    expect(scene().board!.colors).not.toBeNull();
    // Un produit sans profil visuel retombe sur l'apparence du style.
    const plain = { ...catalog.gpu[0], visual: undefined };
    expect(layoutScene({ ...resolveBuild(BASE), gpu: plain }, "noir").gpu).toMatchObject({ colors: null, width: 126 });
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
    // Sans boîtier choisi : selon le style.
    const noCase = (style: "rgb" | "minimaliste") => layoutScene(resolveBuild({ ...BASE, case: undefined }), style).fans;
    expect(noCase("rgb")).toMatchObject({ front: 3, rear: 1, rgb: null });
    expect(noCase("minimaliste").front).toBe(2);
    // Avec un boîtier : les ventilateurs qu'il fournit.
    expect(scene({ case: "lancool-216-rgb" }).fans).toEqual({ front: 2, frontSize: 160, rear: 1, rearSize: 140, rgb: true });
    expect(scene({ case: "4000d-airflow" }).fans).toMatchObject({ front: 1, frontSize: 120, rgb: false });
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
    expect(scene().psu).toMatchObject({ wattage: 750 });
  });

  it("garde les ventilateurs fournis à l'intérieur de chaque boîtier", () => {
    for (const pcCase of catalog.case) {
      const frame = frameFor(pcCase);
      const { front, frontSize } = scene({ case: pcCase.id }).fans;
      for (const y of frontFanHeights(front, frontSize)) expect(y - frontSize / 2, pcCase.id).toBeGreaterThanOrEqual(frame.bottom + 4);
      expect(frontSize + 20, pcCase.id).toBeLessThanOrEqual(frame.width);
    }
  });

  it("garde les ventilateurs de façade à l'intérieur du boîtier", () => {
    for (const [count, size] of [[3, 120], [2, 120], [2, 140]] as const) {
      const heights = frontFanHeights(count, size);
      expect(heights).toHaveLength(count);
      expect(Math.max(...heights) + size / 2).toBeLessThanOrEqual(ANCHOR.top - 4);
      expect(Math.min(...heights) - size / 2).toBeGreaterThanOrEqual(ANCHOR.top - CASE.height + 4);
    }
  });

  it("est déterministe", () => {
    expect(scene({ gpu: "rtx-5080" }, "rgb")).toEqual(scene({ gpu: "rtx-5080" }, "rgb"));
  });
});
