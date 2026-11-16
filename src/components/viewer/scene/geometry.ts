import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/*
 * Géométries partagées. Chaque forme n'est construite qu'une fois, puis
 * réutilisée par tous les objets identiques (ventilateurs, panneaux…).
 */
const cache = new Map<string, THREE.BufferGeometry>();

function cached<T extends THREE.BufferGeometry>(key: string, build: () => T): T {
  let geometry = cache.get(key) as T | undefined;
  if (!geometry) {
    geometry = build();
    cache.set(key, geometry);
  }
  return geometry;
}

/** Pavé aux arêtes adoucies. */
export function rbox(width: number, height: number, depth: number, radius = 2): THREE.BufferGeometry {
  const r = Math.min(radius, width / 2, height / 2, depth / 2);
  return cached(`rbox:${width}:${height}:${depth}:${r}`, () => new RoundedBoxGeometry(width, height, depth, 2, r));
}

export function box(width: number, height: number, depth: number): THREE.BufferGeometry {
  return cached(`box:${width}:${height}:${depth}`, () => new THREE.BoxGeometry(width, height, depth));
}

export function cylinder(radiusTop: number, radiusBottom: number, height: number, segments = 24): THREE.BufferGeometry {
  return cached(`cyl:${radiusTop}:${radiusBottom}:${height}:${segments}`, () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments));
}

export function torus(radius: number, tube: number, segments = 48): THREE.BufferGeometry {
  return cached(`torus:${radius}:${tube}:${segments}`, () => new THREE.TorusGeometry(radius, tube, 10, segments));
}

export function disc(radius: number): THREE.BufferGeometry {
  return cached(`disc:${radius}`, () => new THREE.CircleGeometry(radius, 32));
}

export type Hole = { x: number; y: number; w: number; h: number; r?: number } | { x: number; y: number; radius: number };

function roundedRect(target: THREE.Shape | THREE.Path, x: number, y: number, w: number, h: number, r: number) {
  const left = x - w / 2, right = x + w / 2, bottom = y - h / 2, top = y + h / 2;
  const radius = Math.min(r, w / 2, h / 2);
  target.moveTo(left + radius, bottom);
  target.lineTo(right - radius, bottom);
  target.quadraticCurveTo(right, bottom, right, bottom + radius);
  target.lineTo(right, top - radius);
  target.quadraticCurveTo(right, top, right - radius, top);
  target.lineTo(left + radius, top);
  target.quadraticCurveTo(left, top, left, top - radius);
  target.lineTo(left, bottom + radius);
  target.quadraticCurveTo(left, bottom, left + radius, bottom);
}

/**
 * Tôle plane percée d'ouvertures, dans le plan XY, d'épaisseur centrée en z.
 * C'est ce qui donne de vraies ouvertures : grille de ventilateur, baie
 * d'alimentation, découpe des connecteurs.
 */
export function panel(width: number, height: number, thickness: number, holes: Hole[] = [], corner = 3): THREE.BufferGeometry {
  return cached(`panel:${width}:${height}:${thickness}:${corner}:${JSON.stringify(holes)}`, () => {
    const shape = new THREE.Shape();
    roundedRect(shape, 0, 0, width, height, corner);
    for (const hole of holes) {
      const path = new THREE.Path();
      if ("radius" in hole) path.absarc(hole.x, hole.y, hole.radius, 0, Math.PI * 2, true);
      else roundedRect(path, hole.x, hole.y, hole.w, hole.h, hole.r ?? 2);
      shape.holes.push(path);
    }
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 20 });
    geometry.translate(0, 0, -thickness / 2);
    return geometry;
  });
}

/** Plan dont les UV suivent les dimensions réelles, pour une perforation de pas constant. */
export function perforated(width: number, height: number, pitch = 7): THREE.BufferGeometry {
  return cached(`perf:${width}:${height}:${pitch}`, () => {
    const geometry = new THREE.PlaneGeometry(width, height);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * width) / pitch, (uv.getY(i) * height) / (pitch * 1.75));
    return geometry;
  });
}

/** Cadre de ventilateur : carré arrondi percé, avec les quatre bras du moteur à l'arrière. */
export function fanFrame(size: number): THREE.BufferGeometry {
  return cached(`fan-frame:${size}`, () => {
    const body = panel(size, size, 25, [{ x: 0, y: 0, radius: size / 2 - 4 }], 9).clone();
    const parts: THREE.BufferGeometry[] = [body];
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      const arm = new THREE.BoxGeometry(size - 10, 4, 2.5).toNonIndexed();
      arm.rotateZ(angle);
      arm.translate(0, 0, -11);
      parts.push(arm);
    }
    const mount = new THREE.CylinderGeometry(size * 0.16, size * 0.16, 2.5, 24).toNonIndexed();
    mount.rotateX(Math.PI / 2);
    mount.translate(0, 0, -11);
    parts.push(mount);
    return mergeGeometries(parts)!;
  });
}

/** Rotor : moyeu et pales galbées, fusionnés en un seul maillage. */
export function fanRotor(size: number, blades = 9): THREE.BufferGeometry {
  return cached(`fan-rotor:${size}:${blades}`, () => {
    const tip = size / 2 - 6;
    const hub = size * 0.17;
    const span = tip - hub;
    const chord = size * 0.19;
    const outline = new THREE.Shape();
    outline.moveTo(hub - 2, -chord * 0.4);
    outline.bezierCurveTo(hub + span * 0.35, -chord * 1.0, tip - 8, -chord * 1.05, tip, -chord * 0.35);
    outline.quadraticCurveTo(tip + 1, chord * 0.3, tip - 5, chord * 0.62);
    outline.bezierCurveTo(tip - span * 0.45, chord * 0.62, hub + 8, chord * 0.55, hub - 2, chord * 0.4);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < blades; i++) {
      const blade = new THREE.ExtrudeGeometry(outline, { depth: 1.4, bevelEnabled: false, curveSegments: 8 });
      blade.translate(0, 0, -0.7);
      blade.rotateX(0.5);
      blade.rotateZ((i * Math.PI * 2) / blades);
      parts.push(blade);
    }
    const core = new THREE.CylinderGeometry(hub, hub, 17, 32).toNonIndexed();
    core.rotateX(Math.PI / 2);
    parts.push(core);
    return mergeGeometries(parts)!;
  });
}

/** Dissipateur d'une barrette de RAM, vu de profil (plan XY, x = hauteur). */
export function ramSpreader(height: number): THREE.BufferGeometry {
  return cached(`ram:${height}`, () => {
    const half = 66.5;
    const shape = new THREE.Shape();
    shape.moveTo(4, -half);
    shape.lineTo(height - 12, -half);
    shape.lineTo(height - 6, -half + 10);
    shape.lineTo(height - 6, -18);
    shape.lineTo(height - 9, -12);
    shape.lineTo(height - 9, 12);
    shape.lineTo(height - 6, 18);
    shape.lineTo(height - 6, half - 10);
    shape.lineTo(height - 12, half);
    shape.lineTo(4, half);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 6.4, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.5, bevelSegments: 1 });
    geometry.translate(0, 0, -3.2);
    return geometry;
  });
}

/** Tube souple passant par une série de points : câbles et tuyaux. */
export function tube(points: [number, number, number][], radius: number): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.5);
  return new THREE.TubeGeometry(curve, 36, radius, 10, false);
}
