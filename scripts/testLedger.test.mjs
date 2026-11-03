import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { coverageEntry, needsCoverage, readLedger, runStatus } from './testLedger.mjs';
import { addedText, gatherFixes, isFixCommit, isRepoProject, parseGitLog, parseRerunRecords, parseVitestFailures, renameChains, scanLines, sessionEvents, touchedUntilGreen, underCurrentName } from './testLedgerHistory.mjs';
import { areaOf, buildRecords, evidenceHash, familyOf, fixTouchesTest, hashInputs, importGraph, isStale, ledgerReport, levelOf, moduleUnderTest, repeatOffenders, testOnlyFiles } from './testLedgerRecords.mjs';
import { moduleReport, moduleTests } from './testLedgerReporter.mjs';

const moduleRun = (overrides = {}) => ({
  file: 'src/lib/a.test.ts',
  project: 'node',
  environmentMs: 1,
  prepareMs: 2,
  setupMs: 3,
  collectMs: 40,
  durationMs: 50,
  hash: 'h1',
  hashInputs: ['src/lib/a.test.ts', 'src/lib/a.ts'],
  moduleUnderTest: { path: 'src/lib/a.ts', by: 'name' },
  tests: [{ name: 'group > works', state: 'passed', ms: 10 }],
  ...overrides,
});
const run = (at, modules, overrides = {}) => ({ at, sha: `sha-${at}`, toolchain: { vitest: '5.0.5' }, wallMs: 1000, status: 'passed', modules, ...overrides });

