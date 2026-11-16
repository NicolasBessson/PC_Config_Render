# PC Architect — passation pour l'agent suivant

@AGENTS.md

Configurateur de PC : recommandation à partir d'un besoin, compatibilité, estimation de FPS et visualiseur 3D par style. Le produit et son périmètre sont définis par le cahier des charges v1.1 du projet ; le `README.md` en résume l'essentiel. L'utilisateur écrit surtout en français et débute avec les outils (Node, terminal, Git) : donner des étapes concrètes, une commande à la fois.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (port 3000) |
| `npm test` | Vitest : 32 tests unitaires et d'acceptation des moteurs |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` puis `npm start` | Version de production |
| `node scripts/generate-demo-benchmarks.mjs` | Régénère `data/benchmarks.json` (données synthétiques) |

Avant de considérer un changement terminé : tests, typecheck, lint et build doivent passer.

## État du projet

Fait : accueil, questionnaire assisté, résultats, configuration manuelle, fiche détaillée, comparateur, sauvegarde locale, partage par URL, routes d'API. Les scénarios A à G du cahier des charges (section 19) ont été vérifiés dans un navigateur.

Non fait, à ne pas présenter comme existant :

- **Aucune donnée n'est vérifiée.** Les fiches composants portent `verified: false` ; les prix ont `priceDate: null` ; les benchmarks sont synthétiques (`demo: true`). C'est le chantier prioritaire avant toute mise en ligne.
- Catégorie « ventilateurs supplémentaires » du mode manuel.
- Tout ce qui est hors MVP : comptes, assistant IA, prix en temps réel, modèles 3D de produits réels, ray tracing, upscaling, usages autres que le gaming.

## Règles produit à ne pas enfreindre

Elles viennent du cahier des charges et priment sur la commodité.

1. **Ne jamais inventer une donnée.** Sans benchmark exploitable, le moteur retourne `{ kind: "insufficient" }` et l'interface affiche « Données insuffisantes ». Ne pas ajouter de valeur par défaut, d'interpolation ni de repli.
2. **Compatibilité déterministe.** Les règles sont du code testé et versionné (`version` à incrémenter quand la logique change). Aucune IA ne décide si deux composants sont compatibles.
3. **Les règles métier restent dans `src/lib`**, sans import de React ni de l'interface. Les pages les appellent ; elles ne les réimplémentent pas.
4. **Toute estimation s'affiche avec sa fourchette, sa source et sa confiance.** Tant que les sources sont de démonstration, le badge « Source de démonstration » doit rester visible.
5. **Le rendu 3D est illustratif** et le dit à l'écran. Il ne sert jamais de preuve de compatibilité.
6. **Jamais de quasi-doublons** dans les propositions : deux propositions diffèrent par le CPU ou le GPU, sinon on en affiche moins de trois.
7. **Pas de secret ni d'API payante.** Le MVP fonctionne sans IA externe.

## Architecture

```
data/                    Catalogue, jeux, benchmarks (JSON versionné)
src/lib/catalog/         Schémas Zod, chargement validé, describe.ts
src/lib/compat/          rules.ts (règles), index.ts (checkBuild, checkCandidate)
src/lib/perf/            estimate.ts : modèle d'estimation des FPS
src/lib/recommend/       Énumération, classement, compromis
src/lib/build.ts         Build, prix, consommation, encodage pour l'URL
src/lib/insights.ts      Capacité d'évolution
src/lib/query.ts         Lecture et écriture de l'état dans l'URL
src/lib/saved.ts         Sauvegarde localStorage
src/components/viewer/   PcScene (géométrie), PcCanvas (Canvas), Viewer (contrôles), styles.ts
src/components/          Panneaux partagés, en-tête, useViewState
src/app/                 Pages et routes d'API
```

Points d'entrée utiles :

- **Ajouter un composant** : une entrée dans le bon fichier `data/*.json`. L'identifiant est en minuscules avec tirets, **sans point** (le point sépare les identifiants dans l'URL). Un schéma invalide fait échouer le chargement, volontairement.
- **Ajouter une règle de compatibilité** : un objet dans `RULES` (`src/lib/compat/rules.ts`) et son test dans `compat.test.ts`. Une règle retourne `null` tant que ses composants ne sont pas tous choisis.
- **Ajouter un style** : `styleSchema` dans `schema.ts`, une palette dans `styles.ts`, et un boîtier portant ce `style` (le moteur de recommandation choisit le boîtier par style).
- **Remplacer les benchmarks** : même structure que `data/benchmarks.json`. Une « série » est un tableau de mesures d'une même source dans les mêmes conditions ; la normalisation se fait à l'intérieur d'une série, jamais entre sources.

