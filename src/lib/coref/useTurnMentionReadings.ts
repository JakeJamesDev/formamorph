import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ChatMessage } from '@/types';
import { useMountedRef } from '@/lib/useMountedRef';
import type { CharacterMentions } from './characterMentions';
import type { MentionCast, MentionPlayer } from './mentionReading';
import { holdsTurn, narrationHash, turnsToRead, type MentionReadingMap } from './mentionReadings';

interface Options {
  controller: CharacterMentions;
  ready: boolean;
  history: ChatMessage[];
  /** A turn is running; its passage is not finished yet. */
  busy: boolean;
  readings: MentionReadingMap;
  setReadings: Dispatch<SetStateAction<MentionReadingMap>>;
  cast: MentionCast;
  player: MentionPlayer | undefined;
}

/** Reads finished passages in the background, one at a time, once the model is ready. No turn waits for it. */
export function useTurnMentionReadings({ controller, ready, history, busy, readings, setReadings, cast, player }: Options): void {
  const mounted = useMountedRef();
  const historyRef = useRef(history);
  historyRef.current = history;
  const castRef = useRef({ cast, player });
  castRef.current = { cast, player };
  // Turns that had a reading, so an edit or regenerate of one reads it again (Q42).
  const read = useRef(new Set<string>());
  for (const turnId of Object.keys(readings)) read.current.add(turnId);
  const running = useRef(false);
  // Passages a reading failed on, so a failure is not retried in a loop.
  const failed = useRef(new Set<string>());
  // Bumped after each reading, so the next waiting turn starts.
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (busy || !ready || running.current) return;
    const next = turnsToRead(history, readings, read.current)
      .find((turn) => !failed.current.has(`${turn.turnId}:${narrationHash(turn.narration)}`));
    if (!next) return;
    running.current = true;
    const { cast: entities, player: played } = castRef.current;
    controller.readPassage(next.narration, entities, played ? { player: played } : {})
      .then((result) => {
        if (!result || !mounted.current) return;
        // A rewind or a regenerate may have dropped the turn while the reading ran.
        if (!holdsTurn(historyRef.current, next.turnId, next.narration)) return;
        setReadings((prev) => ({ ...prev, [next.turnId]: { ...result, textHash: narrationHash(next.narration) } }));
      })
      .catch((error: unknown) => {
        failed.current.add(`${next.turnId}:${narrationHash(next.narration)}`);
        console.warn('Character Mentions could not read the passage', error);
      })
      .finally(() => {
        running.current = false;
        if (mounted.current) setDone((n) => n + 1);
      });
  }, [controller, ready, history, busy, readings, setReadings, mounted, done]);
}
