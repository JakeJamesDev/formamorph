// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { indexMaps, mapStack } from './mapStack.mjs';

let dir;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

// Column 11 of line 1 maps to src/lib/idb.ts 3:3, inside `transactionDone`.
const MAP = { version: 3, sources: ['../../src/lib/idb.ts'], names: ['foo', 'transactionDone'], mappings: 'AAAAA,UAEEC' };

const mapsDir = () => {
  dir = mkdtempSync(path.join(tmpdir(), 'map-stack-'));
  mkdirSync(path.join(dir, 'web', 'assets'), { recursive: true });
  writeFileSync(path.join(dir, 'web', 'assets', 'entityCard-C-HUKBh9.js.map'), JSON.stringify(MAP));
  return indexMaps(dir);
};

describe('mapStack', () => {
  it('rewrites a Safari frame to its source position', () => {
    const stack = 'Stack:\nr@https://formamorph.ai/play/assets/entityCard-C-HUKBh9.js:1:11';
    expect(mapStack(stack, mapsDir())).toBe('Stack:\nr@src/lib/idb.ts:3:3 transactionDone');
  });

  it('rewrites a V8 frame', () => {
    expect(mapStack('    at r (http://x/assets/entityCard-C-HUKBh9.js:1:11)', mapsDir()))
      .toBe('    at r (src/lib/idb.ts:3:3 transactionDone)');
  });

  it('leaves a frame of a chunk it holds no map for', () => {
    const stack = 'r@https://formamorph.ai/play/assets/index-Abc123.js:1:11';
    expect(mapStack(stack, mapsDir())).toBe(stack);
  });
});
