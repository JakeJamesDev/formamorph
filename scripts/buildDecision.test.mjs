// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SKIP_PATTERNS, classifyChange, isSkippable } from './buildDecision.mjs';

describe('classifyChange', () => {
  it('skips a tests-only list', () => {
    const changed = ['src/lib/foo.test.ts', 'scripts/affectedTests.test.mjs', 'src/test/helpAiFixture.ts', 'a.test.js'];
    expect(classifyChange(changed)).toEqual({ build: false, forcing: [] });
  });

  it('skips spec, notes and the worktrees config', () => {
    const changed = ['docs-internal/specs/x/spec.md', 'docs-internal/notes/y/notes.md', '.claude/ticket-worktrees.json'];
    expect(classifyChange(changed).build).toBe(false);
  });

  it('builds a docs-only list, since the help index bundles docs', () => {
    expect(classifyChange(['docs/Changelog.md', 'docs/Home.md'])).toEqual({
      build: true,
      forcing: ['docs/Changelog.md', 'docs/Home.md'],
    });
  });

  it('builds a mixed list and names only the forcing paths', () => {
    const changed = ['src/lib/foo.test.ts', 'src/lib/foo.ts', 'docs-internal/specs/x/spec.md'];
    expect(classifyChange(changed)).toEqual({ build: true, forcing: ['src/lib/foo.ts'] });
  });

  it('builds a source list', () => {
    expect(classifyChange(['src/views/MainMenu.tsx', 'package.json', 'vite.config.js']).build).toBe(true);
  });

  it('builds for a non-source file named like a test', () => {
    expect(classifyChange(['docs/How.test.md', 'public/x.test.png']).build).toBe(true);
  });

  it('does not skip other docs-internal folders or sibling test folders', () => {
    expect(classifyChange(['docs-internal/designs/x/design.md', 'testing/parity/turn-pipeline-parity.json']).build).toBe(true);
  });
});

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
// Bundled source: the default skip set is the scan root, so skipped files never seed the walk.
const isSource = (file) => /^src\/.*\.(ts|tsx|js|jsx)$/.test(file) && !isSkippable(file);
const SOURCE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '/index.ts', '/index.tsx', '/index.js'];
const trackedSet = new Set(tracked);

/** Tracked files the bundle reads that `patterns` would skip: static imports and `import.meta.glob` targets of bundled source. */
export function bundleInputsSkipped(patterns) {
  const skipped = new Set();
  const flag = (file) => {
    if (isSkippable(file, patterns)) skipped.add(file);
  };
  for (const file of tracked.filter(isSource)) {
    flag(file);
    const source = readFileSync(file, 'utf8');
    const dir = path.posix.dirname(file);
    for (const [, spec] of source.matchAll(/(?:from|import|new URL)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      const base = spec.startsWith('@/') ? `src/${spec.slice(2)}` : spec.startsWith('.') ? path.posix.join(dir, spec) : null;
      if (!base) continue;
      const clean = base.split('?')[0];
      for (const extension of SOURCE_EXTENSIONS) if (trackedSet.has(clean + extension)) flag(clean + extension);
    }
    for (const [, args] of source.matchAll(/import\.meta\.glob(?:<[^>]*>)?\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/g)) {
      const globs = [...args.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]).filter((glob) => !glob.startsWith('!'));
      for (const glob of globs) {
        const resolved = glob.startsWith('/') ? glob.slice(1) : path.posix.join(dir, glob);
        for (const candidate of tracked) if (path.posix.matchesGlob(candidate, resolved)) flag(candidate);
      }
    }
  }
  for (const entry of ['index.html', 'package.json', 'vite.config.js', 'tailwind.config.js', 'postcss.config.js', 'tsconfig.json']) flag(entry);
  return [...skipped].sort();
}

describe('skip set against the bundle inputs', () => {
  it('finds source to scan', () => {
    expect(tracked.filter(isSource).length).toBeGreaterThan(100);
    expect(tracked).toContain('docs/_Sidebar.md');
  });

  it('skips no file the Vite entry graph or the help docs bundle reads', () => {
    expect(bundleInputsSkipped(SKIP_PATTERNS)).toEqual([]);
  });

  it('reports the docs the help index bundles when a docs pattern joins the skip set', () => {
    const hit = bundleInputsSkipped([...SKIP_PATTERNS, 'docs/**']);
    expect(hit).toContain('docs/_Sidebar.md');
    expect(hit.some((file) => file.startsWith('docs/') && file !== 'docs/_Sidebar.md')).toBe(true);
  });

  it('reports bundled source when a source pattern joins the skip set', () => {
    const hit = bundleInputsSkipped([...SKIP_PATTERNS, 'src/lib/**']);
    expect(hit.length).toBeGreaterThan(0);
    expect(hit.every((file) => file.startsWith('src/lib/'))).toBe(true);
  });

  it('reports bundled assets reached by glob when their pattern joins the skip set', () => {
    expect(bundleInputsSkipped([...SKIP_PATTERNS, 'src/defaultworlds/*.json'])).toContain('src/defaultworlds/emberwatch.json');
  });
});
