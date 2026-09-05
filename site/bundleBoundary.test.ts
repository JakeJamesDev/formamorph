import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * The account pages must not pull the game in.
 *
 * A login page that imports a view, a context or a manager quietly gains three.js, Streamdown, QuickJS
 * and the rest, and every gate stays green while it happens — the bundle is simply megabytes larger.
 * So the boundary is stated here as a list, and reaching outside it fails.
 */

const SITE = resolve(__dirname);

/** What `site/` may reach for inside `src/`. Everything here is a leaf the game does not drag along. */
const ALLOWED = [
  '@/services/AuthService',
  '@/components/ui/',
  '@/lib/utils',
  '@/types',
];

/** Every `@/...` specifier in a file, import and dynamic `import()` alike. */
const appImports = (source: string): string[] =>
  [...source.matchAll(/(?:from|import)\s*\(?\s*['"](@\/[^'"]+)['"]/g)].map((hit) => hit[1]);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

describe('the site entry stays out of the game bundle', () => {
  it('imports only the leaves it is allowed to', () => {
    const strays = sourceFiles(SITE).flatMap((path) =>
      appImports(readFileSync(path, 'utf-8'))
        .filter((specifier) => !ALLOWED.some((prefix) => specifier.startsWith(prefix)))
        .map((specifier) => `${path.slice(SITE.length + 1)} → ${specifier}`));

    expect(strays).toEqual([]);
  });

  it('has an allow list that really is a list, not everything under src', () => {
    // A guard that allowed '@/' would pass forever. This is what stops the list being widened to
    // nothing by a later edit.
    expect(ALLOWED).not.toContain('@/');
    expect(ALLOWED.every((prefix) => prefix.length > '@/x'.length)).toBe(true);
  });
});
