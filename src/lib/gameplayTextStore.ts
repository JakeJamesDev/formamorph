import { useSyncExternalStore } from 'react';

// The live narration reveal text, kept OUT of GameplayContext. The smoothed streaming reveal calls
// setGameplayText ~60×/sec; routing it through context re-rendered every gameplay consumer (and the
// huge GameViewer) each frame, starving the reveal on long sessions. As a standalone store, only the
// components that display it (via useGameplayText) re-render per frame. The save snapshot reads the
// current value with getGameplayText(); the persisted shape (GameState.gameplayText) is unchanged.
let text = '';
const listeners = new Set<() => void>();

/** The current reveal text (used at snapshot/TTS time; not reactive). */
export function getGameplayText(): string {
  return text;
}

/** Set the reveal text and notify subscribers (no-op if unchanged). */
export function setGameplayText(next: string): void {
  if (next === text) return;
  text = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Subscribe a component to the live reveal text, re-rendering it as narration streams. */
export function useGameplayText(): string {
  return useSyncExternalStore(subscribe, getGameplayText);
}
