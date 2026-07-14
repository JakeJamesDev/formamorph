import { describe, it, expect } from 'vitest';
import {
  parseDirectorCast,
  matchCastToEntities,
  classifyCast,
  buildSceneList,
  isEmptyCastName,
  sanitizePlanForReveal,
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

  it('splits a "Name (alias)" bullet into a clean name plus a captured alias', () => {
    const raw = [
      'Cast:',
      '- Maela (the hooded woman) - watching from the dock',
      '- Bram (ferryman) - looping the rope',
    ].join('\n');
    expect(parseDirectorCast(raw).cast).toEqual([
      { name: 'Maela', stance: 'watching from the dock', alias: 'the hooded woman' },
      { name: 'Bram', stance: 'looping the rope', alias: 'ferryman' },
    ]);
  });

  it('does not attach an alias to the player character', () => {
    const raw = ['Cast:', '- Player Character (the mapmaker) - seated at the bar'].join('\n');
    expect(parseDirectorCast(raw).cast).toEqual([
      { name: 'Player Character', stance: 'seated at the bar', isPlayer: true },
    ]);
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

describe('isEmptyCastName', () => {
  it('catches single-word sentinels and "the scene is empty" phrasings', () => {
    for (const n of ['none', 'None.', 'N/A', 'nobody', 'no characters', 'no other characters present',
      'No other characters', 'no one else', 'No one else present', 'nobody else', 'no others', 'no NPCs present']) {
      expect(isEmptyCastName(n)).toBe(true);
    }
  });

  it('does not flag real names that merely start with "no"', () => {
    for (const n of ['Noah', 'Nora', 'Norman', 'Nobu']) expect(isEmptyCastName(n)).toBe(false);
  });
});

describe('classifyCast', () => {
  const entities = [ent('1', 'Mira'), ent('2', 'Captain Vos')];

  it('buckets defined entities vs ad-hoc names and flags the player by trait name', () => {
    const cast = [
      { name: 'Player Character', isPlayer: true },
      { name: 'Aldric' }, // the player, named instead of labeled
      { name: 'Mira' },
      { name: 'A hooded looter' },
    ];
    const { npcCast, directorCandidates, adHocCandidates } = classifyCast(cast, entities, ['Aldric']);
    expect(npcCast.map((c) => c.name)).toEqual(['Mira', 'A hooded looter']);
    expect(directorCandidates).toEqual(['Mira']);
    expect(adHocCandidates).toEqual(['A hooded looter']);
  });

  it('treats a name that resolves to an entity as an NPC even if it also matches a trait name', () => {
    // "Mira" is both a selected trait name and a world entity — the entity wins (it's an NPC, not the player).
    const { npcCast, directorCandidates } = classifyCast([{ name: 'Mira' }], entities, ['Mira']);
    expect(npcCast).toHaveLength(1);
    expect(directorCandidates).toEqual(['Mira']);
  });
});

describe('sanitizePlanForReveal', () => {
  const revealNone = () => false;
  const revealAll = () => true;

  it('swaps an unrevealed name for its parenthetical alias across Scene, Cast, and Beats', () => {
    const plan = [
      'Scene: Maela lingers by the door.',
      'Cast:',
      '- Player Character - seated at the bar',
      '- Maela (the silver-haired woman) - watching the room',
      'Beats: Maela steps closer and studies you.',
    ].join('\n');
    const out = sanitizePlanForReveal(plan, revealNone);
    expect(out).not.toMatch(/Maela/);
    expect(out).toContain('the silver-haired woman lingers by the door');
    expect(out).toContain('- the silver-haired woman - watching the room');
    expect(out).toContain('the silver-haired woman steps closer');
  });

  it('leaves a name untouched once it has been revealed in past narration', () => {
    const plan = ['Cast:', '- Maela (the silver-haired woman) - watching'].join('\n');
    expect(sanitizePlanForReveal(plan, revealAll)).toContain('Maela');
  });

  it('falls back to a neutral descriptor when the planner gave no alias', () => {
    const plan = ['Cast:', '- Gareth - blocking the exit', 'Beats: Gareth draws a blade.'].join('\n');
    const out = sanitizePlanForReveal(plan, revealNone);
    expect(out).not.toMatch(/Gareth/);
    expect(out).toContain('someone the player has not yet identified');
  });

  it('never rewrites the player or empty-cast sentinels', () => {
    const plan = ['Cast:', '- Player Character - waiting', '- None'].join('\n');
    expect(sanitizePlanForReveal(plan, revealNone)).toBe(plan);
  });
});

describe('buildSceneList', () => {
  const entities = [ent('1', 'Maela'), ent('2', 'Bram')];

  it('sources presence from the planner cast, canonicalizes names, carries aliases, and reveals by narration', () => {
    const cast = [
      { name: 'maela', alias: 'the hooded woman' },
      { name: 'Bram' },
      { name: 'Player Character', isPlayer: true },
    ];
    const list = buildSceneList({ cast, entities, narrationSoFar: 'Bram waves you over.', priorNarration: '' });
    expect(list).toEqual([
      { name: 'Maela', alias: 'the hooded woman', revealed: false },
      { name: 'Bram', revealed: true },
    ]);
  });

  it('reveals a name once it has appeared in prior narration', () => {
    const list = buildSceneList({
      cast: [{ name: 'Maela', alias: 'the hooded woman' }],
      entities, narrationSoFar: '', priorNarration: 'Earlier, Maela gave her name.',
    });
    expect(list[0].revealed).toBe(true);
  });

  it('falls back to the narration parse when no planner ran (cast null); named = revealed', () => {
    const list = buildSceneList({ cast: null, entities, narrationSoFar: 'Bram ties off the rope.', priorNarration: '' });
    expect(list).toEqual([{ name: 'Bram', revealed: true }]);
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
    // Scene → stances → beats, each carrying its data. We don't pin the exact section labels/whitespace
    // (those can iterate); we guard that all three sections are present, in order, with their content.
    expect(out).toContain('A dim inn room.');
    expect(out).toContain('Sylphie');
    expect(out).toContain('in the corner');
    expect(out).toContain('Alph');
    expect(out).toContain('- Sylphie speaks up');
    expect(out).toContain('- Alph keeps packing');
    expect(out.indexOf('A dim inn room.')).toBeLessThan(out.indexOf('in the corner'));
    expect(out.indexOf('in the corner')).toBeLessThan(out.indexOf('- Sylphie speaks up'));
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
    concurrentCharacters: false,
    fullMessageHistory: [],
    diaryMemoryEntries: 5,
    caps: { director: 100, character: 100, storyboard: 100 },
    activeCharacterCap: 3,
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

  it('runs character passes concurrently and keeps intents in cast order despite out-of-order completion', async () => {
    let storyboardMsg = '';
    const request: StagedRequestFn = async (_s, m, type) => {
      if (type === 'director') return 'Scene: A cave.\nCast:\n- Goblin - snarling\n- Orc - roaring';
      if (type === 'character') {
        const isGoblin = JSON.stringify(m).includes('Goblin');
        // Goblin (cast-first) resolves LAST — order must come from cast position, not completion.
        await new Promise((r) => setTimeout(r, isGoblin ? 20 : 5));
        return isGoblin ? 'Goblin intent' : 'Orc intent';
      }
      if (type === 'storyboard') { storyboardMsg = m[0].content; return 'The cave stirs.'; }
      return '';
    };
    const res = await runStagedPlanning({ ...baseCtx, concurrentCharacters: true, request, signal: new AbortController().signal });
    expect(storyboardMsg).toContain('Goblin intent');
    expect(storyboardMsg).toContain('Orc intent');
    // Cast order (Goblin before Orc) is preserved even though Orc's call resolved first.
    expect(storyboardMsg.indexOf('Goblin intent')).toBeLessThan(storyboardMsg.indexOf('Orc intent'));
    expect(res.turnPlan).toContain('The cave stirs.');
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
