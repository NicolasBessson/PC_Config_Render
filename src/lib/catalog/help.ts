import type { Category } from "./index";

/** Explications courtes pour débutants : à quoi sert chaque composant, et comment le choisir. */
export const CATEGORY_HELP: Record<Category, { role: string; tip: string }> = {
  cpu: {
    role: "Le processeur (CPU) exécute la logique du jeu : physique, intelligence artificielle, préparation des images.",
    tip: "Il compte surtout quand on vise beaucoup d'images par seconde. Il doit avoir le même socket que la carte mère.",
  },
  gpu: {
    role: "La carte graphique (GPU) dessine les images. C'est le composant qui pèse le plus sur les performances en jeu.",
    tip: "Plus la résolution est élevée, plus elle travaille. Vérifiez sa longueur : elle doit entrer dans le boîtier.",
  },
  motherboard: {
    role: "La carte mère relie tous les composants entre eux.",
    tip: "Elle impose le socket du processeur, le type de mémoire (DDR4 ou DDR5) et son format doit convenir au boîtier.",
  },
  ram: {
    role: "La mémoire vive (RAM) garde sous la main les données dont le jeu a besoin tout de suite.",
    tip: "16 Go suffisent pour jouer aujourd'hui, 32 Go laissent de la marge. Elle doit être du type accepté par la carte mère.",
  },
  storage: {
    role: "Le stockage (SSD) conserve le système, les jeux et vos fichiers.",
    tip: "Il joue sur les temps de chargement, pas sur les images par seconde. Les jeux récents pèsent souvent plus de 100 Go.",
  },
  psu: {
    role: "L'alimentation fournit le courant à tous les composants.",
    tip: "Sa puissance doit dépasser la consommation estimée avec une marge, et elle doit avoir les connecteurs de la carte graphique.",
  },
  cooler: {
    role: "Le refroidissement évacue la chaleur du processeur.",
    tip: "Un ventirad (à air) est simple et fiable ; un watercooling (liquide) déporte la chaleur vers un radiateur. Vérifiez qu'il entre dans le boîtier.",
  },
  fans: {
    role: "Les ventilateurs supplémentaires renouvellent l'air du boîtier, en plus de ceux qu'il fournit déjà.",
    tip: "Facultatifs. Leur taille doit correspondre aux emplacements libres du boîtier ; chacun demande un connecteur sur la carte mère ou un répartiteur.",
  },
  case: {
    role: "Le boîtier accueille et protège l'ensemble, et détermine l'allure du PC.",
    tip: "Il limite la taille de la carte mère, la longueur de la carte graphique et la hauteur du refroidissement.",
  },
};

export const GLOSSARY = {
  fps: "FPS : images affichées par seconde. Plus il y en a, plus le jeu paraît fluide. 60 convient à la plupart des jeux.",
  low: "FPS « 1 % low » : la fluidité dans les moments les plus chargés. Elle n'est pas estimée ici, faute de mesures.",
  range: "La fourchette indique l'incertitude de l'estimation : le résultat réel dépend de la scène, des pilotes et des réglages.",
} as const;
