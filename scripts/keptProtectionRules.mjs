// The kept-protection check's pure rules: given evidence from before and after a change, what protection it lost.
import { median } from './slowTestReporter.mjs';

const FILE_READS_SOURCE = /\b(?:readFileSync|readFile|readdirSync|readdir|globSync)\b|\?raw\b/;

/** Whether a test file is a scanner, which would read Stryker's instrumented source instead of the real text. */
export const isScanner = (file, text, alwaysRun) => file in alwaysRun || FILE_READS_SOURCE.test(text);

/** Each file's coverage entry, one per test file. */
function fileCoverage(records) {
  const files = new Map();
  for (const record of records) {
    if (!files.has(record.file)) files.set(record.file, { record, coverage: record.coverage });
  }
  return [...files.values()];
}

const isGood = (coverage) => Boolean(coverage?.lines) && coverage.status === 0;
const NO_MODULE = '(no module)';
const moduleOf = ({ record, coverage }) => coverage?.module ?? record.moduleUnderTest ?? NO_MODULE;
const unionOf = (entries, read) => new Set(entries.flatMap((entry) => read(entry.coverage)));
const coveredLines = (coverage) => coverage.lines.covered;
const coveredBranches = (coverage) => coverage.branches.covered;
const minus = (from, without) => [...from].filter((id) => !without.has(id));

/** Each module's coverage change across the touched test files; fresh `context` records for other files still hold a line. */
export function coverageChange({ before, after, context = [] }) {
  const touched = new Set([...before, ...after].map((record) => record.file));
  const others = fileCoverage(context.filter((record) => !touched.has(record.file) && !record.stale)).filter(({ coverage }) => isGood(coverage));
  const beforeFiles = fileCoverage(before);
  const afterFiles = fileCoverage(after);
  const modules = new Set([...beforeFiles, ...afterFiles].map(moduleOf));
  return [...modules].sort().map((module) => {
    const inModule = (entry) => moduleOf(entry) === module;
    const was = beforeFiles.filter(inModule);
    const now = afterFiles.filter(inModule);
    const rest = others.filter(inModule);
    const unmeasured = [...was, ...now].filter(({ coverage }) => !isGood(coverage)).map(({ record }) => record.file);
    const good = (entries) => entries.filter(({ coverage }) => isGood(coverage));
    const covers = [...good(was), ...good(now)].map(({ coverage }) => coverage);
    const shapes = new Set([...covers, ...rest.map(({ coverage }) => coverage)].map((coverage) => `${coverage.lines.total}/${coverage.branches.total}`));
    const sources = new Set(covers.map((coverage) => coverage.moduleHash).filter(Boolean));
    const sourceChanged = shapes.size > 1 || sources.size > 1;
    const change = (read) => {
      const had = unionOf(good(was), read);
      const has = unionOf(good(now), read);
      const held = unionOf(rest, read);
      return { lost: minus(had, new Set([...has, ...held])), gained: minus(has, new Set([...had, ...held])).length };
    };
    const lines = change(coveredLines);
    const branches = change(coveredBranches);
    return {
      module,
      unmeasured: [...new Set(unmeasured)],
      sourceChanged,
      lostLines: lines.lost.sort((a, b) => a - b),
      lostBranches: branches.lost.sort(),
      gainedLines: lines.gained,
      gainedBranches: branches.gained,
      kept: !unmeasured.length && !sourceChanged && !lines.lost.length && !branches.lost.length,
    };
  });
}

/** Which tests a change moved, removed or added, matched by full name across files. */
export function testChange(before, after) {
  const names = (records) => Map.groupBy(records, (record) => record.name);
  const was = names(before);
  const now = names(after);
  const files = (records) => new Set(records.map((record) => record.file));
  const moved = [...was.keys()].filter((name) => now.has(name) && minus(files(now.get(name)), files(was.get(name))).length);
  return { moved, gone: minus(was.keys(), new Set(now.keys())), added: minus(now.keys(), new Set(was.keys())) };
}

