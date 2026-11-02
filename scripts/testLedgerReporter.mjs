// Vitest reporter that writes one run report for the Test Ledger, to the file its command names.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { calibrate, median } from './slowTestReporter.mjs';

const SAMPLE_EVERY_MS = 1000;

/** Each test as `{ name, state, ms }`; a repeated full name gets a ` #n` so one record stays one test. */
export function moduleTests(tests) {
  const seen = new Map();
  return tests.map((test) => {
    const occurrence = (seen.get(test.fullName) ?? 0) + 1;
    seen.set(test.fullName, occurrence);
    return {
      name: occurrence === 1 ? test.fullName : `${test.fullName} #${occurrence}`,
      state: test.result().state,
      ms: test.diagnostic()?.duration ?? null,
    };
  });
}

/** One test module's times and tests, with its path relative to `root`. */
export function moduleReport(module, root) {
  const diagnostic = module.diagnostic();
  return {
    file: path.relative(root, module.moduleId).replace(/\\/g, '/'),
    project: module.project.name,
    environmentMs: diagnostic.environmentSetupDuration,
    prepareMs: diagnostic.prepareDuration,
    setupMs: diagnostic.setupDuration,
    collectMs: diagnostic.collectDuration,
    durationMs: diagnostic.duration,
    tests: moduleTests([...module.children.allTests()]),
  };
}

export default class TestLedgerReporter {
  samples = [];
  timer;

  onInit() {
    this.timer = setInterval(() => this.samples.push(calibrate()), SAMPLE_EVERY_MS);
    this.timer.unref();
  }

  onTestRunEnd(modules, unhandledErrors, reason) {
    clearInterval(this.timer);
    writeFileSync(process.env.TEST_LEDGER_RUN_FILE, JSON.stringify({
      reason,
      unhandled: unhandledErrors.length,
      calibrationMs: this.samples.length ? median(this.samples) : null,
      modules: modules.map((module) => moduleReport(module, process.cwd())),
    }));
  }
}
