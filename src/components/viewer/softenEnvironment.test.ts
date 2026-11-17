import { describe, expect, it } from "vitest";
import { softenEquirect } from "./softenEnvironment";

/** Énergie totale reçue de l'environnement : somme pondérée par l'angle solide. */
function energy(pixels: ArrayLike<number>, width: number, height: number, channels: number): number {
  let sum = 0;
  for (let y = 0; y < height; y++) {
    const weight = Math.sin(((y + 0.5) / height) * Math.PI) / (width * height);
    for (let x = 0; x < width; x++) sum += pixels[(y * width + x) * channels] * weight;
  }
  return sum;
}

describe("adoucissement de l'image de studio", () => {
  it("laisse intact un environnement uniforme", () => {
    const source = new Float32Array(64 * 32 * 3).fill(0.5);
    const out = softenEquirect(source, 64, 32, 3, 32);
    expect(out.length).toBe(32 * 16 * 4);
    for (let i = 0; i < out.length; i += 4) {
      expect(out[i]).toBeCloseTo(0.5, 5);
      expect(out[i + 3]).toBe(1);
    }
  });

  it("étale une lampe ponctuelle sans changer la quantité de lumière", () => {
    const width = 128, height = 64;
    const source = new Float32Array(width * height * 4);
    // Une lampe très vive près de l'horizon, comme dans la photo de studio.
    for (let y = 28; y < 31; y++) for (let x = 40; x < 43; x++) source[(y * width + x) * 4] = 3000;
    const out = softenEquirect(source, width, height, 4, 64);
    const peak = Math.max(...Array.from({ length: out.length / 4 }, (_, i) => out[i * 4]));
    expect(peak).toBeLessThan(300); // la pointe est très atténuée…
    expect(peak).toBeGreaterThan(1); // …mais la lampe reste la zone la plus claire
    const before = energy(source, width, height, 4), after = energy(out, 64, 32, 4);
    expect(after / before).toBeGreaterThan(0.9);
    expect(after / before).toBeLessThan(1.1);
  });
});
