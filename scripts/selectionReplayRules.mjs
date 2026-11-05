// The selection replay's pure rules: what counts as a test path, which bugs to inject, and how a run scores (scripts/selectionReplay.mjs).
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');

const TEST_PATH = /\.test\.[cm]?[jt]sx?$|__snapshots__\/|__fixtures__\/|\/fixtures\/|__parity__\/|__bodies__\/|^src\/test\/|^testing\/|^e2e\//;
const CODE_FILE = /^(?:src|electron|scripts|site)\/.*\.(?:tsx?|mjs|cjs)$/;
const DATA_FILE = /\.(?:md|css|json|html|ya?ml|dict)$/;
const NOT_DATA = /^(?:docs-internal|marketing|android|\.claude)\/|__snapshots__\/|^(?:package(?:-lock)?|tsconfig[^/]*)\.json$/;
const NON_GATE_INPUT = /^docs-internal\//;
const ONE_SIDED_95 = 0.05;
/** Share of data mutants that delete the whole file instead of one line. */
const DELETE_FILE_SHARE = 0.25;

/** Test files and what only tests read: a replay keeps these from before the landing. */
export const isTestPath = (file) => TEST_PATH.test(file);

/** A seeded generator in [0, 1), so a sample can be repeated and resumed. */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [out[index], out[other]] = [out[other], out[index]];
  }
  return out;
}

/** How one landing becomes a bug: its non-test diff on the tests from before it. `entries` come from a no-renames diff of the parent and the landing. */
export function replayPlan(entries) {
  const tests = entries.filter(({ path }) => isTestPath(path));
  return {
    restore: tests.filter(({ status }) => status !== 'A').map(({ path }) => path),
    remove: tests.filter(({ status }) => status === 'A').map(({ path }) => path),
    change: entries.filter(({ path }) => !isTestPath(path)).map(({ path }) => path),
  };
}

/** A landing that can show a bug: it changes a gate input and rewrites a test that existed, so that test's old form may go red. */
export const isReplayable = ({ parents, files }) => {
  const plan = replayPlan(files);
  return parents.length === 1 && plan.restore.length > 0 && plan.change.some((file) => !NON_GATE_INPUT.test(file));
};

/** A uniform seeded sample of replayable landings. */
export const sampleLandings = (commits, count, seed) => shuffled(commits.filter(isReplayable), seededRandom(seed)).slice(0, count);

/** The files mutants can land in, by kind. Files are sampled uniformly, because selection works per file and large files would otherwise dominate. */
export const mutationPopulation = (files) => ({
  code: files.filter((file) => CODE_FILE.test(file) && !isTestPath(file) && !file.endsWith('.d.ts')),
  data: files.filter((file) => DATA_FILE.test(file) && !NOT_DATA.test(file)),
});

const OPERATOR_SWAPS = new Map([
  [ts.SyntaxKind.EqualsEqualsEqualsToken, '!=='],
  [ts.SyntaxKind.ExclamationEqualsEqualsToken, '==='],
  [ts.SyntaxKind.EqualsEqualsToken, '!='],
  [ts.SyntaxKind.ExclamationEqualsToken, '=='],
  [ts.SyntaxKind.AmpersandAmpersandToken, '||'],
  [ts.SyntaxKind.BarBarToken, '&&'],
  [ts.SyntaxKind.LessThanToken, '>='],
  [ts.SyntaxKind.GreaterThanToken, '<='],
  [ts.SyntaxKind.LessThanEqualsToken, '>'],
  [ts.SyntaxKind.GreaterThanEqualsToken, '<'],
  [ts.SyntaxKind.MinusToken, '+'],
]);