describe('buildRecords', () => {
  it('writes one record per test, with every field the ledger promises', () => {
    const [record, second, ...rest] = buildRecords({
      runs: [run('2026-11-01', [moduleRun({ tests: [{ name: 'group > works', state: 'passed', ms: 10 }, { name: 'skipped one', state: 'skipped', ms: null }] })])],
      coverage: { 'src/lib/a.test.ts': { hash: 'h1', lines: { total: 2, covered: [1] } } },
    });
    expect(rest).toEqual([]);
    expect(record).toMatchObject({
      id: 'src/lib/a.test.ts > group > works',
      file: 'src/lib/a.test.ts',
      name: 'group > works',
      project: 'node',
      hashInputs: ['src/lib/a.test.ts', 'src/lib/a.ts'],
      runAt: '2026-11-01',
      family: 'src/lib/a.ts',
      moduleUnderTest: 'src/lib/a.ts',
      moduleBy: 'name',
      level: 'unit',
      area: null,
      medianMs: 10,
      importCostMs: 40,
      coverage: { lines: { total: 2, covered: [1] } },
      failures: [],
      realBug: [],
      hash: 'h1',
      runSha: 'sha-2026-11-01',
      toolchain: { vitest: '5.0.5' },
    });
    expect(second).toMatchObject({ name: 'skipped one', state: 'skipped', medianMs: null, timedRuns: 0 });
  });

  it('takes the median of passed runs, and the import cost of every run, since a failed test still imported', () => {
    const times = [[10, 100], [30, 300], [20, 200]];
    const runs = times.map(([ms, collectMs], index) => run(`2026-11-0${index + 1}`, [moduleRun({ collectMs, tests: [{ name: 'group > works', state: 'passed', ms }] })]));
    runs.push(run('2026-10-01', [moduleRun({ collectMs: 400, tests: [{ name: 'group > works', state: 'failed', ms: 9000 }] })]));
    const [record] = buildRecords({ runs, runCount: 4 });
    expect(record.medianMs).toBe(20);
    expect(record.timedRuns).toBe(3);
    expect(record.importCostMs).toBe(300);
  });

  it('keeps only runs of the newest hash, so old evidence never mixes with new', () => {
    const [record] = buildRecords({ runs: [
      run('2026-11-02', [moduleRun({ hash: 'new', tests: [{ name: 'group > works', state: 'passed', ms: 5 }] })]),
      run('2026-11-01', [moduleRun({ hash: 'old', tests: [{ name: 'group > works', state: 'passed', ms: 500 }] })]),
    ] });
    expect(record).toMatchObject({ hash: 'new', medianMs: 5, timedRuns: 1, runSha: 'sha-2026-11-02' });
  });

  it('refreshes one file from a subset run and keeps the other file from the full run', () => {
    const other = moduleRun({ file: 'src/lib/b.test.ts', moduleUnderTest: { path: 'src/lib/b.ts', by: 'name' } });
    const records = buildRecords({ runs: [
      run('2026-11-01', [moduleRun(), other]),
      run('2026-11-02', [moduleRun({ hash: 'h2', tests: [{ name: 'new test', state: 'passed', ms: 1 }] })], { scope: 'subset' }),
    ] });
    expect(records.map((record) => [record.id, record.runSha])).toEqual([
      ['src/lib/a.test.ts > new test', 'sha-2026-11-02'],
      ['src/lib/b.test.ts > group > works', 'sha-2026-11-01'],
    ]);
  });

  it('keeps the last loaded run of a file that failed to load, and drops a file no longer in the tree', () => {
    const gone = moduleRun({ file: 'src/lib/gone.test.ts' });
    const records = buildRecords({
      runs: [run('2026-11-02', [moduleRun({ tests: [] })]), run('2026-11-01', [moduleRun(), gone])],
      exists: (file) => file !== 'src/lib/gone.test.ts',
    });
    expect(records.map((record) => [record.id, record.runSha])).toEqual([['src/lib/a.test.ts > group > works', 'sha-2026-11-01']]);
  });

  it('gives a repeated full name the history of that name', () => {
    const tests = [{ name: 'same', state: 'passed', ms: 1 }, { name: 'same #2', state: 'passed', ms: 1 }];
    const history = {
      events: [{ source: 'ci', file: 'src/lib/a.test.ts', test: 'src/lib/a.test.ts > same', run: 1 }],
      fixes: [{ sha: 'f', subject: 'Fix', files: { 'src/lib/a.test.ts': { created: false, added: "+it('same', () => {})" } } }],
    };
    const records = buildRecords({ runs: [run('2026-11-01', [moduleRun({ tests })])], history });
    expect(records.map((record) => [record.name, record.failures.length, record.realBug.length])).toEqual([['same', 1, 1], ['same #2', 1, 1]]);
  });

  it('drops coverage measured at another hash', () => {
    const [record] = buildRecords({ runs: [run('2026-11-01', [moduleRun()])], coverage: { 'src/lib/a.test.ts': { hash: 'old', lines: { total: 1, covered: [] } } } });
    expect(record.coverage).toBeNull();
  });

  it('gives a test its own failures, its suite failures and its file failures', () => {
    const events = [
      { source: 'ci', file: 'src/lib/a.test.ts', test: 'src/lib/a.test.ts > group > works', run: 1 },
      { source: 'rerun', file: 'src/lib/a.test.ts', test: 'src/lib/a.test.ts > group', result: 'passed-alone' },
      { source: 'session', file: 'src/lib/a.test.ts', test: 'src/lib/a.test.ts > group > other' },
      { source: 'ci', file: 'src/lib/a.test.ts', test: null, kind: 'unhandled' },
      { source: 'ci', file: 'src/lib/b.test.ts', test: 'src/lib/b.test.ts > group > works' },
    ];
    const [record] = buildRecords({ runs: [run('2026-11-01', [moduleRun()])], history: { events } });
    expect(record.failures.map((event) => event.source)).toEqual(['ci', 'rerun']);
    expect(record.fileFailures).toEqual([expect.objectContaining({ kind: 'unhandled' })]);
    expect(record.realBug).toEqual([]);
  });

  it('never reads a suite prefix without its separator as the test', () => {
    const events = [{ source: 'ci', file: 'src/lib/a.test.ts', test: 'src/lib/a.test.ts > group > wor' }];
    const [record] = buildRecords({ runs: [run('2026-11-01', [moduleRun()])], history: { events } });
    expect(record.failures).toEqual([]);
  });

  it('names the rule and the commit for each kind of real-bug history', () => {
    const history = {
      events: [{ source: 'ci', file: 'src/lib/a.test.ts', test: 'src/lib/a.test.ts > group > works', run: 7 }],
      fixes: [{ sha: 'fix1', subject: 'Fix a', files: { 'src/lib/a.test.ts': { created: false, added: "+ it('works', () => {})" } } }],
      ciTouched: { 7: { 'src/lib/a.ts': { sha: 'next1', subject: 'Keep a working' } } },
    };
    const [record] = buildRecords({ runs: [run('2026-11-01', [moduleRun()])], history });
    expect(record.realBug).toEqual([
      { rule: 'fix-commit', sha: 'fix1', subject: 'Fix a' },
      { rule: 'ci-caught', sha: 'next1', subject: 'Keep a working' },
    ]);
  });

  it('reads no real-bug history from a session failure, a rerun, or a green that did not touch the module', () => {
    const history = {
      events: [
        { source: 'session', file: 'src/lib/a.test.ts', test: 'src/lib/a.test.ts > group > works', run: 7 },
        { source: 'rerun', file: 'src/lib/a.test.ts', test: 'src/lib/a.test.ts > group > works', run: 7 },
        { source: 'ci', file: 'src/lib/a.test.ts', test: 'src/lib/a.test.ts > group > works', run: 8 },
      ],
      ciTouched: { 7: { 'src/lib/a.ts': { sha: 'n', subject: 's' } }, 8: { 'src/lib/other.ts': { sha: 'n', subject: 's' } } },
    };
    const [record] = buildRecords({ runs: [run('2026-11-01', [moduleRun()])], history });
    expect(record.failures).toHaveLength(3);
    expect(record.realBug).toEqual([]);
  });
});

