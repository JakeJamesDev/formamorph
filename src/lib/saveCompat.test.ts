import { describe, it, expect } from 'vitest';
import { isSaveEnvelope } from './version';
import { parseNarration } from './aiResponse';

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
