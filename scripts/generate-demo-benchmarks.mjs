// Génère data/benchmarks.json : un jeu de données de DÉMONSTRATION.
//
// Ces chiffres NE SONT PAS des mesures. Ils sont synthétiques et servent
// uniquement à faire fonctionner le modèle d'estimation (cahier des charges,
// section 6.4) en attendant la saisie manuelle de benchmarks réels et sourcés.
// Toutes les sources produites ici portent `demo: true` ; l'interface l'affiche.
//
// Usage : node scripts/generate-demo-benchmarks.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REFERENCE_GPU = "rtx-5070";
const REFERENCE_CPU = "r7-7800x3d";
const RESOLUTIONS = ["1080p", "1440p", "4K"];

// Performance relative au GPU de référence, par résolution.
const GPU_INDEX = {
  "rtx-5060": [0.6, 0.56, 0.5],
  "rtx-5060ti": [0.7, 0.67, 0.64],
  "rx-9060xt": [0.69, 0.66, 0.62],
  "rtx-5070": [1, 1, 1],
  "rx-9070": [1.04, 1.06, 1.08],
  "rx-9070xt": [1.15, 1.19, 1.22],
  "rtx-5070ti": [1.18, 1.22, 1.26],
  "rtx-5080": [1.32, 1.4, 1.48],
};
const AMD_GPUS = ["rx-9060xt", "rx-9070", "rx-9070xt"];

// FPS du GPU de référence par jeu et résolution (scène de la source A).
const GAMES = {
  "cyberpunk-2077": { anchor: [135, 90, 42], amdBias: 0.97, cpu: { "r7-9800x3d": 215, "r7-7800x3d": 190, "r5-9600x": 160, "r5-7600": 145, "i5-14600kf": 168, "i5-12400f": 112 } },
  fortnite: { anchor: [210, 145, 72], amdBias: 1.0, cpu: { "r7-9800x3d": 380, "r7-7800x3d": 330, "r5-9600x": 270, "r5-7600": 240, "i5-14600kf": 265, "i5-12400f": 175 } },
  "counter-strike-2": { anchor: [420, 300, 150], amdBias: 1.03, cpu: { "r7-9800x3d": 620, "r7-7800x3d": 540, "r5-9600x": 450, "r5-7600": 400, "i5-14600kf": 430, "i5-12400f": 300 } },
  "baldurs-gate-3": { anchor: [170, 125, 65], amdBias: 1.02, cpu: { "r7-9800x3d": 190, "r7-7800x3d": 165, "r5-9600x": 125, "r5-7600": 112, "i5-14600kf": 130, "i5-12400f": 88 } },
};

// La source B teste une autre scène (échelle différente) et un sous-ensemble
// du matériel, avec de légers écarts : c'est ce qui rend la normalisation utile.
const SOURCE_B_SCALE = 0.88;
const SOURCE_B_GPU_DEV = { "rtx-5060ti": 1.04, "rtx-5070": 1, "rx-9070": 0.96, "rx-9070xt": 1.05, "rtx-5070ti": 0.97, "rtx-5080": 1.03 };
const SOURCE_B_CPU_DEV = { "r7-9800x3d": 1.04, "r7-7800x3d": 1, "r5-9600x": 0.97, "i5-14600kf": 1.05 };

const round = (n) => Math.round(n);
const gpuSeries = [];
const cpuSeries = [];
const gpuAnchors = [];
const cpuAnchors = [];

for (const [gameId, game] of Object.entries(GAMES)) {
  RESOLUTIONS.forEach((resolution, r) => {
    const fpsA = {};
    const fpsB = {};
    for (const [gpuId, index] of Object.entries(GPU_INDEX)) {
      const bias = AMD_GPUS.includes(gpuId) ? game.amdBias : 1;
      const base = game.anchor[r] * index[r] * bias;
      fpsA[gpuId] = round(base);
      if (SOURCE_B_GPU_DEV[gpuId]) fpsB[gpuId] = round(base * SOURCE_B_SCALE * SOURCE_B_GPU_DEV[gpuId]);
    }
    gpuSeries.push({ id: `demo-a-${gameId}-${resolution}`, sourceId: "demo-a", gameId, resolution, preset: "Élevé", testCpuId: "r7-9800x3d", date: null, fps: fpsA });
    gpuSeries.push({ id: `demo-b-${gameId}-${resolution}`, sourceId: "demo-b", gameId, resolution, preset: "Élevé", testCpuId: "r7-9800x3d", date: null, fps: fpsB });
    gpuAnchors.push({ gameId, resolution, preset: "Élevé", seriesId: `demo-a-${gameId}-${resolution}`, fps: fpsA[REFERENCE_GPU] });
  });

  const cpuA = { ...game.cpu };
  const cpuB = {};
  for (const [cpuId, dev] of Object.entries(SOURCE_B_CPU_DEV)) cpuB[cpuId] = round(game.cpu[cpuId] * 0.93 * dev);
  cpuSeries.push({ id: `demo-a-cpu-${gameId}`, sourceId: "demo-a", gameId, resolution: "1080p", preset: "Élevé", testGpuId: "rtx-5080", date: null, fps: cpuA });
  cpuSeries.push({ id: `demo-b-cpu-${gameId}`, sourceId: "demo-b", gameId, resolution: "1080p", preset: "Élevé", testGpuId: "rtx-5080", date: null, fps: cpuB });
  cpuAnchors.push({ gameId, preset: "Élevé", seriesId: `demo-a-cpu-${gameId}`, fps: cpuA[REFERENCE_CPU] });
}

const out = {
  notice: "Jeu de données de démonstration : valeurs synthétiques, non mesurées. À remplacer par des benchmarks réels saisis manuellement avec source, date et conditions.",
  referenceGpuId: REFERENCE_GPU,
  referenceCpuId: REFERENCE_CPU,
  sources: [
    { id: "demo-a", name: "Données de démonstration A", url: null, demo: true },
    { id: "demo-b", name: "Données de démonstration B", url: null, demo: true },
  ],
  gpuSeries,
  cpuSeries,
  gpuAnchors,
  cpuAnchors,
};

const target = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "benchmarks.json");
writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
console.log(`${gpuSeries.length} séries GPU, ${cpuSeries.length} séries CPU -> ${target}`);
