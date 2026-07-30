import { vi } from 'vitest';
import type { TtsPlayback } from '@/lib/useTtsPlayback';

/**
 * Stand-in for the progressive-TTS engine. The real hook builds a Web Audio graph, which jsdom has no
 * AudioContext for; it also derives `duration`/`position` from the audio clock, so a test has no way to put
 * the panels into their "audio exists" state through the real thing. This returns a plain object the test
 * writes directly, with every method a spy.
 *
 * Mock it from a test with
 * `vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'))`,
 * then stage playback with `setTtsPlayback({ duration: 12 })` before rendering.
 */

const fresh = (): TtsPlayback => ({
  reset: vi.fn(),
  append: vi.fn(),
  finalize: vi.fn(),
  togglePlay: vi.fn(),
  seek: vi.fn(),
  position: 0,
  duration: 0,
  paused: true,
  ended: false,
  activeSentenceIndex: -1,
  sentenceTexts: [],
});

let state: TtsPlayback = fresh();

/** Stage playback state (and read back the method spies). Merged over what is already staged. */
export function setTtsPlayback(next: Partial<TtsPlayback> = {}): TtsPlayback {
  state = { ...state, ...next };
  return state;
}

/** The staged playback object, including its spies. */
export function ttsPlayback(): TtsPlayback {
  return state;
}

/** Back to silence with fresh spies. Call between tests. */
export function resetTtsPlayback(): void {
  state = fresh();
}

export function useTtsPlayback(): TtsPlayback {
  return state;
}
