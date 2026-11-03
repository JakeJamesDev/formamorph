import { describe, expect, it } from 'vitest';
import { calibrate, coverageChange, coverageReport, deepCoverageModules, isScanner, killChange, killReport, projectMutationCost, projectionByArea, projectionReport, strykerConfig, testChange } from './keptProtectionRules.mjs';

const coverage = (lines, branches = [], overrides = {}) => ({
  module: 'src/lib/a.ts',
  status: 0,
  lines: { total: 10, covered: lines },
  branches: { total: 4, covered: branches },
  ...overrides,
});
const record = (file, cover, overrides = {}) => ({ file, name: `${file} test`, moduleUnderTest: 'src/lib/a.ts', coverage: cover, stale: false, ...overrides });

describe('coverageChange', () => {
  it('reports the lines and branches a removed test file alone covered', () => {
    const [row] = coverageChange({
      before: [record('a.big.test.ts', coverage([1, 2, 3], ['0:0', '0:1']))],
      after: [record('a.test.ts', coverage([1], ['0:0']))],
    });
    expect(row).toMatchObject({ module: 'src/lib/a.ts', kept: false, lostLines: [2, 3], lostBranches: ['0:1'] });
  });

  it('keeps a module when the after files cover the same lines and branches', () => {
    const [row] = coverageChange({
      before: [record('a.big.test.ts', coverage([1, 2], ['0:0']))],
      after: [record('a.test.ts', coverage([1, 2, 3], ['0:0', '1:0']))],
    });
    expect(row).toMatchObject({ kept: true, lostLines: [], lostBranches: [], gainedLines: 1, gainedBranches: 1 });
  });

  it('counts a deleted file as losing everything it alone covered', () => {
    const [row] = coverageChange({ before: [record('a.test.ts', coverage([1, 2]))], after: [] });
    expect(row).toMatchObject({ kept: false, lostLines: [1, 2] });
  });

  it('lets another test file in the ledger hold a line the touched file stopped covering', () => {
    const [row] = coverageChange({
      before: [record('a.big.test.ts', coverage([1, 2]))],
      after: [],
      context: [record('a.other.test.ts', coverage([1, 2]))],
    });
    expect(row.kept).toBe(true);
  });

  it('never credits a stale ledger record, which no longer describes the tree', () => {
    const [row] = coverageChange({
      before: [record('a.big.test.ts', coverage([1, 2]))],
      after: [],
      context: [record('a.other.test.ts', coverage([1, 2]), { stale: true })],
    });
    expect(row.lostLines).toEqual([1, 2]);
  });

  it('never credits the ledger with its own old record of a touched file', () => {
    const [row] = coverageChange({
      before: [record('a.test.ts', coverage([1, 2]))],
      after: [record('a.test.ts', coverage([1]))],
      context: [record('a.test.ts', coverage([1, 2]))],
    });
    expect(row.lostLines).toEqual([2]);
  });

  it.each([
    ['no coverage', null],
    ['a stored error', { file: 'a.test.ts', error: 'hung' }],
    ['a failing run', coverage([1, 2], [], { status: 1 })],
  ])('fails closed on an after file with %s, even with every line held elsewhere', (_label, cover) => {
    const [row] = coverageChange({
      before: [record('a.test.ts', coverage([1, 2]))],
      after: [record('a.test.ts', cover)],
      context: [record('a.other.test.ts', coverage([1, 2]))],
    });
    expect(row).toMatchObject({ kept: false, unmeasured: ['a.test.ts'] });
  });

  it('fails when the two sides measured different source, whose line ids do not compare', () => {
    const [row] = coverageChange({
      before: [record('a.test.ts', coverage([1, 2]))],
      after: [record('a.test.ts', coverage([1, 2], [], { lines: { total: 11, covered: [1, 2] } }))],
    });
    expect(row).toMatchObject({ kept: false, sourceChanged: true, lostLines: [] });
  });

  it('fails closed on a touched file with no module, which has no coverage to compare', () => {
    const rows = coverageChange({ before: [record('a.test.ts', null, { moduleUnderTest: null })], after: [] });
    expect(rows).toEqual([expect.objectContaining({ module: '(no module)', kept: false, unmeasured: ['a.test.ts'] })]);
  });

  it('fails when one line and branch count hides a source edit', () => {
    const [row] = coverageChange({
      before: [record('a.test.ts', coverage([1, 2], [], { moduleHash: 'old' }))],
      after: [record('a.test.ts', coverage([1, 2], [], { moduleHash: 'new' }))],
    });
    expect(row).toMatchObject({ kept: false, sourceChanged: true });
  });

  it('compares each module on its own, and sorts what was lost', () => {
    const b = (lines) => coverage(lines, [], { module: 'src/lib/b.ts' });
    const rows = coverageChange({
      before: [record('b.test.ts', b([9, 8])), record('a.test.ts', coverage([3, 2], ['1:0', '0:0']))],
      after: [record('b.test.ts', b([])), record('a.test.ts', coverage([3, 2], ['1:0', '0:0']))],
      context: [record('c.test.ts', coverage([8, 9]))],
    });
    expect(rows.map((row) => [row.module, row.kept, row.lostLines])).toEqual([['src/lib/a.ts', true, []], ['src/lib/b.ts', false, [8, 9]]]);
    const [lostBoth] = coverageChange({ before: [record('a.test.ts', coverage([10, 9], ['1:0', '0:0']))], after: [] });
    expect(lostBoth).toMatchObject({ lostLines: [9, 10], lostBranches: ['0:0', '1:0'] });
  });

  it('reads one module hash as one source, and a file without a hash as no second source', () => {
    const [row] = coverageChange({
      before: [record('a.test.ts', coverage([1], [], { moduleHash: 'same' })), record('a.more.test.ts', coverage([1]))],
      after: [record('a.test.ts', coverage([1], [], { moduleHash: 'same' }))],
    });
    expect(row).toMatchObject({ kept: true, sourceChanged: false });
  });

  it('groups by the module coverage measured, so a move can compare a panel the view test also covered', () => {
    const panel = (lines) => coverage(lines, [], { module: 'src/managers/Panel.tsx' });
    const rows = coverageChange({
      before: [record('src/views/View.panel.test.tsx', panel([1, 2, 3]), { moduleUnderTest: 'src/views/View.tsx' })],
      after: [record('src/managers/Panel.test.tsx', panel([1, 2]), { moduleUnderTest: 'src/managers/Panel.tsx' })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ module: 'src/managers/Panel.tsx', kept: false, lostLines: [3] });
  });

  it('reads one coverage entry per file, whatever its test count', () => {
    const cover = coverage([1]);
    const [row] = coverageChange({
      before: [record('a.test.ts', cover, { name: 'one' }), record('a.test.ts', cover, { name: 'two' })],
      after: [record('a.test.ts', cover, { name: 'one' })],
    });
    expect(row.kept).toBe(true);
  });
});

describe('testChange', () => {
  it('names moved, gone and added tests across files', () => {
    const before = [record('view.test.tsx', null, { name: 'moves' }), record('view.test.tsx', null, { name: 'goes' }), record('view.test.tsx', null, { name: 'stays' })];
    const after = [record('panel.test.tsx', null, { name: 'moves' }), record('view.test.tsx', null, { name: 'stays' }), record('panel.test.tsx', null, { name: 'new' })];
    expect(testChange(before, after)).toEqual({ moved: ['moves'], gone: ['goes'], added: ['new'] });
  });
});

const mutant = (line, status, overrides = {}) => ({
  id: String(line),
  mutatorName: 'ConditionalExpression',
  replacement: 'true',
  status,
  location: { start: { line, column: 1 }, end: { line, column: 5 } },
  ...overrides,
});
const report = (...mutants) => ({ files: { 'src/lib/a.ts': { mutants } } });

describe('killChange', () => {
  it('reports a killed mutant that now survives', () => {
    const change = killChange(report(mutant(1, 'Killed'), mutant(2, 'Killed')), report(mutant(1, 'Killed'), mutant(2, 'Survived')));
    expect(change).toMatchObject({ kept: false, killedBefore: 2, killedAfter: 1 });
    expect(change.lost).toEqual(['src/lib/a.ts:2:1-2:5 ConditionalExpression true']);
  });

  it('keeps protection when every detected mutant stays detected, by kill or by timeout', () => {
    const change = killChange(report(mutant(1, 'Killed'), mutant(2, 'Timeout'), mutant(3, 'Survived')), report(mutant(1, 'Timeout'), mutant(2, 'Killed'), mutant(3, 'Survived')));
    expect(change).toMatchObject({ kept: true, lost: [], unmatched: [] });
  });

  it('counts a mutant no test reaches any more as lost', () => {
    expect(killChange(report(mutant(1, 'Killed')), report(mutant(1, 'NoCoverage'))).kept).toBe(false);
  });

  it('matches mutants by what they change, since ids differ between runs', () => {
    const change = killChange(report(mutant(1, 'Killed', { id: '7' })), report(mutant(1, 'Killed', { id: '99' })));
    expect(change.kept).toBe(true);
  });

  it('counts the static survivors it cannot judge', () => {
    const change = killChange(report(mutant(1, 'Survived', { static: true }), mutant(2, 'Killed', { static: true }), mutant(3, 'Survived')), report(mutant(1, 'Survived'), mutant(2, 'Killed'), mutant(3, 'Survived')));
    expect(change.staticSurvivors).toBe(1);
    expect(killReport(change)).toContain("Static survivors, which it can't judge: 1.");
  });

  it('fails when the reports hold different mutants, since the source changed', () => {
    const change = killChange(report(mutant(1, 'Killed')), report(mutant(1, 'Killed', { replacement: 'false' })));
    expect(change).toMatchObject({ kept: false, lost: [] });
    expect(change.unmatched).toHaveLength(2);
    expect(killReport(change)).toContain('In only one report, so the source changed:\n- src/lib/a.ts:1:1-1:5 ConditionalExpression true');
  });
});

describe('isScanner', () => {
  it('finds listed scans and tests that read files from disk', () => {
    expect(isScanner('a.test.ts', 'expect(1).toBe(1)', { 'a.test.ts': 'scans' })).toBe(true);
    // Assembled, so this file does not read as a scanner itself.
    expect(isScanner('b.test.ts', `${['read', 'FileSync'].join('')}('src/a.ts')`, {})).toBe(true);
    expect(isScanner('c.test.ts', `import text from './a.ts${['?', 'raw'].join('')}';`, {})).toBe(true);
  });

  it('leaves a plain test in', () => {
    expect(isScanner('d.test.ts', "import { a } from './a'; expect(a()).toBe(1);", {})).toBe(false);
  });
});

describe('projectMutationCost', () => {
  const rows = (records, calibration = { mutantsPerLine: 2, fixedMs: 0, concurrency: 1 }) => projectMutationCost(deepCoverageModules(records), calibration);
  const q5 = (file, overrides = {}) => record(file, coverage([1], [], { lines: { total: 100, covered: [] } }), { area: 'saves-import-migration', importCostMs: 1000, medianMs: 500, ...overrides });

  it('prices each mutant at one run of the family, imports included', () => {
    const [row] = rows([q5('a.test.ts'), q5('a.more.test.ts')]);
    expect(row).toMatchObject({ module: 'src/lib/a.ts', files: 2, lines: 100, mutants: 200, perMutantMs: 3000 });
    expect(row.hours).toBeCloseTo((200 * 3000) / 3_600_000);
  });

  it('leaves out modules outside the Q5 areas', () => {
    expect(rows([q5('a.test.ts', { area: null })])).toEqual([]);
  });

  it('calibrates against a measured run, so that run projects to its own time', () => {
    const calibration = calibrate({ mutants: 300, lines: 100, wallMs: 3_600_000, concurrency: 4, perMutantMs: 1500 });
    expect(calibration).toMatchObject({ mutantsPerLine: 3, fixedMs: 46_500 });
    const [row] = rows([q5('a.test.ts'), q5('a.more.test.ts')].map((test) => ({ ...test, importCostMs: 500, medianMs: 250 })), calibration);
    expect(row.mutants).toBe(300);
    expect(row.hours).toBeCloseTo(1);
  });

  it('charges a slow family more per mutant than a fast one of the same size', () => {
    const calibration = { mutantsPerLine: 1, fixedMs: 100, concurrency: 1 };
    const [slow, fast] = rows([q5('a.test.ts', { importCostMs: 5000 }), q5('b.test.ts', { moduleUnderTest: 'src/lib/b.ts', importCostMs: 0, medianMs: 0 })], calibration);
    expect(slow.module).toBe('src/lib/a.ts');
    expect(slow.hours).toBeGreaterThan(fast.hours);
    expect(rows([q5('b.test.ts', { moduleUnderTest: 'src/lib/b.ts', importCostMs: 0, medianMs: 0 }), q5('a.test.ts')], calibration).map((row) => row.module)).toEqual(['src/lib/a.ts', 'src/lib/b.ts']);
    expect(fast.hours).toBeCloseTo((100 * 100) / 3_600_000);
  });

  it('totals by area', () => {
    const projected = rows([q5('a.test.ts'), q5('b.test.ts', { moduleUnderTest: 'src/lib/b.ts' })]);
    const [area] = projectionByArea(projected);
    expect(area).toMatchObject({ area: 'saves-import-migration', modules: 2, mutants: 400 });
    const small = { area: 'small', mutants: 1, hours: 1 };
    const big = { area: 'big', mutants: 1, hours: 2 };
    expect(projectionByArea([small, big]).map((row) => row.area)).toEqual(['big', 'small']);
  });
});

describe('reports', () => {
  it('names why a module was not kept', () => {
    const unmeasured = coverageChange({ before: [record('a.test.ts', null)], after: [] });
    expect(coverageReport(unmeasured, { moved: [], gone: [], added: [] })).toContain('| not measured |');
    const edited = coverageChange({ before: [record('a.test.ts', coverage([1], [], { moduleHash: 'old' }))], after: [record('a.test.ts', coverage([1], [], { moduleHash: 'new' }))] });
    expect(coverageReport(edited, { moved: [], gone: [], added: [] })).toContain('| source changed |');
  });

  it('prints each area and module of the projection', () => {
    const row = { module: 'src/lib/a.ts', area: 'turn-prompts', files: 1, lines: 10, mutants: 20, hours: 0.5 };
    const text = projectionReport([row], { mutantsPerLine: 2, fixedMs: 600, concurrency: 4 });
    expect(text).toContain('2.00 mutants per line, 600 ms fixed per mutant, 4 workers.');
    expect(text).toContain('| turn-prompts | 1 | 20 | 0.5 | 0.50 |');
    expect(text).toContain('| `src/lib/a.ts` | turn-prompts | 1 | 10 | 20 | 0.50 |');
  });

  it('names the loss and the tests gone', () => {
    const modules = coverageChange({ before: [record('a.test.ts', coverage([1, 2]))], after: [] });
    const text = coverageReport(modules, testChange([record('a.test.ts', null, { name: 'gone one' })], []));
    expect(text).toContain('| `src/lib/a.ts` | LOST | 2 |');
    expect(text).toContain('lost lines 1, 2.');
    expect(text).toContain('- gone one');
  });

  it('names lost mutants', () => {
    expect(killReport(killChange(report(mutant(1, 'Killed')), report(mutant(1, 'Survived'))))).toContain('Lost 1.');
  });
});

describe('strykerConfig', () => {
  const config = strykerConfig({ module: 'src/lib/a.ts', testFiles: ['src/lib/a.test.ts'], reportFile: 'r.json', incrementalFile: 'i.json', tempDirName: '.stryker-tmp', roots: ['src', 'package.json'], concurrency: 4, force: false });

  it('runs only the given tests, in forks, incrementally', () => {
    expect(config.vitest).toMatchObject({ pool: 'forks', related: false });
    expect(config).toMatchObject({ incremental: true, testFiles: ['src/lib/a.test.ts'], mutate: ['src/lib/a.ts'] });
  });

  it('leaves deleting the sandbox to the caller, which cuts the junction first', () => {
    expect(config).toMatchObject({ cleanTempDir: false, symlinkNodeModules: false, buildCommand: 'node scripts/keptProtectionLink.mjs' });
  });

  it('keeps worktrees out of the sandbox', () => {
    expect(config.ignorePatterns).toEqual(['/*', '!/src', '!/package.json']);
  });
});
