"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Style } from "@/lib/catalog";
import { parseViewState, viewQuery, type ViewState } from "@/lib/query";
import { STYLES } from "./viewer/styles";

/** État d'une configuration affichée, synchronisé avec l'URL pour le partage. */
export function useViewState() {
  const params = useSearchParams();
  const pathname = usePathname();
  const [state, setState] = useState<ViewState>(() => parseViewState(params));
  const query = viewQuery(state);

  useEffect(() => {
    window.history.replaceState(null, "", `${pathname}?${query}`);
  }, [pathname, query]);

  const update = useCallback((patch: Partial<ViewState>) => setState((prev) => ({ ...prev, ...patch })), []);
  /** Changer de style réinitialise l'éclairage sur celui du style. */
  const setStyle = useCallback((style: Style) => setState((prev) => ({ ...prev, style, lighting: STYLES[style].lighting })), []);
  return { state, update, setStyle, query };
}