const DETECTED = new Set(['Killed', 'Timeout']);

/** Each mutant of a Stryker JSON report, keyed by what it changed rather than by its run's id. */
function mutantsOf(report) {
  const mutants = new Map();
  for (const [file, { mutants: list }] of Object.entries(report.files)) {
    for (const mutant of list) {
      const { start, end } = mutant.location;
      mutants.set(`${file}:${start.line}:${start.column}-${end.line}:${end.column} ${mutant.mutatorName} ${mutant.replacement ?? ''}`, mutant);
    }
  }
  return mutants;
}

/** Mutants a change stopped detecting. A mutant only one report holds means the source changed, so the two can't be compared. */
export function killChange(before, after) {
  const was = mutantsOf(before);
  const now = mutantsOf(after);
  const detected = (mutants) => [...mutants].filter(([, { status }]) => DETECTED.has(status)).map(([key]) => key);
  const lost = detected(was).filter((key) => now.has(key) && !DETECTED.has(now.get(key).status));
  const unmatched = [...minus(was.keys(), new Set(now.keys())), ...minus(now.keys(), new Set(was.keys()))];
  return {
    mutants: was.size,
    killedBefore: detected(was).length,
    killedAfter: detected(now).length,
    lost,
    unmatched,
    staticSurvivors: [...was.values()].filter((mutant) => mutant.static && !DETECTED.has(mutant.status)).length,
    kept: !lost.length && !unmatched.length,
  };
}

const sum = (values) => values.reduce((total, value) => total + value, 0);

/** Each Q5 module's size and `perMutantMs`, the worst-case mutant: every test file of the family run once with its imports. */
export function deepCoverageModules(records) {
  const families = Map.groupBy(records.filter((record) => record.moduleUnderTest), (record) => record.moduleUnderTest);
  const rows = [];
  for (const [module, tests] of families) {
    const area = tests.find((record) => record.area)?.area;
    if (!area) continue;
    const files = [...Map.groupBy(tests, (record) => record.file).values()];
    const lines = Math.max(0, ...tests.map((record) => record.coverage?.lines?.total ?? 0));
    rows.push({ module, area, files: files.length, lines, perMutantMs: sum(files.map((inFile) => inFile[0].importCostMs + sum(inFile.map((record) => record.medianMs ?? 0)))) });
  }
  return rows;
}

/** Each module's mutants and upper-bound run time, slowest first. Per-test filtering and bail usually run less. */
export function projectMutationCost(modules, { mutantsPerLine, fixedMs, concurrency }) {
  return modules.map((row) => {
    const mutants = Math.round(row.lines * mutantsPerLine);
    return { ...row, mutants, hours: (mutants * (fixedMs + row.perMutantMs)) / concurrency / 3_600_000 };
  }).sort((a, b) => b.hours - a.hours);
}

/** The projection's calibration from one measured run: mutants per line, and what each mutant cost beyond its module's tests. */
export function calibrate({ mutants, lines, wallMs, concurrency, perMutantMs }) {
  return { mutantsPerLine: mutants / lines, fixedMs: Math.max(0, (wallMs * concurrency) / mutants - perMutantMs), concurrency };
}

/** Each area's total and median projected cost. */
export function projectionByArea(rows) {
  return [...Map.groupBy(rows, (row) => row.area)].map(([area, inArea]) => ({
    area,
    modules: inArea.length,
    mutants: sum(inArea.map((row) => row.mutants)),
    hours: sum(inArea.map((row) => row.hours)),
    medianHours: median(inArea.map((row) => row.hours)),
  })).sort((a, b) => b.hours - a.hours);
}

const preview = (ids) => (ids.length > 20 ? `${ids.slice(0, 20).join(', ')} and ${ids.length - 20} more` : ids.join(', '));

