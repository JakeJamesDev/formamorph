/**
 * Forces entities and locations off inside the In-Play World resolver, for reader-coverage tests. Install it in
 * the test file with:
 *
 *   vi.mock('@/lib/inPlayGates', async (original) => (await import('@/test/inPlayOverride')).withForcedOff(original));
 */
import { onTestFinished } from 'vitest';
import type * as Gates from '@/lib/inPlayGates';

const forced = { entityIds: new Set<string>(), locationIds: new Set<string>() };

/** Turns these ids off for the rest of the running test. */
export function forceOff({ entities = [], locations = [] }: { entities?: string[]; locations?: string[] }) {
  for (const id of entities) forced.entityIds.add(id);
  for (const id of locations) forced.locationIds.add(id);
  onTestFinished(() => { forced.entityIds.clear(); forced.locationIds.clear(); });
}

/** The gates module with the forced ids added to its verdicts. */
export async function withForcedOff(original: () => Promise<typeof Gates>): Promise<typeof Gates> {
  const actual = await original();
  return {
    ...actual,
    evaluateGates: (source, state) => {
      const verdicts = actual.evaluateGates(source, state);
      if (!forced.entityIds.size && !forced.locationIds.size) return verdicts;
      return {
        ...verdicts,
        offEntityIds: new Set([...verdicts.offEntityIds, ...forced.entityIds]),
        offLocationIds: new Set([...verdicts.offLocationIds, ...forced.locationIds]),
      };
    },
  };
}
