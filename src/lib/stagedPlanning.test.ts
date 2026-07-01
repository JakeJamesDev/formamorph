import { describe, it, expect } from 'vitest';
import {
  parseDirectorCast,
  matchCastToEntities,
  buildCharacterUserMessage,
  buildStoryboardUserMessage,
  buildStagedPlan,
} from './stagedPlanning';
import type { Entity } from '@/types';

const ent = (id: string, name: string, extra: Partial<Entity> = {}): Entity => ({ id, name, ...extra });

describe('parseDirectorCast', () => {
  it('parses the well-formed Scene + Cast format, capturing each stance', () => {
    const raw = [
      'Scene: The inn room is dark. Moonlight falls through an open window.',
      'Cast:',
      '- Sylphie - standing in the corner tugging at her skirt',
      '- Alph - sorting through his backpack',
    ].join('\n');
    expect(parseDirectorCast(raw)).toEqual({
      scene: 'The inn room is dark. Moonlight falls through an open window.',
      cast: [
        { name: 'Sylphie', stance: 'standing in the corner tugging at her skirt' },
        { name: 'Alph', stance: 'sorting through his backpack' },
      ],
    });
  });

  it('captures a scene when the model breaks after the "Scene:" label, and drops a bare "none." cast', () => {
    const raw = [
      'Scene:',
      'A dense forest surrounds a small village. Smoke curls from the chimneys.',
      '',
      'Cast:',
      '',
      'none.',
    ].join('\n');
    expect(parseDirectorCast(raw)).toEqual({
      scene: 'A dense forest surrounds a small village. Smoke curls from the chimneys.',
      cast: [],
    });
  });

  it('parses a member inlined on the "Cast:" header (not a bullet)', () => {
    const raw = ['Scene: A lit hall.', 'Cast: Mira - by the hearth'].join('\n');
    expect(parseDirectorCast(raw)).toEqual({
      scene: 'A lit hall.',
      cast: [{ name: 'Mira', stance: 'by the hearth' }],
    });
  });

  it('recovers the first scene and the player from a malformed double Scene/Cast block', () => {
    const raw = [
      'Scene: A misty glade with a stone altar.',
      'Cast:',
      '- None',
      'Scene: The player character rests motionless on the altar.',
      'Cast: Player Character - Resting motionlessly on the altar',
    ].join('\n');
    expect(parseDirectorCast(raw)).toEqual({
      scene: 'A misty glade with a stone altar.',
      cast: [{ name: 'Player Character', stance: 'Resting motionlessly on the altar', isPlayer: true }],
    });
  });

  it('stops treating prose as scene once the cast section has begun', () => {
    const raw = ['Scene: A lit hall.', 'Cast:', '- Mira - by the hearth', 'A stray trailing note.'].join('\n');
    expect(parseDirectorCast(raw)).toEqual({
      scene: 'A lit hall.',
      cast: [{ name: 'Mira', stance: 'by the hearth' }],
    });
  });

  it('leaves stance undefined for a bare name', () => {
    const raw = ['Scene: A quiet plaza.', 'Cast:', '- Mira'].join('\n');
    expect(parseDirectorCast(raw).cast).toEqual([{ name: 'Mira', stance: undefined }]);
  });

  it('falls back to bullets + first prose line as the scene when headers are missing', () => {
    const raw = ['The crowd panics in the plaza.', '* A fleeing officer', '* Street vendor'].join('\n');
    expect(parseDirectorCast(raw)).toEqual({
      scene: 'The crowd panics in the plaza.',
      cast: [
        { name: 'A fleeing officer', stance: undefined },
        { name: 'Street vendor', stance: undefined },
      ],
    });
  });

  it('strips markdown bold and stance clauses from the name, and dedupes case-insensitively', () => {
    const raw = ['Cast:', '- **Mira**: terrified', '- mira — again', '- Jean-Luc'].join('\n');
    expect(parseDirectorCast(raw).cast).toEqual([
      { name: 'Mira', stance: 'terrified' },
      { name: 'Jean-Luc', stance: undefined },
    ]);
  });

  it('keeps the player as a flagged "Player Character" entry (deduped across aliases)', () => {
    const raw = ['Cast:', '- You - by the door', '- The player character', '- Mira'].join('\n');
    expect(parseDirectorCast(raw).cast).toEqual([
      { name: 'Player Character', stance: 'by the door', isPlayer: true },
      { name: 'Mira', stance: undefined },
    ]);
  });

  it('drops "no one present" sentinels like None / N/A', () => {
    const raw = ['Cast:', '- None - this location is empty except for you.'].join('\n');
    expect(parseDirectorCast(raw).cast).toEqual([]);
  });

  it('drops a bare sentinel with trailing punctuation ("None.")', () => {
    const raw = ['Cast:', '- Player Character - sits still', '- None.'].join('\n');
    expect(parseDirectorCast(raw).cast).toEqual([
      { name: 'Player Character', stance: 'sits still', isPlayer: true },
    ]);
  });

  it('trims surrounding punctuation from a name without touching internal marks', () => {
    const raw = ['Cast:', '- Mira! - waving', '- "Reyes" - nods', '- Jean-Luc'].join('\n');
    expect(parseDirectorCast(raw).cast).toEqual([
      { name: 'Mira', stance: 'waving' },
      { name: 'Reyes', stance: 'nods' },
      { name: 'Jean-Luc', stance: undefined },
    ]);
  });

  it('treats an inline "Cast: none" as an empty cast without polluting the scene', () => {
    const raw = ['Scene: A quiet road stretches ahead.', 'Cast: none'].join('\n');
    expect(parseDirectorCast(raw)).toEqual({
      scene: 'A quiet road stretches ahead.',
      cast: [],
    });
  });

  it('returns an empty cast and whole-text scene when there are no bullets', () => {
    expect(parseDirectorCast('Nothing much happens.')).toEqual({
      scene: 'Nothing much happens.',
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
  it('uses the entity description and the current stance for a matched character', () => {
    const msg = buildCharacterUserMessage({
      character: {
        name: 'Mira',
        stance: 'crouched behind a crate',
        entity: ent('1', 'Mira', { aiDescription: 'A wary scout.' }),
      },
      scene: 'Dust settles.',
      action: 'wave',
    });
    expect(msg).toContain('You are Mira.');
    expect(msg).toContain('Who you are: A wary scout.');
    expect(msg).toContain('Current stance: crouched behind a crate');
    expect(msg).toContain('Scene: Dust settles.');
    expect(msg).toContain('As Mira, state in the first person');
  });

  it('flags an ad-hoc character as director-introduced and omits an absent stance', () => {
    const msg = buildCharacterUserMessage({
      character: { name: 'A looter' },
      scene: '',
      action: 'wave',
    });
    expect(msg).toContain('Introduced by the director');
    expect(msg).not.toContain('Current stance:');
  });

  it('lists the recap, scene, intents, and overflow names in the storyboard message', () => {
    const msg = buildStoryboardUserMessage({
      recap: 'You kicked the door in.',
      scene: 'Dust settles.',
      intents: [{ name: 'Mira', text: 'flees north' }],
      overflow: ['Street vendor'],
      action: 'wave',
    });
    expect(msg).toContain('What just happened:\nYou kicked the door in.');
    expect(msg).toContain('Scene: Dust settles.');
    expect(msg).toContain('- Mira: flees north');
    expect(msg).toContain('Also present: Street vendor');
    expect(msg).toContain("player's latest action: wave");
  });
});

describe('buildStagedPlan', () => {
  it('leads with the scene, lists stances, then the beats', () => {
    const out = buildStagedPlan({
      scene: 'A dim inn room.',
      stances: [
        { name: 'Sylphie', stance: 'in the corner' },
        { name: 'Alph' },
      ],
      beats: '- Sylphie speaks up\n- Alph keeps packing',
    });
    expect(out).toBe(
      'Scene: A dim inn room.\n\nPresent entities:\n- Sylphie - in the corner\n- Alph\n\nWhat happens:\n- Sylphie speaks up\n- Alph keeps packing',
    );
  });

  it('omits blank sections', () => {
    expect(buildStagedPlan({ scene: '', stances: [], beats: '- do a thing' })).toBe('What happens:\n- do a thing');
    expect(buildStagedPlan({ scene: 'Just a scene.', stances: [], beats: '' })).toBe('Scene: Just a scene.');
  });
});