describe('fixTouchesTest', () => {
  it('matches a created file, an added test name or an added suite name', () => {
    expect(fixTouchesTest({ created: true, added: '' }, 'any')).toBe(true);
    expect(fixTouchesTest({ created: false, added: "+  it('keeps it', () => {" }, 'group > keeps it')).toBe(true);
    expect(fixTouchesTest({ created: false, added: '+describe("group", () => {' }, 'group > keeps it')).toBe(true);
  });

  it('never matches a name that only appears inside other text', () => {
    expect(fixTouchesTest({ created: false, added: "+  it('keeps it working', () => {" }, 'keeps it')).toBe(false);
  });

  it('matches a name an each template gives, and no other name', () => {
    const added = '+  it.each([\'Left Paw\'])("skips %s, when the slot is full", () => {\n+  it.each(rows)(\'moves $name up\', () => {';
    expect(fixTouchesTest({ created: false, added }, 'group > skips Left Paw, when the slot is full')).toBe(true);
    expect(fixTouchesTest({ created: false, added }, 'moves the stat up')).toBe(true);
    expect(fixTouchesTest({ created: false, added }, 'group > skips nothing')).toBe(false);
  });

  it('matches a name a template literal gives', () => {
    const added = '+  it(`writes ${kind} to the ${place}`, () => {';
    expect(fixTouchesTest({ created: false, added }, 'writes saves to the disk')).toBe(true);
    expect(fixTouchesTest({ created: false, added }, 'reads saves from the disk')).toBe(false);
  });

  it('finds the template after a table of quoted strings, with an apostrophe in the name', () => {
    const added = '+  it.each([\'Left Paw\', \'Off Handle\'])("skips %s, which holds a name the item doesn\'t list", (slot) => {';
    expect(fixTouchesTest({ created: false, added }, "group > skips Left Paw, which holds a name the item doesn't list")).toBe(true);
  });
});

describe('moduleUnderTest', () => {
  const sources = {
    'src/lib/plain.test.ts': "import { a } from './plain';",
    'src/lib/plain.ts': '',
    'src/views/Big.history.test.tsx': "import { Big } from './Big';",
    'src/views/Big.tsx': "import { used } from '@/lib/used';",
    'src/lib/used.ts': '',
    'src/lib/only.test.ts': "import { help } from '@/test/help';\nimport { used } from './used';",
    'src/lib/many.test.ts': "import { help } from '@/test/help';\nimport type { T } from './types';\nimport { x } from './plain';\nimport { y } from './used';",
    'src/lib/types.ts': '',
    'src/test/help.ts': "import { deep } from './deep';",
    'src/test/deep.ts': '',
    'src/lib/helpers.test.ts': "import { help } from '@/test/help';",
    'src/main.tsx': "import './views/Big';\nimport './lib/plain';",
  };
  const graph = importGraph(sources);
  const testOnly = testOnlyFiles(graph);

  it('names the sibling, dropping dotted suffixes', () => {
    expect(moduleUnderTest('src/lib/plain.test.ts', graph, testOnly)).toEqual({ path: 'src/lib/plain.ts', by: 'name' });
    expect(moduleUnderTest('src/views/Big.history.test.tsx', graph, testOnly)).toEqual({ path: 'src/views/Big.tsx', by: 'name' });
  });

  it('skips test-only files when it falls back to an import, and flags a guess', () => {
    expect(moduleUnderTest('src/lib/only.test.ts', graph, testOnly)).toEqual({ path: 'src/lib/used.ts', by: 'import' });
    expect(moduleUnderTest('src/lib/many.test.ts', graph, testOnly)).toEqual({ path: 'src/lib/plain.ts', by: 'first-import' });
    expect(moduleUnderTest('src/lib/helpers.test.ts', graph, testOnly)).toEqual({ path: null, by: null });
  });

  it('calls a file test-only through a chain of helpers, and never one production imports', () => {
    expect(testOnly).toEqual(new Set(['src/test/help.ts', 'src/test/deep.ts']));
  });

  it('ignores a type-only import, which runs nothing', () => {
    expect(graph.get('src/lib/many.test.ts')).not.toContain('src/lib/types.ts');
    const inline = importGraph({ 'a.test.ts': "import { type T, type U } from './b';\nimport { type V, real } from './c';", 'b.ts': '', 'c.ts': '' });
    expect(inline.get('a.test.ts')).toEqual(['c.ts']);
  });

  it('feeds the test, its module, its direct helper and its snapshot to the hash', () => {
    expect(hashInputs('src/lib/only.test.ts', 'src/lib/used.ts', graph, testOnly, (file) => file === 'src/lib/__snapshots__/only.test.ts.snap')).toEqual([
      'src/lib/__snapshots__/only.test.ts.snap',
      'src/lib/only.test.ts',
      'src/lib/used.ts',
      'src/test/help.ts',
    ]);
  });
});

