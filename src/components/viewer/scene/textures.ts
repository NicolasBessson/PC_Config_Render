import * as THREE from "three";

/*
 * Textures procédurales, dessinées dans un canvas : aucun fichier image,
 * aucun téléchargement. Créées à la demande, puis réutilisées.
 */
const cache = new Map<string, THREE.Texture>();

function make(key: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat = true, color = true): THREE.Texture {
  let texture = cache.get(key);
  if (!texture) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext("2d")!);
    texture = new THREE.CanvasTexture(canvas);
    // Les cartes de relief et de rugosité sont des données, pas des couleurs.
    texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    cache.set(key, texture);
  }
  return texture;
}

/** Remplit le canvas d'un bruit gris déterministe, pixel par pixel. */
function noise(ctx: CanvasRenderingContext2D, size: number, seed: number, value: (random: () => number, x: number, y: number) => number) {
  const next = random(seed);
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.max(0, Math.min(255, value(next, x, y)));
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** Grain fin des plastiques et de la peinture époxy : relief à peine perceptible, qui casse les reflets trop lisses. */
export function grainTexture() {
  const texture = make("grain", 256, 256, (ctx) => noise(ctx, 256, 11, (next) => 128 + (next() - 0.5) * 150), true, false);
  texture.repeat.set(5, 5);
  return texture;
}

/** Métal brossé : stries fines dans une seule direction, pour la rugosité et le relief. */
export function brushedTexture() {
  const texture = make("brushed", 256, 256, (ctx) => {
    const next = random(23);
    const rows = Array.from({ length: 256 }, () => 105 + next() * 110);
    noise(ctx, 256, 29, (rand, _x, y) => rows[y] + (rand() - 0.5) * 34);
  }, true, false);
  texture.repeat.set(1, 3);
  return texture;
}

/**
 * Carte de normales calculée à partir d'une carte de hauteur (clair = en relief). Contrairement à un
 * simple relief (« bump »), elle est comprise par le lancer de rayons : le grain d'un plastique ou le
 * brossage d'un métal se voient aussi en rendu photo. Les bords se raccordent : la carte se répète.
 */
function normalFrom(key: string, height: THREE.Texture, strength: number): THREE.Texture {
  let texture = cache.get(key);
  if (!texture) {
    const source = height.image as HTMLCanvasElement;
    const { width, height: rows } = source;
    const levels = source.getContext("2d")!.getImageData(0, 0, width, rows).data;
    const at = (x: number, y: number) => levels[(((y + rows) % rows) * width + ((x + width) % width)) * 4] / 255;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = rows;
    const context = canvas.getContext("2d")!;
    const image = context.createImageData(width, rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < width; x++) {
        // Pente dans les deux directions (filtre de Sobel), puis vecteur normal ramené à l'unité.
        const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * strength;
        const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * strength;
        const length = Math.hypot(dx, dy, 1);
        const i = (y * width + x) * 4;
        image.data[i] = Math.round((-dx / length) * 127.5 + 127.5);
        image.data[i + 1] = Math.round((dy / length) * 127.5 + 127.5);
        image.data[i + 2] = Math.round((1 / length) * 127.5 + 127.5);
        image.data[i + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = height.wrapS;
    texture.wrapT = height.wrapT;
    texture.repeat.copy(height.repeat);
    texture.anisotropy = 8;
    cache.set(key, texture);
  }
  return texture;
}

/** Relief du grain des plastiques et de la peinture. */
export function grainNormal() {
  return normalFrom("grain-normal", grainTexture(), 1.2);
}

/** Relief des stries d'un métal brossé. */
export function brushedNormal() {
  return normalFrom("brushed-normal", brushedTexture(), 1.6);
}

/** Relief des pistes et des composants d'un circuit imprimé. */
export function pcbNormal() {
  return normalFrom("pcb-normal", pcbTexture(), 2);
}

/** Gaine tressée des câbles : deux nappes de brins croisés en diagonale. */
function braidTexture() {
  const texture = make("braid", 64, 64, (ctx) => {
    const image = ctx.createImageData(64, 64);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const u = x / 64, v = y / 64;
        // Chaque brin est un bourrelet ; là où deux brins se croisent, celui du dessus l'emporte.
        const over = Math.sin(Math.PI * 4 * (u + v)) ** 2, under = Math.sin(Math.PI * 4 * (u - v)) ** 2;
        const level = Math.round(255 * Math.max(over, under * 0.82));
        const i = (y * 64 + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = level;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }, true, false);
  texture.repeat.set(1, 2);
  return texture;
}
export function braidNormal() {
  return normalFrom("braid-normal", braidTexture(), 1.4);
}

/** Tôle perforée en nid d'abeille : blanc = matière, noir = trou. */
export function perforationTexture() {
  return make("perforation", 64, 112, (ctx) => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 64, 112);
    ctx.fillStyle = "#000";
    for (const [x, y] of [[0, 0], [64, 0], [0, 112], [64, 112], [32, 56]]) {
      ctx.beginPath();
      ctx.arc(x, y, 21, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Générateur pseudo-aléatoire déterministe : même carte à chaque rendu. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Circuit imprimé : pistes, pastilles, puces et sérigraphie, teintés par le matériau. */
export function pcbTexture() {
  return make("pcb", 1024, 1024, (ctx) => {
    const next = random(7);
    ctx.fillStyle = "#c4c4c4";
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.lineCap = "round";
    // Pistes : segments à 45°, par faisceaux parallèles.
    for (let i = 0; i < 260; i++) {
      let x = next() * 1024, y = next() * 1024;
      const lanes = 1 + Math.floor(next() * 4);
      ctx.strokeStyle = next() > 0.45 ? "#e9e9e9" : "#a0a0a0";
      ctx.lineWidth = 1.5;
      const path: [number, number][] = [[x, y]];
      for (let segment = 0; segment < 4; segment++) {
        const length = 24 + next() * 120;
        const direction = Math.floor(next() * 8) * (Math.PI / 4);
        x += Math.cos(direction) * length;
        y += Math.sin(direction) * length;
        path.push([x, y]);
      }
      for (let lane = 0; lane < lanes; lane++) {
        ctx.beginPath();
        path.forEach(([px, py], index) => (index ? ctx.lineTo(px + lane * 4, py + lane * 4) : ctx.moveTo(px + lane * 4, py + lane * 4)));
        ctx.stroke();
      }
      ctx.fillStyle = "#f6f6f6";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Puces et composants montés en surface.
    for (let i = 0; i < 70; i++) {
      const w = 10 + next() * 34, h = 10 + next() * 26, x = next() * 1000, y = next() * 1000;
      ctx.fillStyle = "#3d3d3d";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#dcdcdc";
      for (let pin = 0; pin < w; pin += 5) {
        ctx.fillRect(x + pin, y - 3, 2, 3);
        ctx.fillRect(x + pin, y + h, 2, 3);
      }
    }
    // Sérigraphie : repères génériques, aucun nom de marque. Écrite à l'envers : la scène est retournée à l'affichage.
    ctx.translate(1024, 0);
    ctx.scale(-1, 1);
    ctx.fillStyle = "#fafafa";
    ctx.font = "600 13px ui-monospace, monospace";
    for (const label of ["PCIE_1", "DIMM_A2", "DIMM_B2", "M2_1", "CPU_FAN", "SYS_FAN1", "JFP1", "ATX_PWR", "CPU_PWR", "SATA_1", "JUSB3", "ARGB_1"]) {
      ctx.fillText(label, next() * 940, 20 + next() * 990);
    }
    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 1;
    for (let i = 0; i < 26; i++) ctx.strokeRect(next() * 980, next() * 980, 14 + next() * 50, 10 + next() * 30);
  });
}

/** Faisceau d'ailettes d'un radiateur. */
export function finsTexture() {
  return make("fins", 8, 8, (ctx) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(0, 0, 3, 8);
  });
}

/** Étiquette d'alimentation générique : uniquement la puissance, aucun logo de marque. */
export function psuLabelTexture(wattage: number, light: boolean) {
  return make(`psu-${wattage}-${light}`, 512, 256, (ctx) => {
    // Dessinée à l'envers : la scène est retournée à l'affichage, le texte se lit alors à l'endroit.
    ctx.translate(512, 0);
    ctx.scale(-1, 1);
    ctx.fillStyle = light ? "#eceef1" : "#101216";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#2f6bff";
    ctx.fillRect(36, 44, 10, 168);
    ctx.fillStyle = light ? "#15171b" : "#f2f4f7";
    ctx.font = "700 112px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(`${wattage} W`, 72, 112);
    ctx.fillStyle = light ? "#6b7280" : "#8a93a4";
    ctx.font = "500 34px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.fillText("ALIMENTATION ATX", 74, 196);
  }, false);
}

/** Dégradé de fond de scène, assorti au reste de l'interface. */
export function backdropTexture() {
  return make("backdrop", 512, 512, (ctx) => {
    const base = ctx.createLinearGradient(0, 0, 0, 512);
    base.addColorStop(0, "#111622");
    base.addColorStop(1, "#07090d");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    const glow = ctx.createRadialGradient(256, 215, 0, 256, 215, 300);
    glow.addColorStop(0, "rgba(47,107,255,0.26)");
    glow.addColorStop(1, "rgba(47,107,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 512);
  }, false);
}
