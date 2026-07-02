import { describe, it, expect } from 'vitest';
import {
  parseDirectorCast,
  matchCastToEntities,
  buildCharacterUserMessage,
  buildDiaryUserMessage,
  buildStoryboardUserMessage,
  buildStagedPlan,
  runStagedPlanning,
  type StagedRequestFn,
} from './stagedPlanning';
import {
  defaultDirectorPrompt,
  defaultDirectorUserPrompt,
  defaultCharacterPrompt,
  defaultStoryboardPrompt,
} from '@/components/game/GamePrompts';
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
    expect(msg).toContain('My background (who I am in general, not this exact moment): A wary scout.');
    expect(msg).toContain('Where I am now: crouched behind a crate');
    expect(msg).toContain('Scene right now: Dust settles.');
    expect(msg).toContain('As Mira, from where I stand in this scene');
  });

  it('flags an ad-hoc character as director-introduced and omits an absent stance', () => {
    const msg = buildCharacterUserMessage({
      character: { name: 'A looter' },
      scene: '',
      action: 'wave',
    });
    expect(msg).toContain('Introduced by the director');
    expect(msg).not.toContain('Where I am now:');
  });

  it('includes the recap of what just happened (before the scene) with the pronoun frame, and omits it when empty', () => {
    const withRecap = buildCharacterUserMessage({
      character: { name: 'Mira', entity: ent('1', 'Mira'), stance: 'by the door' },
      scene: 'Dust settles.',
      action: 'wave',
      recap: 'You kicked the door in.',
    });
    expect(withRecap).toContain('What just happened (here "you" / "your" means the player character, not me):');
    expect(withRecap).toContain('You kicked the door in.');
    // Recap precedes the current scene so the character reacts to how things developed.
    expect(withRecap.indexOf('What just happened')).toBeLessThan(withRecap.indexOf('Scene right now: Dust settles.'));

    const noRecap = buildCharacterUserMessage({
      character: { name: 'Mira', entity: ent('1', 'Mira') },
      scene: 'Dust settles.',
      action: 'wave',
      recap: '   ',
    });
    expect(noRecap).not.toContain('What just happened');
  });

  it('injects the character\'s own diary as a memory block (oldest first)', () => {
    const msg = buildCharacterUserMessage({
      character: { name: 'Mira', entity: ent('1', 'Mira') },
      scene: 'Dust settles.',
      action: 'wave',
      diary: ['I distrusted the stranger.', 'I softened toward them.'],
    });
    expect(msg).toContain('My diary so far');
    expect(msg).toContain('- I distrusted the stranger.');
    expect(msg).toContain('- I softened toward them.');
    // Memory precedes the scene, and the first-person cue still closes the message.
    expect(msg.indexOf('My diary so far')).toBeLessThan(msg.indexOf('Scene right now: Dust settles.'));
    expect(msg).toContain('As Mira, from where I stand in this scene');
  });

  it('omits the diary block when there are no entries', () => {
    const msg = buildCharacterUserMessage({
      character: { name: 'Mira', entity: ent('1', 'Mira') },
      scene: 'Dust settles.',
      action: 'wave',
      diary: [],
    });
    expect(msg).not.toContain('My diary so far');
  });

  it('builds a diary message with the entity blurb and narration for a defined character', () => {
    const msg = buildDiaryUserMessage({
      name: 'Mira',
      entity: ent('1', 'Mira', { aiSummary: 'A wary scout.' }),
      narration: 'The gate groans open.',
    });
    expect(msg).toContain('You are Mira.');
    expect(msg).toContain('Who you are: A wary scout.');
    expect(msg).toContain('The gate groans open.');
    // Establishes the pronoun frame and the first-person identity cue.
    expect(msg).toContain('"you" means the player character, not you');
    expect(msg).toContain('As Mira, write my own diary entry');
  });

  it('builds a diary message with name only for an ad-hoc character', () => {
    const msg = buildDiaryUserMessage({ name: 'A looter', narration: 'Coins scatter.' });
    expect(msg).toContain('You are A looter.');
    expect(msg).not.toContain('Who you are:');
    expect(msg).toContain('Coins scatter.');
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

describe('runStagedPlanning', () => {
  const baseCtx = {
    action: 'look around',
    stageValues: {},
    lastStory: 'It was quiet.',
    entities: [] as Entity[],
    presentEntityIds: [] as string[],
    playerNames: [] as string[],
    characterDiaries: false,
    fullMessageHistory: [],
    diaryMemoryEntries: 5,
    caps: { director: 100, character: 100, storyboard: 100 },
    directorPrompt: defaultDirectorPrompt,
    directorUserPrompt: defaultDirectorUserPrompt,
    characterPrompt: defaultCharacterPrompt,
    storyboardPrompt: defaultStoryboardPrompt,
  };

  it('runs director -> character -> storyboard and assembles the plan', async () => {
    const calls: string[] = [];
    const request: StagedRequestFn = async (_s, _m, type) => {
      calls.push(type);
      if (type === 'director') return 'Scene: A dim cave.\nCast:\n- Player Character - standing\n- Goblin - snarling';
      if (type === 'character') return 'I lunge at the intruder.';
      if (type === 'storyboard') return 'The goblin lunges.';
      return '';
    };
    const res = await runStagedPlanning({ ...baseCtx, request, signal: new AbortController().signal });
    expect(calls).toEqual(['director', 'character', 'storyboard']);
    expect(res.adHocCandidates).toEqual(['Goblin']);
    expect(res.directorCandidates).toEqual([]);
    expect(res.turnPlan).toContain('Scene: A dim cave.');
    expect(res.turnPlan).toContain('The goblin lunges.');
  });

  it('routes a cast name that matches a present entity to directorCandidates', async () => {
    const entities: Entity[] = [{ id: 'e1', name: 'Goblin' }];
    const request: StagedRequestFn = async (_s, _m, type) =>
      type === 'director' ? 'Scene: A cave.\nCast:\n- Goblin - snarling' : type === 'storyboard' ? 'It snarls.' : 'I snarl.';
    const res = await runStagedPlanning({ ...baseCtx, entities, presentEntityIds: ['e1'], request, signal: new AbortController().signal });
    expect(res.directorCandidates).toEqual(['Goblin']);
    expect(res.adHocCandidates).toEqual([]);
  });

  it('skips the character/storyboard passes when only the player is cast', async () => {
    const calls: string[] = [];
    const request: StagedRequestFn = async (_s, _m, type) => {
      calls.push(type);
      return type === 'director' ? 'Scene: An empty road.\nCast:\n- Player Character - walking' : '';
    };
    const res = await runStagedPlanning({ ...baseCtx, request, signal: new AbortController().signal });
    expect(calls).toEqual(['director']);
    expect(res.turnPlan).toContain('Scene: An empty road.');
    expect(res.adHocCandidates).toEqual([]);
  });

  it('treats a director-named player as the player (no character pass), while an NPC still gets one', async () => {
    const calls: string[] = [];
    const request: StagedRequestFn = async (_s, _m, type) => {
      calls.push(type);
      if (type === 'director') return 'Scene: A kitchen.\nCast:\n- Jessica Foster - lingering\n- Alice - watching';
      if (type === 'character') return 'I step closer.';
      if (type === 'storyboard') return 'Alice steps closer.';
      return '';
    };
    const res = await runStagedPlanning({ ...baseCtx, playerNames: ['Jessica Foster'], request, signal: new AbortController().signal });
    // Only Alice gets a motivation pass; the named player is filtered out.
    expect(calls).toEqual(['director', 'character', 'storyboard']);
    expect(res.adHocCandidates).toEqual(['Alice']);
    // The player still grounds the scene stances.
    expect(res.turnPlan).toContain('Jessica Foster');
  });

  it('keeps a present entity as an NPC even if its name matches a player-name candidate (guard)', async () => {
    const entities: Entity[] = [{ id: 'e1', name: 'Guard' }];
    const request: StagedRequestFn = async (_s, _m, type) =>
      type === 'director' ? 'Scene: A gate.\nCast:\n- Guard - blocking' : type === 'storyboard' ? 'It blocks.' : 'I block.';
    const res = await runStagedPlanning({ ...baseCtx, entities, presentEntityIds: ['e1'], playerNames: ['Guard'], request, signal: new AbortController().signal });
    expect(res.directorCandidates).toEqual(['Guard']);
    expect(res.adHocCandidates).toEqual([]);
  });

  it('bails with an empty plan when aborted after the director', async () => {
    const controller = new AbortController();
    const request: StagedRequestFn = async (_s, _m, type) => {
      if (type === 'director') { controller.abort(); return 'Scene: X.\nCast:\n- Goblin - snarl'; }
      return '';
    };
    const res = await runStagedPlanning({ ...baseCtx, request, signal: controller.signal });
    expect(res.turnPlan).toBe('');
  });
});
