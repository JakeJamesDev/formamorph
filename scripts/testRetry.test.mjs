import { describe, it, expect } from 'vitest';
import { retryableFiles } from './testRetry.mjs';

const problem = (kind, message) => (message === undefined ? '' : `<${kind} message="${message}" type="Error">stack</${kind}>`);
const suite = (name, cases, counts = {}) => {
  const failures = counts.failures ?? cases.filter(([, message]) => message !== undefined).length;
  const errors = counts.errors ?? 0;
  const body = cases.map(([title, message, kind = 'failure']) =>
    `<testcase classname="${name}" name="${title}" time="0.1">${problem(kind, message)}</testcase>`).join('\n');
  return `<testsuite name="${name}" tests="${cases.length}" failures="${failures}" errors="${errors}" skipped="0" time="1">\n${body}\n</testsuite>`;
};
const report = (...suites) => `<?xml version="1.0" encoding="UTF-8" ?>\n<testsuites name="vitest tests">\n${suites.join('\n')}\n</testsuites>\n`;

describe('retryableFiles', () => {
  it('names the files whose every failure is a timeout', () => {
    const files = retryableFiles(report(
      suite('src/a.test.ts', [['one'], ['two', 'Test timed out in 5000ms.']]),
      suite('src/b.test.ts', [['one']]),
      suite('src/c.test.ts', [['one', 'Hook timed out in 10000ms', 'error']], { failures: 0, errors: 1 }),
    ));
    expect(files).toEqual(['src/a.test.ts', 'src/c.test.ts']);
  });

  it('returns nothing when any failure is not a timeout, so a real red is never retried', () => {
    expect(retryableFiles(report(
      suite('src/a.test.ts', [['one', 'Test timed out in 5000ms.']]),
      suite('src/b.test.ts', [['one', 'AssertionError: expected 1 to be 2']]),
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
