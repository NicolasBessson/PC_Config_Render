# PC Architect

Configurateur de PC : recommandation à partir d'un besoin, vérification de compatibilité, estimation de performances transparente et visualisation 3D par style. Prix indicatifs en CHF, interface en français.

Ce dépôt contient le MVP décrit par le cahier des charges v1.1, utilisable en local.

## Lancer le site en local

Prérequis : Node.js 20.9 ou plus récent.

```bash
npm install
```

```bash
npm run dev
```

Le site est alors disponible sur http://localhost:3000.

Autres commandes :

| Commande | Rôle |
|---|---|
| `npm test` | Tests unitaires et tests d'acceptation des moteurs |
| `npm run e2e` | Tests navigateur des parcours principaux (site lancé au préalable ; `npx playwright install chromium` la première fois) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | ESLint |
| `npm run build` puis `npm start` | Version de production |

## Pages

| Page | Contenu |
|---|---|
| `/` | Accueil, avec le même PC décliné dans les quatre styles |
| `/assiste` | Questionnaire en cinq étapes : budget, jeux, résolution, fluidité, style |
| `/resultats` | Jusqu'à trois propositions (économique, équilibrée, performance) avec aperçu 3D |
| `/manuel` | Choix composant par composant, compatibilité et rendu mis à jour en direct |
| `/config` | Fiche détaillée : grand visualiseur, style, éclairage, diagnostics |
| `/comparer` | Tableau comparatif de deux configurations |

Une configuration est entièrement décrite par son URL : le lien se partage tel quel. Le bouton « Enregistrer » la conserve dans le navigateur (aucun compte).

## ⚠️ Données de démonstration

Le catalogue et les benchmarks livrés ici servent à faire fonctionner le parcours. **Ils ne sont pas vérifiés.**

- **Composants** (`data/*.json`) : deux campagnes de vérification auprès des fabricants ont eu lieu les 16 et 17 novembre 2026. 25 fiches sur 53 sont `verified: true` ; les 28 autres ont une source mais des champs non confirmés, listés dans `unconfirmed`. La vérification s'appuie sur des extraits de recherche des sites officiels, pas sur une lecture complète des pages.
- **Prix** : ordres de grandeur, pas des relevés. `priceDate: null` signifie « prix non relevé ».
- **Benchmarks** (`data/benchmarks.json`) : valeurs **synthétiques**, produites par `scripts/generate-demo-benchmarks.mjs`. Ce ne sont pas des mesures. Les deux sources portent `demo: true`, et l'interface affiche « Source de démonstration » sur chaque estimation.

Avant toute mise en ligne, ces fichiers doivent être remplacés par des données saisies manuellement avec source, date et conditions (sections 6.4 et 16.5 du cahier des charges).

Pour illustrer le cas « données insuffisantes », un jeu (Monster Hunter Wilds) et deux cartes graphiques (Arc B580, RTX 5090 Founders Edition) n'ont volontairement aucun benchmark : elles ne sont jamais recommandées, seulement choisies à la main. Il en va de même de la plateforme AM4 (Ryzen 5 5600, Ryzen 7 5800X3D, carte mère B550), ajoutée pour son modèle 3D réel.

## Architecture

Monolithe modulaire Next.js (App Router) en TypeScript. Les règles métier vivent dans `src/lib`, sans dépendance à l'interface ni à une IA.

```
data/                     Catalogue, jeux et benchmarks en JSON versionné
scripts/                  Générateur des benchmarks de démonstration
src/lib/catalog/          Schémas Zod et chargement validé des fichiers JSON
src/lib/compat/           Moteur de compatibilité : règles déterministes et versionnées
src/lib/perf/             Modèle d'estimation des FPS (section 6.4)
src/lib/recommend/        Énumération, classement et sélection des propositions (section 5.4)
src/lib/build.ts          Configuration, prix, consommation, encodage pour l'URL
src/components/viewer/    Visualiseur 3D (React Three Fiber) : layout.ts, camera.ts, scene/
src/app/                  Pages et routes d'API
```

