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

- **Composants** (`data/*.json`) : références réelles, mais caractéristiques saisies de mémoire. Chaque fiche porte `verified: false` et `specUrl: null` tant qu'elle n'a pas été contrôlée contre la fiche constructeur.
- **Prix** : ordres de grandeur, pas des relevés. `priceDate: null` signifie « prix non relevé ».
- **Benchmarks** (`data/benchmarks.json`) : valeurs **synthétiques**, produites par `scripts/generate-demo-benchmarks.mjs`. Ce ne sont pas des mesures. Les deux sources portent `demo: true`, et l'interface affiche « Source de démonstration » sur chaque estimation.

Avant toute mise en ligne, ces fichiers doivent être remplacés par des données saisies manuellement avec source, date et conditions (sections 6.4 et 16.5 du cahier des charges).

Pour illustrer le cas « données insuffisantes », un jeu (Monster Hunter Wilds) et une carte graphique (Arc B580) n'ont volontairement aucun benchmark.

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
src/components/viewer/    Visualiseur 3D (React Three Fiber), boîtier paramétrique
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

Conformément au MVP : pas de comptes, pas d'assistant IA, pas de prix en temps réel, pas de modèles 3D de produits réels (le boîtier est un modèle générique, signalé « rendu illustratif »), pas de catégorie « ventilateurs supplémentaires », gaming uniquement, un preset graphique par jeu, ray tracing et upscaling désactivés.