describe('stale records', () => {
  const inputs = ['src/lib/a.test.ts', 'src/lib/a.ts', 'src/test/help.ts'];
  const tree = { 'src/lib/a.test.ts': 'test', 'src/lib/a.ts': 'source', 'src/test/help.ts': 'helper', 'src/lib/z.ts': 'other' };
  const reader = (files) => (file) => files[file] ?? null;
  const record = { hashInputs: inputs, hash: evidenceHash(inputs, reader(tree)) };

  it('stays fresh when nothing behind it changed, including a line-ending change or an unrelated file', () => {
    expect(isStale(record, reader(tree))).toBe(false);
    expect(isStale(record, reader({ ...tree, 'src/lib/z.ts': 'changed' }))).toBe(false);
    const crlfTree = { ...tree, 'src/lib/a.ts': 'one\ntwo' };
    const crlfRecord = { hashInputs: inputs, hash: evidenceHash(inputs, reader(crlfTree)) };
    expect(isStale(crlfRecord, reader({ ...crlfTree, 'src/lib/a.ts': 'one\r\ntwo' }))).toBe(false);
  });

  it.each(inputs)('goes stale when %s changes', (file) => {
    expect(isStale(record, reader({ ...tree, [file]: `${tree[file]} changed` }))).toBe(true);
  });

  it('goes stale when a file behind it is gone', () => {
    const { 'src/lib/a.ts': _gone, ...rest } = tree;
    expect(isStale(record, reader(rest))).toBe(true);
  });

  describe('through the written ledger', () => {
    let dir;
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it('reads a changed test as stale and leaves its neighbor fresh', () => {
      dir = mkdtempSync(path.join(os.tmpdir(), 'test-ledger-'));
      const changed = path.join(dir, 'a.test.ts');
      const kept = path.join(dir, 'b.test.ts');
      writeFileSync(changed, 'before');
      writeFileSync(kept, 'kept');
      const read = (file) => (file === changed ? 'before' : 'kept');
      const lines = [changed, kept].map((file) => JSON.stringify({ id: file, file, hashInputs: [file], hash: evidenceHash([file], read) }));
      writeFileSync(path.join(dir, 'ledger.jsonl'), `${lines.join('\n')}\n`);
      expect(readLedger(dir).map((row) => row.stale)).toEqual([false, false]);
      writeFileSync(changed, 'after');
      expect(readLedger(dir).map((row) => row.stale)).toEqual([true, false]);
    });
  });
});

describe('record labels', () => {
  it('sets the level from the path', () => {
    const always = { 'src/lib/scan.test.ts': 'reads files' };
    expect(levelOf('src/lib/scan.test.ts', always)).toBe('scan');
    expect(levelOf('scripts/x.test.mjs', always)).toBe('script');
    expect(levelOf('electron/x.test.mjs', always)).toBe('script');
    expect(levelOf('src/views/GameViewer.a.test.tsx', always)).toBe('view');
    expect(levelOf('src/managers/X.test.tsx', always)).toBe('component');
    expect(levelOf('src/lib/x.test.ts', always)).toBe('unit');
  });

  it('names the Q5 area from the test or its module', () => {
    expect(areaOf('src/lib/saveImport.legacy.test.ts', 'src/lib/saveImport.ts')).toBe('saves-import-migration');
    expect(areaOf('src/lib/turnPipeline/planTurn.test.ts', null)).toBe('turn-prompts');
    expect(areaOf('src/lib/x.test.ts', 'src/lib/statCodeExecutor.ts')).toBe('sandbox-scripts');
    expect(areaOf('src/views/MainMenu.ageGate.test.tsx', 'src/views/MainMenu.tsx')).toBe('accounts-moderation');
    expect(areaOf('src/lib/color.test.ts', 'src/lib/color.ts')).toBeNull();
  });

  it('does not read the scripts folder as the Scripts feature', () => {
    expect(areaOf('scripts/slowTestReporter.test.mjs', 'scripts/slowTestReporter.mjs')).toBeNull();
  });

  it('matches whole words, so a longer word that holds one names no area', () => {
    expect(areaOf('src/lib/bridgeDescription.test.ts', 'src/lib/bridgeDescription.ts')).toBeNull();
    expect(areaOf('src/components/modals/libraryAuthor.test.tsx', null)).toBeNull();
    expect(areaOf('src/lib/authoringTour.test.ts', null)).toBeNull();
    expect(areaOf('src/services/AuthService.test.ts', null)).toBe('accounts-moderation');
  });

  it('groups a family by module, or by base name when there is none', () => {
    expect(familyOf('src/views/A.b.test.tsx', 'src/views/A.tsx')).toBe('src/views/A.tsx');
    expect(familyOf('src/lib/docs/docsCoverage.links.test.ts', null)).toBe('src/lib/docs/docsCoverage');
    expect(familyOf('root.links.test.ts', null)).toBe('root');
  });
});

