import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

/*
 * Finition du rendu photo. Un lancer de rayons laisse du grain tant que le calcul
 * n'a pas convergé, et quelques points isolés très clairs (un rayon tombé par
 * hasard sur une LED). Cette passe, appliquée à l'affichage seulement, fait deux choses :
 *   1. elle ramène un point isolé au niveau de son deuxième voisin le plus clair ;
 *   2. elle lisse le grain entre pixels de teinte proche, sans traverser les contours.
 * Le lissage faiblit à mesure que les passes s'accumulent : l'image finale garde ses détails.
 */
const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float threshold;
  varying vec2 vUv;

  const float RADIUS = 4.0;
  const float SIGMA = 2.4;

  float luma(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  // Comparaison dans un espace proche de la perception : le grain des zones sombres compte autant que celui des zones claires.
  vec3 perceived(vec3 color) {
    return sqrt(max(color, vec3(0.0)));
  }

  void main() {
    vec2 texel = 1.0 / vec2(textureSize(map, 0));
    vec3 center = texture2D(map, vUv).rgb;

    // Deuxième voisin le plus clair : un trait lumineux d'un pixel de large a toujours deux voisins
    // clairs et reste intact, alors qu'un point isolé — même à côté d'un autre — est ramené au fond.
    float first = 0.0;
    float second = 0.0;
    for (float x = -1.0; x <= 1.0; x++) {
      for (float y = -1.0; y <= 1.0; y++) {
        if (x == 0.0 && y == 0.0) continue;
        float neighbour = luma(texture2D(map, vUv + vec2(x, y) * texel).rgb);
        if (neighbour > first) {
          second = first;
          first = neighbour;
        } else if (neighbour > second) {
          second = neighbour;
        }
      }
    }
    float level = luma(center);
    if (level > second) center *= second / max(level, 1e-6);

    vec3 reference = perceived(center);
    float spatial = 0.5 / (SIGMA * SIGMA);
    float tonal = 0.5 / (threshold * threshold);
    vec3 sum = center;
    float weight = 1.0;
    for (float x = -RADIUS; x <= RADIUS; x++) {
      for (float y = -RADIUS; y <= RADIUS; y++) {
        if (x == 0.0 && y == 0.0) continue;
        vec3 color = texture2D(map, vUv + vec2(x, y) * texel).rgb;
        vec3 delta = perceived(color) - reference;
        float w = exp(-(x * x + y * y) * spatial - dot(delta, delta) * tonal);
        sum += color * w;
        weight += w;
      }
    }

    gl_FragColor = vec4(sum / weight, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Force du lissage selon le nombre de passes : le bruit décroît comme 1/√n. */
export function finishThreshold(samples: number): number {
  return Math.min(0.2, Math.max(0.03, 0.5 / Math.sqrt(Math.max(1, samples))));
}

export function createPhotoFinish() {
  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: null as THREE.Texture | null }, threshold: { value: 0.1 } },
    vertexShader,
    fragmentShader,
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new FullScreenQuad(material);
  return {
    render(renderer: THREE.WebGLRenderer, texture: THREE.Texture, samples: number) {
      material.uniforms.map.value = texture;
      material.uniforms.threshold.value = finishThreshold(samples);
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      quad.render(renderer);
      renderer.autoClear = autoClear;
    },
    dispose() {
      material.dispose();
      quad.dispose();
    },
  };
}
