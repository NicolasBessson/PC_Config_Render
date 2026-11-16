// Applique au catalogue les résultats d'une campagne de vérification.
//
// Usage : node scripts/apply-verification.mjs <date ISO> <fichier.json> [...]
//
// Chaque fichier est un tableau d'objets :
//   { file, id, status: "verified" | "partial" | "not_found", sourceUrl, sourceLabel,
//     corrections: { "champ" | "chemin.pointé": valeur }, unconfirmed: ["champ"], note }
//
// Une fiche ne passe à `verified: true` que si son statut est "verified" :
// tous les champs utiles ont alors été confirmés par la source constructeur.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [date, ...files] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || files.length === 0) {
  console.error("Usage : node scripts/apply-verification.mjs AAAA-MM-JJ resultats.json [...]");
  process.exit(1);
}
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const cache = new Map();
const load = (name) => {
  if (!cache.has(name)) cache.set(name, JSON.parse(readFileSync(path.join(dataDir, `${name}.json`), "utf-8")));
  return cache.get(name);
};
const setPath = (object, dotted, value) => {
  const keys = dotted.split(".");
  let target = object;
  for (const key of keys.slice(0, -1)) target = target[key] ??= {};
  target[keys.at(-1)] = value;
};

const summary = { verified: 0, partial: 0, not_found: 0, corrections: 0 };
for (const file of files) {
  for (const result of JSON.parse(readFileSync(file, "utf-8"))) {
    const entry = load(result.file).find((component) => component.id === result.id);
    if (!entry) throw new Error(`Composant inconnu : ${result.file}/${result.id}`);
    summary[result.status]++;
    if (result.status === "not_found") continue; // la fiche reste telle quelle, non vérifiée
    for (const [field, value] of Object.entries(result.corrections ?? {})) {
      setPath(entry, field, value);
      summary.corrections++;
      console.log(`correction  ${result.file}/${result.id}  ${field} = ${JSON.stringify(value)}`);
    }
    entry.verified = result.status === "verified";
    entry.verifiedAt = date;
    entry.source = { label: result.sourceLabel, url: result.sourceUrl };
    entry.specUrl = result.sourceUrl;
    if (result.unconfirmed?.length) entry.unconfirmed = result.unconfirmed;
    else delete entry.unconfirmed;
  }
}
for (const [name, content] of cache) writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(content, null, 2) + "\n");
console.log(summary);