/** The coverage check as Markdown. */
export function coverageReport(modules, tests) {
  const lines = ['| Module | Result | Lost lines | Lost branches | New lines | New branches |', '|---|---|---:|---:|---:|---:|'];
  for (const row of modules) {
    const result = row.kept ? 'kept' : row.unmeasured.length ? 'not measured' : row.sourceChanged ? 'source changed' : 'LOST';
    lines.push(`| \`${row.module}\` | ${result} | ${row.lostLines.length} | ${row.lostBranches.length} | ${row.gainedLines} | ${row.gainedBranches} |`);
  }
  for (const row of modules) {
    if (row.lostLines.length) lines.push('', `\`${row.module}\` lost lines ${preview(row.lostLines)}.`);
    if (row.lostBranches.length) lines.push('', `\`${row.module}\` lost branches ${preview(row.lostBranches)}.`);
    if (row.unmeasured.length) lines.push('', `\`${row.module}\` has no green coverage from: ${row.unmeasured.join(', ')}.`);
  }
  lines.push('', `Tests moved ${tests.moved.length}, gone ${tests.gone.length}, added ${tests.added.length}.`);
  if (tests.gone.length) lines.push('', 'Gone:', ...tests.gone.map((name) => `- ${name}`));
  return lines.join('\n');
}

/** The projection as Markdown. */
export function projectionReport(rows, calibration) {
  return [
    `${calibration.mutantsPerLine.toFixed(2)} mutants per line, ${calibration.fixedMs.toFixed(0)} ms fixed per mutant, ${calibration.concurrency} workers.`,
    '',
    '| Area | Modules | Mutants | Hours, all | Hours, median module |',
    '|---|---:|---:|---:|---:|',
    ...projectionByArea(rows).map((row) => `| ${row.area} | ${row.modules} | ${row.mutants} | ${row.hours.toFixed(1)} | ${row.medianHours.toFixed(2)} |`),
    '',
    '| Module | Area | Test files | Lines | Mutants | Hours |',
    '|---|---|---:|---:|---:|---:|',
    ...rows.map((row) => `| \`${row.module}\` | ${row.area} | ${row.files} | ${row.lines} | ${row.mutants} | ${row.hours.toFixed(2)} |`),
  ].join('\n');
}

/** The kill check as Markdown. */
export function killReport(change) {
  const lines = [`Mutants ${change.mutants}. Detected before ${change.killedBefore}, after ${change.killedAfter}. Lost ${change.lost.length}. Static survivors, which it can't judge: ${change.staticSurvivors}.`];
  if (change.lost.length) lines.push('', 'Lost:', ...change.lost.map((key) => `- ${key}`));
  if (change.unmatched.length) lines.push('', 'In only one report, so the source changed:', ...change.unmatched.map((key) => `- ${key}`));
  return lines.join('\n');
}

/** The Stryker options for one module and its test files: forks, incremental, a sandbox of only what tests read. */
export function strykerConfig({ module, testFiles, reportFile, incrementalFile, tempDirName, roots, concurrency, force }) {
  return {
    testRunner: 'vitest',
    plugins: ['@stryker-mutator/vitest-runner'],
    vitest: { configFile: 'vite.config.js', related: false, pool: 'forks' },
    mutate: [module],
    testFiles,
    incremental: true,
    incrementalFile,
    force,
    concurrency,
    reporters: ['json', 'clear-text'],
    jsonReporter: { fileName: reportFile },
    clearTextReporter: { allowColor: false, logTests: false, reportTests: false, reportMutants: false },
    tempDirName,
    // The caller cuts this link before it deletes the sandbox, so no recursive delete can follow it.
    cleanTempDir: false,
    symlinkNodeModules: false,
    buildCommand: 'node scripts/keptProtectionLink.mjs',
    // Only the top-level entries git tracks, since the checkout also holds gigabytes of worktrees and output.
    ignorePatterns: ['/*', ...roots.map((root) => `!/${root}`)],
    // Peers' gates share this machine, and a slow run read as a timeout would count as a false kill.
    timeoutMS: 30_000,
    dryRunTimeoutMinutes: 30,
  };
}
