import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNotices } from '../src/lib/noticesFormat';
import { fenced, gapsIn, readPackage, renderPackages, resolvePackage, shippedOutsideGraph, spliceGenerated, walkDependencies } from './noticesList.mjs';

const tempDir = () => mkdtempSync(join(tmpdir(), 'notices-list-'));

const writePackage = (dir: string, pkg: Record<string, unknown>, files: Record<string, string> = {}) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
};

const record = (id: string, license = 'MIT', texts = ['MIT text']) => ({ id, license, repo: null, texts });

describe('readPackage', () => {
  it('reads the declared license and every license file, leaving source files out', () => {
    const dir = writePackage(join(tempDir(), 'a'), { name: 'a', version: '1.0.0', license: 'MIT', repository: 'https://github.com/o/a.git' }, {
      LICENSE: 'MIT text\r\n',
      'NOTICE.txt': 'Notice text',
      'license.js': 'code',
      'index.js': 'code',
    });
    expect(readPackage(dir, {}, '')).toEqual({ id: 'a@1.0.0', license: 'MIT', repo: 'o/a', texts: ['MIT text', 'Notice text'] });
  });

  it('finds a file named Copyright', () => {
    const dir = writePackage(join(tempDir(), 'a'), { name: 'a', version: '1.0.0', license: 'MIT' }, { Copyright: 'Word list terms' });
    expect(readPackage(dir, {}, '').texts).toEqual(['Word list terms']);
  });

  it('takes text and a corrected license from the map over what the package says', () => {
    const texts = tempDir();
    writeFileSync(join(texts, 'a.txt'), 'Map text');
    const dir = writePackage(join(tempDir(), 'a'), { name: 'a', version: '1.0.0', license: 'UNKNOWN' }, { LICENSE: 'Shipped text' });
    expect(readPackage(dir, { a: { license: 'ISC', textFile: 'a.txt' } }, texts)).toMatchObject({ license: 'ISC', texts: ['Map text'] });
  });
});

describe('shippedOutsideGraph', () => {
  const project = (map: Record<string, string[]>) => {
    const root = tempDir();
    writePackage(root, { dependencies: { prod: '1' } });
    mkdirSync(join(root, 'legal'));
    writeFileSync(join(root, 'legal/notices-map.json'), JSON.stringify({ withDependencies: [], packageOnly: [], overrides: {}, ...map }));
    const pkg = (name: string, extra = {}) => writePackage(join(root, 'node_modules', name), { name, version: '1.0.0', ...extra });
    return { root, pkg };
  };

  it('holds the production tree and the listed roots with their dependencies, and a package-only entry alone', () => {
    const { root, pkg } = project({ withDependencies: ['native'], packageOnly: ['styles'] });
    const dirs = [pkg('prod'), pkg('native', { dependencies: { inner: '1' } }), pkg('inner'), pkg('styles', { dependencies: { tool: '1' } })];
    pkg('tool');
    expect(shippedOutsideGraph(root).sort()).toEqual(dirs.sort());
  });

  it('refuses a map name that is not installed', () => {
    const { root, pkg } = project({ packageOnly: ['gone'] });
    pkg('prod');
    expect(() => shippedOutsideGraph(root)).toThrow(/names gone/);
  });
});

describe('gapsIn', () => {
  it('names a package with no text and one with no usable license', () => {
    expect(gapsIn([
      record('a@1'),
      record('b@1', 'MIT', []),
      { ...record('c@1'), license: null },
      record('d@1', 'UNKNOWN'),
      record('e@1', 'SEE LICENSE IN LICENSE'),
    ])).toEqual(['b@1 has no license text', 'c@1 has no declared license', 'd@1 has no declared license', 'e@1 has no declared license']);
  });
});

describe('walkDependencies', () => {
  it('follows dependencies through nested and hoisted folders, skips what is not installed, and survives a cycle', () => {
    const modules = join(tempDir(), 'node_modules');
    const a = writePackage(join(modules, 'a'), { name: 'a', dependencies: { b: '1', c: '1', absent: '1' } });
    const nestedB = writePackage(join(a, 'node_modules/b'), { name: 'b', version: '2.0.0' });
    writePackage(join(modules, 'b'), { name: 'b', version: '1.0.0' });
    const c = writePackage(join(modules, 'c'), { name: 'c', dependencies: { a: '1' } });
    expect([...walkDependencies([a])].sort()).toEqual([a, c, nestedB].sort());
  });
});

describe('resolvePackage', () => {
  it('returns null for a package that is not installed', () => {
    expect(resolvePackage('no-such-package', tempDir())).toBeNull();
  });
});

describe('fenced', () => {
  it('outlasts any fence inside the text, so the parser keeps the entry whole', () => {
    const text = 'Before\n```\n### inside\n```\nAfter';
    const entries = parseNotices(`## One\n\n### a\n\n${fenced(text)}\n\n### b\n\nSecond.\n`);
    expect(entries.map((entry) => entry.name)).toEqual(['a', 'b']);
    expect(entries[0].text).toContain('### inside');
  });
});

describe('renderPackages', () => {
  it('sorts entries, counts licenses and renders the format the parser reads', () => {
    const generated = renderPackages([record('b@1', 'ISC'), record('a@1'), record('c@1')]);
    expect(generated).toContain('| 2 | MIT |\n| 1 | ISC |');
    expect(generated).toContain('Total components: **3**.');
    expect(parseNotices(generated)).toEqual([
      { name: 'a@1', section: 'Components and license texts', text: '- License: **MIT**\n\n```\nMIT text\n```' },
      { name: 'b@1', section: 'Components and license texts', text: '- License: **ISC**\n\n```\nMIT text\n```' },
      { name: 'c@1', section: 'Components and license texts', text: '- License: **MIT**\n\n```\nMIT text\n```' },
    ]);
  });
});

describe('spliceGenerated', () => {
  const head = '# Notices\n\n## Bundled assets\n\n### Art\n\nHand-kept  text.\n\n';
  const generated = renderPackages([record('a@1')]);

  it('keeps everything above the summary byte for byte', () => {
    const stale = `${head}## Software license summary\n\nold\n\n## Components and license texts\n\n### z@9\n\nold\n`;
    expect(spliceGenerated(stale, generated)).toBe(head + generated);
  });

  it('changes nothing on a second run', () => {
    const once = spliceGenerated(`${head}## Software license summary\n`, generated);
    expect(spliceGenerated(once, generated)).toBe(once);
  });

  it('keeps a CRLF checkout in CRLF, on a second run too', () => {
    const crlfHead = head.replace(/\n/g, '\r\n');
    const once = spliceGenerated(`${crlfHead}## Software license summary\r\n`, generated);
    expect(once.startsWith(crlfHead)).toBe(true);
    expect(once.replace(/\r\n/g, '').includes('\n')).toBe(false);
    expect(spliceGenerated(once, generated)).toBe(once);
  });

  it('refuses a file with no summary heading', () => {
    expect(() => spliceGenerated(head, generated)).toThrow(/summary/);
  });
});