describe('ledgerReport', () => {
  it('reports wall time, the breakdown of full runs, top families and failure history', () => {
    const runs = [run('2026-11-01', [moduleRun()], { scope: 'full' }), run('2026-11-02', [moduleRun({ collectMs: 9999 })], { scope: 'subset' })];
    const records = buildRecords({ runs: runs.slice(0, 1), history: { fixes: [{ sha: 'f', subject: 'Fix', files: { 'src/lib/a.test.ts': { created: true, added: '' } } }] } });
    const report = ledgerReport(runs, records, { ci: { runs: 300, failed: 41, from: '2026-09-01', to: '2026-11-01', logsMissing: 2, logsFailed: 3, unreachable: 1 }, reruns: { records: 4, downloadsFailed: 5 }, sessions: { files: 9, withFailures: 3 } });
    expect(report).toContain('| Import (collect) | 0.0 |');
    expect(report).not.toContain('10.0 |');
    expect(report).toContain('| `src/lib/a.ts` | 1 | 1 | 0.0 |');
    expect(report).toContain('real-bug history: 1 of 1 (fix-commit 1, ci-caught 0)');
    expect(report).toContain('300 runs, 41 failed, 2026-09-01 to 2026-11-01; 2 logs gone, 3 logs not read this time, 1 shas not in this clone');
    expect(report).toContain('Rerun records read: 4; 5 CI artifacts not downloaded');
    expect(report).toContain('| `src/lib/a.test.ts` | 1 | f |');
  });

  it('reports the breakdown of a subset ledger, which has no full run', () => {
    const report = ledgerReport([run('2026-11-01', [moduleRun({ collectMs: 2000 })], { scope: 'subset' })], []);
    expect(report).toContain('| Import (collect) | 2.0 |');
  });
});

describe('repeatOffenders', () => {
  const record = (file, failures, fileFailures = []) => ({ file, failures, fileFailures });

  it('names a file CI failed in two runs, with the last date, and counts a run once', () => {
    expect(repeatOffenders([
      record('a.test.ts', [{ source: 'ci', run: 1, at: '2026-10-01T00:00:00Z' }, { source: 'session', run: 9, at: '2026-12-01T00:00:00Z' }]),
      record('a.test.ts', [{ source: 'ci', run: 1, at: '2026-10-01T00:00:00Z' }], [{ source: 'ci', run: 2, at: '2026-10-17T00:00:00Z' }]),
      record('b.test.ts', [{ source: 'ci', run: 3, at: '2026-10-02T00:00:00Z' }]),
    ])).toEqual([{ file: 'a.test.ts', runs: 2, lastSeen: '2026-10-17' }]);
  });
});

describe('runStatus', () => {
  const failed = [{ tests: [{ state: 'failed' }] }];
  const green = [{ tests: [{ state: 'passed' }] }];

  it('tells a green run from one a rerun turned green, and from a red one', () => {
    expect(runStatus(0, green)).toBe('passed');
    expect(runStatus(0, failed)).toBe('green-after-rerun');
    expect(runStatus(1, failed)).toBe('failed');
  });
});

describe('needsCoverage', () => {
  it('resumes past a good entry, and measures again for a new hash or an error', () => {
    expect(needsCoverage({ hash: 'h' }, 'h')).toBe(false);
    expect(needsCoverage({ hash: 'old' }, 'h')).toBe(true);
    expect(needsCoverage({ hash: 'h', error: 'hung' }, 'h')).toBe(true);
    expect(needsCoverage({}, 'h')).toBe(true);
    expect(needsCoverage({ hash: 'h', module: 'a.ts' }, 'h', 'a.ts')).toBe(false);
    expect(needsCoverage({ hash: 'h', module: 'a.ts' }, 'h', 'b.ts')).toBe(true);
  });
});

