// The Test Ledger's pure rules: given run reports, coverage and failure history, which records come out.
import { createHash } from 'node:crypto';
import path from 'node:path';
import { median } from './slowTestReporter.mjs';
import { testKey } from './testRetry.mjs';

export const TEST_FILE = /\.test\.(?:tsx?|mjs)$/;
const CODE_EXTENSIONS = ['.ts', '.tsx', '.mjs', '.cjs', '.js'];
const IMPORT_TYPE = /^\s*import\s+(?:type\b[^;]*;|\{\s*(?:type\s+[^,}]+,?\s*)+\}\s*from\s+['"][^'"]+['"];?)/gm;
const IMPORT = /(?:\bfrom\s+|\bimport\s+|\bimport\(\s*|\bimportActual(?:<[^>]*>)?\(\s*)['"]([^'"]+)['"]/g;

/** A specifier's repo path, or null when it leaves the repo or names no file in `files`. */
function resolveImport(specifier, from, files) {
  const bare = specifier.split('?')[0];
  const base = bare.startsWith('@/') ? `src/${bare.slice(2)}`
    : bare.startsWith('.') ? path.posix.join(path.posix.dirname(from), bare) : null;
  if (base === null) return null;
  const candidates = [base, ...CODE_EXTENSIONS.map((ext) => base + ext), ...CODE_EXTENSIONS.map((ext) => `${base}/index${ext}`)];
  return candidates.find((candidate) => files.has(candidate)) ?? null;
}

/** Each file's resolved runtime imports, in source order. `sources` maps repo paths to their text. */
export function importGraph(sources) {
  const files = new Set(Object.keys(sources));
  const graph = new Map();
  for (const [file, text] of Object.entries(sources)) {
    const runtime = text.replace(IMPORT_TYPE, '');
    const targets = [...runtime.matchAll(IMPORT)].map(([, specifier]) => resolveImport(specifier, file, files)).filter(Boolean);
    graph.set(file, [...new Set(targets)]);
  }
  return graph;
}

/** The files only tests reach: every importer is a test or another such file. */
export function testOnlyFiles(graph) {
  const importers = new Map();
  for (const [file, targets] of graph) {
    for (const target of targets) {
      if (!importers.has(target)) importers.set(target, []);
      importers.get(target).push(file);
    }
  }
  const testOnly = new Set([...importers.keys()].filter((file) => !TEST_FILE.test(file)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const file of testOnly) {
      if (importers.get(file).every((importer) => TEST_FILE.test(importer) || testOnly.has(importer))) continue;
      testOnly.delete(file);
      changed = true;
    }
  }
  return testOnly;
}

const isCode = (file) => CODE_EXTENSIONS.includes(path.posix.extname(file));

/** The module a test file tests, and the rule that named it: its sibling by name, its only import, or its first. */
export function moduleUnderTest(testFile, graph, testOnly) {
  const dir = path.posix.dirname(testFile);
  const parts = path.posix.basename(testFile).replace(/\.test\.[^.]+$/, '').split('.');
  for (let keep = parts.length; keep > 0; keep--) {
    const stem = `${dir === '.' ? '' : `${dir}/`}${parts.slice(0, keep).join('.')}`;
    const sibling = CODE_EXTENSIONS.map((ext) => stem + ext).find((file) => graph.has(file));
    if (sibling) return { path: sibling, by: 'name' };
  }
  const imports = (graph.get(testFile) ?? []).filter((file) => isCode(file) && !TEST_FILE.test(file) && !testOnly.has(file));
  if (imports.length === 0) return { path: null, by: null };
  return { path: imports[0], by: imports.length === 1 ? 'import' : 'first-import' };
}

/** The files whose text decides a record's hash: the test, its snapshot, its module and its direct test-only imports. */
export function hashInputs(testFile, module, graph, testOnly, exists) {
  const dir = path.posix.dirname(testFile);
  const snapshot = `${dir}/__snapshots__/${path.posix.basename(testFile)}.snap`;
  const helpers = (graph.get(testFile) ?? []).filter((file) => testOnly.has(file));
  const inputs = [testFile, ...helpers, ...(module ? [module] : []), ...(exists(snapshot) ? [snapshot] : [])];
  return [...new Set(inputs)].sort();
}

/** The hash of `inputs` as `read` returns them, with line endings normalized; a missing file reads as null. */
export function evidenceHash(inputs, read) {
  const hash = createHash('sha256');
  for (const input of inputs) {
    const text = read(input);
    hash.update(`${input}\0${text === null ? '\u0001missing' : text.replace(/\r\n/g, '\n')}\0`);
  }
  return hash.digest('hex');
}

/** Whether the files behind a record have changed since its run. */
export const isStale = (record, read) => evidenceHash(record.hashInputs, read) !== record.hash;

/** `scan` means listed as always run, which is not every test that scans files. */
export function levelOf(file, alwaysRun) {
  if (file in alwaysRun) return 'scan';
  if (/^(?:scripts|electron|testing)\//.test(file)) return 'script';
  if (file.startsWith('src/views/')) return 'view';
  return file.endsWith('.tsx') ? 'component' : 'unit';
}

// The spec's Q5 deep-coverage areas, matched on whole words so `description` is not a script and `author` is not auth.
const DEEP_COVERAGE_AREAS = [
  ['saves-import-migration', /\b(?:saves?|saved|saving|autosave|import|imports|migrate|migration|migrations|backup|backups|convert|conversion|lorebook|export|exports|version)\b/],
  ['turn-prompts', /\b(?:turn pipeline|turn pass|turn passes|game prompts|experimental prompts|prompt samplers|plan turn|run turn)\b/],
  ['sandbox-scripts', /\b(?:stat code|sandbox|quickjs|script|scripts)\b/],
  ['accounts-moderation', /\b(?:auth|account|accounts|age gate|moderation|moderator|content reports?|admin panel|manage users|abuse|staff)\b/],
];

const words = (text) => text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[/._-]/g, ' ').toLowerCase();

/** The Q5 area a test's paths name, read from the file names; the `scripts/` folder is not the Scripts feature. */
export function areaOf(file, module) {
  const named = words([file, module].filter(Boolean).map((p) => p.replace(/^scripts\//, '')).join(' '));
  return DEEP_COVERAGE_AREAS.find(([, pattern]) => pattern.test(named))?.[0] ?? null;
}

/** A family is the module under test, or the file's path without its dotted suffixes when no module was found. */
export const familyOf = (file, module) => module ?? file.replace(/\.test\.[^.]+$/, '').replace(/^((?:.*\/)?[^./]+)\..*$/, '$1');

const quoted = (segment) => [`'${segment}'`, `"${segment}"`, `\`${segment}\``];
const PLACEHOLDER = '%[sdifjo]|\\$\\{[^}]*\\}|\\$\\w+';
const TEMPLATE_NAME = new RegExp(`\\(\\s*\\+?\\s*(['"\`])((?:(?!\\1).)*(?:${PLACEHOLDER})(?:(?!\\1).)*)\\1`, 'g');
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The name a template gives, as a pattern with each placeholder open. */
const templatePattern = (template) => new RegExp(`^${template.split(new RegExp(PLACEHOLDER)).map(escapeRegex).join('.*')}$`);

/** Whether a Fix commit's change to a test file touches this test: it created the file or added one of the name's segments. */
export function fixTouchesTest(change, name) {
  if (change.created) return true;
  const segments = name.split(' > ');
  if (segments.some((segment) => quoted(segment).some((form) => change.added.includes(form)))) return true;
  const templates = [...change.added.matchAll(TEMPLATE_NAME)].map(([, , template]) => templatePattern(template));
  return templates.some((pattern) => segments.some((segment) => pattern.test(segment)));
}

/** One record per test in the newest run of each file still in the tree; the time comes from up to `runCount` runs of the same hash. */
export function buildRecords({ runs, coverage = {}, history = {}, alwaysRun = {}, runCount = 3, exists = () => true }) {
  const { events = [], fixes = [], ciTouched = {} } = history;
  const newestFirst = [...runs].sort((a, b) => b.at.localeCompare(a.at));
  const byFile = new Map();
  for (const run of newestFirst) {
    for (const module of run.modules) {
      if (!byFile.has(module.file)) byFile.set(module.file, []);
      byFile.get(module.file).push({ run, module });
    }
  }
  const eventsByFile = Map.groupBy(events, (event) => event.file);
  const records = [];
  for (const [file, entries] of byFile) {
    if (!exists(file)) continue;
    // A file that failed to load in its newest run holds no tests, so its last loaded run still speaks for it.
    const newest = entries.find((entry) => entry.module.tests.length);
    if (!newest) continue;
    const { run, module } = newest;
    const sameHash = entries.filter((entry) => entry.module.hash === module.hash).slice(0, runCount);
    const importCostMs = median(sameHash.map((entry) => entry.module.collectMs));
    const fileEvents = eventsByFile.get(file) ?? [];
    const unit = module.moduleUnderTest ?? { path: null, by: null };
    for (const test of module.tests) {
      const times = sameHash.flatMap((entry) => entry.module.tests.filter((t) => t.name === test.name && t.state === 'passed').map((t) => t.ms));
      const id = testKey(file, test.name);
      // History knows a repeated full name without the ` #n` the reporter gives it.
      const sourceName = test.name.replace(/ #\d+$/, '');
      const sourceId = testKey(file, sourceName);
      const own = fileEvents.filter((event) => event.test && (event.test === sourceId || sourceId.startsWith(`${event.test} > `)));
      const realBug = [];
      for (const fix of fixes) {
        if (fix.files[file] && fixTouchesTest(fix.files[file], sourceName)) realBug.push({ rule: 'fix-commit', sha: fix.sha, subject: fix.subject });
      }
      for (const event of own) {
        const caught = unit.path && ciTouched[event.run]?.[unit.path];
        if (event.source === 'ci' && caught) realBug.push({ rule: 'ci-caught', sha: caught.sha, subject: caught.subject });
      }
      records.push({
        id,
        file,
        name: test.name,
        project: module.project,
        state: test.state,
        family: familyOf(file, unit.path),
        moduleUnderTest: unit.path,
        moduleBy: unit.by,
        level: levelOf(file, alwaysRun),
        area: areaOf(file, unit.path),
        medianMs: times.length ? median(times) : null,
        timedRuns: times.length,
        importCostMs,
        coverage: coverage[file]?.hash === module.hash ? coverage[file] : null,
        failures: own,
        fileFailures: fileEvents.filter((event) => !event.test),
        realBug: [...new Map(realBug.map((entry) => [`${entry.rule}:${entry.sha}`, entry])).values()],
        hash: module.hash,
        hashInputs: module.hashInputs,
        runSha: run.sha,
        runAt: run.at,
        toolchain: run.toolchain,
      });
    }
  }
  return records.sort((a, b) => a.id.localeCompare(b.id));
}

const seconds = (ms) => (ms / 1000).toFixed(1);
const sum = (values) => values.reduce((total, value) => total + value, 0);
const TOP_FAMILIES = 15;

/** Run time, the worker-time breakdown, the top families and the failure history, as Markdown. */
export function ledgerReport(runs, records, meta = {}) {
  const lines = ['## Runs', '', '| At | Sha | Scope | Wall s | Files | Tests | Unhandled | Calibration ms | Status |', '|---|---|---|---:|---:|---:|---:|---:|---|'];
  for (const run of [...runs].sort((a, b) => a.at.localeCompare(b.at))) {
    const testCount = sum(run.modules.map((module) => module.tests.length));
    lines.push(`| ${run.at} | ${run.sha?.slice(0, 9)} | ${run.scope ?? 'full'} | ${seconds(run.wallMs)} | ${run.modules.length} | ${testCount} | ${run.unhandled ?? 0} | ${run.calibrationMs?.toFixed(2) ?? '-'} | ${run.status} |`);
  }
  lines.push('', '## Worker time, median run', '', '| Part | Seconds |', '|---|---:|');
  const full = runs.filter((run) => run.scope !== 'subset');
  const fullRuns = full.length ? full : runs;
  const parts = [['Environment', 'environmentMs'], ['Prepare', 'prepareMs'], ['Setup files', 'setupMs'], ['Import (collect)', 'collectMs'], ['Test bodies', 'durationMs']];
  for (const [label, field] of parts) {
    lines.push(`| ${label} | ${seconds(median(fullRuns.map((run) => sum(run.modules.map((module) => module[field])))))} |`);
  }
  const families = Map.groupBy(records, (record) => record.family);
  const rows = [...families].map(([family, tests]) => {
    const files = Map.groupBy(tests, (record) => record.file);
    return {
      family,
      files: files.size,
      tests: tests.length,
      bodyMs: sum(tests.map((record) => record.medianMs ?? 0)),
      importMs: sum([...files.values()].map(([record]) => record.importCostMs)),
    };
  }).sort((a, b) => (b.bodyMs + b.importMs) - (a.bodyMs + a.importMs));
  const totalBody = sum(rows.map((row) => row.bodyMs));
  lines.push('', '## Top families', '', '| Family | Files | Tests | Body s | Body % | Import s |', '|---|---:|---:|---:|---:|---:|');
  for (const row of rows.slice(0, TOP_FAMILIES)) {
    lines.push(`| \`${row.family}\` | ${row.files} | ${row.tests} | ${seconds(row.bodyMs)} | ${totalBody ? ((row.bodyMs / totalBody) * 100).toFixed(1) : '0.0'} | ${seconds(row.importMs)} |`);
  }
  const count = (source) => records.filter((record) => record.failures.some((event) => event.source === source)).length;
  const realBug = records.filter((record) => record.realBug.length);
  const byRule = (rule) => realBug.filter((record) => record.realBug.some((entry) => entry.rule === rule)).length;
  lines.push('', '## Failure history', '', `Tests with a failure, by source: CI ${count('ci')}, rerun ${count('rerun')}, session transcript ${count('session')}.`,
    `Tests with real-bug history: ${realBug.length} of ${records.length} (fix-commit ${byRule('fix-commit')}, ci-caught ${byRule('ci-caught')}).`);
  if (meta.ci) lines.push(`CI history read: ${meta.ci.runs} runs, ${meta.ci.failed} failed, ${meta.ci.from} to ${meta.ci.to}; ${meta.ci.logsMissing} logs gone, ${meta.ci.logsFailed} logs not read this time, ${meta.ci.unreachable} shas not in this clone.`);
  if (meta.reruns) lines.push(`Rerun records read: ${meta.reruns.records}; ${meta.reruns.downloadsFailed} CI artifacts not downloaded.`);
  if (meta.sessions) lines.push(`Session transcripts read: ${meta.sessions.files} files, ${meta.sessions.withFailures} with a failure.`);
  const offenders = repeatOffenders(records);
  lines.push('', '## Repeat offenders in CI', '', '| File | CI runs | Last seen |', '|---|---:|---|', ...offenders.map(({ file, runs: count, lastSeen }) => `| \`${file}\` | ${count} | ${lastSeen} |`));
  const realBugFiles = [...Map.groupBy(realBug, (record) => record.file)].map(([file, tests]) => ({
    file,
    tests: tests.length,
    commits: [...new Set(tests.flatMap((record) => record.realBug.map((entry) => entry.sha.slice(0, 9))))],
  })).sort((a, b) => b.tests - a.tests);
  lines.push('', '## Real-bug history by file', '', '| File | Tests | Commits |', '|---|---:|---|', ...realBugFiles.map(({ file, tests, commits }) => `| \`${file}\` | ${tests} | ${commits.join(' ')} |`));
  return lines.join('\n');
}

/** Files CI failed in at least two runs, with the date of the last, most runs first. */
export function repeatOffenders(records) {
  const byFile = new Map();
  for (const record of records) {
    for (const event of [...record.failures, ...record.fileFailures]) {
      if (event.source !== 'ci') continue;
      if (!byFile.has(record.file)) byFile.set(record.file, new Map());
      byFile.get(record.file).set(event.run, event.at);
    }
  }
  return [...byFile].map(([file, runs]) => ({ file, runs: runs.size, lastSeen: [...runs.values()].sort().at(-1)?.slice(0, 10) }))
    .filter(({ runs }) => runs >= 2).sort((a, b) => b.runs - a.runs || a.file.localeCompare(b.file));
}
