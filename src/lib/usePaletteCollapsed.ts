import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'fm-placeholder-palette-collapsed';
const CHANGE_EVENT = 'fm-placeholder-palette-collapsed';

/**
 * Whether the placeholder palette strip is folded away. A statement about how the author likes to work
 * rather than a per-panel setting, so it is shared by every panel at once and persisted across reloads —
 * the same shape as the prompt editor's split preference.
 */
export function usePaletteCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onChange = (e: Event) => setCollapsed((e as CustomEvent<boolean>).detail);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const update = useCallback((v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
    } catch {
      // A blocked localStorage costs only persistence; this session still honors the choice.
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: v }));
  }, []);

  return [collapsed, update];
}
