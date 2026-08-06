import { describe, it, expect } from 'vitest';
import { APP_VERSION, isSaveEnvelope, migrateLegacySaveState, migrateSave } from './version';
import { DEFAULT_AVATAR_ID } from './defaultAvatar';
import { parseNarration } from './aiResponse';
import { appendCurrentToHistory, rollbackState } from './turnHistory';
import type { GameState, SaveObject } from '@/types';

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
  // Mirrors loadGame's guard: a numeric `version` marks a legacy save whose stateHistory (prior pages
  // only, current kept separate) gets currentState appended as its final page.
  const loadStateHistory = (save: { version: string | number; stateHistory: string[]; currentState: string }) =>
    typeof save.version === 'number'
      ? appendCurrentToHistory(save.stateHistory, save.currentState)
      : save.stateHistory;

  it('appends currentState to a legacy (numeric-version) save so every page maps to its own turn', () => {
    // Real 3-turn v1.2 shape: stateHistory holds the prior pages; currentState is the latest turn.
    const legacy = { version: 2, currentState: 'afterTurn3', stateHistory: ['afterTurn1', 'afterTurn2'] };
    const aligned = loadStateHistory(legacy);
    expect(aligned).toEqual(['afterTurn1', 'afterTurn2', 'afterTurn3']);
    expect(rollbackState(aligned, 2)).toBe('afterTurn2'); // page 2 → its own snapshot
    expect(rollbackState(aligned, 3)).toBe('afterTurn3'); // page 3 (current) is present, not missing
  });

  it('leaves a current (string-version) save untouched — no re-append on a re-saved import', () => {
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

  it('binds legacy body stats so a v1.2 save drives the VRM', () => {
    const state = {
      playerStats: [{ id: 's', name: 'Stomach', value: 5 }, { id: 'h', name: 'Health', value: 90 }],
    } as unknown as GameState;
    const out = migrateLegacySaveState(state);
    expect(out.playerStats[0].morphBindings).toEqual(['Belly']);
    expect(out.playerStats[1].morphBindings).toBeUndefined(); // non-body stat untouched
  });
});

