import * as THREE from "three";

/*
 * Textures procédurales, dessinées dans un canvas : aucun fichier image,
 * aucun téléchargement. Créées à la demande, puis réutilisées.
 */
const cache = new Map<string, THREE.Texture>();

function make(key: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat = true): THREE.Texture {
  let texture = cache.get(key);
  if (!texture) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext("2d")!);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    cache.set(key, texture);
  }
  return texture;
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

/** Circuit imprimé : pistes et pastilles discrètes, teintées par le matériau. */
export function pcbTexture() {
  return make("pcb", 512, 512, (ctx) => {
    const next = random(7);
    ctx.fillStyle = "#c9c9c9";
    ctx.fillRect(0, 0, 512, 512);
    ctx.lineCap = "round";
    for (let i = 0; i < 150; i++) {
      let x = next() * 512, y = next() * 512;
      ctx.strokeStyle = next() > 0.5 ? "#f2f2f2" : "#a2a2a2";
      ctx.lineWidth = 1 + Math.floor(next() * 2);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let segment = 0; segment < 4; segment++) {
        const length = 16 + next() * 70;
        const direction = Math.floor(next() * 8) * (Math.PI / 4);
        x += Math.cos(direction) * length;
        y += Math.sin(direction) * length;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
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
