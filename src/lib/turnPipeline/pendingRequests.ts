import type { AIRequestType } from '@/types';

/** Which in-flight request the status label names first: what the player waits on before background work. */
const LABEL_ORDER: readonly AIRequestType[] = [
  'narration', 'thinking', 'director', 'character', 'storyboard', 'locationChange', 'entityLocation',
  'choices', 'statUpdates', 'discoverEntity', 'timePassed', 'openingTime',
  'summary', 'milestoneSelect', 'diary', 'sceneTags',
];

const rank = (type: AIRequestType): number => {
  const index = LABEL_ORDER.indexOf(type);
  return index === -1 ? LABEL_ORDER.length : index;
};

/**
 * Counts one turn's in-flight requests by type and reports the one the status label should name. Each
 * start and settle calls `onChange` with the first pending type in label order; once nothing is pending,
 * the last label stands.
 */
export function createPendingRequests(onChange: (type: AIRequestType) => void) {
  const pending = new Map<AIRequestType, number>();

  const report = () => {
    const types = [...pending.keys()];
    if (types.length === 0) return;
    onChange(types.reduce((best, type) => (rank(type) < rank(best) ? type : best)));
  };

  return {
    /** Runs one request, counting it as pending until it settles either way. */
    async track<T>(type: AIRequestType, send: () => Promise<T>): Promise<T> {
      pending.set(type, (pending.get(type) ?? 0) + 1);
      report();
      try {
        return await send();
      } finally {
        const left = (pending.get(type) ?? 1) - 1;
        if (left > 0) pending.set(type, left);
        else pending.delete(type);
        report();
      }
    },
  };
}
