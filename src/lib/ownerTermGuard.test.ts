import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { checkOwnerTerm } from './ownerTermGuard';

const lines = (text: string, path = 'src/x.ts') => checkOwnerTerm(text, path).map((v) => `${v.line}:${v.term}`);

describe('checkOwnerTerm', () => {
  it.each([
    ['the picker label', `label: 'Same Bearer',`],
    ['a doc sentence', 'A trait counts for its bearer.'],
    ['a lowercase identifier', 'const bearerWorld = world;'],
    ['holder as owner', '// The holder of the trait.'],
    ['a holder identifier', 'const traitHolders = traitOwnerMaps(world);'],
    ['a quoted label', `label: 'Bearer',`],
    ['a longer holder identifier', 'const holderIds = rows.map(holderOf);'],
  ])('flags %s', (_name, src) => {
    expect(lines(src)).toHaveLength(1);
  });

  it.each([
    ['the sign-in header', 'headers: { Authorization: `Bearer ${token}` },'],
    ['a scheme argument', `authHeaders(apiToken, 'Bearer')`],
    ['a header comment', '/** A bearer header for the signed-in reader. */'],
    ['the parent-tree walk', 'const parentId = holderOf(locations, at);'],
    ['the placeholder tree ids', 'drop({ activeHolderId, holderId });'],
    ['the word placeholder', 'const placeholders = [];'],
    ['an account holder', 'reads the request as the account holder’s own act'],
  ])('allows %s', (_name, src) => {
    expect(lines(src)).toEqual([]);
  });

  it('reports the line of each hit', () => {
    expect(lines('const a = 1;\nSame Bearer\nfine\nthe holder\n')).toEqual(['2:bearer', '4:holder']);
  });

  it('lets a legacy-key file name the saved key, but not holder', () => {
    expect(lines(`{ kind: 'trait', bearer: mira }`, 'src/lib/version.ts')).toEqual([]);
    expect(lines('the holder', 'src/lib/version.ts')).toEqual(['1:holder']);
  });

  it('lets the glossary and the format doc say the old words are gone', () => {
    expect(lines('_Avoid_: bearer, holder', 'CONTEXT.md')).toEqual([]);
    expect(lines('> 🔁 Older files name the owner under `bearer`. The app reads it as `owner`.', 'docs/WorldFormat.md')).toEqual([]);
  });
});

const ROOT = resolve(__dirname, '..', '..');

const walk = (dir: string, keep: (rel: string) => boolean): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    const rel = relative(ROOT, p).replaceAll('\\', '/');
    if (e.isDirectory()) return rel === 'src/data' ? [] : walk(p, keep);
    return keep(rel) ? [rel] : [];
  });

const MIN_FILES = 500;

const SELF = new Set(['src/lib/ownerTermGuard.ts', 'src/lib/ownerTermGuard.test.ts']);

const scanned = (): string[] => [
  'CONTEXT.md',
  ...walk(join(ROOT, 'docs'), (rel) => rel.endsWith('.md') && !/^docs\/Changelog/.test(rel)),
  ...walk(join(ROOT, 'src'), (rel) => /\.(tsx?|json)$/.test(rel)),
  ...walk(join(ROOT, 'e2e'), (rel) => /\.tsx?$/.test(rel)),
];

describe('the owner term in the repo', () => {
  it('uses neither bearer nor holder for an owner in the docs, the app source, the bundled worlds or the e2e specs', () => {
    const files = scanned().filter((rel) => !SELF.has(rel));
    // A wrong root would scan nothing and pass; the app holds well over this many files.
    expect(files.length).toBeGreaterThan(MIN_FILES);
    const offenders = files.flatMap((rel) =>
      checkOwnerTerm(readFileSync(join(ROOT, rel), 'utf8'), rel).map((v) => `${rel}:${v.line} ${v.text}`),
    );
    expect(offenders, 'Say owner. HTTP `Authorization: Bearer` and the parent-tree `holderOf` are allowed.').toEqual([]);
  });
});
