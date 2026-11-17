import { describe, expect, it } from "vitest";
import { CAMERA_LIMITS, DEFAULT_VIEW, VIEW_ORDER, VIEWS } from "./camera";
import { CASE } from "./layout";

/** Demi-dimensions du boîtier, en unités de scène (1 unité = 100 mm). */
const HALF = { x: CASE.width / 200, y: CASE.height / 200, z: CASE.depth / 200 };

describe("vues de la caméra", () => {
  it("propose les quatre vues prévues, la vue trois-quarts par défaut", () => {
    expect(VIEW_ORDER).toEqual(["trois-quarts", "cote", "interieur", "arriere"]);
    expect(DEFAULT_VIEW).toBe("trois-quarts");
    for (const id of VIEW_ORDER) expect(VIEWS[id].label.length).toBeGreaterThan(0);
  });

  it("chaque vue respecte les limites de navigation", () => {
    for (const id of VIEW_ORDER) {
      const { position, target } = VIEWS[id];
      const offset = position.map((value, i) => value - target[i]);
      const distance = Math.hypot(...offset);
      const polar = Math.acos(offset[1] / distance);
      expect(distance, id).toBeGreaterThanOrEqual(CAMERA_LIMITS.minDistance);
      expect(distance, id).toBeLessThanOrEqual(CAMERA_LIMITS.maxDistance);
      expect(polar, id).toBeGreaterThanOrEqual(CAMERA_LIMITS.minPolarAngle);
      expect(polar, id).toBeLessThanOrEqual(CAMERA_LIMITS.maxPolarAngle);
    }
  });

  it("aucune vue ne place la caméra dans le boîtier", () => {
    for (const id of VIEW_ORDER) {
      const [x, y, z] = VIEWS[id].position;
      const inside = Math.abs(x) < HALF.x + 0.5 && Math.abs(y) < HALF.y + 0.5 && Math.abs(z) < HALF.z + 0.5;
      expect(inside, id).toBe(false);
    }
  });

  it("la distance minimale garde la caméra hors du boîtier, quelle que soit l'orientation", () => {
    const farthestCorner = Math.hypot(HALF.x, HALF.y + 0.2, HALF.z);
    for (const id of VIEW_ORDER) {
      const targetOffset = Math.hypot(...VIEWS[id].target);
      expect(CAMERA_LIMITS.minDistance - targetOffset, id).toBeGreaterThan(farthestCorner);
    }
  });

  it("la vue éclatée recule sans sortir des limites de zoom", () => {
    const { position, target } = VIEWS.eclatee;
    const distance = Math.hypot(...position.map((value, i) => value - target[i]));
    const base = Math.hypot(...VIEWS["trois-quarts"].position.map((value, i) => value - VIEWS["trois-quarts"].target[i]));
    expect(distance).toBeGreaterThan(base);
    expect(distance).toBeLessThanOrEqual(CAMERA_LIMITS.maxDistance);
    expect(VIEW_ORDER).not.toContain("eclatee"); // déclenchée par son bouton, pas par le sélecteur
  });

  it("les vues montrent des faces différentes", () => {
    expect(VIEWS.cote.position[0]).toBeGreaterThan(Math.abs(VIEWS.cote.position[2]) * 5); // face à la vitre
    expect(VIEWS.arriere.position[2]).toBeLessThan(-HALF.z); // derrière le boîtier
    expect(VIEWS["trois-quarts"].position[2]).toBeGreaterThan(HALF.z); // devant
  });
});
