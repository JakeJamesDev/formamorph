import { describe, it, expect } from 'vitest';
import {
  parseDirectorCast,
  matchCastToEntities,
  buildCharacterUserMessage,
  buildStoryboardUserMessage,
} from './stagedPlanning';
import type { Entity } from '@/types';

const ent = (id: string, name: string, extra: Partial<Entity> = {}): Entity => ({ id, name, ...extra });

describe('parseDirectorCast', () => {
  it('parses the well-formed Continuation + Cast format', () => {
    const raw = [
      'Continuation: The sirens are still wailing as dust settles.',
      'Cast:',
      '- Mira - she scrambles for cover',
      '- Captain Vos - barking orders',
    ].join('\n');
    expect(parseDirectorCast(raw)).toEqual({
      continuation: 'The sirens are still wailing as dust settles.',
      cast: [{ name: 'Mira' }, { name: 'Captain Vos' }],
    });
  });

  it('falls back to bullets + first prose line when headers are missing', () => {
    const raw = ['The crowd panics in the plaza.', '* A fleeing officer', '* Street vendor'].join('\n');
    expect(parseDirectorCast(raw)).toEqual({
      continuation: 'The crowd panics in the plaza.',
      cast: [{ name: 'A fleeing officer' }, { name: 'Street vendor' }],
    });
  });

  it('strips markdown bold and reason clauses, and dedupes case-insensitively', () => {
    const raw = ['Cast:', '- **Mira**: terrified', '- mira — again', '- Jean-Luc'].join('\n');
    expect(parseDirectorCast(raw).cast).toEqual([{ name: 'Mira' }, { name: 'Jean-Luc' }]);
  });

  it('drops the player character even when the director lists them', () => {
    const raw = ['Cast:', '- You', '- The player character', '- Mira'].join('\n');
    expect(parseDirectorCast(raw).cast).toEqual([{ name: 'Mira' }]);
  });

  it('drops "no one present" sentinels like None / N/A', () => {
    const raw = ['Cast:', '- None - this location is empty except for you.'].join('\n');
    expect(parseDirectorCast(raw).cast).toEqual([]);
  });

  it('treats an inline "Cast: none" as an empty cast without polluting the continuation', () => {
    const raw = ['Continuation: A quiet road stretches ahead.', 'Cast: none'].join('\n');
    expect(parseDirectorCast(raw)).toEqual({
      continuation: 'A quiet road stretches ahead.',
      cast: [],
    });
  });

  it('returns an empty cast and whole-text continuation when there are no bullets', () => {
    expect(parseDirectorCast('Nothing much happens.')).toEqual({
      continuation: 'Nothing much happens.',
      cast: [],
    });
  });
});

describe('matchCastToEntities', () => {
  const entities = [ent('1', 'Mira', { aiDescription: 'A wary scout.' }), ent('2', 'Captain Vos')];

  it('attaches the author entity on a case-insensitive name match, leaves ad-hoc names bare', () => {
    const { chosen } = matchCastToEntities([{ name: 'mira' }, { name: 'A looter' }], entities);
    expect(chosen[0].entity?.id).toBe('1');
    expect(chosen[1].entity).toBeUndefined();
  });

  it('caps the chosen list and returns the rest as overflow names', () => {
    const cast = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];
    const { chosen, overflow } = matchCastToEntities(cast, entities, 3);
    expect(chosen.map((c) => c.name)).toEqual(['A', 'B', 'C']);
    expect(overflow).toEqual(['D']);
  });
});

describe('user-message builders', () => {
  it('uses the entity description for a matched character', () => {
    const msg = buildCharacterUserMessage({
      character: { name: 'Mira', entity: ent('1', 'Mira', { aiDescription: 'A wary scout.' }) },
      continuation: 'Dust settles.',
      action: 'wave',
    });
    expect(msg).toContain('Who they are: A wary scout.');
    expect(msg).toContain("State Mira's motivation");
  });

  it('flags an ad-hoc character as director-introduced', () => {
    const msg = buildCharacterUserMessage({
      character: { name: 'A looter' },
      continuation: '',
      action: 'wave',
    });
    expect(msg).toContain('Introduced by the director');
  });

  it('lists the recap, intents, and overflow names in the storyboard message', () => {
    const msg = buildStoryboardUserMessage({
      recap: 'You kicked the door in.',
      continuation: 'Dust settles.',
      intents: [{ name: 'Mira', text: 'flees north' }],
      overflow: ['Street vendor'],
      action: 'wave',
    });
    expect(msg).toContain('What just happened:\nYou kicked the door in.');
    expect(msg).toContain('- Mira: flees north');
    expect(msg).toContain('Also present: Street vendor');
    expect(msg).toContain("player's latest action: wave");
  });
});
