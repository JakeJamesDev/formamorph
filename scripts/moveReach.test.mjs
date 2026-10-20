// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOOLING_PATTERNS, moveReach, tsClosure } from './moveReach.mjs';

/** A closure over a hand-written import graph: each file plus everything it reaches. */
function closureOf(graph) {
  return (files) => {
    const seen = new Set();
    const walk = (file) => {
      if (seen.has(file)) return;
      seen.add(file);
      (graph[file] ?? []).forEach(walk);
    };
    files.forEach(walk);
    return seen;
  };
}

const graph = {
  'src/a.ts': ['src/shared.ts'],
  'src/b.ts': ['src/shared.ts'],
  'src/c.ts': ['src/a.ts'],
  'src/shared.ts': [],
  'src/far.ts': [],
};

describe('moveReach', () => {
  it('clears a move that touches only skippable files or modules with no import path to the ticket', () => {
    expect(moveReach(['docs/Changelog.md'], ['src/a.ts'], closureOf(graph)).reaches).toBe(false);
    expect(moveReach(['src/far.ts', 'docs-internal/notes/x.md'], ['src/a.ts'], closureOf(graph)).reaches).toBe(false);
    expect(moveReach(['src/b.ts'], ['src/a.ts'], closureOf(graph)).reaches).toBe(false);
  });

  it('flags a move that imports the ticket, or that the ticket imports', () => {
    expect(moveReach(['src/c.ts'], ['src/a.ts'], closureOf(graph))).toEqual({ reaches: true, reason: "main's new commits import the ticket's src/a.ts" });
    expect(moveReach(['src/shared.ts'], ['src/a.ts'], closureOf(graph))).toEqual({ reaches: true, reason: "the ticket imports main's changed src/shared.ts" });
    expect(moveReach(['src/a.ts'], ['src/a.ts'], closureOf(graph)).reaches).toBe(true);
  });

  it('flags tooling and bundle inputs outside the module graph without a closure', () => {
    const never = () => { throw new Error('closure not needed'); };
    for (const file of ['scripts/affectedTests.mjs', 'package.json', 'tsconfig.json', 'vite.config.js']) {
      expect(moveReach([file], ['src/a.ts'], never).reaches).toBe(true);
    }
    expect(moveReach(['docs/Home.md'], ['src/a.ts'], never).reaches).toBe(true);
    expect(moveReach(['src/index.css'], ['src/a.ts'], never).reaches).toBe(true);
    expect(TOOLING_PATTERNS).toContain('scripts/**');
  });

  it('treats a fixture nothing imports as unreachable', () => {
    expect(moveReach(['testing/baseline/cases.json'], ['src/a.ts'], closureOf(graph)).reaches).toBe(false);
  });
});

describe('tsClosure', () => {
  it('returns the file itself and what it imports, repo-relative', () => {
    const closure = tsClosure(['src/lib/uuid.ts']);
    expect(closure.has('src/lib/uuid.ts')).toBe(true);
    for (const file of closure) expect(file).not.toMatch(/node_modules|^\.\./);
  });
});

describe('cli', () => {
  it('exits 0 for an independent move and 1 for one that reaches the ticket', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'move-reach-'));
    try {
      const run = (probe) => {
        writeFileSync(path.join(dir, 'probe.json'), JSON.stringify(probe));
        try {
          return { code: 0, out: execFileSync(process.execPath, ['scripts/moveReach.mjs', path.join(dir, 'probe.json')], { encoding: 'utf8' }) };
        } catch (error) {
          return { code: error.status, out: error.stdout };
        }
      };
      expect(run({ moved: ['docs/Changelog.md'], changed: ['src/lib/uuid.ts'] })).toMatchObject({ code: 0 });
      expect(run({ moved: ['src/lib/uuid.ts'], changed: ['src/lib/uuid.ts'] })).toMatchObject({ code: 1 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
