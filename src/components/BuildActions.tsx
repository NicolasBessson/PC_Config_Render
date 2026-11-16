"use client";

import { useState } from "react";
import { useSavedBuilds } from "@/lib/saved";
import { Button } from "./ui";

/** Sauvegarde locale et partage par lien, sans compte utilisateur. */
export function BuildActions({ query, path = "/config" }: { query: string; path?: string }) {
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
        </>
      )}
      {feedback && <span role="status" className="text-xs text-ok">{feedback}</span>}
    </div>
  );
}
