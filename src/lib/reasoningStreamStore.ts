import { useSyncExternalStore } from 'react';

/** The live reasoning for the in-progress turn: the streaming scratchpad text, its think duration once known,
 *  and whether the model is still thinking (`active` ⇒ the block stays expanded; false ⇒ it auto-collapses). */
export interface LiveReasoning {
  text: string;
  ms: number;
  active: boolean;
}

// Kept OUT of context for the same reason as the narration reveal (gameplayTextStore): a reasoning model
// streams its scratchpad token-by-token, so routing each update through context would re-render every
// gameplay consumer. Only the reasoning block subscribes here.
let state: LiveReasoning = { text: '', ms: 0, active: false };
const listeners = new Set<() => void>();

export function getLiveReasoning(): LiveReasoning {
  return state;
}

/** Replace the live reasoning and notify subscribers (no-op when unchanged). */
export function setLiveReasoning(next: LiveReasoning): void {
  if (next.text === state.text && next.ms === state.ms && next.active === state.active) return;
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Subscribe a component to the live reasoning stream. */
export function useLiveReasoning(): LiveReasoning {
  return useSyncExternalStore(subscribe, getLiveReasoning);
}
