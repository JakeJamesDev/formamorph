// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALWAYS_RUN, GRAPH_COVERED, PATH_TRIGGERS, cjsRequires, gitFiles, relatedFiles, requirersOf } from './testSelection.mjs';

// Tracked and new files; a tracked file deleted in the working tree is gone.
const FILES = gitFiles('ls-files', '--cached', '--others', '--exclude-standard').filter((file) => existsSync(file));
const read = (file) => readFileSync(file, 'utf8');

const TESTS = FILES.filter((file) => /\.test\.(ts|tsx|mjs)$/.test(file) && !file.startsWith('e2e/'));
// testing/ holds probe scripts that only its own opt-in test loads.
const SOURCES = FILES.filter((file) => /\.(ts|tsx|js|jsx|mjs)$/.test(file) && !/^(e2e|testing)\//.test(file));
const CJS = FILES.filter((file) => file.endsWith('.cjs'));

const DISK_READ = /\bnode:(fs|fs\/promises|child_process)\b|['"](fs|fs\/promises|child_process)['"]|process\.cwd\(\)/;
const QUERY_IMPORTS = [
  /(?:from\s*|import\(\s*)['"]([^'"?]+)\?[\w-]+['"]/g,
  /import\.meta\.glob[^(]*\(\s*['"]([^'"]+)['"]\s*,\s*\{[^}]*\bquery:/g,
];

/** The repo path or glob a `?query` import names, or null for a package import. */
const importTarget = (file, specifier) => {
  if (specifier.startsWith('@/')) return `src/${specifier.slice(2)}`;
  if (specifier.startsWith('.')) return path.posix.join(path.posix.dirname(file), specifier);
  return null;
};

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\(\s*)['"]([^'"?]+)['"]/g;
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx'];
const FILE_SET = new Set(FILES);

/** The repo files `file` imports or requires by path. */
const importsOf = (file) =>
  [...read(file).matchAll(IMPORT)].flatMap(([, specifier]) => {
    const target = importTarget(file, specifier);
    const found = target && EXTENSIONS.map((ext) => target + ext).find((candidate) => FILE_SET.has(candidate));
    return found ? [found] : [];
  });

/** Every test file and every module a test reaches through its imports. */
const testReach = () => {
  const seen = new Set();
  const queue = [...TESTS];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...importsOf(file));
  }
  return [...seen];
};

const triggered = (file, target) =>
  Object.entries(PATH_TRIGGERS).some(
    ([glob, files]) => files.includes(file) && (glob === target || path.posix.matchesGlob(target, glob)),
  );
const triggerTargets = new Set(Object.values(PATH_TRIGGERS).flat());

describe('the test selection lists', () => {
  it('classify every test file, and every module a test imports, that reads from disk', () => {
    const reach = testReach();
    expect(reach).toContain('src/lib/turnPipeline/parityTestInputs.ts');
    const readers = reach.filter((file) => DISK_READ.test(read(file)));
    const unclassified = readers.filter((file) => !(file in ALWAYS_RUN || file in GRAPH_COVERED || triggerTargets.has(file)));
    expect(unclassified).toEqual([]);
  });

  it('list only existing disk readers, each with a reason, on one list', () => {
    const problems = [];
    for (const [list, entries] of [['ALWAYS_RUN', ALWAYS_RUN], ['GRAPH_COVERED', GRAPH_COVERED]]) {
      for (const [file, reason] of Object.entries(entries)) {
        if (!existsSync(file)) problems.push(`${list}: ${file} does not exist`);
        else if (!DISK_READ.test(read(file))) problems.push(`${list}: ${file} no longer reads from disk`);
        if (!reason.trim()) problems.push(`${list}: ${file} has no reason`);
      }
    }
    for (const file of Object.keys(ALWAYS_RUN)) if (file in GRAPH_COVERED) problems.push(`${file} is on both lists`);
    expect(problems).toEqual([]);
  });

  it('give every ?query import a path trigger', () => {
    const missing = [];
    for (const file of SOURCES) {
      const source = read(file);
      for (const pattern of QUERY_IMPORTS) {
        for (const [, specifier] of source.matchAll(pattern)) {
          const target = importTarget(file, specifier);
          if (target && !(file in ALWAYS_RUN) && !triggered(file, target)) missing.push(`${file} -> ${target}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('point every path trigger at existing files', () => {
    const problems = [];
    for (const [glob, files] of Object.entries(PATH_TRIGGERS)) {
      if (!FILES.some((file) => path.posix.matchesGlob(file, glob))) problems.push(`${glob} matches no file`);
      for (const file of files) if (!existsSync(file)) problems.push(`${glob}: ${file} does not exist`);
    }
    expect(problems).toEqual([]);
  });

  it('can follow every CommonJS require', () => {
    const dynamic = CJS.flatMap((file) => cjsRequires(file, read(file)).dynamic.map((call) => `${file}: ${call}`));
    expect(dynamic).toEqual([]);
  });

  it('rerun the full suite when the vite config, a file it imports, or the install setup changes', async () => {
    const { default: config } = await import('../vite.config.js');
    // The matcher vitest itself applies to the changed paths, which it resolves to absolute forward-slash form.
    const require = createRequire(import.meta.url);
    const picomatch = require(require.resolve('picomatch', { paths: [path.dirname(require.resolve('vitest/package.json'))] }));
    const fullSuite = picomatch(config.test.forceRerunTriggers);
    const root = process.cwd().replace(/\\/g, '/');
    const imports = [...read('vite.config.js').matchAll(/from '\.\/([^']+)'/g)].map(([, specifier]) =>
      ['', '.ts', '.js', '.mjs'].map((ext) => specifier + ext).find((file) => existsSync(file)),
    );
    expect(imports.length).toBeGreaterThan(0);
    const triggers = ['vite.config.js', ...imports, 'package.json', 'package-lock.json', 'tsconfig.json', '.env', '.env.local'];
    expect(triggers.filter((file) => !fullSuite(`${root}/${file}`))).toEqual([]);
    expect(fullSuite(`${root}/src/components/FontTuneDialog.tsx`)).toBe(false);
  });
});

describe('relatedFiles', () => {
  const requirers = requirersOf(Object.fromEntries(CJS.map((file) => [file, read(file)])));

  it('adds the module that imports a docs page with a query', () => {
    expect(relatedFiles(['docs/Settings.md'], requirers)).toContain('src/lib/docs/bundledDocsIndex.ts');
  });

  it('adds every CommonJS file that requires a changed one, transitively', () => {
    const related = relatedFiles(['electron/streamDownload.cjs'], requirers);
    expect(related).toEqual(expect.arrayContaining(['electron/modelDownload.cjs', 'electron/winUpdate.cjs', 'electron/updater.cjs']));
  });

  it('follows a require into a path trigger, so an engine change reaches the proxy that forks its host', () => {
    expect(relatedFiles(['electron/llmEngine.cjs'], requirers)).toContain('electron/llmEngineProxy.cjs');
  });

  it('adds the test that owns a changed snapshot', () => {
    expect(relatedFiles(['src/a/__snapshots__/B.test.tsx.snap'], new Map())).toContain('src/a/B.test.tsx');
  });

  it('always adds the always-run tests', () => {
    expect(relatedFiles([], new Map())).toEqual(Object.keys(ALWAYS_RUN).sort());
  });
});

describe('gitFiles', () => {
  it('splits the list of a command that ends in a pathspec', () => {
    expect(gitFiles('ls-files', '--', '*.cjs')).toContain('electron/main.cjs');
  });
});

describe('cjsRequires', () => {
  it('resolves literal relative requires and flags the rest', () => {
    const source = "const a = require('./a.cjs');\nconst fs = require('node:fs');\nconst b = require(name);";
    expect(cjsRequires('electron/x.cjs', source)).toEqual({ targets: ['electron/a.cjs'], dynamic: ['require(name)'] });
  });
});
