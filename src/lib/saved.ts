"use client";

import { useCallback, useSyncExternalStore } from "react";

export interface SavedBuild {
  id: string;
  name: string;
  /** Chaîne de requête complète de la fiche (configuration, style, éclairage). */
  query: string;
  savedAt: string;
}

const KEY = "pc-architect:configurations";
const EMPTY: SavedBuild[] = [];
let cache: { raw: string | null; value: SavedBuild[] } = { raw: null, value: EMPTY };

function read(): SavedBuild[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY; // stockage indisponible (navigation privée, etc.)
  }
  if (raw === cache.raw) return cache.value;
  let value = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) value = parsed.filter((b) => typeof b?.id === "string" && typeof b?.name === "string" && typeof b?.query === "string");
  } catch {
    value = EMPTY;
  }
  cache = { raw, value };
  return value;
}

function write(list: SavedBuild[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* la sauvegarde locale est un confort, pas une exigence */
  }
  window.dispatchEvent(new Event("pc-architect:saved"));
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("pc-architect:saved", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("pc-architect:saved", callback);
  };
}

/** Configurations sauvegardées dans le navigateur, sans compte utilisateur. */
export function useSavedBuilds() {
  const saved = useSyncExternalStore(subscribe, read, () => EMPTY);
  const save = useCallback((name: string, query: string) => {
    const entry: SavedBuild = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: name.trim().slice(0, 60) || "Ma configuration", query, savedAt: new Date().toISOString() };
    write([entry, ...read()].slice(0, 30));
  }, []);
  const remove = useCallback((id: string) => write(read().filter((b) => b.id !== id)), []);
  return { saved, save, remove };
}
