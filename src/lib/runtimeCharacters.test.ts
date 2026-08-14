import { describe, it, expect } from 'vitest';
import {
  selectDueDiscovery,
  materializeDiscoveredEntity,
  discoveredAsEntities,
  cleanDiscoveredDescription,
  selectReachableVisitors,
} from './runtimeCharacters';
import { entityIdsAt } from './entityPresence';
import { buildEntityContext } from './locationContext';
import type { ChatMessage, DiscoveredEntity, Entity, GameLocation } from '@/types';

/** Build an assistant turn message with the given fields. */
function turn(fields: { turnId?: string; narration?: string; entities?: string[]; locationId?: string }): ChatMessage {
  return { role: 'assistant', content: JSON.stringify({ narration: 'n', choices: [], stat_changes: [], ...fields }) };
}

describe('selectReachableVisitors', () => {
  // town > { houseA (current), Sarah's House (Sarah) } ; a top-level location has no reachable siblings.
  const houseA: GameLocation = { id: 'a', name: 'House A', parentId: 'town' };
  const sarahs: GameLocation = { id: 'b', name: "Sarah's House", parentId: 'town' };
  const locs = [houseA, sarahs];
  const alice: Entity = { id: 'alice', name: 'Alice', locations: ['a'] };
  const sarah: Entity = { id: 'sarah', name: 'Sarah', locations: ['b'] };
  const authored = [alice, sarah];

  it('pulls in a reachable-sibling authored entity named this turn and not present', () => {
    expect(selectReachableVisitors(['Sarah'], houseA, locs, authored, ['alice'])).toEqual([sarah]);
  });

  it('excludes those already present, not reachable, not authored, or not named', () => {
    expect(selectReachableVisitors(['Sarah'], houseA, locs, authored, ['alice', 'sarah'])).toEqual([]); // already present
    expect(selectReachableVisitors(['Alice'], houseA, locs, authored, ['alice'])).toEqual([]); // Alice is present here, not a sibling
    expect(selectReachableVisitors(['Goblin'], houseA, locs, authored, ['alice'])).toEqual([]); // unauthored / unnamed
    expect(selectReachableVisitors([], houseA, locs, authored, ['alice'])).toEqual([]); // nobody named
  });

  it('returns nothing for a top-level location (no reachable siblings)', () => {
    const top: GameLocation = { id: 'top', name: 'Overworld' };
    expect(selectReachableVisitors(['Sarah'], top, [...locs, top], authored, [])).toEqual([]);
  });
});

describe('selectDueDiscovery', () => {
  const known = ['Alice']; // one authored entity

  it('picks the newest turn holding an unknown participant', () => {
    const history: ChatMessage[] = [
      turn({ turnId: 't1', narration: 'Old.', entities: ['Goblin'] }),
      turn({ turnId: 't2', narration: 'A mouse squeaks.', entities: ['Alice', 'Mouse'], locationId: 'loc-1' }),
    ];
    const due = selectDueDiscovery(history, known);
    expect(due).toEqual({ turnId: 't2', name: 'Mouse', narration: 'A mouse squeaks.', locationId: 'loc-1' });
  });

  it('skips authored/known participants', () => {
    const history = [turn({ turnId: 't1', narration: 'Hi.', entities: ['Alice'] })];
    expect(selectDueDiscovery(history, known)).toBeNull();
  });

  it('skips a name that is a variant of an already-known one (no duplicate identity)', () => {
    const history = [turn({ turnId: 't1', narration: 'He nods.', entities: ['Aldric'] })];
    expect(selectDueDiscovery(history, ['Sergeant Aldric'])).toBeNull();
  });

  it('returns null when nothing is due', () => {
    expect(selectDueDiscovery([], known)).toBeNull();
    expect(selectDueDiscovery([turn({ turnId: 't1', narration: 'x', entities: [] })], known)).toBeNull();
  });

  it('ignores turns without an id or narration', () => {
    const history = [
      turn({ narration: 'No id.', entities: ['Ghost'] }),
      turn({ turnId: 't2', narration: '   ', entities: ['Wraith'] }),
    ];
    expect(selectDueDiscovery(history, known)).toBeNull();
  });
});

describe('materializeDiscoveredEntity', () => {
  it('builds a minimal valid entity with a fresh id and trimmed fields', () => {
    const e = materializeDiscoveredEntity('  Mouse  ', '  A small grey mouse.  ');
    expect(e.name).toBe('Mouse');
    expect(e.aiDescription).toBe('A small grey mouse.');
    expect(typeof e.id).toBe('string');
    expect(e.id.length).toBeGreaterThan(0);
  });
});