## Décisions prises, et pourquoi

- **Marge d'alimentation de 25 %** et 75 W pour le reste du système (`src/lib/build.ts`). Sous la marge, la règle échoue.
- **Proposition « Équilibrée »** : rapport performances/prix pondéré par la capacité d'évolution (+10 % par point) et la RAM (+5 % à partir de 32 Go), et jamais plus chère que « Performance ». C'est une interprétation de la section 3.3 ; l'utilisateur en est informé mais ne l'a pas validée explicitement.
- **Une configuration sans benchmark pour son GPU n'est jamais recommandée**, puisque la cible ne peut pas être vérifiée.
- **L'état d'une configuration vit dans l'URL** (`b`, `style`, `lum`, `c`, `res`, `fps`) : pas de base de données, partage immédiat.
- **Le moteur de recommandation tourne dans le navigateur** (environ 100 ms pour 14 000 configurations) ; les routes d'API exposent les mêmes fonctions avec validation Zod.
- **Monster Hunter Wilds et l'Arc B580 n'ont volontairement aucun benchmark**, pour exercer le cas « données insuffisantes ». Ne pas les « corriger ».

## Pièges techniques

- **Next.js 16** avec `cacheComponents` et `partialPrefetching` activés. Lire les guides dans `node_modules/next/dist/docs/` avant d'écrire du code Next. Tout composant qui appelle `useSearchParams` doit être enveloppé dans `<Suspense>` (voir les pages existantes).
- **Polices** : paquet `geist`, local. Ne pas utiliser `next/font/google`, qui exige un accès réseau à la compilation.
- **Aucune ressource 3D externe** : pas de préréglage `Environment` de drei (il télécharge un HDR), pas de `Text` de drei (il télécharge une police). L'environnement est fait de `Lightformer`, les étiquettes de `Html`.
- **Le visualiseur est chargé avec `next/dynamic` et `ssr: false`** depuis un composant client. La détection WebGL et la limite d'erreur sont dans `PcCanvas.tsx` : une panne 3D ne doit jamais casser la page.
- **Cotes de la scène en millimètres**, groupe racine à l'échelle 0,01. Axes : x = largeur (vitre côté +x), y = hauteur, z = profondeur (façade côté +z).
- **Les aperçus des résultats et du comparateur utilisent `animate={false}`** (`frameloop="demand"`) pour ne pas faire tourner trois boucles de rendu.
- **Tailwind 4** : les couleurs sont des jetons définis dans `src/app/globals.css` (`bg-surface`, `text-muted`, `border-line`, `bg-accent`…). Les réutiliser plutôt que d'écrire des valeurs en dur.
- **Colonnes de grille** : ajouter `min-w-0`, sinon un texte tronqué fait déborder la page sur mobile.

## Vérifier dans un navigateur

Les tests Vitest ne couvrent que `src/lib`. Pour l'interface, lancer le site et le piloter avec Playwright (Chromium est préinstallé dans les sessions cloud). Le rendu WebGL sans carte graphique demande ces options :

```js
chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] })
```

Après un `next build`, arrêter l'ancien serveur avec `pkill -f next-server` avant d'en relancer un : sinon l'ancien continue de servir des fichiers périmés et renvoie des erreurs 500.

## Git

- Branche de travail : `claude/intelligent-clarke-50yvp1`. Pas de pull request sans demande explicite.
- **Le push est bloqué** : Claude n'a pas d'accès en écriture à `NicolasBessson/PC_Config_Render` (erreur 403). L'utilisateur doit reconnecter GitHub et installer l'application Claude GitHub sur le dépôt. Tant que ce n'est pas fait, le travail n'existe que dans la session : lui fournir une archive (`git archive --format=zip --prefix=PC_Config_Render/ HEAD`).
- `next dev` réécrit `AGENTS.md` : le committer avec le reste.

## Suite logique

1. Remplacer les données de démonstration par des données sourcées : fiches constructeur, prix relevés avec date, benchmarks saisis à la main avec source et conditions.
2. Faire tester le site par 5 à 10 personnes du public cible (validation externe prévue en phase 1).
3. Affiner le boîtier 3D : c'est l'argument principal du produit face à la concurrence.
4. Trancher les questions ouvertes de la section 23 du cahier des charges, dont le nom « PC Architect AI » pour un MVP sans IA.