describe('touchedUntilGreen', () => {
  const ciRun = (databaseId, conclusion, createdAt, headSha, headBranch = 'main') => ({ databaseId, conclusion, createdAt, headSha, headBranch });
  const commit = (sha, ...paths) => ({ sha, subject: `subject ${sha}`, changes: paths.map((file) => ({ path: file })) });

  it('reads up to the next green on the same branch, skipping a green of the same sha', () => {
    const asked = [];
    const { touched } = touchedUntilGreen([
      ciRun(1, 'failure', '2026-10-01', 'red'),
      ciRun(2, 'success', '2026-10-02', 'red'),
      ciRun(3, 'success', '2026-10-03', 'other', 'pr/x'),
      ciRun(4, 'success', '2026-10-04', 'green'),
      ciRun(5, 'success', '2026-10-05', 'later'),
    ], (from, to) => {
      asked.push([from, to]);
      return [commit('new', 'src/a.ts'), commit('old', 'src/a.ts', 'src/b.ts')];
    }, new Map());
    expect(asked).toEqual([['red', 'green']]);
    expect(touched[1]).toEqual({ 'src/a.ts': { sha: 'new', subject: 'subject new' }, 'src/b.ts': { sha: 'old', subject: 'subject old' } });
  });

  it('files a renamed module under its current name', () => {
    const { touched } = touchedUntilGreen([ciRun(1, 'failure', '2026-10-01', 'r'), ciRun(2, 'success', '2026-10-02', 'g')], () => [commit('c', 'src/old.ts')], new Map([['src/old.ts', 'src/new.ts']]));
    expect(Object.keys(touched[1])).toEqual(['src/new.ts']);
  });

  it('counts a sha this clone does not hold, and has nothing to read without a later green', () => {
    const missing = () => { throw new Error('bad revision'); };
    expect(touchedUntilGreen([ciRun(1, 'failure', '2026-10-01', 'r'), ciRun(2, 'success', '2026-10-02', 'g')], missing, new Map())).toEqual({ touched: {}, unreachable: 1 });
    expect(touchedUntilGreen([ciRun(1, 'failure', '2026-10-01', 'r')], missing, new Map())).toEqual({ touched: {}, unreachable: 0 });
  });
});

describe('underCurrentName', () => {
  it('moves an event to the renamed file, test key included', () => {
    const chain = new Map([['old.test.ts', 'new.test.ts']]);
    expect(underCurrentName({ file: 'old.test.ts', test: 'old.test.ts > x' }, chain)).toEqual({ file: 'new.test.ts', test: 'new.test.ts > x' });
    expect(underCurrentName({ file: 'old.test.ts', test: null }, chain)).toEqual({ file: 'new.test.ts', test: null });
  });
});

describe('isRepoProject', () => {
  it('takes the checkout and its worktrees, not a sibling project', () => {
    expect(isRepoProject('D--repo', 'D--repo')).toBe(true);
    expect(isRepoProject('D--repo--claude-worktrees-ticket-a', 'D--repo')).toBe(true);
    expect(isRepoProject('D--repo-llama-server', 'D--repo')).toBe(false);
  });
});

describe('with real files', () => {
  let dir;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('scanLines finds every needle, across a read boundary and on a last line with no newline', async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'test-ledger-scan-'));
    const file = path.join(dir, 'transcript.jsonl');
    const longLine = `${'x'.repeat((1 << 20) - 3)}FAIL long`;
    writeFileSync(file, `skip me\n${longLine}\nthis originated in a test\nFAIL last`);
    const hits = [];
    await scanLines(file, ['FAIL', 'originated in'], (line) => hits.push(line.slice(-9)));
    expect(hits).toEqual(['FAIL long', 'in a test', 'FAIL last']);
  });

  it('gatherFixes reads only the lines a Fix commit added, through a rename, and skips a commit with no source change', () => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'test-ledger-git-'));
    const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const write = (file, text) => writeFileSync(path.join(dir, file), text);
    const body = Array.from({ length: 30 }, (_, line) => `const keep${line} = ${line};`).join('\n');
    git('init', '-q');
    mkdirSync(path.join(dir, 'src'));
    write('src/a.ts', 'one');
    write('src/old.test.ts', `${body}\nit('kept', () => {});\n`);
    git('add', '.');
    git('commit', '-qm', 'Add a');
    git('mv', 'src/old.test.ts', 'src/new.test.ts');
    write('src/a.ts', 'two');
    write('src/new.test.ts', `${body}\nit('kept', () => {});\nit('added by the fix', () => {});\n`);
    git('add', '.');
    git('commit', '-qm', 'Fix a');
    write('src/new.test.ts', `${body}\nit('flake fixed', () => {});\n`);
    git('add', '.');
    git('commit', '-qm', 'Fix a flaky test');
    const { fixes, chain } = gatherFixes(dir);
    expect(chain.get('src/old.test.ts')).toBe('src/new.test.ts');
    expect(fixes.map((fix) => fix.subject)).toEqual(['Fix a']);
    expect(fixes[0].files['src/new.test.ts'].created).toBe(false);
    expect(fixes[0].files['src/new.test.ts'].added).toContain('added by the fix');
    expect(fixes[0].files['src/new.test.ts'].added).not.toContain('kept');
  });
});

