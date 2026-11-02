import { describe, it, expect } from 'vitest';
import { rerunAllowed, rerunRecords, retryableFiles } from './testRetry.mjs';

const problem = (kind, message, body = 'stack', type = 'Error') =>
  (message === undefined ? '' : `<${kind} message="${message}" type="${type}">\n${body}\n</${kind}>`);
const suite = (name, cases, counts = {}) => {
  const failures = counts.failures ?? cases.filter(([, message]) => message !== undefined).length;
  const errors = counts.errors ?? 0;
  const body = cases.map(([title, message, kind = 'failure', stack, type]) =>
    `<testcase classname="${name}" name="${title}" time="0.1">${problem(kind, message, stack, type)}</testcase>`).join('\n');
  return `<testsuite name="${name}" tests="${cases.length}" failures="${failures}" errors="${errors}" skipped="0" time="1">\n${body}\n</testsuite>`;
};
const report = (...suites) => `<?xml version="1.0" encoding="UTF-8" ?>\n<testsuites name="vitest tests">\n${suites.join('\n')}\n</testsuites>\n`;

// Stacks as vitest prints them: a `findBy*` miss, a `waitFor` that gave up on an assertion, and a plain assertion.
const FIND_BY_MISS = [
  'TestingLibraryElementError: Unable to find an element with the display value: Sedge Landing.',
  ' ❯ waitForWrapper ../../../node_modules/@testing-library/dom/dist/wait-for.js:163:27',
  ' ❯ ../../../node_modules/@testing-library/dom/dist/query-helpers.js:86:33',
  ' ❯ openOptedIn src/views/WorldEditor.autoSave.test.tsx:57:33',
].join('\n');
const WAIT_FOR_MISS = [
  'AssertionError: expected &quot;spy&quot; to be called 1 times, but got 0 times',
  ' ❯ waitFor.timeout src/views/WorldEditor.historyOrigin.test.tsx:88:40',
  ' ❯ runWithExpensiveErrorDiagnosticsDisabled node_modules/@testing-library/dom/dist/config.js:47:12',
  ' ❯ checkCallback node_modules/@testing-library/dom/dist/wait-for.js:124:77',
  ' ❯ src/views/WorldEditor.historyOrigin.test.tsx:88:11',
].join('\n');
// A `waitFor` with an async callback: no wait-for frame, but the DOM dump `waitFor` appends when it gives up.
const DUMP = 'Ignored nodes: comments, script, style\n&lt;body&gt;\n  &lt;div /&gt;\n&lt;/body&gt;';
const ASYNC_WAIT_FOR_MISS = `expected [] to include &apos;Fenwick Reach&apos;\n\n${DUMP}`;
const ASYNC_WAIT_FOR_STACK = [
  `AssertionError: ${ASYNC_WAIT_FOR_MISS}`,
  ' ❯ waitFor.timeout src/views/MainMenu.worldImport.test.tsx:54:60',
].join('\n');
// A sync `getBy*` miss carries the same dump from the query itself, with no `waitFor` behind it.
const GET_BY_MISS = `Unable to find an element with the text: missing.\n\n${DUMP}`;
const GET_BY_STACK = [
  `TestingLibraryElementError: ${GET_BY_MISS}`,
  ' ❯ Object.getElementError node_modules/@testing-library/dom/dist/config.js:37:19',
  ' ❯ node_modules/@testing-library/dom/dist/query-helpers.js:76:38',
  ' ❯ src/views/MainMenu.entry.test.tsx:19:12',
].join('\n');
const PLAIN_MISS = [
  'AssertionError: expected 62 to be less than or equal to 61',
  ' ❯ site/bundleBoundary.test.ts:158:38',
].join('\n');

