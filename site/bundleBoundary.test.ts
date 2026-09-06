import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DIRECTORIES, FILES } from '../tailwind.site.content.cjs';

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
  '@/services/PolicyService',
  '@/services/UserService',
  '@/components/ui/',
  '@/components/UserAvatar',
  '@/components/RoleBadge',
  '@/components/community/AgeGateDialog',
  '@/components/community/ProfileStats',
  '@/components/community/UserCreationsTab',
  '@/components/menu/DeleteAccountDialog',
  '@/components/menu/ProfileAvatarEditor',
  '@/lib/ageGate',
  '@/lib/apiBase',
  '@/lib/deletionCancellation',
  '@/lib/serverDate',
  '@/lib/utils',
  '@/types',
];

/**
 * What the allowed leaves may reach in turn, checked one hop deeper.
 *
 * The list above only says what `site/` names. A leaf that itself imports a manager is how the game gets
 * in without a single site file mentioning it — which is what `UserAvatar` did, by reaching into
 * `WorldStorageService` for one URL and dragging the world store and its migrations behind it.
 */
const FORBIDDEN_DOWNSTREAM = [
  '@/services/WorldStorageService',
  '@/contexts/',
  '@/views/',
  '@/managers/',
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

/** Where an `@/...` specifier's file actually is, or null when it resolves to nothing readable. */
const resolveApp = (specifier: string): string | null => {
  const base = resolve(SITE, '..', 'src', specifier.slice('@/'.length));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch { /* the next extension */ }
  }

  return null;
};

/** Every `@/...` specifier reachable from the site files, following each one into the next. */
const reachableFromSite = (): Map<string, string> => {
  // The specifier, and the site file or app module that first named it — so a failure says the route in.
  const seen = new Map<string, string>();
  const queue: { specifier: string; via: string }[] = [];

  for (const path of sourceFiles(SITE)) {
    const from = path.slice(SITE.length + 1);
    for (const specifier of appImports(readFileSync(path, 'utf-8'))) queue.push({ specifier, via: from });
  }

  while (queue.length > 0) {
    const { specifier, via } = queue.shift()!;
    if (seen.has(specifier)) continue;
    seen.set(specifier, via);

    const file = resolveApp(specifier);
    if (!file) continue;
    for (const next of appImports(readFileSync(file, 'utf-8'))) {
      queue.push({ specifier: next, via: `${via} → ${specifier}` });
    }
  }

  return seen;
};

describe('the site entry stays out of the game bundle', () => {
  it('imports only the leaves it is allowed to', () => {
    const strays = sourceFiles(SITE).flatMap((path) =>
      appImports(readFileSync(path, 'utf-8'))
        .filter((specifier) => !ALLOWED.some((prefix) => specifier.startsWith(prefix)))
        .map((specifier) => `${path.slice(SITE.length + 1)} → ${specifier}`));

    expect(strays).toEqual([]);
  });

  it('does not reach the game through one of the leaves it is allowed', () => {
    const reached = reachableFromSite();

    const strays = [...reached]
      .filter(([specifier]) => FORBIDDEN_DOWNSTREAM.some((prefix) => specifier.startsWith(prefix)))
      .map(([specifier, via]) => `${via} → ${specifier}`);

    expect(strays).toEqual([]);
  });

  it('reaches a countable number of app modules, not an open-ended set', () => {
    // The list above is a denylist, so it only catches the ways in that somebody has already thought
    // of. This is the backstop: a leaf that starts dragging a subsystem along shows up as a jump here
    // even when nothing it pulls is named. Raise the ceiling deliberately, having looked at what moved.
    expect(reachableFromSite().size).toBeLessThanOrEqual(40);
  });

  it('really does walk past the first hop', () => {
    // Without this, a walk that quietly stopped at the site's own imports would pass the test above
    // while the leaves underneath dragged in whatever they liked.
    const reached = reachableFromSite();

    // Nothing under `site/` names this one; it is reached only through a leaf that does.
    const named = sourceFiles(SITE).flatMap((path) => appImports(readFileSync(path, 'utf-8')));
    expect(named).not.toContain('@/lib/catalogKinds');

    expect(reached.has('@/lib/catalogKinds')).toBe(true);
    expect(reached.get('@/lib/catalogKinds')).toContain('→');
  });

  it('has every file it reaches in the stylesheet’s scan, so nothing reused comes out unstyled', () => {
    // The quietest failure on this boundary. A reused control whose file Tailwind never scanned still
    // renders, still type-checks and still passes its tests — it is simply missing the classes it
    // asked for, so an avatar's `h-16 w-16` circle comes out a `w-16` oval. Nothing else catches it.
    const root = resolve(SITE, '..');
    const scanned = (path: string) =>
      FILES.includes(path) || DIRECTORIES.some((directory) => path.startsWith(directory));

    const unscanned = [...reachableFromSite().keys()]
      .map((specifier) => resolveApp(specifier))
      .filter((file): file is string => !!file)
      // Forward slashes, because the lists are written the way the Tailwind globs are.
      .map((file) => file.slice(root.length + 1).replace(/\\/g, '/'))
      .filter((path) => !scanned(path));

    expect(unscanned).toEqual([]);
  });

  it('has an allow list that really is a list, not everything under src', () => {
    // A guard that allowed '@/' would pass forever. This is what stops the list being widened to
    // nothing by a later edit.
    expect(ALLOWED).not.toContain('@/');
    expect(ALLOWED.every((prefix) => prefix.length > '@/x'.length)).toBe(true);
  });
});
