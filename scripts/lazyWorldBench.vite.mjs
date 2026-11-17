// The app's Vite config with the executor's sandbox import wrapped, so the bench can read each run's program size.
import path from 'node:path';
import base from '../vite.config.js';

const root = path.resolve(import.meta.dirname, '..');
const SPY = '\0lazy-world-bench-sandbox';
const resolved = typeof base === 'function' ? await base({ command: 'serve', mode: 'development' }) : base;

export default {
  ...resolved,
  root,
  plugins: [{
    name: 'lazy-world-bench-sandbox',
    enforce: 'pre',
    resolveId: (id, importer) => (id === './scriptSandbox' && importer?.endsWith('statCodeExecutor.ts') ? SPY : null),
    load: (id) => (id !== SPY ? null : [
      `import * as real from ${JSON.stringify(path.join(root, 'src/lib/scriptSandbox.ts').replaceAll('\\', '/'))};`,
      'export const runInSandbox = (program, ...rest) => { globalThis.__lazyWorldBenchProgram = program.length; return real.runInSandbox(program, ...rest); };',
    ].join('\n')),
  }, ...(resolved.plugins ?? [])],
};