describe('retryableFiles', () => {
  it('names the files whose every failure is a timeout', () => {
    const files = retryableFiles(report(
      suite('src/a.test.ts', [['one'], ['two', 'Test timed out in 5000ms.']]),
      suite('src/b.test.ts', [['one']]),
      suite('src/c.test.ts', [['one', 'Hook timed out in 10000ms', 'error']], { failures: 0, errors: 1 }),
    ));
    expect(files).toEqual(['src/a.test.ts', 'src/c.test.ts']);
  });

  it('counts a findBy or waitFor that gave up as a timeout, by the wait-for frame in its stack', () => {
    const files = retryableFiles(report(
      suite('src/views/WorldEditor.autoSave.test.tsx', [['one', 'Unable to find an element with the display value: Sedge Landing.', 'failure', FIND_BY_MISS]]),
      suite('src/views/WorldEditor.historyOrigin.test.tsx', [['one', 'expected &quot;spy&quot; to be called 1 times, but got 0 times', 'failure', WAIT_FOR_MISS]]),
      suite('src/b.test.ts', [['one']]),
    ));
    expect(files).toEqual(['src/views/WorldEditor.autoSave.test.tsx', 'src/views/WorldEditor.historyOrigin.test.tsx']);
  });

  it('counts an async waitFor callback that gave up as a timeout, by the DOM dump on a non-query error', () => {
    expect(retryableFiles(report(
      suite('src/views/MainMenu.worldImport.test.tsx', [['one', ASYNC_WAIT_FOR_MISS, 'failure', ASYNC_WAIT_FOR_STACK, 'AssertionError']]),
    ))).toEqual(['src/views/MainMenu.worldImport.test.tsx']);
  });

  it('leaves a sync getBy miss alone: the query dumped the DOM, not a waitFor that gave up', () => {
    expect(retryableFiles(report(
      suite('src/views/MainMenu.entry.test.tsx', [['one', GET_BY_MISS, 'failure', GET_BY_STACK, 'TestingLibraryElementError']]),
    ))).toEqual([]);
  });

  it('returns nothing when any failure is not a timeout, so a real red is never retried', () => {
    expect(retryableFiles(report(
      suite('src/a.test.ts', [['one', 'Test timed out in 5000ms.']]),
      suite('src/b.test.ts', [['one', 'AssertionError: expected 1 to be 2']]),
    ))).toEqual([]);
    expect(retryableFiles(report(
      suite('src/views/WorldEditor.autoSave.test.tsx', [['one', 'Unable to find an element with the display value: Sedge Landing.', 'failure', FIND_BY_MISS]]),
      suite('site/bundleBoundary.test.ts', [['one', 'expected 62 to be less than or equal to 61', 'failure', PLAIN_MISS]]),
    ))).toEqual([]);
  });

  it('returns nothing when a suite counts a failure the report carries no message for', () => {
    expect(retryableFiles(report(
      suite('src/a.test.ts', [['one', 'Test timed out in 5000ms.']]),
      suite('src/b.test.ts', [['one']], { failures: 1 }),
    ))).toEqual([]);
  });

  it('returns nothing for a green report', () => {
    expect(retryableFiles(report(suite('src/a.test.ts', [['one']])))).toEqual([]);
    expect(retryableFiles('')).toEqual([]);
  });

  it('leaves an assertion that only quotes a timeout alone', () => {
    expect(retryableFiles(report(
      suite('src/a.test.ts', [['one', 'expected &apos;Request timed out&apos; to equal &apos;Saved&apos;', 'failure', PLAIN_MISS, 'AssertionError']]),
    ))).toEqual([]);
  });

  it('counts a waitFor that says it timed out, with no wait-for frame', () => {
    expect(retryableFiles(report(
      suite('src/a.test.ts', [['one', 'Timed out in waitFor.', 'failure', 'Error: Timed out in waitFor.']]),
    ))).toEqual(['src/a.test.ts']);
  });
});

describe('rerunAllowed', () => {
  it('allows a run that ended on failed tests alone', () => {
    expect(rerunAllowed({ reason: 'failed', unhandled: 0 })).toBe(true);
  });

  it('refuses an unhandled error, an interrupted run, and a run that wrote no outcome', () => {
    expect(rerunAllowed({ reason: 'failed', unhandled: 1 })).toBe(false);
    expect(rerunAllowed({ reason: 'interrupted', unhandled: 0 })).toBe(false);
    expect(rerunAllowed(null)).toBe(false);
  });
});

describe('rerunRecords', () => {
  const first = report(
    suite('src/a.test.ts', [['group &gt; starved', 'Test timed out in 5000ms.\nIf this is a long-running test'], ['group &gt; red alone', 'Test timed out in 5000ms.'], ['group &gt; green']]),
    suite('src/b.test.ts', [['green']]),
  );

  it('names each failed test, its file and its result, and keeps the context', () => {
    const rerun = report(suite('src/a.test.ts', [['group &gt; starved'], ['group &gt; red alone', 'Test timed out in 5000ms.'], ['group &gt; green']]));
    expect(rerunRecords(first, rerun, false, ['src/a.test.ts'], { source: 'local' })).toEqual([
      { test: 'src/a.test.ts > group > starved', file: 'src/a.test.ts', result: 'passed-alone', message: 'Test timed out in 5000ms.', source: 'local' },
      { test: 'src/a.test.ts > group > red alone', file: 'src/a.test.ts', result: 'failed-alone', message: 'Test timed out in 5000ms.', source: 'local' },
    ]);
  });

  it('counts a test a red rerun lost as failed', () => {
    expect(rerunRecords(first, '', false, ['src/a.test.ts'], {}).map((r) => r.result)).toEqual(['failed-alone', 'failed-alone']);
  });

  it('counts a test a red rerun skipped as failed', () => {
    const rerun = report(`<testsuite name="src/a.test.ts" tests="1" failures="0" errors="0" skipped="1" time="1">
<testcase classname="src/a.test.ts" name="group &gt; starved" time="0"><skipped/></testcase>
</testsuite>`);
    expect(rerunRecords(first, rerun, false, ['src/a.test.ts'], {})[0].result).toBe('failed-alone');
  });

  it('counts a failed hook\'s suite as passed when the rerun is green, though the green report omits it', () => {
    const hook = report(suite('src/h.test.ts', [['group', 'Hook timed out in 10000ms', 'failure']]));
    const green = report(suite('src/h.test.ts', [['group &gt; one']]));
    expect(rerunRecords(hook, green, true, ['src/h.test.ts'], {})).toEqual([
      { test: 'src/h.test.ts > group', file: 'src/h.test.ts', result: 'passed-alone', message: 'Hook timed out in 10000ms' },
    ]);
  });

  it('reads a file name with an XML escape the same in both lists', () => {
    const junit = report(suite('src/a&amp;b.test.ts', [['one', 'Test timed out in 5000ms.']]));
    const files = retryableFiles(junit);
    expect(files).toEqual(['src/a&b.test.ts']);
    expect(rerunRecords(junit, '', false, files, {})).toHaveLength(1);
  });
});
