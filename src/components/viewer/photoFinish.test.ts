import { describe, expect, it } from "vitest";
import { finishThreshold } from "./photoFinish";

describe("finition du rendu photo", () => {
  it("lisse fortement les premières passes, puis de moins en moins", () => {
    expect(finishThreshold(1)).toBe(0.2);
    expect(finishThreshold(16)).toBeCloseTo(0.125);
    expect(finishThreshold(100)).toBeCloseTo(0.05);
    expect(finishThreshold(16)).toBeGreaterThan(finishThreshold(64));
  });

  it("garde un lissage minimal sur l'image finale, sans jamais dépasser le maximum", () => {
    expect(finishThreshold(320)).toBe(0.03);
    expect(finishThreshold(100000)).toBe(0.03);
    expect(finishThreshold(0)).toBe(0.2);
  });
});
