import { useEffect, useRef, useState } from 'react';
import { createWorkerClient } from '@/lib/createWorkerClient';
import { useMountedRef } from '@/lib/useMountedRef';
import { createBenchPass, type BenchPassResult, type BenchReply } from './benchPass';
import { rememberFindingKeys } from './findingKeys';
import { createWorldPatcher } from './worldMirror';
import type { Finding, RuleWorld } from './rules';

/** How still the world has to go before the pass runs again. Long enough that typing a name never
 *  triggers a pass per keystroke, short enough that the badge answers while the edit is still fresh. */
export const PASS_DEBOUNCE_MS = 400;

/** Runs the pass in the Bench worker; in-thread where no worker exists or the worker failed. */
interface BenchRunner {
  run(world: RuleWorld): Promise<BenchPassResult>;
  terminate(): void;
}

function createBenchRunner(): BenchRunner {
  let local: ((world: RuleWorld) => BenchPassResult) | null = null;
  const runLocal = async (world: RuleWorld) => (local ??= createBenchPass())(world);
  if (typeof Worker === 'undefined') return { run: runLocal, terminate: () => {} };
  const client = createWorkerClient(
    // type:'module' — required in dev, where Vite serves the worker with bare ESM imports a classic worker rejects.
    () => new Worker(new URL('./benchWorker.ts', import.meta.url), { type: 'module' }),
  );
  const patcher = createWorldPatcher();
  let failed = false;
  // The worker's last findings. Every reply arrives in order, so a reply without findings means these.
  let last: Pick<BenchPassResult, 'findings' | 'keys'> = { findings: [], keys: [] };
  return {
    async run(world) {
      if (failed) return runLocal(world);
      try {
        const reply = await client.run({ patch: patcher.patch(world) }) as BenchReply;
        if (reply.findings && reply.keys) {
          reply.findings.forEach((finding, i) => rememberFindingKeys(finding, reply.keys![i]));
          last = { findings: reply.findings, keys: reply.keys };
        }
        return { ...last, bytes: reply.bytes };
      } catch (error) {
        console.error('Test Bench worker failed; checking on the main thread:', error);
        failed = true;
        client.terminate();
        return runLocal(world);
      }
    },
    terminate: () => { client.terminate(); patcher.reset(); },
  };
}

export interface BenchCheck {
  /** The rule findings, null until the first pass lands. */
  findings: Finding[] | null;
  /** The world's publish size in bytes, null until the first pass lands. */
  bytes: number | null;
}

/**
 * The rule findings and publish size for `world`, worked out off the main thread. The first pass starts at
 * mount; later ones wait until the world has been still for `delayMs`, and the last answer stays in place
 * while one is pending. Pass a value whose identity changes only when the world data does — the editor's
 * memoized payload — because that identity is what schedules the pass.
 */
export function useBenchPass(world: RuleWorld, delayMs = PASS_DEBOUNCE_MS): BenchCheck {
  const [result, setResult] = useState<BenchCheck>({ findings: null, bytes: null });
  const mounted = useMountedRef();
  const runner = useRef<BenchRunner | null>(null);
  // Only the newest pass may land; a slow one for an older world must not overwrite it.
  const newest = useRef(0);
  const ran = useRef(false);

  useEffect(() => {
    const own = createBenchRunner();
    runner.current = own;
    return () => { own.terminate(); runner.current = null; };
  }, []);

  useEffect(() => {
    const run = () => {
      ran.current = true;
      const ticket = ++newest.current;
      runner.current?.run(world).then(
        ({ findings, bytes }) => { if (mounted.current && ticket === newest.current) setResult({ findings, bytes }); },
        // A pass that breaks reaches the editor's error boundary, as a rule throwing in render would.
        (error: unknown) => { if (mounted.current) setResult(() => { throw error; }); },
      );
    };
    const timer = setTimeout(run, ran.current ? delayMs : 0);
    return () => clearTimeout(timer);
  }, [world, delayMs, mounted]);

  return result;
}
