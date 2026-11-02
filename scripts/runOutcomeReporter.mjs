// Vitest reporter that writes how the run ended, for scripts/runTests.mjs. JUnit never names an unhandled error.
import { writeFileSync } from 'node:fs';

export default class RunOutcomeReporter {
  onTestRunEnd(_modules, unhandledErrors, reason) {
    writeFileSync(process.env.RUN_TESTS_OUTCOME, JSON.stringify({ reason, unhandled: unhandledErrors.length }));
  }
}
