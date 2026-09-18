import { useSyncExternalStore } from 'react';

/** The root attributes that switch the theme: the mode class and the theme name. */
const THEME_ATTRIBUTES = ['class', 'data-theme'];

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: THEME_ATTRIBUTES });
  return () => observer.disconnect();
}

/** Re-reads `read` whenever the document root changes mode or theme. `read` must return a primitive. */
export function useRootSnapshot<T extends string | number | boolean>(read: () => T): T {
  return useSyncExternalStore(subscribe, read);
}

/** The mode the root renders in, as the theme provider's class sets it. */
export const readRootMode = (): 'light' | 'dark' =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';
