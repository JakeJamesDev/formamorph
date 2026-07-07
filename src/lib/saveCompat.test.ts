import { describe, it, expect } from 'vitest';
import { isSaveEnvelope, migrateLegacySaveState } from './version';
import { parseNarration } from './aiResponse';
import { realignLegacyStateHistory, rollbackState } from './turnHistory';
import type { GameState } from '@/types';

// A compact but realistic v1.2 save envelope (top-level numeric `version: 2`, flat currentState + stateHistory,
// a stat with a numeric-id descriptor, a legacy `game_text` assistant message, and NO discoveredEntities). Mirrors
// the shape of a real exported v1.2 save so a future save-shape refactor can't silently break loading old files.
const legacyAssistantContent = JSON.stringify({
  game_text: 'You awaken in Magiterra Nova.\n\n\tNearby Characters:\n\t\tNone',
  choices: ['Scan the horizon', 'Change Location'],
  stat_changes: [],
});

const v12Save = {
  name: 'Test',
  version: 2,
  currentState: {
    playerStats: [
      {
        id: '1739621674256',
        name: 'Mobility',
        type: 'number',
        description: 'Movement capabilities.',
        min: 0,
        max: 100,
        value: 9,
        regen: 3,
        descriptors: [{ id: 1739621674256, threshold: 10, description: 'Crippled.' }],
      },
    ],
    playerTraits: [],
    visibleEntities: [],
    logEntries: [{ text: 'Starting in random location: Magiterra Nova', gameTime: 0, repeat: 0 }],
    gameplayText: 'You awaken in Magiterra Nova.',
    locationId: '1739142346750',
    gameTime: 3,
    fullMessageHistory: [
      { role: 'user', content: 'START GAME' },
      { role: 'assistant', content: legacyAssistantContent },
    ],
    characterData: null,
    choices: ['Scan the horizon', 'Change Location'],
    isGameStarted: true,
    timestamp: '2026-07-03T00:55:06.140Z',
    playerNotes: '',
    previousStateIndex: 1,
    stateVersion: 2,
  },
  stateHistory: [],
};

describe('v1.2 save-load compatibility', () => {
  it('is detected as a save envelope by shape, ignoring the numeric version', () => {
    expect(isSaveEnvelope(v12Save)).toBe(true);
    // Deep-nested legacy saves lack currentState → routed to the conversion worker instead.
    expect(isSaveEnvelope({ name: 'old', gameStates: [] })).toBe(false);
  });

  it('carries every field loadGameState consumes, and omits the v2-only discoveredEntities', () => {
    const s = v12Save.currentState;
    for (const field of [
      'playerStats', 'playerTraits', 'visibleEntities', 'logEntries', 'gameplayText',
      'gameTime', 'fullMessageHistory', 'characterData', 'choices', 'isGameStarted',
      'playerNotes', 'locationId',
    ] as const) {
      expect(s).toHaveProperty(field);
    }
    // discoveredEntities is absent in v1.2 — loadGameState defaults it via `?? []`.
    expect('discoveredEntities' in s).toBe(false);
  });

  it('parses legacy game_text assistant messages as narration (not raw JSON)', () => {
    const assistant = v12Save.currentState.fullMessageHistory.find((m) => m.role === 'assistant');
    const narration = parseNarration(assistant!.content);
    expect(narration).toBe('You awaken in Magiterra Nova.\n\n\tNearby Characters:\n\t\tNone');
    expect(narration.startsWith('{')).toBe(false);
  });
});

describe('v1.2 stateHistory realignment', () => {
  // Mirrors loadGame's guard: a numeric `version` marks a legacy save whose stateHistory is realigned.
  const loadStateHistory = (save: { version: string | number; stateHistory: string[]; currentState: string }) =>
    typeof save.version === 'number'
      ? realignLegacyStateHistory(save.stateHistory, save.currentState)
      : save.stateHistory;

  it('realigns a legacy (numeric-version) save so rollback maps pages to the right turn', () => {
    // 3-turn v1.2 save: opening snapshot dropped, rest shifted (index i = turn i+2 snapshot).
    const legacy = { version: 2, currentState: 'afterTurn3', stateHistory: ['afterTurn2', 'afterTurn3'] };
    const aligned = loadStateHistory(legacy);
    expect(aligned).toEqual(['afterTurn2', 'afterTurn2', 'afterTurn3']);
    expect(rollbackState(aligned, 2)).toBe('afterTurn2'); // page 2 → turn-2 snapshot, not turn-3
  });

  it('leaves a current (string-version) save untouched — no re-prepend on a re-saved import', () => {
    const current = { version: '2.0.1', currentState: 'afterTurn3', stateHistory: ['afterTurn1', 'afterTurn2', 'afterTurn3'] };
    expect(loadStateHistory(current)).toBe(current.stateHistory);
  });
});

describe('migrateLegacySaveState', () => {
  it("renames a save's frozen trait descriptions so they reach the AI (aiDescription)", () => {
    const state = {
      playerTraits: [{ id: 't', name: 'Bat Pony', description: 'You are a Bat Pony', statChanges: [] }],
    } as unknown as GameState;
    const out = migrateLegacySaveState(state);
    expect(out.playerTraits[0]).toMatchObject({
      playerDescription: 'You are a Bat Pony',
      aiDescription: 'You are a Bat Pony',
    });
    expect('description' in out.playerTraits[0]).toBe(false);
  });

  it('is idempotent — an already-migrated snapshot is unchanged', () => {
    const state = {
      playerTraits: [{ id: 't', name: 'Male', playerDescription: 'You are a male', aiDescription: 'You are a male', statChanges: [] }],
    } as unknown as GameState;
    expect(migrateLegacySaveState(state).playerTraits[0]).toMatchObject({
      playerDescription: 'You are a male',
      aiDescription: 'You are a male',
    });
  });
});

describe('v2.x per-playthrough dictionaries field', () => {
  // loadGame restores dictionaries only when the envelope carries the array — this mirrors that guard.
  const shouldRestore = (save: Record<string, unknown>) => Array.isArray(save.dictionaries);

  it('is still a save envelope with or without the dictionaries field', () => {
    expect(isSaveEnvelope(v12Save)).toBe(true); // legacy, no field
    expect(isSaveEnvelope({ ...v12Save, dictionaries: [{ id: 'b1', name: 'Lore', entries: [] }] })).toBe(true);
  });

  it('does not restore dictionaries for an old save that lacks the field', () => {
    expect(shouldRestore(v12Save)).toBe(false);
  });

  it('restores the dictionaries when present', () => {
    const save = { ...v12Save, dictionaries: [{ id: 'b1', name: 'Lore', entries: [] }] };
    expect(shouldRestore(save)).toBe(true);
    expect(save.dictionaries[0].name).toBe('Lore');
  });
});