describe('parseVitestFailures', () => {
  it('reads a CI log line, a colored line and a local one', () => {
    const log = [
      'test (1)\tRun npm test\t2026-10-27T11:44:00Z  FAIL  |dom| src/views/A.test.tsx > group > keeps it',
      '\u001b[31m FAIL \u001b[39m \u001b[2m|node|\u001b[22m src/lib/b.test.ts > works\r',
      ' FAIL  src/lib/c.test.ts [ src/lib/c.test.ts ]',
      'test (1)\tRun npx vitest run --shard=1/4\t2026-10-27T11:52:03.5896594Z \u001b[41m\u001b[1m FAIL \u001b[22m\u001b[49m \u001b[30m\u001b[43m node \u001b[49m\u001b[39m scripts/d.test.ts\u001b[2m [ scripts/d.test.ts ]\u001b[22m',
      'test (2)\tRun npx vitest run --shard=2/4\t2026-10-27T11:52:03.5896594Z ^[[41m^[[1m FAIL ^[[22m^[[49m ^[[30m^[[46m dom ^[[49m^[[39m src/e.test.tsx^[[2m > ^[[22mgroup^[[2m > ^[[22mworks',
    ].join('\n');
    expect(parseVitestFailures(log)).toEqual([
      { file: 'src/views/A.test.tsx', test: 'src/views/A.test.tsx > group > keeps it', kind: 'failed' },
      { file: 'src/lib/b.test.ts', test: 'src/lib/b.test.ts > works', kind: 'failed' },
      { file: 'src/lib/c.test.ts', test: null, kind: 'failed' },
      { file: 'scripts/d.test.ts', test: null, kind: 'failed' },
      { file: 'src/e.test.tsx', test: 'src/e.test.tsx > group > works', kind: 'failed' },
    ]);
  });

  it('reads a file that failed with no test name as a file failure', () => {
    expect(parseVitestFailures(' FAIL  |dom| src/lib/c.test.tsx')).toEqual([{ file: 'src/lib/c.test.tsx', test: null, kind: 'failed' }]);
  });

  it('reads the file an unhandled error came from, with an absolute path made relative', () => {
    expect(parseVitestFailures('This error originated in "/home/runner/work/app/app/src/lib/d.test.ts" test file.')).toEqual([
      { file: 'src/lib/d.test.ts', test: null, kind: 'unhandled' },
    ]);
  });

  it('counts a repeated line once and ignores text that only mentions FAIL', () => {
    expect(parseVitestFailures(' FAIL  src/a.test.ts > x\n FAIL  src/a.test.ts > x\nFAILED to build\n')).toHaveLength(1);
  });
});

describe('parseRerunRecords', () => {
  it('reads the runner record shape and skips a broken line', () => {
    const line = JSON.stringify({ test: 'a.test.ts > x', file: 'a.test.ts', result: 'passed-alone', message: 'Test timed out', sha: 's', at: 't', source: 'ci', run: '9', shard: 2 });
    expect(parseRerunRecords(`${line}\nnot json\n`)).toEqual([{ source: 'rerun', file: 'a.test.ts', test: 'a.test.ts > x', result: 'passed-alone', at: 't', sha: 's', origin: 'ci', run: '9' }]);
  });
});

describe('sessionEvents', () => {
  const line = (type, content) => JSON.stringify({ type, timestamp: 'now', sessionId: 's1', message: { content } });

  it('reads failures from tool output in both content shapes', () => {
    const text = ' FAIL  src/a.test.ts > x';
    expect(sessionEvents(line('user', [{ type: 'tool_result', content: text }]))).toEqual([{ source: 'session', at: 'now', session: 's1', file: 'src/a.test.ts', test: 'src/a.test.ts > x', kind: 'failed' }]);
    expect(sessionEvents(line('user', [{ type: 'tool_result', content: [{ type: 'text', text }] }]))).toHaveLength(1);
  });

  it('ignores a quote in a message, and a line that is not JSON', () => {
    expect(sessionEvents(line('assistant', [{ type: 'text', text: ' FAIL  src/a.test.ts > x' }]))).toEqual([]);
    expect(sessionEvents(line('user', [{ type: 'text', text: ' FAIL  src/a.test.ts > x' }]))).toEqual([]);
    expect(sessionEvents('{broken FAIL')).toEqual([]);
  });
});

