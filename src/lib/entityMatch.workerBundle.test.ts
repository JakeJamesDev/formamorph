import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build, type Rolldown } from 'vite';
import { expect, it } from 'vitest';

// Workers bundle as iife with no `require`; a UMD dependency there exports nothing (the Test Bench worker crash).
it('matches plurals when bundled the way workers are', async () => {
  const entry = fileURLToPath(new URL('./entityMatch.ts', import.meta.url));
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: { write: false, minify: false, lib: { entry, formats: ['iife'], name: 'entityMatch' } },
  });
  const output = (Array.isArray(result) ? result[0] : result) as Rolldown.RolldownOutput;
  const sandbox: { entityMatch?: { matchKey: (text: string) => string } } = {};
  runInNewContext(output.output[0].code, sandbox);
  expect(sandbox.entityMatch?.matchKey('Wolves')).toBe('wolf');
}, 60_000);
