// Reads a vitest JUnit report and tells the test gate whether a red run is worth one retry in isolation.
// A gate run shares the machine with other sessions' gates and dev servers, and a starved run times tests
// out that pass alone. Only timeouts earn the retry: any other failure is a real red and reruns the same.
// JUnit, not JSON: vitest's JSON reporter writes a timeout as a placeholder stack and drops the message.

const TIMED_OUT = /timed out/i;
const SUITE = /<testsuite\s[^>]*?name="([^"]*)"[^>]*>([\s\S]*?)<\/testsuite>/g;
const PROBLEM = /<(?:failure|error)\b[^>]*?message="([^"]*)"/g;

/** Every file whose failures are all timeouts, as the suite names the report carries; empty when any failure is real. */
export function retryableFiles(junit) {
  const files = [];
  for (const [, file, body] of junit.matchAll(SUITE)) {
    const messages = [...body.matchAll(PROBLEM)].map(([, message]) => message);
    if (messages.length === 0) {
      // A suite with no failure element is green, or failed in a way the report cannot show: never retried.
      if (/\b(?:failures|errors)="[1-9]/.test(junit.slice(junit.indexOf(file), junit.indexOf(body)))) return [];
      continue;
    }
    if (!messages.every((message) => TIMED_OUT.test(message))) return [];
    files.push(file);
  }
  return files;
}
