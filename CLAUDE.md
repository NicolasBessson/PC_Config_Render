# PC Architect — passation pour l'agent suivant

@AGENTS.md

Configurateur de PC : recommandation à partir d'un besoin, compatibilité, estimation de FPS et visualiseur 3D par style. Le produit et son périmètre sont définis par le cahier des charges v1.1 du projet ; le `README.md` en résume l'essentiel. L'utilisateur écrit surtout en français et débute avec les outils (Node, terminal, Git) : donner des étapes concrètes, une commande à la fois.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (port 3000) |
| `npm test` | Vitest : 83 tests (moteurs, ventilateurs, offres, correspondance configuration ↔ scène 3D, caméra, rendu photo, matériaux) |
| `npm run e2e` | 11 tests navigateur (Playwright) sur un site déjà lancé ; `BASE_URL` pour l'adresse, `PW_CHROMIUM` pour un Chromium existant |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` puis `npm start` | Version de production |
| `node scripts/generate-demo-benchmarks.mjs` | Régénère `data/benchmarks.json` (données synthétiques) |

Avant de considérer un changement terminé : tests, typecheck, lint et build doivent passer.

## État du projet

Fait (MVP) : accueil, questionnaire assisté, résultats, configuration manuelle, fiche détaillée, comparateur, sauvegarde locale, partage par URL, routes d'API. Les scénarios A à G du cahier des charges (section 19) ont été vérifiés dans un navigateur.

Fait (roadmap V2, sprint 1 — qualité visuelle 3D) : boîtier détaillé, composants intérieurs réalistes, câbles, matériaux partagés, ombres, halo lumineux, quatre vues de caméra avec transitions, qualité haute ou légère.