describe('git history', () => {
  const log = [
    '\0new\t2026-11-02\tFix the thing\n\nM\tsrc/lib/a.ts\nM\tsrc/lib/a2.test.ts\n',
    '\0mid\t2026-11-01\tMove tests\n\nR100\tsrc/lib/a1.test.ts\tsrc/lib/a2.test.ts\n',
    '\0old\t2026-10-01\tMove tests again\n\nR090\tsrc/lib/a0.test.ts\tsrc/lib/a1.test.ts\nA\tsrc/lib/c.test.ts\n',
  ].join('');
  const commits = parseGitLog(log);

  it('reads commits, statuses and renames', () => {
    expect(commits[0]).toMatchObject({ sha: 'new', subject: 'Fix the thing', changes: [{ status: 'M', path: 'src/lib/a.ts' }, { status: 'M', path: 'src/lib/a2.test.ts' }] });
    expect(commits[1].changes[0]).toEqual({ status: 'R', path: 'src/lib/a2.test.ts', from: 'src/lib/a1.test.ts' });
  });

  it('follows a chain of renames to the current name', () => {
    const chain = renameChains(commits);
    expect(chain.get('src/lib/a0.test.ts')).toBe('src/lib/a2.test.ts');
    expect(chain.get('src/lib/a1.test.ts')).toBe('src/lib/a2.test.ts');
  });

  it('calls a commit a fix only with a Fix subject, a source change and a test change', () => {
    const source = { status: 'M', path: 'src/lib/a.ts' };
    const test = { status: 'M', path: 'src/lib/a.test.ts' };
    expect(isFixCommit({ subject: 'Fix a', changes: [source, test] })).toBe(true);
    expect(isFixCommit({ subject: 'Add a', changes: [source, test] })).toBe(false);
    expect(isFixCommit({ subject: 'Fix a flaky test', changes: [test, { status: 'M', path: 'src/test/setup.ts' }] })).toBe(false);
    expect(isFixCommit({ subject: 'Fix a', changes: [source] })).toBe(false);
    expect(isFixCommit({ subject: 'Fix CI', changes: [test, { status: 'M', path: 'package.json' }, { status: 'M', path: '.github/workflows/ci.yml' }] })).toBe(false);
  });

  it('keeps only added lines, with escaped quotes undone so a name can match', () => {
    const diff = "--- a/x\n+++ b/x\n-it('gone', () => {})\n+it('doesn\\'t break', () => {})\n";
    expect(addedText(diff)).toBe("+it('doesn't break', () => {})");
  });
});

describe('coverageEntry', () => {
  const final = {
    'D:\\repo\\src\\lib\\a.ts': {
      statementMap: { 0: { start: { line: 1 } }, 1: { start: { line: 2 } }, 2: { start: { line: 2 } }, 3: { start: { line: 5 } } },
      s: { 0: 1, 1: 0, 2: 3, 3: 0 },
      b: { 0: [1, 0], 1: [0, 2] },
      f: { 0: 1, 1: 0 },
    },
  };

  it('stores covered line and branch ids, not only counts', () => {
    expect(coverageEntry(final, 'src/lib/a.ts')).toEqual({
      module: 'src/lib/a.ts',
      lines: { total: 3, covered: [1, 2] },
      branches: { total: 4, covered: ['0:0', '1:1'] },
      functions: { total: 2, covered: 1 },
    });
  });

  it('returns null when the report does not hold the module', () => {
    expect(coverageEntry(final, 'src/lib/b.ts')).toBeNull();
  });
});

describe('reporter', () => {
  const testCase = (fullName, state, duration) => ({ fullName, result: () => ({ state }), diagnostic: () => (duration === undefined ? undefined : { duration }) });

  it('marks a repeated full name so each test keeps its own record', () => {
    expect(moduleTests([testCase('x', 'passed', 4), testCase('x', 'failed', 5), testCase('y', 'skipped')])).toEqual([
      { name: 'x', state: 'passed', ms: 4 },
      { name: 'x #2', state: 'failed', ms: 5 },
      { name: 'y', state: 'skipped', ms: null },
    ]);
  });

  it('reports a module with its relative path and timing parts', () => {
    const module = {
      moduleId: path.join('/repo', 'src', 'a.test.ts'),
      project: { name: 'node' },
      children: { allTests: () => [testCase('x', 'passed', 1)][Symbol.iterator]() },
      diagnostic: () => ({ environmentSetupDuration: 1, prepareDuration: 2, setupDuration: 3, collectDuration: 4, duration: 5 }),
    };
    expect(moduleReport(module, path.join('/repo'))).toEqual({
      file: 'src/a.test.ts', project: 'node', environmentMs: 1, prepareMs: 2, setupMs: 3, collectMs: 4, durationMs: 5, tests: [{ name: 'x', state: 'passed', ms: 1 }],
    });
  });
});
