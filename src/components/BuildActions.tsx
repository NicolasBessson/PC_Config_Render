"use client";

import { useState } from "react";
import { buildPrice, componentPrice, fanCountOf, formatChf, type Build } from "@/lib/build";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/catalog";
import { useSavedBuilds } from "@/lib/saved";
import { Button } from "./ui";

/** Sauvegarde locale et partage par lien, sans compte utilisateur. */
/** Liste des composants en texte brut, à coller dans un message ou un document. */
export function buildAsText(build: Build, url: string): string {
  const lines = CATEGORIES.filter((category) => build[category]).map((category) => {
    const component = build[category]!;
    const quantity = category === "fans" ? `${fanCountOf(build)} × ` : "";
    return `${CATEGORY_LABELS[category]} : ${quantity}${component.brand} ${component.name} — ${formatChf(componentPrice(build, category))}`;
  });
  return [...lines, `Total indicatif : ${formatChf(buildPrice(build))} (prix non relevés)`, url].join("\n");
}

export function BuildActions({ query, path = "/config", build }: { query: string; path?: string; build?: Build }) {
  const { save } = useSavedBuilds();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const flash = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2200);
  };
  const share = async () => {
    const url = `${window.location.origin}${path}?${query}`;
    try {
      await navigator.clipboard.writeText(url);
      flash("Lien copié");
    } catch {
      window.prompt("Copiez ce lien :", url);
    }
  };
  const copyList = async () => {
    if (!build) return;
    const text = buildAsText(build, `${window.location.origin}${path}?${query}`);
    try {
      await navigator.clipboard.writeText(text);
      flash("Liste copiée");
    } catch {
      window.prompt("Copiez cette liste :", text);
    }
  };
  const submit = () => {
    save(name, query);
    setNaming(false);
    setName("");
    flash("Configuration enregistrée");
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {naming ? (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-center gap-2">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la configuration" maxLength={60} className="w-52 rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
          <Button variant="primary" type="submit">OK</Button>
          <Button variant="ghost" onClick={() => setNaming(false)}>Annuler</Button>
        </form>
      ) : (
        <>
          <Button onClick={() => setNaming(true)}>Enregistrer</Button>
          <Button onClick={share}>Partager le lien</Button>
          {build && <Button onClick={copyList}>Copier la liste</Button>}
          {build && path === "/config" && <Button onClick={() => window.print()} title="Choisissez « Enregistrer au format PDF » dans la fenêtre d'impression">Exporter en PDF</Button>}
        </>
      )}
      {feedback && <span role="status" className="text-xs text-ok">{feedback}</span>}
    </div>
  );
}
