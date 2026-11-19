import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build, type Rolldown } from 'vite';
import { expect, it } from 'vitest';
import appConfig from '../../../vite.config.js';

// Web globals a worker scope holds; the DOM's are absent there.
const WORKER_GLOBALS = [
  'TextEncoder', 'TextDecoder', 'URL', 'URLSearchParams', 'crypto', 'performance', 'setTimeout', 'clearTimeout',
  'queueMicrotask', 'structuredClone', 'atob', 'btoa', 'fetch', 'Blob',
];

// A worker has no `document`; a module that reads it at load (the markdown parser) kills the worker on start.
it('loads in a worker scope with no document', async () => {
  const entry = fileURLToPath(new URL('./benchWorker.ts', import.meta.url));
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    define: { ...appConfig.define, 'process.env.NODE_ENV': '"production"' },
    resolve: appConfig.resolve,
    build: { write: false, minify: false, lib: { entry, formats: ['iife'], name: 'benchWorker' } },
  });
  const output = (Array.isArray(result) ? result[0] : result) as Rolldown.RolldownOutput;
  const listeners: string[] = [];
  const self = { addEventListener: (type: string) => listeners.push(type), postMessage: () => {} };
  const workerScope = Object.fromEntries(WORKER_GLOBALS.map((name) => [name, Reflect.get(globalThis, name)]));
  runInNewContext(output.output[0].code, { ...workerScope, self, console });
  expect(listeners).toEqual(['message']);
}, 60_000);
