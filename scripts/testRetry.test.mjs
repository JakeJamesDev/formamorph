import { describe, it, expect } from 'vitest';
import { retryableFiles } from './testRetry.mjs';

const problem = (kind, message, body = 'stack') => (message === undefined ? '' : `<${kind} message="${message}" type="Error">\n${body}\n</${kind}>`);
const suite = (name, cases, counts = {}) => {
  const failures = counts.failures ?? cases.filter(([, message]) => message !== undefined).length;
  const errors = counts.errors ?? 0;
  const body = cases.map(([title, message, kind = 'failure', stack]) =>
    `<testcase classname="${name}" name="${title}" time="0.1">${problem(kind, message, stack)}</testcase>`).join('\n');
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