describe('migrateSave (shared import + load path)', () => {
  const legacyEnvelope = {
    name: 'Old',
    version: 2,
    currentState: {
      playerTraits: [{ id: 't', name: 'Bat Pony', description: 'You are a Bat Pony', statChanges: [] }],
      playerStats: [{ id: 's', name: 'Stomach', value: 5 }],
      fullMessageHistory: [{ role: 'user', content: 'START GAME' }, { role: 'assistant', content: '{}' }],
    },
    stateHistory: [],
  } as unknown as SaveObject;

  it('migrates a legacy (numeric-version) envelope: traits, body-stat binding, realignment, stamp', () => {
    const out = migrateSave(legacyEnvelope);
    expect(out.version).toBe(APP_VERSION);
    expect(out.currentState.playerTraits[0]).toMatchObject({
      playerDescription: 'You are a Bat Pony',
      aiDescription: 'You are a Bat Pony',
    });
    expect(out.currentState.playerStats[0].morphBindings).toEqual(['Belly']);
    // v2-only field stamped onto every snapshot, not just defaulted on read.
    expect(out.currentState.discoveredEntities).toEqual([]);
    // opening-only save: empty history + appended current = a single page (the migrated currentState).
    expect(out.stateHistory).toHaveLength(1);
    expect(out.stateHistory[0]).toBe(out.currentState);
  });

  describe('player model sentinel', () => {
    const envelope = (current?: string, history: (string | undefined)[] = []) => ({
      name: 'Save', version: APP_VERSION,
      currentState: { playerTraits: [], playerStats: [], characterData: current ? { playerModelId: current } : null },
      stateHistory: history.map((h) => ({ playerTraits: [], playerStats: [], characterData: h ? { playerModelId: h } : null })),
    } as unknown as SaveObject);

    it("rewrites the 'default' sentinel to the seeded model's library id", () => {
      const out = migrateSave(envelope('default'));
      expect(out.currentState.characterData?.playerModelId).toBe(DEFAULT_AVATAR_ID);
    });

    it('rewrites the sentinel in every history snapshot, not just the current one', () => {
      const out = migrateSave(envelope('default', ['default', 'other-model']));
      expect(out.stateHistory.map((s) => s.characterData?.playerModelId))
        .toEqual([DEFAULT_AVATAR_ID, 'other-model']);
    });

    it("rewrites the pre-rename 'default-model' id onto the current default", () => {
      const out = migrateSave(envelope('default-model', ['default-model']));
      expect(out.currentState.characterData?.playerModelId).toBe(DEFAULT_AVATAR_ID);
      expect(out.stateHistory.map((s) => s.characterData?.playerModelId)).toEqual([DEFAULT_AVATAR_ID]);
    });

    it('leaves a real library id alone', () => {
      const out = migrateSave(envelope('some-uploaded-model'));
      expect(out.currentState.characterData?.playerModelId).toBe('some-uploaded-model');
    });

    it("leaves the 'world' selection alone", () => {
      const out = migrateSave(envelope('world'));
      expect(out.currentState.characterData?.playerModelId).toBe('world');
    });

    it('tolerates a save with no character data', () => {
      const out = migrateSave(envelope());
      expect(out.currentState.characterData).toBeNull();
    });

    it('is idempotent — a migrated save is unchanged by a second pass', () => {
      const once = migrateSave(envelope('default'));
      const twice = migrateSave(once);
      expect(twice.currentState.characterData?.playerModelId).toBe(DEFAULT_AVATAR_ID);
    });
  });

  describe('body morphs', () => {
    const envelope = (character: Record<string, unknown> | null, history: (Record<string, unknown> | null)[] = []) => ({
      name: 'Save', version: APP_VERSION,
      currentState: { playerTraits: [], playerStats: [], characterData: character },
      stateHistory: history.map((h) => ({ playerTraits: [], playerStats: [], characterData: h })),
    } as unknown as SaveObject);
    // A character carrying the legacy fixed body fields (pre-generic-map shape).
    const legacyCharacter = () => ({
      playerModelId: 'm', bellySize: 0.4, bodyWeight: -0.2, breastsSize: 0,
      bodyShape: { pear: 1.1, apple: 0, hourglass: 0.3 },
    });

    it('folds the legacy fixed fields into bodyMorphs under their morph names', () => {
      const out = migrateSave(envelope(legacyCharacter()));
      expect(out.currentState.characterData?.bodyMorphs).toEqual({
        Belly: 0.4, Fat: -0.2, B_Pear: 1.1, B_HourGlass: 0.3,
      });
    });

    it('drops zero-valued legacy fields (0 = off = absent) and the old fields themselves', () => {
      const character = out(legacyCharacter());
      expect(character).not.toHaveProperty('bellySize');
      expect(character).not.toHaveProperty('bodyShape');
      // breastsSize was 0 and bodyShape.apple was 0 → no Breasts / B_Apple key.
      expect(character?.bodyMorphs).not.toHaveProperty('Breasts');
      expect(character?.bodyMorphs).not.toHaveProperty('B_Apple');
    });

    it('preserves an already-migrated character (idempotent — a second pass is a no-op)', () => {
      const migrated = { playerModelId: 'm', bodyMorphs: { Belly: 0.4, Custom_Tail: 0.9 } };
      const once = migrateSave(envelope(migrated));
      const twice = migrateSave(once);
      expect(twice.currentState.characterData?.bodyMorphs).toEqual({ Belly: 0.4, Custom_Tail: 0.9 });
    });

    it('tolerates a save with no character data', () => {
      expect(migrateSave(envelope(null)).currentState.characterData).toBeNull();
    });

    it('folds every history snapshot, not just the current one', () => {
      const migrated = migrateSave(envelope(legacyCharacter(), [legacyCharacter(), null]));
      expect(migrated.stateHistory[0].characterData?.bodyMorphs).toEqual({
        Belly: 0.4, Fat: -0.2, B_Pear: 1.1, B_HourGlass: 0.3,
      });
      expect(migrated.stateHistory[1].characterData).toBeNull();
    });

    // Helper: run migrateSave and return the current snapshot's character.
    function out(character: Record<string, unknown>) {
      return migrateSave(envelope(character)).currentState.characterData as
        (Record<string, unknown> & { bodyMorphs?: Record<string, number> }) | null;
    }
  });

  it('appends current and stamps discoveredEntities on a multi-turn envelope (the import regression)', () => {
    // Real 3-turn v1.2 shape: stateHistory = prior pages only; the regression duplicated page 1 and
    // dropped current. Migration must yield 3 distinct pages ending in currentState, each with the field.
    const state = (t: number) => ({
      playerTraits: [], playerStats: [],
      fullMessageHistory: Array.from({ length: t * 2 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `${i}` })),
    });
    const multiTurn = {
      name: 'ThreeTurns', version: 2,
      currentState: state(3),
      stateHistory: [state(1), state(2)],
    } as unknown as SaveObject;
    const out = migrateSave(multiTurn);
    expect(out.stateHistory).toHaveLength(3);
    expect(out.stateHistory[2]).toBe(out.currentState); // current is the final page, present not missing
    expect(out.stateHistory[0]).not.toBe(out.stateHistory[1]); // no duplicated opening page
    for (const snap of out.stateHistory) expect(snap.discoveredEntities).toEqual([]);
  });

  it('hoists the canonical history and strips every snapshot copy (storage cleanup)', () => {
    // A legacy 2-turn save: current holds the full 4-message history, the one prior page a 2-message prefix.
    const state = (t: number) => ({
      playerTraits: [], playerStats: [],
      fullMessageHistory: Array.from({ length: t * 2 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` })),
    });
    const out = migrateSave({ name: 'Two', version: 2, currentState: state(2), stateHistory: [state(1)] } as unknown as SaveObject);
    // The one canonical history is hoisted from the current snapshot (the full 4 messages).
    expect(out.messageHistory).toHaveLength(4);
    expect(out.messageHistory?.[3]).toEqual({ role: 'assistant', content: 'm3' });
    // No snapshot keeps its own copy anymore.
    for (const snap of [out.currentState, ...out.stateHistory]) {
      expect('fullMessageHistory' in snap).toBe(false);
    }
  });

  it('hoists + strips a string-version old-shape save without a legacy re-stamp, idempotently', () => {
    const oldShape = { ...legacyEnvelope, version: APP_VERSION }; // string version but history still embedded
    const out = migrateSave(oldShape);
    expect(out.version).toBe(APP_VERSION); // not re-run through the legacy branch
    expect(out.messageHistory).toEqual(legacyEnvelope.currentState.fullMessageHistory);
    expect('fullMessageHistory' in out.currentState).toBe(false);
    // Idempotent: a second pass over the already-cleaned save keeps the same history and stays stripped.
    const again = migrateSave(out);
    expect(again.messageHistory).toEqual(out.messageHistory);
    expect('fullMessageHistory' in again.currentState).toBe(false);
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

describe('scene images ride the envelope, not the turns', () => {
  // The pixels were moved out of the messages because every history walk parses those (json5 took ~110ms on
  // a turn carrying one image, which starved the narration reveal). migrateSave must carry the new
  // top-level field through untouched, or a save written with images would load without them.
  const withImages: SaveObject = {
    ...(v12Save as unknown as SaveObject),
    version: APP_VERSION,
    messageHistory: [
      { role: 'user', content: 'I look around.' },
      { role: 'assistant', content: JSON.stringify({ narration: 'n', choices: [], stat_changes: [], turnId: 't1', sceneTags: '1girl, dock' }) },
    ],
    sceneImages: { t1: ['data:image/png;base64,AAA'] },
  };

  it('survives migration with its keys intact', () => {
    const migrated = migrateSave(withImages);
    expect(migrated.sceneImages).toEqual({ t1: ['data:image/png;base64,AAA'] });
  });

  it('leaves the messages free of pixels, keeping only the tag line', () => {
    const migrated = migrateSave(withImages);
    const assistant = (migrated.messageHistory ?? []).find((m) => m.role === 'assistant')!;
    expect(assistant.content).not.toContain('data:image');
    expect(JSON.parse(assistant.content).sceneTags).toBe('1girl, dock');
  });

  it('reads a save written without images as simply having none', () => {
    const { sceneImages: _dropped, ...withoutImages } = withImages;
    expect(migrateSave(withoutImages as SaveObject).sceneImages).toBeUndefined();
  });
});