### Compatibilité

Trois niveaux : compatible, à vérifier, incompatible. Les sept règles de la section 4.5 sont bloquantes : socket, génération de RAM, format de carte mère, longueur du GPU, encombrement et socket du refroidissement, puissance de l'alimentation (marge de 25 %), connecteurs du GPU. Les vérifications reportées (BIOS, dégagement RAM/ventirad, GPU/radiateur frontal, capacité thermique) retournent « à vérifier ».

### Estimation des FPS

1. Normalisation par source : chaque mesure est divisée par celle du GPU de référence dans la même série.
2. Agrégation des performances relatives par moyenne géométrique.
3. Ancrage sur une mesure absolue du GPU de référence.
4. Résultat = min(limite GPU, limite CPU).
5. Fourchette issue de l'écart entre sources, avec une marge minimale de ±10 %.

Sans mesure exploitable, le moteur retourne « données insuffisantes » et aucun chiffre.

### Recommandation

Toutes les combinaisons du catalogue sont énumérées pour le style choisi, les incompatibles écartées, puis :

- **Économique** : la moins chère qui atteint la cible.
- **Performance** : le FPS estimé le plus élevé dans le budget.
- **Équilibrée** : le meilleur rapport performances/prix, pondéré par la capacité d'évolution, entre les deux autres.

Deux propositions diffèrent au moins par le CPU ou le GPU ; sinon le moteur en affiche moins de trois. Si la cible est hors d'atteinte, il le dit et propose des compromis calculés (budget, résolution, FPS, style).

### Visualiseur 3D

Boîtier moyen-tour générique modélisé en géométrie paramétrique, décliné en quatre styles. Les composants reprennent les cotes du catalogue (longueur, épaisseur et ventilateurs du GPU, hauteur du ventirad, taille et emplacement du radiateur, nombre de barrettes), pas l'apparence exacte des produits : le rendu est signalé « illustratif · modèles génériques ».