Fait (sprint 2 — 3D interactive, élargi à la demande de l'utilisateur) :

- Clic sur un composant : fiche (fabricant, modèle, caractéristiques, prix indicatif, compatibilité, mentions « non vérifié ») et étiquette surlignée.
- Éclairage : couleur principale et secondaire, intensité, effets fixe / respiration / cycle, case « Animations » qui fige tout. État porté par l'URL (`lum`, `c`, `c2`, `li`, `anim`).
- **Apparence propre à chaque produit** : champ `visual` des fiches (couleurs, largeur du GPU, nombre et taille des ventilateurs, épaisseur du radiateur) et `dimensionsMm` des boîtiers. Le boîtier est rendu à ses dimensions extérieures, avec ou sans cache d'alimentation, alimentation à l'arrière ou à l'avant, et les ventilateurs qu'il fournit.

Sélection : le composant cliqué est entouré d'un cadre lumineux (`Highlight` dans `scene/context.tsx`), calculé sur son encombrement. L'effet `Outline` de `@react-three/postprocessing` a été essayé et ne s'affichait pas : ne pas y revenir sans raison.

Limite assumée : pas de logos ni de répliques exactes des produits (droits des marques, section 16.5 du cahier des charges). Les valeurs `visual` et `dimensionsMm` sont saisies de mémoire, comme le reste du catalogue : à vérifier au sprint 3.

Fait (sprint 3 — catalogue vérifié, première campagne du 16 novembre 2026) : les 40 fiches ont été confrontées aux sites des fabricants. 20 sont `verified: true`, 20 partiellement vérifiées (source consultée, champs listés dans `unconfirmed`). Neuf corrections appliquées. Chaque fiche porte `source`, `verifiedAt` et `specUrl`.

Deuxième campagne, le 17 novembre 2026, pour huit nouvelles fiches (RTX 5090 Founders Edition, Corsair RM1000x, T-Force Delta RGB DDR5 noire et blanche, Arctic Freezer 34 eSports DUO, Gigabyte B550 AORUS ELITE V2, Ryzen 5 5600, Ryzen 7 5800X3D), même méthode : le catalogue compte 53 fiches, dont 25 `verified: true`. La compatibilité AM4 des six refroidissements a été confirmée sur les sites des fabricants.

**Plateforme AM4** (socket `AM4` dans `socketSchema`) : ajoutée pour la carte mère B550, seule carte dont un modèle 3D réel de qualité existe. Ses deux processeurs n'ont **aucun benchmark** : la plateforme n'est donc jamais recommandée, seulement montée à la main, et ses FPS s'affichent « Données insuffisantes ». Non confirmés : la puissance maximale des processeurs (`powerW`, 88 et 142 W) et la liste des BIOS de la carte (`biosUpdateFor`). La RTX 5090 n'a **volontairement aucun benchmark**, comme l'Arc B580 : elle n'est donc jamais recommandée, seulement choisie à la main, et ses FPS s'affichent « Données insuffisantes ».

Limites de ces campagnes, à lever avant de parler de catalogue fiable :

- Les pages des fabricants n'ont pas pu être ouvertes directement (hôtes hors du réseau autorisé) : la vérification repose sur des extraits de recherche restreints aux domaines officiels. Autoriser ces hôtes permettrait de trancher les champs `unconfirmed`.
- **Aucun prix n'est relevé** (`priceDate: null` partout). Tâche 3.2 non faite.
- Points à recontrôler à la main : hauteur du NH-D15 (165 ou 168 mm selon les pages Noctua ; 168 retenu par prudence), largeur de la RX 9060 XT (deux valeurs chez Sapphire), connecteurs PCIe de la RM750e, ventilateur frontal du H5 Flow 2022, position de l'alimentation dans les boîtiers.
- Les champs `visual` (couleurs) ne sont pas vérifiés.

Pour une nouvelle campagne : produire des fichiers de résultats au format décrit en tête de `scripts/apply-verification.mjs`, puis `node scripts/apply-verification.mjs AAAA-MM-JJ resultats.json`. Une fiche ne passe à `verified: true` que si tous ses champs utiles sont confirmés.

Fait (réalisme du rendu, 17 novembre 2026) :

- **Mode « Rendu photo »** (bouton de la barre d'outils) : lancer de rayons progressif, 320 passes, détail dans « Pièges techniques ».
- **Adaptation à l'exposition** (`exposureSafe`, `scene/materials.ts`) : les styles sombres sont éclairés environ cinq fois plus fort que le style blanc ; les couleurs moyennes et claires des produits (`useTint`) et des modèles réels (`GltfModel`) sont ramenées à ce qu'elles donnent sous l'éclairage de référence, sinon un ventirad gris ou une carte blanche sont brûlés dans un boîtier noir.
- **Cinq modèles réels de plus** (RTX 5090 FE, T-Force Delta RGB noire et blanche, Freezer 34 eSports DUO, carte mère Gigabyte B550 AORUS ELITE V2) et **tous les fichiers allégés** : 13 Mo → 6 Mo pour l'ensemble. Montage presque entièrement réel pour les démonstrations : `r5-5600.rtx-5090-fe.b550-aorus-elite-v2.ddr4-32-lpx.990pro-2tb.rm1000x.freezer-34-esports-duo.4000d-airflow`.

Fait (sprint 5 — expérience utilisateur, en partie) : configurateur manuel en trois zones (composants / aperçu 3D / prix et détails) qui deviennent trois onglets sous 1280 px ; répartition du budget par catégorie (`BudgetBreakdown`) ; bouton « Copier la liste » ; aides pour débutants (`src/lib/catalog/help.ts`) ; encart « En bref » du comparateur. Aussi faits : section « Ce que vous pouvez faire » sur l'accueil et graphique des FPS par résolution (`FpsByResolution`). Aussi faits : export PDF (bouton « Exporter en PDF » de la fiche, feuille de style d'impression dans `globals.css`) et catégorie « ventilateurs supplémentaires ».

Sprint 4 (benchmarks réels) **non commencé, volontairement** : il exige des FPS exacts relevés un par un avec leurs conditions de test. Depuis une session sans accès aux pages sources, seuls des extraits de recherche sont disponibles, ce qui ne permet pas de garantir les chiffres. À faire par saisie manuelle, ou avec un accès direct aux sources.

Déploiement : projet Vercel `pc-architect` (compte de l'utilisateur), en ligne sur https://pc-architect-two.vercel.app. Le dépôt GitHub n'est pas encore relié à Vercel (il appartient à un autre compte) : redéployer à la main avec `vercel deploy --prod --yes` après connexion (`vercel login`). L'environnement cloud « PC_Config_Render » autorise `vercel.com` et `api.vercel.com`.

Prochaines étapes : finir le sprint 3 (prix relevés, champs non confirmés), le sprint 4 lorsque les sources seront accessibles, le reste du sprint 5, puis le sprint 6 (tests par 5 à 10 personnes). Ne pas démarrer plusieurs chantiers à la fois.

Non fait, à ne pas présenter comme existant :

- **Les données ne sont que partiellement vérifiées.** 25 fiches sur 53 sont `verified: true` ; aucun prix n'est relevé (`priceDate: null`) ; les benchmarks sont synthétiques (`demo: true`).
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
src/components/viewer/   Visualiseur 3D (détail ci-dessous)
src/components/          Panneaux partagés, en-tête, useViewState
src/app/                 Pages et routes d'API
```

### Visualiseur 3D

```
viewer/layout.ts         PUR et testé : traduit une configuration en description de scène (quoi, où, combien)
viewer/camera.ts         PUR et testé : vues prédéfinies et limites de navigation
viewer/styles.ts         Palettes des quatre styles
viewer/PcScene.tsx       Assemble la scène à partir de layout.ts
viewer/PcCanvas.tsx      Canvas, lumières, ombres, post-traitement, contrôleur de caméra, repli WebGL
viewer/Viewer.tsx        Interface : vues, vitre, étiquettes, qualité, capture, sélecteurs de style et d'éclairage
viewer/scene/            Un fichier par élément : Chassis, Motherboard, Gpu, Ram, Cooler, Psu, Cables, Fan
viewer/scene/materials.ts   Une vingtaine de matériaux partagés par style
viewer/scene/geometry.ts    Géométries mises en cache (tôles percées, rotor, cadre de ventilateur…)
viewer/scene/textures.ts    Textures procédurales dessinées dans un canvas
viewer/scene/context.tsx    Contexte de scène, Glow, Part, Repeat (instanciation), Label
```

Repère : il est ancré au coin haut-arrière côté carte mère (`ANCHOR`). La carte mère, le GPU et le ventilateur arrière ne bougent pas ; la vitre, la façade et le fond suivent les dimensions du boîtier (`frameFor`, type `Frame`). `PcScene` recentre ensuite le tout sur le socle.

Couleurs : celles du produit (`visual`) priment sur celles du style via `useTint` ; un produit sans `visual` retombe sur la palette du style. Seuls les produits réellement RGB (`rgb: true`, `fansRgb`) s'illuminent.

Vue éclatée : bouton de la barre d'outils. Chaque catégorie se déplace selon `EXPLODE_OFFSET` (`scene/context.tsx`), animée dans `Pick` ; la vitre, les câbles et le faisceau d'alimentation sont retirés, les étiquettes affichées d'office, et la caméra prend la vue `eclatee` (absente du sélecteur de vues).

Orientation : les cotes de la scène placent la façade côté +z, ce qui donnait un PC **en miroir** d'un vrai. `PcScene` applique donc une échelle négative en z : dans le monde, vu côté vitre, la façade est à droite et les connecteurs arrière à gauche. Conséquences : les vues de `camera.ts` ont la façade côté −z, et les textes dessinés dans les textures (étiquette d'alimentation, sérigraphie) sont écrits à l'envers pour se lire à l'endroit.

Modèles 3D réels (`viewer/models.ts`, fichiers dans `public/models/`, chargés par `scene/GltfModel.tsx`) : Corsair 4000D Airflow (noir, et blanc par reteinte), Gigabyte B550 AORUS ELITE V2, Corsair Vengeance LPX, Intel Arc B580, NVIDIA RTX 5090 Founders Edition, TeamGroup T-Force Delta RGB DDR5 (noire et blanche), Arctic Freezer 34 eSports DUO, Ryzen 5 7600, Ryzen 7 9800X3D et Samsung 990 Pro, créés par des tiers sur Sketchfab, licence CC BY 4.0.

**Carte mère réelle** : son socket, ses emplacements mémoire, son connecteur 24 broches et son dissipateur M.2 ne sont pas là où la carte générique les dessine. `layout.anchors` (type `Anchors`, `anchorsFor` dans `layout.ts`) porte ces repères ; `Cooler`, `Ram`, `Cables` et `Motherboard` les lisent, jamais les constantes `BOARD.cpuY` / `RAM_SLOT_Z`. Le fichier n'étant pas aux proportions exactes, ses échelles sont calées sur le processeur (profondeur) et sur le premier emplacement PCIe, qui doit tomber face à la carte graphique (hauteur) : test dans `layout.test.ts`. Le modèle embarque un processeur dans son socket ; la scène n'ajoute alors qu'une zone cliquable invisible.

**Matériaux des modèles** (`adapt` dans `GltfModel.tsx`) : (1) copie par `SkeletonUtils.clone`, car certains fichiers ont des pièces articulées (processeur et levier de la B550) qu'un `clone` ordinaire déplace ; (2) `tune` (dans `models.ts`) corrige les matériaux mal déclarés : le circuit de la B550 est annoncé métallique et poli, il devenait blanc dans les styles sombres — c'était le **reflet du studio**, pas la couleur, et seul `specular` (qui passe le matériau en `MeshPhysicalMaterial`) le règle, `envMapIntensity` n'agissant plus sur l'environnement de la scène depuis three r163 ; (3) `INTERIOR_LIGHT` : l'intérieur du boîtier reçoit environ trois fois plus de lumière que l'extérieur (lumières d'ambiance), les pièces intérieures sont adaptées en conséquence, le boîtier non (`interior={false}`). **Préparation d'un fichier** : `gltf-transform` (hors dépôt) avec `dedup`, `prune`, `resize --width 1024 --height 1024`, `webp --quality 86`, `meshopt --level medium` ; le décodeur meshopt est embarqué par drei, aucun téléchargement. Les sommets compressés sont des entiers : `plainGeometry` les reconvertit en flottants au chargement, sans quoi le rendu photo (qui fusionne toute la scène) affiche une image noire. Les cotes de `models.ts` se mesurent sur le fichier d'origine ; la compression ne les change pas. **Parties lumineuses** : `glow` (expression régulière sur le nom du matériau) fait redessiner la barre d'une barrette RGB avec le matériau `Glow` de la scène, pour suivre couleur, intensité et effet. Les éléments émissifs d'un modèle (logo « GEFORCE RTX ») sont plafonnés (`MAX_EMISSIVE`). **Placement** : la scène étant affichée en miroir, chaque modèle se pose avec une matrice de déterminant négatif, sinon ses inscriptions sont inversées ; vérifier en gros plan. **Licence** : toujours relire la fiche du modèle (`/v3/models/<uid>`), la recherche Sketchfab annonce parfois « CC Attribution » pour un modèle en réalité non commercial (cas du Ryzen 7 7800X3D, écarté). Écartés aussi : le NH-D15 (proportions fausses), l'alimentation be quiet! (ancienne génération), la RTX 5070 (trop grossière). La recherche du 17 novembre 2026 n'a rien donné pour les RTX 50, les RX 9000, le Lancool 216, le H5 Flow, l'AP201 ni les cartes mères du catalogue. Le téléchargement passe par l'API Sketchfab avec la clé enregistrée dans l'environnement (`Authorization: Token proxy-injected`). **Le crédit est obligatoire** : il figure dans la fiche du composant, le pied de page et le README ; tout nouveau modèle doit y être ajouté. Seule la licence « CC Attribution » convient (pas les variantes « NonCommercial »). Un boîtier doté d'un modèle impose ses repères à `frameFor` (`frame`, `psuX`), mesurés sur le fichier ; si le fichier ne se charge pas, la forme générique prend le relais. Pistes écartées : Noctua publie des fichiers officiels mais son site bloque les accès automatisés (à télécharger à la main) et ses conditions ne disent rien de la rediffusion ; GrabCAD est non commercial ; les modèles de BuildCores sont interdits de réutilisation ; sa base OpenDB est sous licence non commerciale à partage identique, donc à ne pas importer.

Règle de conception : **toute décision sur ce qui est affiché se prend dans `layout.ts`**, pas dans les composants de `scene/`. C'est ce qui rend la correspondance configuration ↔ rendu testable sans navigateur (`layout.test.ts`). Les modèles sont génériques, aux cotes du catalogue ; le badge « Rendu illustratif · modèles génériques » doit rester affiché.

Ventilateurs supplémentaires : neuvième catégorie, **facultative** (`CORE_CATEGORIES` liste les huit indispensables ; `isComplete` ne regarde que celles-là). Le nombre est porté par `fanCount` (1 à 6) dans `Build` et `BuildIds`, et par deux jetons en fin de lien, absents quand aucun ventilateur n'est choisi : les anciens liens restent valides. Prix via `componentPrice`. Règle `fans-case` : emplacements libres = emplacements du boîtier (`fanSlots`) moins les ventilateurs fournis en façade, une position occupée par un radiateur comptant pour zéro. Le moteur de recommandation n'en propose jamais.

Offres vendeurs (`src/lib/offers`, `data/offers.json`) : structure prête, fichier vide, **aucune interface**. À brancher lorsque des prix auront été relevés avec leur date ; un prix de plus de 14 jours n'est pas « actuel » (`isFresh`), et le classement ne dépend que du prix.

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
- **Post-traitement** (`@react-three/postprocessing`) : le halo n'apparaît que sur les matériaux `Glow`, dont l'intensité émissive dépasse le seuil du `Bloom`. Une surface blanche trop éclairée franchit aussi ce seuil : c'est pourquoi le style blanc a une `exposure` réduite. Avec le compositeur, le fond de scène est une texture opaque (`backdropTexture`), pas un canvas transparent.
- **Rendu photo** (`PhotoTracer` dans `PcCanvas.tsx`, `three-gpu-pathtracer`, chargé à la demande) : la scène passe en mode `photo` (drapeau du contexte), puis est figée et tracée par passes ; déplacer la caméra relance le calcul. Ce que ce mode change, et pourquoi : (1) `Repeat` fusionne ses copies, le lancer de rayons ignorant l'instanciation ; (2) la vitre devient un verre à transmission **d'épaisseur nulle** — épaisse, elle voile tout l'intérieur ; (3) les couleurs sont relevées de 2,2 % (`photoAlbedo`), les noirs des palettes ne renvoyant presque rien, sinon l'intérieur reste noir et les LED n'éclairent rien ; (4) les lumières classiques sont coupées : seules la photo de studio et les éléments lumineux (×6, `PHOTO_GLOW`) éclairent ; (5) la photo de studio est **tournée de −70°** (`PHOTO_TURN`) pour que sa lampe entre par la vitre, et **adoucie** (`softenEnvironment.ts`) car la lampe d'origine, minuscule et très vive, donne du grain et des ombres dures ; (6) à l'affichage, `photoFinish.ts` retire les points isolés et lisse le grain, de moins en moins au fil des passes ; (7) le plateau devient mat, sinon il reflète la lampe arrière. Pièges : `BlurredEnvMapGenerator` de la bibliothèque ne compile pas avec three 0.187 (d'où l'adoucissement maison) ; `WebGLPathTracer` est annoncé obsolète au profit d'une version WebGPU (simple avertissement) ; ne pas modifier `gl` ou `scene` issus de `useThree` (règle ESLint `react-hooks/immutability`) : passer par `get()`. Sans carte graphique, une passe prend 1,5 à 4 s en 520 × 600 et la préparation plus d'une minute ; sur une vraie carte, c'est sans commune mesure, mais **jamais mesuré**.
- **Qualité** : « haute » = ombres + halo + haute densité de pixels ; « légère » = rien de tout cela. Les appareils tactiles démarrent en légère ; `PerformanceMonitor` y bascule si la fluidité est insuffisante ; un choix manuel prime. Coût mesuré sur une configuration complète : environ 390 appels de rendu par image en haute (dont le sol réfléchissant), 200 en légère ; les câbles sont fusionnés en un seul maillage.
- **Sous SwiftShader (tests sans carte graphique), la mesure automatique bascule toujours en qualité légère.** Pour capturer la qualité haute, cliquer sur le bouton « Qualité » jusqu'à lire « haute » : le clic verrouille le choix.
- **Éclairage par l'image** : la scène est éclairée par une vraie photo de studio, `public/hdri/studio_small_03_1k.hdr` (Poly Haven, CC0), chargée par `StudioEnvironment` ; le studio procédural en `Lightformer` ne sert plus que de repli pendant le chargement ou si le fichier manque. La lumière ambiante uniforme est presque coupée (0,15) : c'est l'image qui remplit les ombres. Rendu des couleurs `NEUTRAL` (les courbes ACES et AgX délavent les teintes RGB). Un boîtier blanc renvoie beaucoup plus de lumière : son `exposure` est de 0,21 ; au-delà il est brûlé. La vitre générique a un `envMapIntensity` de 0,5, sinon elle devient laiteuse.
- **Passe « réalisme »** (qualité haute uniquement, `PcCanvas.tsx`) : occlusion ambiante `N8AO` (placée en premier dans le compositeur, `multisampling={0}` et anticrénelage `SMAA`), vignette, sol réfléchissant `MeshReflectorMaterial`, environnement de studio en `Lightformer`. Trop d'occlusion ou trop peu de lumière ambiante rend l'intérieur illisible : une lumière d'appoint neutre est placée dans `PcScene`.
- **Relief des matériaux** : `grainTexture` (plastiques, peinture) et `brushedTexture` (métaux) servent de `bumpMap` / `roughnessMap` ; ce sont des données, créées avec `NoColorSpace`. `useTint` applique le même relief aux couleurs propres aux produits. La vitre est un `MeshPhysicalMaterial` verni.
- **Câbles** (`scene/Cables.tsx`) : chaque câble est une nappe de fils fins (`ribbon`), sur deux rangées, tenue par des peignes. Une trentaine de tubes à six facettes : ne pas augmenter leur finesse sans mesurer.
- **Lumière principale basse et latérale** (`PcCanvas.tsx`) : elle entre par la vitre. Placée plus haut, le dessus du boîtier plonge tout l'intérieur dans l'ombre.
- **Ailettes, condensateurs, vis** passent par `Repeat` (instanciation) ; les rotors sont des géométries fusionnées. Ne pas revenir à un maillage par ailette.
- **Tôles percées** : `panel(largeur, hauteur, épaisseur, trous)` produit de vraies ouvertures. Après `rotateY(π/2)`, l'axe x de la forme devient −z.
- **Tailwind 4** : les couleurs sont des jetons définis dans `src/app/globals.css` (`bg-surface`, `text-muted`, `border-line`, `bg-accent`…). Les réutiliser plutôt que d'écrire des valeurs en dur.
- **Colonnes de grille** : ajouter `min-w-0`, sinon un texte tronqué fait déborder la page sur mobile.

## Vérifier dans un navigateur

Les tests Vitest ne couvrent que la logique. Pour l'interface, `npm run e2e` (script `scripts/e2e.mjs`) couvre les parcours principaux : dans une session cloud, `npm run build && npx next start -p 3210 &` puis `BASE_URL=http://localhost:3210 PW_CHROMIUM=/opt/pw-browsers/chromium npm run e2e`. Pour une vérification visuelle, piloter le site avec Playwright (Chromium est préinstallé dans les sessions cloud). Le rendu WebGL sans carte graphique demande ces options :

```js
chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] })
```

Après un `next build`, arrêter l'ancien serveur avec `pkill -f next-server` avant d'en relancer un : sinon l'ancien continue de servir des fichiers périmés et renvoie des erreurs 500.

## Git

- Branche de travail : `claude/intelligent-clarke-50yvp1`. Pas de pull request sans demande explicite.
- Le push fonctionne depuis que l'application Claude GitHub est installée sur le dépôt. En cas d'erreur 403, c'est cette installation qu'il faut vérifier ; en attendant, fournir une archive (`git archive --format=zip --prefix=PC_Config_Render/ HEAD`).
- `next dev` réécrit `AGENTS.md` : le committer avec le reste.

## Suite logique

1. Remplacer les données de démonstration par des données sourcées : fiches constructeur, prix relevés avec date, benchmarks saisis à la main avec source et conditions.
2. Faire tester le site par 5 à 10 personnes du public cible (validation externe prévue en phase 1).
3. Affiner le boîtier 3D : c'est l'argument principal du produit face à la concurrence.
4. Trancher les questions ouvertes de la section 23 du cahier des charges, dont le nom « PC Architect AI » pour un MVP sans IA.
