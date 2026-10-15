// What scripts told the player with `player.tell`, by turn id (Q16, Q53). Held beside the history like scene
// images, so no request ever carries them (Q23) and a rolled-back turn drops its own.

import type { ChatMessage, ScriptTiming } from '@/types';
import { parseTurnContent, pruneTurnMap } from './turnDigest';

/** One tell, with the timing of the script that made it, so a replay replaces only its own (Q54). */
export interface ScriptTell {
  text: string;
  timing: ScriptTiming;
}

/** A turn's tells by turn id, in call order. */
export type TellMap = Record<string, ScriptTell[]>;

/** The timings a stats re-roll runs again. During AI Output never tells (Q45). */
export const REROLLED_TIMINGS: readonly ScriptTiming[] = ['start', 'before', 'after'];

const TIMINGS: readonly ScriptTiming[] = ['before', 'after', 'output', 'start', 'switch'];

const NO_TELLS: readonly ScriptTell[] = [];

/** A turn's tells, in call order. */
export const turnTells = (map: TellMap, turnId: string | undefined): readonly ScriptTell[] =>
  (turnId && map[turnId]) || NO_TELLS;

/** The map with one more tell on a turn. */
export const addTell = (map: TellMap, turnId: string, tell: ScriptTell): TellMap =>
  ({ ...map, [turnId]: [...(map[turnId] ?? []), tell] });

/** The map with a turn's tells set to `tells`. None leaves no entry. */
export function setTurnTells(map: TellMap, turnId: string, tells: readonly ScriptTell[]): TellMap {
  if (tells.length) return { ...map, [turnId]: [...tells] };
  if (!(turnId in map)) return map;
  const { [turnId]: _dropped, ...rest } = map;
  return rest;
}

/** The map without a turn's tells from `timings`, which a replay is about to make again. */
export const withoutTimings = (map: TellMap, turnId: string, timings: readonly ScriptTiming[]): TellMap =>
  setTurnTells(map, turnId, turnTells(map, turnId).filter((tell) => !timings.includes(tell.timing)));

/** The id of the newest turn in the history. Undefined before the first narration. */
export const latestTurnId = (history: readonly ChatMessage[]): string | undefined => {
  const last = history.findLast((message) => message.role === 'assistant');
  return last ? parseTurnContent(last.content)?.turnId : undefined;
};

/** Forget the tells of turns no longer in the history: a failed, rolled-back or re-generated turn. */
export const pruneTells = (map: TellMap, history: ChatMessage[]): TellMap => pruneTurnMap(map, history);

const isTell = (value: unknown): value is ScriptTell => {
  const tell = value as Partial<ScriptTell> | null;
  return !!tell && typeof tell.text === 'string' && TIMINGS.includes(tell.timing as ScriptTiming);
};

/** The map a save holds, read back. A save is a file the player can edit, so only well-formed tells stay. */
export function restoreTells(raw: unknown): TellMap {
  const restored: TellMap = {};
  if (!raw || typeof raw !== 'object') return restored;
  for (const [turnId, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const tells = list.filter(isTell).map(({ text, timing }) => ({ text, timing }));
    if (tells.length) restored[turnId] = tells;
  }
  return restored;
}
