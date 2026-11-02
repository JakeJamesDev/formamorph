import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parseNotices } from '../src/lib/noticesFormat';
import { REGENERATE, noticesDrift, packageIds, packageRootOf, packageRoots, shipNotices } from './shipNotices.mjs';

const THREE_VERSION = (JSON.parse(readFileSync('node_modules/three/package.json', 'utf8')) as { version: string }).version;
const THREE_MODULE = join(process.cwd(), 'node_modules/three/build/three.module.js');

const packageEntry = (name: string, text = '- License: **MIT**\n\n```\nMIT text\n```') => `### ${name}\n\n${text}\n`;
const listing = (...entries: string[]) => `# Notices\n\n## Components and license texts\n\n${entries.join('\n')}`;

interface BuildContext {
  getModuleIds: () => string[];
  emitFile: ReturnType<typeof vi.fn>;
  error: (message: string) => never;
}

const context = (moduleIds: string[] = []): BuildContext => ({
  getModuleIds: () => moduleIds,
  emitFile: vi.fn(),
  error: (message) => { throw new Error(message); },
});

const runHook = (plugin: { generateBundle?: unknown }, ctx: BuildContext) =>
  (plugin.generateBundle as (this: BuildContext) => void).call(ctx);

const rootWith = (notices: string) => {
  const root = mkdtempSync(join(tmpdir(), 'ship-notices-'));
  writeFileSync(join(root, 'THIRD-PARTY-NOTICES.md'), notices);
  writeFileSync(join(root, 'package.json'), '{}');
  mkdirSync(join(root, 'legal'));
  writeFileSync(join(root, 'legal/notices-map.json'), JSON.stringify({ withDependencies: [], packageOnly: [], overrides: {} }));
  return root;
};

