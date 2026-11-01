// Reads a vitest JUnit report and tells the test gate whether a red run is worth one retry in isolation.
// A gate run shares the machine with other sessions' gates and dev servers, and a starved run times tests
// out that pass alone. Only an expired timer earns the retry: vitest's test and hook timeouts, and
// testing-library's `waitFor` giving up, which is how every `findBy*` and `waitFor` miss surfaces. Any
// other failure is a real red and reruns the same.
// JUnit, not JSON: vitest's JSON reporter writes a timeout as a placeholder stack and drops the message.

// Vitest's and testing-library's own words only: an assertion can quote "timed out" and still be a real red.
const TIMED_OUT = /^(?:(?:Test|Hook) timed out in \d+ms|Timed out in wait(?:For|Until)\b)/;
// A `findBy*` miss and a sync `waitFor` callback carry the frame that retried them. A real miss carries it
// too, and the rerun alone still fails on it.
const WAIT_FOR_FRAME = /@testing-library\/dom\/dist\/wait-for\.js/;
// An async `waitFor` callback loses those frames, so the other mark is the DOM dump `waitFor` appends to the
// last error when it gives up. A query's own miss carries the same dump without `waitFor`, so that type is out.
const DOM_DUMP = /Ignored nodes: comments, script, style/;
const QUERY_ERROR = 'TestingLibraryElementError';
const SUITE = /<testsuite\s[^>]*?name="([^"]*)"[^>]*>([\s\S]*?)<\/testsuite>/g;
const PROBLEM = /<(failure|error)\b([^>]*?)message="([^"]*)"([^>]*)>([\s\S]*?)<\/\1>/g;
const TYPE = /\btype="([^"]*)"/;
const TESTCASE = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
const NAME = /\bname="([^"]*)"/;
const FAILED = /<(?:failure|error)\b/;
const SKIPPED = /<skipped\b/;
const MESSAGE = /\bmessage="([^"]*)"/;
const MESSAGE_HEAD = 200;

/** One test's identity across the rerun log and the slow-test history. */
export const testKey = (file, name) => `${file} > ${name}`;

const unescapeXml = (text) => text
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const expired = ({ type, message, stack }) =>
  TIMED_OUT.test(message) || WAIT_FOR_FRAME.test(stack) || (DOM_DUMP.test(message) && type !== QUERY_ERROR);

/** Every file whose failures are all expired timers, as the suite names the report carries; empty when any failure is real. */
export function retryableFiles(junit) {
  const files = [];
  for (const [, file, body] of junit.matchAll(SUITE)) {
    const problems = [...body.matchAll(PROBLEM)].map(([, , before, message, after, stack]) =>
      ({ type: (before + after).match(TYPE)?.[1] ?? '', message, stack }));
    if (problems.length === 0) {
      // A suite with no failure element is green, or failed in a way the report cannot show: never retried.
      if (/\b(?:failures|errors)="[1-9]/.test(junit.slice(junit.indexOf(file), junit.indexOf(body)))) return [];
      continue;
    }
    if (!problems.every(expired)) return [];
    files.push(unescapeXml(file));
  }
  return files;
}

/** Whether a red run's outcome leaves room for a retry: it ran to its end, and no unhandled error came with it. */
export const rerunAllowed = (outcome) => outcome?.reason === 'failed' && outcome.unhandled === 0;

/** Each test in the report as `{ test, file, failed, ran, message }`, with the XML escapes undone. */
function testCases(junit) {
  const cases = [];
  for (const [, suite, body] of junit.matchAll(SUITE)) {
    const file = unescapeXml(suite);
    for (const [, attributes, inner = ''] of body.matchAll(TESTCASE)) {
      const test = testKey(file, unescapeXml(attributes.match(NAME)?.[1] ?? ''));
      const message = unescapeXml(inner.match(MESSAGE)?.[1] ?? '').split('\n')[0].slice(0, MESSAGE_HEAD);
      cases.push({ test, file, failed: FAILED.test(inner), ran: !SKIPPED.test(inner), message });
    }
  }
  return cases;
}

/**
 * One rerun record per test that failed in the retried files. A green rerun passed them all, including a failed
 * hook's suite, which a green report does not list. In a red rerun only a test that ran and passed counts as passed.
 */
export function rerunRecords(firstJunit, rerunJunit, rerunGreen, files, context) {
  const passedAlone = new Set(testCases(rerunJunit).filter(({ failed, ran }) => ran && !failed).map(({ test }) => test));
  return testCases(firstJunit).filter(({ failed, file }) => failed && files.includes(file)).map(({ test, file, message }) => (
    { test, file, result: rerunGreen || passedAlone.has(test) ? 'passed-alone' : 'failed-alone', message, ...context }
  ));
}
