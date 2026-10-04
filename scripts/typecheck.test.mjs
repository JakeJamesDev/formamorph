// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILD_INFO, SEED, sameDrive, typecheck } from './typecheck.mjs';

const TSCONFIG = JSON.stringify({
  compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler', strict: true, noEmit: true, types: [] },
  include: ['*.ts'],
});
const SHAPE = 'export const count: number = 1;\n';
const USE = "import { count } from './shape';\nexport const doubled: number = count * 2;\n";

const temps = [];
afterEach(() => temps.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** A fixture project where `use.ts` reads a number from `shape.ts`. */
const project = (parent, name) => {
  const root = path.join(parent, name);
  mkdirSync(root);
  writeFileSync(path.join(root, 'tsconfig.json'), TSCONFIG);
  writeFileSync(path.join(root, 'shape.ts'), SHAPE);
  writeFileSync(path.join(root, 'use.ts'), USE);
  return root;
};

const tempParent = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'typecheck-'));
  temps.push(dir);
  return dir;
};

describe('typecheck', () => {
  it('fails on an error planted after a warm run', () => {
    const root = project(tempParent(), 'app');
    expect(typecheck({ root })).toMatchObject({ state: 'cold', status: 0 });
    expect(typecheck({ root })).toMatchObject({ state: 'warm', status: 0 });

    writeFileSync(path.join(root, 'use.ts'), `${USE}export const broken: number = 'text';\n`);
    const run = typecheck({ root });

    expect(run).toMatchObject({ state: 'warm' });
    expect(run.status).not.toBe(0);
    expect(run.output).toMatch(/use\.ts.*error TS2322/);
  }, 60_000);

  it('still reports an error in a file that was clean when the seed was made', () => {
    const parent = tempParent();
    const main = project(parent, 'main');
    expect(typecheck({ root: project(parent, 'clean'), mainRoot: main })).toMatchObject({ status: 0, published: true });

    // use.ts is byte-identical to the seed; only its dependency changed.
    const worktree = project(parent, 'worktree');
    writeFileSync(path.join(worktree, 'shape.ts'), "export const count: string = 'one';\n");
    const run = typecheck({ root: worktree, mainRoot: main });

    expect(run).toMatchObject({ state: 'seeded' });
    expect(run.status).not.toBe(0);
    expect(run.output).toMatch(/use\.ts.*error TS2362/);
  }, 60_000);

  it('fails on a planted error when seeded from a file another worktree wrote back', () => {
    const parent = tempParent();
    const main = project(parent, 'main');
    const first = project(parent, 'first');
    expect(typecheck({ root: first, mainRoot: main })).toMatchObject({ state: 'cold', status: 0, published: true });
    const written = readFileSync(path.join(main, SEED));
    expect(written.equals(readFileSync(path.join(first, BUILD_INFO)))).toBe(true);

    const second = project(parent, 'second');
    writeFileSync(path.join(second, 'use.ts'), `${USE}export const broken: number = 'text';\n`);
    const run = typecheck({ root: second, mainRoot: main });

    expect(run).toMatchObject({ state: 'seeded', published: false });
    expect(run.status).not.toBe(0);
    expect(run.output).toMatch(/use\.ts.*error TS2322/);
    expect(readFileSync(path.join(main, SEED)).equals(written)).toBe(true);
  }, 60_000);

  it('fails on a planted error when seeded from a half-written file', () => {
    const parent = tempParent();
    const main = project(parent, 'main');
    expect(typecheck({ root: project(parent, 'clean'), mainRoot: main })).toMatchObject({ status: 0, published: true });
    const full = readFileSync(path.join(main, SEED));
    writeFileSync(path.join(main, SEED), full.subarray(0, full.length / 2));

    const worktree = project(parent, 'worktree');
    writeFileSync(path.join(worktree, 'use.ts'), `${USE}export const broken: number = 'text';\n`);
    const run = typecheck({ root: worktree, mainRoot: main });

    expect(run).toMatchObject({ state: 'seeded' });
    expect(run.status).not.toBe(0);
    expect(run.output).toMatch(/use\.ts.*error TS2322/);
  }, 60_000);

  it("keeps the main checkout's own runs apart from the seed", () => {
    const main = project(tempParent(), 'main');
    expect(typecheck({ root: main, mainRoot: main })).toMatchObject({ state: 'cold', status: 0, published: false });
    expect(typecheck({ root: main, mainRoot: main })).toMatchObject({ state: 'warm', status: 0, published: false });
    expect(existsSync(path.join(main, BUILD_INFO))).toBe(true);
    expect(existsSync(path.join(main, SEED))).toBe(false);
  }, 60_000);
});

describe.runIf(process.platform === 'win32')('sameDrive', () => {
  it('compares drive roots without case', () => {
    expect(sameDrive('D:\\a\\b', 'd:\\c')).toBe(true);
    expect(sameDrive('C:\\a', 'D:\\a')).toBe(false);
  });
});
