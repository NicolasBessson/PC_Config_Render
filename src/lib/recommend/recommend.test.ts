import { describe, expect, it } from "vitest";
import { decodeBuild, encodeBuild, resolveBuild } from "../build";
import { enumerateCandidates, recommend, type RecommendInput } from "./index";

const TEST_A: RecommendInput = { budget: 1500, gameIds: ["cyberpunk-2077"], resolution: "1440p", targetFps: 60, style: "rgb" };
const pair = (p: { build: { cpu: { id: string }; gpu: { id: string } } }) => `${p.build.cpu.id}|${p.build.gpu.id}`;

describe("moteur de recommandation", () => {
  it("n'énumère que des configurations sans conflit bloquant", () => {
    const candidates = enumerateCandidates("minimaliste");
    expect(candidates.length).toBeGreaterThan(1000);
    // Le boîtier minimaliste est mATX : aucune carte mère ATX ne doit passer.
    expect(candidates.every((c) => c.build.motherboard.formFactor !== "ATX")).toBe(true);
    expect(candidates.every((c) => c.build.cpu.socket === c.build.motherboard.socket)).toBe(true);
  });

  it("test d'acceptation A — 1'500 CHF, 1440p, 60 FPS, style RGB", () => {
    const result = recommend(TEST_A);
    expect(result.status).toBe("ok");
    expect(result.proposals.map((p) => p.profile)).toEqual(["economique", "equilibree", "performance"]);
    for (const p of result.proposals) {
      expect(p.price).toBeLessThanOrEqual(1500);
      expect(p.compat.status).not.toBe("incompatible");
      expect(p.meetsTarget).toBe(true);
      expect(p.build.case.style).toBe("rgb");
      expect(p.performance[0].result.kind).toBe("estimate");
    }
    const [eco, , perf] = result.proposals;
    expect(eco.price).toBeLessThanOrEqual(Math.min(...result.proposals.map((p) => p.price)));
    const [, balanced] = result.proposals;
    expect(perf.price).toBeGreaterThan(eco.price);
    expect(balanced.price).toBeGreaterThanOrEqual(eco.price);
    expect(balanced.price).toBeLessThanOrEqual(perf.price);
  });

  it("deux propositions diffèrent au moins par le GPU ou le CPU", () => {
    const result = recommend(TEST_A);
    expect(new Set(result.proposals.map(pair)).size).toBe(result.proposals.length);
  });

  it("affiche moins de trois propositions plutôt que des quasi-doublons", () => {
    // Budget tout juste suffisant : très peu de couples CPU/GPU possibles.
    const cheapest = recommend({ ...TEST_A, budget: 20000 }).proposals[0].price;
    const result = recommend({ ...TEST_A, budget: cheapest });
    expect(result.status).toBe("ok");
    expect(result.proposals.length).toBeLessThan(3);
    expect(new Set(result.proposals.map(pair)).size).toBe(result.proposals.length);
  });

  it("test d'acceptation F — cible irréalisable dans le budget", () => {
    const result = recommend({ budget: 900, gameIds: ["cyberpunk-2077"], resolution: "4K", targetFps: 144, style: "noir" });
    expect(result.status).toBe("no-solution");
    expect(result.proposals.every((p) => !p.meetsTarget)).toBe(true);
    expect(result.proposals.every((p) => p.profile === "meilleur-effort")).toBe(true);
    expect(result.compromises.length).toBeGreaterThan(0);
    // Un compromis proposé doit réellement fonctionner.
    const lower = result.compromises.find((c) => c.kind === "fps" && c.patch.targetFps);
    if (lower) expect(recommend({ budget: 900, gameIds: ["cyberpunk-2077"], resolution: "4K", style: "noir", targetFps: lower.patch.targetFps! }).status).toBe("ok");
  });

  it("un compromis de budget rend la cible atteignable", () => {
    const input: RecommendInput = { budget: 800, gameIds: ["cyberpunk-2077"], resolution: "1440p", targetFps: 60, style: "blanc" };
    const result = recommend(input);
    expect(result.status).toBe("no-solution");
    const budget = result.compromises.find((c) => c.kind === "budget");
    expect(budget).toBeDefined();
    expect(recommend({ ...input, ...budget!.patch }).status).toBe("ok");
  });

  it("test d'acceptation E — jeu sans benchmark : aucun FPS inventé", () => {
    const result = recommend({ ...TEST_A, gameIds: ["monster-hunter-wilds"] });
    expect(result.status).toBe("no-data");
    expect(result.proposals).toHaveLength(0);
    expect(result.gamesWithoutData).toEqual(["Monster Hunter Wilds"]);

    const mixed = recommend({ ...TEST_A, gameIds: ["cyberpunk-2077", "monster-hunter-wilds"] });
    expect(mixed.status).toBe("ok");
    expect(mixed.gamesWithoutData).toEqual(["Monster Hunter Wilds"]);
    const undocumented = mixed.proposals[0].performance.find((g) => g.gameId === "monster-hunter-wilds")!;
    expect(undocumented.result.kind).toBe("insufficient");
    expect(undocumented.meetsTarget).toBeNull();
  });

  it("ne recommande pas une carte graphique sans benchmark", () => {
    const result = recommend({ ...TEST_A, budget: 20000 });
    expect(result.proposals.every((p) => p.build.gpu.id !== "arc-b580")).toBe(true);
  });

  it("est reproductible à données et paramètres identiques", () => {
    const encoded = () => recommend(TEST_A).proposals.map((p) => p.encoded);
    expect(encoded()).toEqual(encoded());
  });

  it("rejette une entrée invalide", () => {
    expect(() => recommend({ ...TEST_A, budget: -5 })).toThrow();
    expect(() => recommend({ ...TEST_A, gameIds: [] })).toThrow();
  });
});

describe("partage par URL", () => {
  it("encode puis décode une configuration", () => {
    const ids = recommend(TEST_A).proposals[0].ids;
    expect(decodeBuild(encodeBuild(ids))).toEqual(ids);
  });

  it("ignore les identifiants inconnus au lieu de les deviner", () => {
    const build = resolveBuild(decodeBuild("r5-7600.carte-inexistante.b650-tomahawk"));
    expect(build.cpu?.id).toBe("r5-7600");
    expect(build.gpu).toBeNull();
    expect(decodeBuild("x".repeat(1000))).toEqual({});
  });
});
