import * as THREE from "three";

/*
 * Adoucissement d'une image d'environnement équirectangulaire, pour le rendu photo.
 *
 * La photo de studio contient une lampe petite et très vive. En lancer de rayons, elle
 * donne des ombres dures et beaucoup de grain. Étalée sur un angle plus large, elle se
 * comporte comme une grande boîte à lumière : même quantité de lumière, ombres douces.
 *
 * `softenEquirect` est pure (tableaux en entrée et en sortie) pour pouvoir être testée.
 */

/**
 * @param source   pixels linéaires, ligne par ligne, `channels` valeurs par pixel
 * @param sharpness finesse du lobe : la demi-largeur angulaire vaut environ 1/√sharpness radian
 * @returns pixels RGBA (alpha = 1) de taille `outWidth` × `outWidth / 2`
 */
export function softenEquirect(source: ArrayLike<number>, width: number, height: number, channels: number, outWidth = 128, sharpness = 14): Float32Array {
  const outHeight = outWidth / 2;
  const count = outWidth * outHeight;

  // 1. Réduction par moyenne de blocs : l'énergie de chaque zone est conservée.
  const small = new Float32Array(count * 3);
  for (let y = 0; y < outHeight; y++) {
    const y0 = Math.floor((y * height) / outHeight), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / outHeight));
    for (let x = 0; x < outWidth; x++) {
      const x0 = Math.floor((x * width) / outWidth), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / outWidth));
      let r = 0, g = 0, b = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * width + sx) * channels;
          r += source[i];
          g += source[i + 1];
          b += source[i + 2];
        }
      }
      const n = (y1 - y0) * (x1 - x0), o = (y * outWidth + x) * 3;
      small[o] = r / n;
      small[o + 1] = g / n;
      small[o + 2] = b / n;
    }
  }

  // 2. Direction et angle solide de chaque pixel réduit.
  const directions = new Float32Array(count * 3);
  const solidAngle = new Float32Array(count);
  for (let y = 0; y < outHeight; y++) {
    const theta = ((y + 0.5) / outHeight) * Math.PI;
    for (let x = 0; x < outWidth; x++) {
      const phi = ((x + 0.5) / outWidth) * 2 * Math.PI, i = y * outWidth + x;
      directions[i * 3] = Math.sin(theta) * Math.cos(phi);
      directions[i * 3 + 1] = Math.cos(theta);
      directions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi);
      solidAngle[i] = Math.sin(theta);
    }
  }

  // 3. Convolution sur la sphère par un lobe en exp(sharpness · (cos − 1)).
  const out = new Float32Array(count * 4);
  const cutoff = 1 - 9 / sharpness; // au-delà, le poids est inférieur à e⁻⁹
  for (let i = 0; i < count; i++) {
    const dx = directions[i * 3], dy = directions[i * 3 + 1], dz = directions[i * 3 + 2];
    let r = 0, g = 0, b = 0, total = 0;
    for (let j = 0; j < count; j++) {
      const cos = dx * directions[j * 3] + dy * directions[j * 3 + 1] + dz * directions[j * 3 + 2];
      if (cos < cutoff) continue;
      const w = Math.exp(sharpness * (cos - 1)) * solidAngle[j];
      r += small[j * 3] * w;
      g += small[j * 3 + 1] * w;
      b += small[j * 3 + 2] * w;
      total += w;
    }
    out[i * 4] = r / total;
    out[i * 4 + 1] = g / total;
    out[i * 4 + 2] = b / total;
    out[i * 4 + 3] = 1;
  }
  return out;
}

/** Version adoucie d'une texture d'environnement HDR chargée en mémoire ; `null` si ses pixels ne sont pas lisibles. */
export function softenEnvironment(texture: THREE.Texture, sharpness = 14): THREE.DataTexture | null {
  const image = texture.image as { data?: ArrayLike<number>; width?: number; height?: number } | undefined;
  if (!image?.data || !image.width || !image.height) return null;
  const { data, width, height } = image;
  const channels = Math.round(data.length / (width * height));
  if (channels < 3) return null;
  let linear: ArrayLike<number> = data;
  if (texture.type === THREE.HalfFloatType) {
    const decoded = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) decoded[i] = THREE.DataUtils.fromHalfFloat(data[i]);
    linear = decoded;
  }
  const outWidth = 128;
  const soft = new THREE.DataTexture(softenEquirect(linear, width, height, channels, outWidth, sharpness), outWidth, outWidth / 2, THREE.RGBAFormat, THREE.FloatType);
  soft.mapping = THREE.EquirectangularReflectionMapping;
  soft.colorSpace = THREE.LinearSRGBColorSpace;
  soft.minFilter = THREE.LinearFilter;
  soft.magFilter = THREE.LinearFilter;
  soft.wrapS = THREE.RepeatWrapping;
  soft.flipY = texture.flipY;
  soft.needsUpdate = true;
  return soft;
}
