// Reads a vitest JUnit report and tells the test gate whether a red run is worth one retry in isolation.
// A gate run shares the machine with other sessions' gates and dev servers, and a starved run times tests
// out that pass alone. Only an expired timer earns the retry: vitest's test and hook timeouts, and
// testing-library's `waitFor` giving up, which is how every `findBy*` and `waitFor` miss surfaces. Any
// other failure is a real red and reruns the same.
// JUnit, not JSON: vitest's JSON reporter writes a timeout as a placeholder stack and drops the message.

const TIMED_OUT = /timed out/i;
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
    files.push(file);
  }
  return files;
}
