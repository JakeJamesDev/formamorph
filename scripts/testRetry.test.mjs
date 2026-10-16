import { describe, it, expect } from 'vitest';
import { retryableFiles } from './testRetry.mjs';

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
});
