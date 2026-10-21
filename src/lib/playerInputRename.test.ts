/**
 * @vitest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RETIRED = 'ask' + 'Text';
const ROOTS = ['src', 'docs', 'electron', 'site', 'e2e'];
// The rewrite names the old call by design; the changelog records the rename.
const ALLOWED = new Set(['src/lib/scriptTextMigration.ts', 'src/lib/scriptTextMigration.test.ts', 'docs/Changelog.md']);

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return [];
    const path = join(dir, name).replaceAll('\\', '/');
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe('player.input rename', () => {
  it('leaves no source, guide or Design System page naming the retired call', () => {
    const named = ROOTS.flatMap(filesUnder)
      .filter((path) => /\.(tsx?|json|md|mjs|js)$/.test(path) && !ALLOWED.has(path) && !path.endsWith('playerInputRename.test.ts'))
      .filter((path) => readFileSync(path, 'utf8').includes(RETIRED));
    expect(named).toEqual([]);
  });
});
