import { describe, expect, it } from 'vitest';
import { scriptActionFor } from './turnPasses';
import { TEST_PROMPTS, testInput } from './turnTestInputs';
import { closedTurns, scriptMemories, buildMemoryLedger } from '@/lib/memoryView';
import type { ChatMessage } from '@/types';

/** The action and number a turn hands `turn`. */

describe('the action a script reads', () => {
  it('reads a live action trimmed, its OOC brackets and inner spaces kept', () => {
    expect(scriptActionFor(testInput({ action: '  [OOC: be brief]  I wait.\n' }))).toBe('[OOC: be brief]  I wait.');
  });

  it('reads the player’s edited cue on the opening turn', () => {
    expect(scriptActionFor(testInput({ isGameStarted: false, action: ' I walk the pier. ' }))).toBe('I walk the pier.');
  });

  it('reads the drawn opening for the "START GAME" stand-in', () => {
    const prompts = { ...TEST_PROMPTS, openingCue: ' The ferry docks. ' };
    expect(scriptActionFor(testInput({ isGameStarted: false, action: 'START GAME', prompts }))).toBe('The ferry docks.');
  });

  it('reads empty on an Opening Narration start, and a blank narration counts as none', () => {
    expect(scriptActionFor(testInput({ isGameStarted: false, action: 'START GAME', writtenNarration: 'Page one.' }))).toBe('');
    expect(scriptActionFor(testInput({ isGameStarted: false, action: 'Go.', writtenNarration: '  ' }))).toBe('Go.');
  });

  it('keeps "START GAME" typed on a later turn as the player’s text', () => {
    expect(scriptActionFor(testInput({ action: 'START GAME' }))).toBe('START GAME');
  });
});

const user = (content: string): ChatMessage => ({ role: 'user', content });
const assistant = (turnId: string): ChatMessage => ({
  role: 'assistant', content: JSON.stringify({ narration: 'n', choices: [], stat_changes: [], turnId, summary: `s ${turnId}` }),
});

describe('the closed turn count', () => {
  it('reads 0 before the opening turn', () => {
    expect(closedTurns([])).toBe(0);
    expect(closedTurns([user('START GAME')])).toBe(0);
  });

  it('counts on the scale of memories[].turn, a turn in progress not counted', () => {
    const history = [user('a'), assistant('t1'), user('b'), assistant('t2'), user('c'), assistant('t3'), user('d')];
    const ledger = buildMemoryLedger({ history, overrides: {}, pins: {}, selection: null, verbatimFloor: 0 });
    expect(closedTurns(history)).toBe(3);
    expect(scriptMemories(ledger, history).at(-1)?.turn).toBe(closedTurns(history));
  });
});