describe('cleanDiscoveredDescription', () => {
  it('cuts an echoed prompt-scaffold tail (the Thorne leak)', () => {
    const raw =
      "Thorne stands at his full imposing height, his greatsword held with casual confidence.\n\n" +
      "The passage they appeared in:\nAldric crouches low, fingers splayed. \"It's mechanical. Some kind of";
    expect(cleanDiscoveredDescription(raw, 'Thorne')).toBe(
      'Thorne stands at his full imposing height, his greatsword held with casual confidence.',
    );
  });

  it('trims a token-capped mid-word tail to the last full sentence (the Cedric cut)', () => {
    const raw =
      "Cedric clutches an ancient tome, robes worn but embroidered with a guild crest. Gray streaks through";
    expect(cleanDiscoveredDescription(raw, 'Cedric')).toBe(
      'Cedric clutches an ancient tome, robes worn but embroidered with a guild crest.',
    );
  });

  it('strips a leading "Name:" echo', () => {
    expect(cleanDiscoveredDescription('Mira: A quiet healer with steady hands.', 'Mira')).toBe(
      'A quiet healer with steady hands.',
    );
  });

  it('strips a leading "Character name: X" echo instead of discarding the whole reply', () => {
    // The label-cut runs over the whole reply, so a leading echo used to truncate at index 0 and
    // throw the description away — the character then stayed due and was re-described from scratch.
    expect(cleanDiscoveredDescription('Character name: Mira\nA quiet healer with steady hands.', 'Mira')).toBe(
      'A quiet healer with steady hands.',
    );
  });

  it('still cuts a "Character name:" echo that comes AFTER the description', () => {
    const raw = 'A quiet healer with steady hands.\n\nCharacter name: Mira\nThe passage they appeared in: ...';
    expect(cleanDiscoveredDescription(raw, 'Mira')).toBe('A quiet healer with steady hands.');
  });

  it('strips both echo forms when the model stacks them', () => {
    expect(cleanDiscoveredDescription('Character name: Mira\nMira: A quiet healer.', 'Mira')).toBe('A quiet healer.');
  });

  it('strips a <think> block', () => {
    expect(cleanDiscoveredDescription('<think>who is this?</think>A stoic guard.', 'Guard')).toBe('A stoic guard.');
  });

  it('passes a clean description through unchanged', () => {
    const good = 'A lean elven scout, wary and quick, who places himself between strangers and his companions.';
    expect(cleanDiscoveredDescription(good, 'Aldric')).toBe(good);
  });

  it('returns empty when nothing usable remains', () => {
    expect(cleanDiscoveredDescription('The passage they appeared in:\nsomething', 'X')).toBe('');
    expect(cleanDiscoveredDescription('   ', 'X')).toBe('');
  });
});

describe('discoveredAsEntities', () => {
  const worldEntity: Entity = { id: 'world-a', name: 'Hermit', locations: ['loc-1'] };
  const discovered: DiscoveredEntity[] = [
    { entity: { id: 'disc-1', name: 'Mouse' }, locationId: 'loc-1', sourceTurnId: 't2' },
    { entity: { id: 'disc-2', name: 'Bat' }, locationId: 'loc-9', sourceTurnId: 't3' },
  ];

  it('anchors each discovered character to the location it was invented in', () => {
    const cast = [worldEntity, ...discoveredAsEntities(discovered)];
    // Rostering the cave lists the authored hermit and only the mouse — the bat is somewhere else.
    expect(entityIdsAt('loc-1', cast)).toEqual(['world-a', 'disc-1']);
    expect(entityIdsAt('loc-9', cast)).toEqual(['disc-2']);
  });

  it('leaves an unanchored discovery belonging nowhere rather than everywhere', () => {
    const floating: DiscoveredEntity = { entity: { id: 'disc-3', name: 'Voice' }, sourceTurnId: 't4' };
    expect(discoveredAsEntities([floating])[0].locations).toBeUndefined();
    expect(entityIdsAt('loc-1', discoveredAsEntities([floating]))).toEqual([]);
  });

  it('rosters at the location it was invented at, alongside the authored cast', () => {
    const cave: GameLocation = { id: 'loc-1', name: 'Cave' };
    const all = [worldEntity, ...discoveredAsEntities(discovered)];
    expect(buildEntityContext(cave, all, { nameOnly: true })).toBe('Hermit, Mouse');
  });

  it('never mutates the stored discovery record', () => {
    discoveredAsEntities(discovered);
    expect('locations' in discovered[0].entity).toBe(false);
  });
});
