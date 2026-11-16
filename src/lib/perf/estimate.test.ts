import { describe, expect, it } from "vitest";
import type { Benchmarks } from "../catalog";
import { estimateFps, MIN_MARGIN } from "./estimate";

/** Jeu de données minimal, calculable à la main. */
const data: Benchmarks = {
  notice: "test",
  referenceGpuId: "ref-gpu",
  referenceCpuId: "ref-cpu",
  sources: [
    { id: "a", name: "Source A", url: null, demo: false },
    { id: "b", name: "Source B", url: null, demo: false },
  ],
  gpuSeries: [
    // Les deux sources testent des scènes différentes : FPS bruts non comparables.
    { id: "a-1440", sourceId: "a", gameId: "jeu", resolution: "1440p", preset: "Élevé", testCpuId: "ref-cpu", date: null, fps: { "ref-gpu": 100, fast: 150, solo: 80 } },
    { id: "b-1440", sourceId: "b", gameId: "jeu", resolution: "1440p", preset: "Élevé", testCpuId: "ref-cpu", date: null, fps: { "ref-gpu": 50, fast: 100 } },
  ],
  cpuSeries: [
    { id: "a-cpu", sourceId: "a", gameId: "jeu", resolution: "1080p", preset: "Élevé", testGpuId: "fast", date: null, fps: { "ref-cpu": 200, slow: 90 } },
  ],
  gpuAnchors: [{ gameId: "jeu", resolution: "1440p", preset: "Élevé", seriesId: "a-1440", fps: 100 }],
  cpuAnchors: [{ gameId: "jeu", preset: "Élevé", seriesId: "a-cpu", fps: 200 }],
};
const estimate = (gpuId: string, cpuId = "ref-cpu", gameId = "jeu") => estimateFps({ cpuId, gpuId, gameId, resolution: "1440p" }, data);

describe("modèle d'estimation des FPS", () => {
  it("normalise par source puis agrège par moyenne géométrique", () => {
    // Ratios : 150/100 = 1,5 et 100/50 = 2,0 → √(1,5 × 2) ≈ 1,732 → 173 FPS.
    const result = estimate("fast");
    expect(result.kind).toBe("estimate");
    if (result.kind !== "estimate") return;
    expect(result.fps).toBe(173);
    // Une moyenne de FPS bruts donnerait (150 + 100) / 2 = 125 : faux.
    expect(result.fps).not.toBe(125);
  });

  it("donne une fourchette basée sur l'écart entre les sources", () => {
    const result = estimate("fast");
    if (result.kind !== "estimate") throw new Error("estimation attendue");
    expect(result.low).toBe(150); // ancre × ratio minimal
    expect(result.high).toBe(200); // ancre × ratio maximal
    expect(result.confidence).toBe("moyenne"); // deux sources, mais en désaccord
  });

  it("applique une marge minimale avec une seule source", () => {
    const result = estimate("solo");
    if (result.kind !== "estimate") throw new Error("estimation attendue");
    expect(result.fps).toBe(80);
    expect(result.low).toBe(Math.round(80 * (1 - MIN_MARGIN)));
    expect(result.high).toBe(Math.round(80 * (1 + MIN_MARGIN)));
    expect(result.confidence).toBe("faible");
  });

  it("retient min(limite GPU, limite CPU)", () => {
    const result = estimate("fast", "slow");
    if (result.kind !== "estimate") throw new Error("estimation attendue");
    expect(result.gpuLimit).toBe(173);
    expect(result.cpuLimit).toBe(90);
    expect(result.fps).toBe(90);
    expect(result.limitedBy).toBe("cpu");
  });

  it("n'invente jamais de chiffre (test d'acceptation E)", () => {
    expect(estimate("inconnu").kind).toBe("insufficient");
    expect(estimate("fast", "cpu-inconnu").kind).toBe("insufficient");
    expect(estimate("fast", "ref-cpu", "jeu-inconnu").kind).toBe("insufficient");
    expect(estimateFps({ cpuId: "ref-cpu", gpuId: "fast", gameId: "jeu", resolution: "4K" }, data).kind).toBe("insufficient");
  });

  it("conserve la provenance et signale les données de démonstration", () => {
    const result = estimate("fast");
    if (result.kind !== "estimate") throw new Error("estimation attendue");
    expect(result.sources).toEqual(["Source A", "Source B"]);
    expect(result.demo).toBe(false);
    const real = estimateFps({ cpuId: "r5-7600", gpuId: "rtx-5070", gameId: "cyberpunk-2077", resolution: "1440p" });
    expect(real.kind === "estimate" && real.demo).toBe(true);
  });

  it("le catalogue réel : jeu et carte sans benchmark", () => {
    expect(estimateFps({ cpuId: "r5-7600", gpuId: "rtx-5070", gameId: "monster-hunter-wilds", resolution: "1440p" }).kind).toBe("insufficient");
    expect(estimateFps({ cpuId: "r5-7600", gpuId: "arc-b580", gameId: "cyberpunk-2077", resolution: "1440p" }).kind).toBe("insufficient");
  });
});