describe('shipNotices', () => {
  it('emits the notices file at the root of a build', () => {
    const plugin = shipNotices('.');
    const ctx = context();
    runHook(plugin, ctx);
    expect(ctx.emitFile).toHaveBeenCalledTimes(1);
    const [asset] = ctx.emitFile.mock.calls[0];
    expect(asset.fileName).toBe('THIRD-PARTY-NOTICES.md');
    expect(asset.source === readFileSync('THIRD-PARTY-NOTICES.md', 'utf8')).toBe(true);
  });

  it('serves the same file in dev, and passes other requests on', () => {
    const plugin = shipNotices('.');
    let handler!: (req: { url: string }, res: { setHeader: () => void; end: (body: Buffer) => void }, next: () => void) => void;
    (plugin.configureServer as (server: unknown) => void)({ middlewares: { use: (fn: typeof handler) => { handler = fn; } } });

    let served: Buffer | undefined;
    const next = vi.fn();
    handler({ url: '/THIRD-PARTY-NOTICES.md?t=1' }, { setHeader: () => {}, end: (body) => { served = body; } }, next);
    expect(served?.toString('utf8')).toBe(readFileSync('THIRD-PARTY-NOTICES.md', 'utf8'));
    expect(next).not.toHaveBeenCalled();

    handler({ url: '/src/main.tsx' }, { setHeader: () => {}, end: () => { throw new Error('served'); } }, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('fails the build on a bundled package with no entry, naming the package and the command', () => {
    const ctx = context([THREE_MODULE]);
    expect(() => runHook(shipNotices(rootWith(listing())), ctx)).toThrow(`Run ${REGENERATE}.\nthree@${THREE_VERSION} has no entry`);
    expect(ctx.emitFile).not.toHaveBeenCalled();
  });

  it('passes a bundled package that has an entry', () => {
    const ctx = context([THREE_MODULE]);
    runHook(shipNotices(rootWith(listing(packageEntry(`three@${THREE_VERSION}`)))), ctx);
    expect(ctx.emitFile).toHaveBeenCalledTimes(1);
  });

  it('fails on a package that ships outside the bundles and has no entry', () => {
    const root = rootWith(listing());
    mkdirSync(join(root, 'node_modules/native'), { recursive: true });
    writeFileSync(join(root, 'node_modules/native/package.json'), JSON.stringify({ name: 'native', version: '2.0.0' }));
    writeFileSync(join(root, 'legal/notices-map.json'), JSON.stringify({ withDependencies: ['native'], packageOnly: [], overrides: {} }));
    expect(() => runHook(shipNotices(root), context())).toThrow('native@2.0.0 has no entry');
  });

  it('counts a package that only a worker bundle reaches', () => {
    const plugin = shipNotices(rootWith(listing()));
    runHook(plugin.api.workerPlugin(), context([THREE_MODULE]));
    expect(() => runHook(plugin, context())).toThrow(/three@\S+ has no entry/);
  });

  it('reports the package folders in place of the check when the generator asks', () => {
    const report = join(mkdtempSync(join(tmpdir(), 'ship-notices-')), 'packages.json');
    vi.stubEnv('FORMAMORPH_NOTICES_PACKAGES', report);
    try {
      runHook(shipNotices(rootWith(listing())), context([THREE_MODULE, THREE_MODULE]));
    } finally {
      vi.unstubAllEnvs();
    }
    expect(JSON.parse(readFileSync(report, 'utf8'))).toEqual([packageRootOf(THREE_MODULE)]);
  });

  it.each(['vite.config.js', 'vite.site.config.js'])('is in the %s build, with its workers', (config) => {
    const source = readFileSync(config, 'utf8');
    expect(source).toContain('const notices = shipNotices(import.meta.dirname)');
    expect(source).toMatch(/plugins: \[[^\]]*\bnotices\b[^\]]*\]/);
    expect(source).toContain('plugins: () => [notices.api.workerPlugin()]');
  });
});

describe('packageRootOf', () => {
  it.each([
    ['D:\\repo\\node_modules\\three\\build\\three.js', 'D:/repo/node_modules/three'],
    ['/repo/node_modules/@radix-ui/react-slot/dist/index.mjs?v=1', '/repo/node_modules/@radix-ui/react-slot'],
    ['/repo/node_modules/a/node_modules/b/index.js', '/repo/node_modules/a/node_modules/b'],
    ['\0/repo/node_modules/c/index.js', '/repo/node_modules/c'],
  ])('finds the innermost package of %s', (id, root) => {
    expect(packageRootOf(id)).toBe(root);
  });

  it.each(['/repo/src/main.tsx', '\0vite/preload-helper.js'])('leaves our own module %s alone', (id) => {
    expect(packageRootOf(id)).toBeNull();
  });
});

describe('packageIds', () => {
  it('names each package once with its installed version', () => {
    const roots = packageRoots([THREE_MODULE, THREE_MODULE, '/repo/src/main.tsx']);
    expect(packageIds([...roots, ...roots])).toEqual([`three@${THREE_VERSION}`]);
  });
});

describe('noticesDrift', () => {
  it('passes a package whose entry has text', () => {
    expect(noticesDrift(['a@1.0.0'], listing(packageEntry('a@1.0.0')))).toEqual([]);
  });

  it('fails a bundled package with no entry', () => {
    expect(noticesDrift(['a@1.0.0'], listing())).toEqual(['a@1.0.0 has no entry']);
  });

  it('treats a version difference as a missing entry', () => {
    expect(noticesDrift(['a@1.0.1'], listing(packageEntry('a@1.0.0')))).toEqual(['a@1.0.1 has no entry']);
  });

  it('fails a package entry with no fenced license text', () => {
    expect(noticesDrift([], listing(packageEntry('a@1.0.0', '- License: **MIT**')))).toEqual(['a@1.0.0 has no license text']);
  });

  it('fails a package entry whose fence is empty', () => {
    expect(noticesDrift([], listing(packageEntry('a@1.0.0', '- License: **MIT**\n\n```\n\n```')))).toEqual(['a@1.0.0 has no license text']);
  });

  it('fails a hand-kept entry with no text, and accepts one with a link alone', () => {
    const notices = (text: string) => `## Bundled assets\n\n### Art\n\n${text}\n`;
    expect(noticesDrift([], notices(''))).toEqual(['Art has no license text']);
    expect(noticesDrift([], notices('Used under <https://example.com>.'))).toEqual([]);
  });

  it('fails an entry that reads UNKNOWN', () => {
    expect(noticesDrift([], listing(packageEntry('a@1.0.0', '- License: **UNKNOWN**\n\n```\ntext\n```')))).toEqual(['a@1.0.0 reads UNKNOWN']);
  });
});

describe('the shipped notices file', () => {
  const notices = readFileSync('THIRD-PARTY-NOTICES.md', 'utf8').replace(/\r\n/g, '\n');
  const entries = parseNotices(notices);
  const text = (name: string) => entries.find((entry) => entry.name === name)?.text ?? '';

  it('has no drift of its own', () => {
    expect(noticesDrift([], notices)).toEqual([]);
  });

  it('states the regenerate command in its header', () => {
    expect(notices.slice(0, notices.indexOf('## Bundled assets'))).toContain(REGENERATE);
  });

  it.each([
    ['Webfonts', 'SIL OPEN FONT LICENSE Version 1.1'],
    ['Original Formamorph', 'FieryLionite'],
    ['Original Formamorph', 'Permission is hereby granted'],
    ['llama.cpp', 'The ggml authors'],
    ['llama.cpp', 'Permission is hereby granted'],
    ['LLVM OpenMP', 'LLVM Exceptions'],
    ['eSpeak NG', 'GNU GENERAL PUBLIC LICENSE'],
    ['eSpeak NG', 'Version 3, 29 June 2007'],
    ['Android libraries', 'Apache License'],
  ])('%s carries %s', (name, wording) => {
    expect(text(name).includes(wording)).toBe(true);
  });

  it('names a family in Webfonts for every font package, and gives each package a font license', () => {
    const fonts = entries.filter((entry) => /^@fontsource(-variable)?\//.test(entry.name));
    expect(fonts).toHaveLength(12);
    const families = [...text('Webfonts').matchAll(/^- \*\*(.+?)\*\*/gm)].map((match) => match[1].toLowerCase().replace(/ /g, '-'));
    expect(families.sort()).toEqual(fonts.map((entry) => /\/(.+)@/.exec(entry.name)?.[1]).sort());
    for (const font of fonts) {
      expect(font.text.startsWith('- License: **OFL-1.1**')).toBe(true);
      expect(font.text.includes('SIL OPEN FONT LICENSE')).toBe(true);
    }
  });

  it('names only avatar files that exist', () => {
    const named = [...notices.slice(0, notices.indexOf('## Software license summary')).matchAll(/`([\w./-]+\.vrm)`/g)].map((match) => match[1]);
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((path) => !existsSync(path))).toEqual([]);
  });
});
