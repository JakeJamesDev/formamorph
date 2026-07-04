import { useState, useEffect } from "react";

const STORAGE_KEY = "FORMAMORPH_readmeHiddenWorlds";

/**
 * Per-world "show README on entry" flag, defaulting to true. Backs both checkboxes that control it —
 * the main-menu "Show Readme" (writes the flag directly) and the in-game "Don't Show This Again" (writes
 * its inverse) — off a single stored value so they stay in sync. Only the hidden world ids are persisted
 * (absent ⇒ shown), mirroring the Discover `hiddenWorldIds` pattern.
 */
export function useReadmeVisibility() {
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
  }, [hidden]);

  const showReadme = (id: string | null | undefined) => !id || !hidden.includes(id);
  const setShowReadme = (id: string | null | undefined, show: boolean) => {
    if (!id) return;
    setHidden((prev) =>
      show ? prev.filter((x) => x !== id) : prev.includes(id) ? prev : [...prev, id],
    );
  };

  return { showReadme, setShowReadme };
}