- Quatre vues (trois-quarts, côté, intérieur, arrière) avec transitions, rotation, zoom, réinitialisation, commandes tactiles.
- Vitre amovible, étiquettes des composants, capture d'image.
- Clic sur un composant : fiche avec fabricant, modèle, caractéristiques, prix indicatif et compatibilité.
- Chaque produit a son apparence (couleurs, ventilateurs, épaisseur du radiateur) et chaque boîtier ses dimensions extérieures. Pas de logos ni de répliques exactes.
- Éclairage : couleur principale et secondaire, intensité, effets fixe, respiration ou cycle ; les animations peuvent être coupées.
- Deux niveaux de qualité (haute : ombres et halo lumineux ; légère), avec bascule automatique si la fluidité est insuffisante.
- **Rendu photo** : un bouton lance un calcul par lancer de rayons, image par image. La lumière rebondit réellement (ombres douces, LED qui éclairent l'intérieur, vitre qui réfléchit et laisse passer). L'image s'affine en 320 passes ; « Capture » l'enregistre. Demande une carte graphique correcte.
- Si WebGL est indisponible, la page reste utilisable et affiche les données de la configuration.

### Modèles 3D de tiers

Treize fiches du catalogue utilisent un modèle 3D réel, créé par un tiers et publié sur Sketchfab sous licence [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Tous sont repositionnés, mis à l'échelle et compressés (textures réduites, géométrie compactée) ; le boîtier blanc est en outre reteinté, et les couleurs claires sont adaptées à l'exposition du style affiché.

| Produit | Modèle | Auteur |
|---|---|---|
| Corsair 4000D Airflow, noir et blanc | [Corsair 4000D Airflow (Free)](https://sketchfab.com/3d-models/corsair-4000d-airflow-free-34df3ba96cf94e71accdb5779c4b8694) | Kirigami |
| Gigabyte B550 AORUS ELITE V2 | [B550 AORUS ELITE V2 model](https://sketchfab.com/3d-models/b550-aorus-elite-v2-model-59f6b9b39f5d401b8beee8ff0c28e88e) | exitmonad |
| Corsair Vengeance LPX | [RAM Corsair Vengeance LPX](https://sketchfab.com/3d-models/ram-corsair-vengeance-lpx-ee11e1926e514075a70642ecb5dc5c2d) | supahot |
| Intel Arc B580 | [Intel Arc B580 Graphics Card](https://sketchfab.com/3d-models/intel-arc-b580-graphics-card-3251ad158ee44a7e9802cb378b4d281a) | PolyDavid |
| NVIDIA GeForce RTX 5090 Founders Edition | [NVIDIA RTX 5090 Founders Edition](https://sketchfab.com/3d-models/nvidia-rtx-5090-founders-edition-5934a7ddfa144951ac66eb8cab13f220) | PolyDavid |
| TeamGroup T-Force Delta RGB DDR5, noire | [DDR5 RAM - Teamgroup T-Force Black](https://sketchfab.com/3d-models/ddr5-ram-teamgroup-t-force-black-268614943df3411bb6487a9601adc03f) | PolyDavid |
| TeamGroup T-Force Delta RGB DDR5, blanche | [DDR5 RAM - Teamgroup T-Force White](https://sketchfab.com/3d-models/ddr5-ram-teamgroup-t-force-white-198540480d3241f6be95d7e57f53b90a) | PolyDavid |
| Arctic Freezer 34 eSports DUO | [Arctic Freezer (AMD)](https://sketchfab.com/3d-models/arctic-freezer-amd-5b06c10634c049b9865e6036abf2d4ac) | Nouraiz |
| AMD Ryzen 7 9800X3D | [AMD 9800x3D CPU - SUPER LOW POLY](https://sketchfab.com/3d-models/amd-9800x3d-cpu-super-low-poly-3851621aed404adaa5b11efde67d5dc4) | PolyDavid |
| AMD Ryzen 5 7600 | [AMD Ryzen 5 7600 CPU chip (AM5 socket)](https://sketchfab.com/3d-models/amd-ryzen-5-7600-cpu-chip-am5-socket-a05c2732e0b847c2967e2c9282abd5f9) | arsdever |
| Samsung 990 Pro | [Samsung 990 PRO SSD](https://sketchfab.com/3d-models/samsung-990-pro-ssd-6ada64c9ba734e499978a084e68ec3df) | PolyDavid |

L'éclairage de la scène utilise l'image de studio « [Studio Small 03](https://polyhaven.com/a/studio_small_03) » de Sergej Majboroda (Poly Haven, domaine public CC0), servie depuis `public/hdri/`.

Ce ne sont pas des fichiers officiels des fabricants ; les marques appartiennent à leurs détenteurs. Les crédits figurent aussi dans le pied de page du site et dans la fiche de chaque composant. Les fichiers sont dans `public/models/`, le registre dans `src/components/viewer/models.ts`.

### API

| Route | Rôle |
|---|---|
| `GET /api/components[?category=gpu]` | Catalogue |
| `GET /api/components/:id` | Un composant |
| `GET /api/games` | Jeux |
| `POST /api/builds/validate` | Rapport de compatibilité d'une configuration |
| `POST /api/builds/recommend` | Propositions pour un besoin |
| `POST /api/performance/estimate` | Estimation de FPS |

Les entrées sont validées côté serveur avec Zod.

## Hors périmètre de cette version

Pas de comptes, pas d'assistant IA, pas de prix en temps réel, pas de répliques exactes ni de logos des produits (modèles génériques aux cotes du catalogue, signalés « rendu illustratif »), gaming uniquement, un preset graphique par jeu, ray tracing et upscaling désactivés.