/** The places a code file can be mutated. Types and imports can't change behavior; loop conditions would hang a run. */
export function codeSites(file, source) {
  const scriptKind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
  const sites = [];
  const add = (start, end, replacement, op) => sites.push({ start, end, replacement, op, line: tree.getLineAndCharacterOfPosition(start).line + 1 });
  const negate = (node) => add(node.getStart(tree), node.end, `!(${node.getText(tree)})`, 'negate-condition');
  const visit = (node) => {
    if (ts.isTypeNode(node) || ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return;
    if (ts.isBinaryExpression(node) && OPERATOR_SWAPS.has(node.operatorToken.kind)) {
      add(node.operatorToken.getStart(tree), node.operatorToken.end, OPERATOR_SWAPS.get(node.operatorToken.kind), `swap ${node.operatorToken.getText(tree)}`);
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword) add(node.getStart(tree), node.end, 'false', 'flip true');
    if (node.kind === ts.SyntaxKind.FalseKeyword) add(node.getStart(tree), node.end, 'true', 'flip false');
    if (ts.isIfStatement(node) || ts.isConditionalExpression(node)) negate(ts.isIfStatement(node) ? node.expression : node.condition);
    if (ts.isWhileStatement(node) || ts.isDoStatement(node)) return visit(node.statement);
    if (ts.isForStatement(node)) return visit(node.statement);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return sites;
}

/** Each non-blank line of a data file, as a deletion. */
function dataSites(source) {
  const sites = [];
  let start = 0;
  let line = 1;
  for (const text of source.split('\n')) {
    const end = start + text.length + 1;
    if (text.trim()) sites.push({ start, end: Math.min(end, source.length), replacement: '', op: 'delete-line', line });
    start = end;
    line++;
  }
  return sites;
}

/** One mutant per sampled file. `read` returns a file's text, or null when it isn't there. */
export function sampleMutants({ code, data }, { codeCount, dataCount, seed, read }) {
  // One generator per kind, so asking for more of one kind leaves the other's sample alone.
  const pick = (kind, files, count, random, siteOf) => {
    const out = [];
    for (const file of shuffled(files, random)) {
      if (out.length === count) break;
      const source = read(file);
      const site = source === null ? null : siteOf(file, source, random);
      if (site) out.push({ kind, file, ...site });
    }
    return out;
  };
  const anyOf = (sites, random) => (sites.length ? sites[Math.floor(random() * sites.length)] : null);
  const codeSite = (file, source, random) => anyOf(codeSites(file, source), random);
  const dataSite = (_file, source, random) => (random() < DELETE_FILE_SHARE ? { op: 'delete-file', line: 0 } : anyOf(dataSites(source), random));
  return [...pick('code', code, codeCount, seededRandom(seed), codeSite), ...pick('data', data, dataCount, seededRandom(seed + 1), dataSite)];
}

export const mutantId = ({ kind, file, line, op }) => `${kind}:${file}:${line}:${op}`;

/** A file's text with one mutant applied. */
export const applyMutant = (source, { start, end, replacement }) => source.slice(0, start) + replacement + source.slice(end);

/**
 * Scores one injected bug. A file counts as red for the bug only when it went red in the full run, stayed red alone,
 * and is green alone without the bug: a starved test or a test that was already red proves nothing about selection.
 * The tools: `enterBug` and `enterControl` set up the trees, `selected` lists what the gate would run, `runAll` runs
 * every test and `runFiles` runs named files.
 */
export async function scoreBug(tools) {
  await tools.enterBug();
  const selected = await tools.selected();
  const full = await tools.runAll();
  if (!full.valid) return { status: 'invalid', reason: full.reason, selected: selected.length };
  const base = { selected: selected.length, files: full.files };
  const firstRed = Object.keys(full.red);
  if (!firstRed.length) return { ...base, status: full.failed ? 'unattributed' : 'no-red', red: [], missed: [], unconfirmed: [], alreadyRed: [] };
  const again = await tools.runFiles(firstRed);
  if (!again.valid) return { ...base, status: 'invalid', reason: again.reason };
  const stayedRed = firstRed.filter((file) => file in again.red);
  const unconfirmed = firstRed.filter((file) => !stayedRed.includes(file));
  const newTests = {};
  if (stayedRed.length) {
    await tools.enterControl();
    const control = await tools.runFiles(stayedRed);
    if (!control.valid) return { ...base, status: 'invalid', reason: control.reason };
    // By test, not file: one test already red must not hide another this bug turned red.
    for (const file of stayedRed) {
      const before = new Set(control.red[file] ?? []);
      const tests = again.red[file].filter((test) => !before.has(test));
      if (tests.length) newTests[file] = tests;
    }
  }
  const red = Object.keys(newTests);
  const alreadyRed = stayedRed.filter((file) => !(file in newTests));
  const chosen = new Set(selected);
  return {
    ...base,
    status: red.length ? 'bug' : 'no-red',
    red,
    missed: red.filter((file) => !chosen.has(file)).map((file) => ({ file, tests: newTests[file] })),
    unconfirmed,
    alreadyRed,
    filteredUnselected: [...unconfirmed, ...alreadyRed].filter((file) => !chosen.has(file)),
  };
}

/** The stored run settings that differ from what this run asks for. Results from another selector, base or seed must not mix. */
export const settingConflicts = (stored, wanted) => Object.keys(stored).filter((key) => wanted[key] !== undefined && wanted[key] !== stored[key]);

/** The miss rate's 95% one-sided upper bound: the rule of three at zero misses, the exact binomial bound above it. No bug at all bounds nothing. */
export function missUpperBound(misses, bugs) {
  if (bugs === 0) return { rate: 1, method: 'no evidence' };
  if (misses === 0) return { rate: Math.min(1, 3 / bugs), method: 'rule of three' };
  if (misses >= bugs) return { rate: 1, method: 'exact binomial' };
  const atMost = (rate) => {
    let term = (1 - rate) ** bugs;
    let total = term;
    for (let count = 1; count <= misses; count++) {
      term *= ((bugs - count + 1) / count) * (rate / (1 - rate));
      total += term;
    }
    return total;
  };
  let low = misses / bugs;
  let high = 1;
  for (let step = 0; step < 60; step++) {
    const middle = (low + high) / 2;
    if (atMost(middle) > ONE_SIDED_95) low = middle;
    else high = middle;
  }
  return { rate: high, method: 'exact binomial' };
}

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function tally(cases) {
  const bugs = cases.filter((row) => row.status === 'bug');
  const misses = bugs.filter((row) => row.missed.length).length;
  return { cases: cases.length, bugs: bugs.length, misses, upperBound: missUpperBound(misses, bugs.length) };
}

/**
 * The run's numbers. The trial is one bug that turned a test red, since a bug with thirty red tests is one chance to
 * miss, not thirty. Precision pools selected files over those bugs: of what the gate ran, how much went red. The
 * selected share also counts bugs that turned nothing red, because the gate paid for those runs too.
 */
export function summarize(cases) {
  const bugs = cases.filter((row) => row.status === 'bug');
  const selected = bugs.reduce((sum, row) => sum + row.selected, 0);
  const hit = bugs.reduce((sum, row) => sum + row.red.length - row.missed.length, 0);
  return {
    ...tally(cases),
    missedFiles: bugs.reduce((sum, row) => sum + row.missed.length, 0),
    redFiles: bugs.reduce((sum, row) => sum + row.red.length, 0),
    precision: selected ? hit / selected : null,
    medianSelectedShare: median(cases.filter((row) => row.status === 'bug' || row.status === 'no-red').map((row) => row.selected / row.files)),
    noRed: cases.filter((row) => row.status === 'no-red').length,
    invalid: cases.filter((row) => row.status === 'invalid').length,
    unattributed: cases.filter((row) => row.status === 'unattributed').length,
    unconfirmedFiles: cases.reduce((sum, row) => sum + (row.unconfirmed?.length ?? 0), 0),
    alreadyRedFiles: cases.reduce((sum, row) => sum + (row.alreadyRed?.length ?? 0), 0),
    subset: cases.some((row) => row.subset),
    byKind: Object.fromEntries(['landing', 'code', 'data'].map((kind) => [kind, tally(cases.filter((row) => row.kind === kind))])),
    missList: bugs.filter((row) => row.missed.length).map(({ id, kind, change, missed }) => ({ id, kind, change, missed })),
    invalidList: cases.filter((row) => row.status === 'invalid').map(({ id, reason }) => ({ id, reason })),
    filteredList: cases.filter((row) => row.filteredUnselected?.length).map(({ id, filteredUnselected }) => ({ id, files: filteredUnselected })),
  };
}

const percent = (value) => (value === null ? 'none' : `${(value * 100).toFixed(1)}%`);

/** The summary as Markdown. */
export function replayReport(summary) {
  const row = (name, { cases, bugs, misses, upperBound }) => `| ${name} | ${cases} | ${bugs} | ${misses} | ${percent(upperBound.rate)} |`;
  const lines = [
    ...(summary.subset ? ['> ⚠️ This run used a subset of the tests, so its numbers score nothing.', ''] : []),
    '| Injected | Tried | Turned a test red | Missed | Miss rate upper bound (95%) |',
    '|---|---:|---:|---:|---:|',
    row('Landings', summary.byKind.landing),
    row('Code mutants', summary.byKind.code),
    row('Data mutants', summary.byKind.data),
    row('**All**', summary),
    '',
    `- **Sample size:** ${summary.bugs} bugs turned a test red. Bound method: ${summary.upperBound.method}.`,
    `- **Precision:** ${percent(summary.precision)}. The gate selected a median ${percent(summary.medianSelectedShare)} of test files.`,
    `- **Red files:** ${summary.redFiles}, ${summary.missedFiles} not selected.`,
    `- **Left out:** ${summary.noRed} turned nothing red, ${summary.invalid} runs were invalid, ${summary.unattributed} went red with no file named.`,
    `- **Filtered reds:** ${summary.unconfirmedFiles} files went green alone, ${summary.alreadyRedFiles} were red without the bug.`,
    '',
    summary.bugs ? (summary.missList.length ? '## Misses' : `**No misses in ${summary.bugs} bugs.**`) : '**No evidence: no bug turned a test red.**',
    ...summary.missList.flatMap(({ id, change, missed }) => ['', `- \`${id}\`, changing ${change.map((file) => `\`${file}\``).join(', ')}:`, ...missed.map(({ file, tests }) => `  - \`${file}\`: ${tests.join('; ')}`)]),
    ...(summary.invalidList.length ? ['', '## Invalid Runs', '', ...summary.invalidList.map(({ id, reason }) => `- \`${id}\`: ${reason}`)] : []),
    ...(summary.filteredList.length ? ['', '## Filtered Reds Not Selected', '', ...summary.filteredList.map(({ id, files }) => `- \`${id}\`: ${files.map((file) => `\`${file}\``).join(', ')}`)] : []),
  ];
  return lines.join('\n');
}
