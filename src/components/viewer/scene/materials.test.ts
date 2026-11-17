import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { exposureSafe, luminance, photoAlbedo } from "./materials";

const grey = (level: number) => new THREE.Color().setScalar(level);

describe("adaptation des couleurs à l'exposition du style", () => {
  it("ne touche à rien dans le style blanc, peu exposé", () => {
    expect(luminance(exposureSafe(grey(0.9), 0.21))).toBeCloseTo(0.9, 5);
    expect(luminance(exposureSafe(grey(0.05), 0.21))).toBeCloseTo(0.05, 5);
  });

  it("comprime les teintes claires dans un style sombre, sans assombrir les noirs", () => {
    const white = luminance(exposureSafe(grey(1), 1));
    const mid = luminance(exposureSafe(grey(0.3), 1));
    const dark = luminance(exposureSafe(grey(0.02), 1));
    expect(white).toBeCloseTo(0.21, 2); // un blanc s'affiche comme sous l'éclairage de référence
    expect(white).toBeGreaterThan(mid); // l'ordre des clartés est conservé
    expect(mid).toBeGreaterThan(dark);
    expect(dark).toBeGreaterThan(0.014); // un noir garde l'essentiel de sa surexposition
  });

  it("garde la teinte : les trois composantes sont réduites dans la même proportion", () => {
    const red = exposureSafe(new THREE.Color(0.9, 0.1, 0.1), 1.15);
    expect(red.g / red.r).toBeCloseTo(0.1 / 0.9, 5);
    expect(red.b / red.r).toBeCloseTo(0.1 / 0.9, 5);
  });

  it("tient compte de la clarté de la texture : une texture sombre n'est pas assombrie davantage", () => {
    const factor = exposureSafe(grey(1), 1, 0.03);
    expect(factor.r).toBeGreaterThan(0.6);
    expect(exposureSafe(grey(1), 1, 1).r).toBeLessThan(0.25);
  });

  it("rendu photo : un noir absolu reçoit un minimum de lumière renvoyée", () => {
    expect(luminance(photoAlbedo(grey(0)))).toBeCloseTo(0.022, 5);
    expect(luminance(photoAlbedo(grey(1)))).toBeCloseTo(1, 5);
  });
});

describe("continuité de l'adaptation", () => {
  it("la clarté affichée croît toujours avec la clarté réelle, à toute exposition", () => {
    for (const exposure of [0.5, 1, 1.15]) {
      let previous = 0;
      for (let level = 0.005; level <= 1; level += 0.005) {
        const shown = luminance(exposureSafe(grey(level), exposure));
        expect(shown, `exposition ${exposure}, clarté ${level.toFixed(3)}`).toBeGreaterThan(previous);
        previous = shown;
      }
    }
  });
});
