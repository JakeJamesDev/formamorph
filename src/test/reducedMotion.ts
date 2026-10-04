import { vi } from 'vitest';

/** Turns the system's reduced-motion preference on for the page. `vi.unstubAllGlobals()` turns it off. */
export function stubReducedMotion(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce'), media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));
}
