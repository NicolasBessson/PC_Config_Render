import Link from "next/link";
import { HeroViewer } from "@/components/HeroViewer";
import { DemoNotice, LinkButton } from "@/components/ui";
import { catalog, CATEGORIES, games } from "@/lib/catalog";

const STEPS = [
  { n: "01", title: "Décrivez votre besoin", text: "Budget, jeux, résolution, fréquence d'images et style. Aucune connaissance des composants n'est nécessaire." },
  { n: "02", title: "Recevez jusqu'à trois configurations", text: "Économique, équilibrée, performance. Toutes vérifiées par un moteur de compatibilité déterministe." },
  { n: "03", title: "Voyez votre PC avant de l'acheter", text: "Chaque proposition s'affiche en 3D dans le style choisi. Tournez, zoomez, changez l'éclairage." },
];

const FEATURES = [
  { title: "Explorer le PC en 3D", text: "Quatre vues, rotation et zoom libres, vitre amovible. Chaque boîtier est à ses dimensions, chaque composant à son gabarit." },
  { title: "Cliquer sur une pièce", text: "Fabricant, modèle, caractéristiques, prix indicatif et compatibilité s'affichent, avec la source lorsqu'elle est vérifiée." },
  { title: "Personnaliser l'éclairage", text: "Deux couleurs, intensité, effets fixe, respiration ou cycle. Les animations se coupent d'un clic." },
  { title: "Vérifier la compatibilité", text: "Socket, mémoire, format, encombrement, alimentation : chaque règle est expliquée, avec les valeurs utilisées." },
  { title: "Comparer deux configurations", text: "Composants, prix, consommation et performances estimées côte à côte, avec un résumé des écarts." },
  { title: "Partager et exporter", text: "Un lien suffit à retrouver une configuration. La liste des composants se copie en un clic." },
];

const PILLARS = [
  { title: "Le style compte autant que les FPS", text: "Blanc, noir, minimaliste ou RGB : vous jugez l'esthétique sur un rendu 3D, pas sur une liste de pièces." },
  { title: "Des estimations transparentes", text: "Chaque chiffre de performance est affiché avec sa fourchette, sa source et son niveau de confiance. Sans donnée fiable, aucun chiffre." },
  { title: "Pensé pour la Suisse", text: "Prix indicatifs en CHF, interface en français, marché suisse en priorité." },
];

export default function Home() {
  const references = CATEGORIES.reduce((sum, category) => sum + catalog[category].length, 0);
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 lg:grid-cols-[1fr_1.05fr] lg:py-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white/5 px-3 py-1 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Configurateur · Compatibilité · Rendu 3D
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Imaginez votre PC.
              <br />
              <span className="text-accent-soft">Voyez-le avant de l&apos;acheter.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Dites-nous à quoi vous voulez jouer et avec quel budget. PC Architect propose des configurations compatibles, estime leurs performances en toute transparence et les affiche en 3D dans le style
              que vous aimez.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/assiste" variant="primary" className="px-6 py-3 text-base">
                Créer avec l&apos;assistant →
              </LinkButton>
              <LinkButton href="/manuel" className="px-6 py-3 text-base">
                Configurer manuellement
              </LinkButton>
            </div>
            <dl className="mt-8 flex gap-8 text-sm">
              {[
                [references, "composants"],
                [games.length, "jeux"],
                [4, "styles"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dd className="font-mono text-2xl font-semibold">{value}</dd>
                  <dt className="text-muted">{label}</dt>
                </div>
              ))}
            </dl>
          </div>
          <HeroViewer />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">Comment ça marche</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="rounded-2xl border border-line bg-surface p-5">
              <span className="font-mono text-sm text-accent-soft">{step.n}</span>
              <h3 className="mt-2 text-lg font-medium">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/assiste" className="group rounded-2xl border border-accent/40 bg-accent/10 p-6 transition hover:bg-accent/15">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-soft">Pour débuter</p>
            <h3 className="mt-2 text-xl font-semibold">Configuration assistée</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">Cinq questions, sans jargon. Le moteur passe en revue tout le catalogue et retient les configurations qui tiennent votre objectif.</p>
            <span className="mt-4 inline-block text-sm font-medium text-ink group-hover:underline">Commencer le questionnaire →</span>
          </Link>
          <Link href="/manuel" className="group rounded-2xl border border-line bg-surface p-6 transition hover:border-white/25">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Pour les passionnés</p>
            <h3 className="mt-2 text-xl font-semibold">Configuration manuelle</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">Choisissez chaque pièce. Compatibilité, prix, consommation et rendu 3D se mettent à jour à chaque changement.</p>
            <span className="mt-4 inline-block text-sm font-medium text-ink group-hover:underline">Ouvrir le configurateur →</span>
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted">
          Vous hésitez entre deux configurations ?{" "}
          <Link href="/comparer" className="text-accent-soft hover:underline">
            Comparez-les côte à côte
          </Link>
          .
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">Ce que vous pouvez faire</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-line bg-surface p-5">
              <h3 className="font-medium">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.text}</p>
            </div>
          ))}
        </div>
        <DemoNotice className="mt-5" />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">Ce qui nous distingue</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="border-l-2 border-accent pl-4">
              <h3 className="font-medium">{pillar.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{pillar.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
