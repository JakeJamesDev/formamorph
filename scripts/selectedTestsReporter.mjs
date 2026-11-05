// A vitest reporter that writes the test files a run selected to SELECTED_TESTS_FILE and stops before any test runs (scripts/selectionReplay.mjs).
import { writeFileSync } from 'node:fs';
import path from 'node:path';

export default class SelectedTestsReporter {
  onInit(vitest) {
    this.root = vitest.config.root;
  }

  onTestRunStart(specifications) {
    const files = specifications.map((specification) => path.relative(this.root, specification.moduleId).replace(/\\/g, '/'));
    writeFileSync(process.env.SELECTED_TESTS_FILE, JSON.stringify([...new Set(files)].sort()));
    process.exit(0);
  }
}
