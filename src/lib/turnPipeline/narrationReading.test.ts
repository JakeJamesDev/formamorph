import { describe, it, expect } from 'vitest';
import { readNarration, selectVisitorAdditions, splitParticipants, presentSceneEntities } from './narrationReading';
import type { Entity, GameLocation } from '@/types';

const ent = (id: string, name: string): Entity => ({ id, name });
const loc = (id: string, name: string, over: Partial<GameLocation> = {}): GameLocation =>
  ({ id, name, entities: [], ...over }) as GameLocation;

const MAREN = { ...ent('e1', 'Maren Vosk'), locations: ['l2'] };
const SERANA = ent('e2', 'Professor Serana');

const read = (narration: string, over: Parameters<typeof readNarration>[0] extends infer T ? Partial<T> : never = {}) =>
  readNarration({
    narration,
    priorNarration: '',
    entities: [MAREN, SERANA],
    directorCandidates: [],
    adHocCandidates: [],
    exclusions: {},
    sceneCast: null,
    ...over,
  });

describe('readNarration', () => {
  it('counts an entity the prose shows, not one the dialogue only talks about', () => {
    const shown = read('Maren Vosk hauls the net aboard.');
    expect(shown.participants).toContain('Maren Vosk');

    const spoken = read('The deckhand mutters, "for Professor Serana\'s review, then."');
    expect(spoken.participants).not.toContain('Professor Serana');
  });

  it('confirms a director candidate loosely and an ad-hoc one strictly', () => {
    // The planner already vouched a defined entity is present, so a partial name confirms it.
    expect(read('The tank grinds forward.', { directorCandidates: ['Battle Tank'] }).participants)
      .toContain('Battle Tank');
    // A planner-invented name has no entity record behind it, so it takes the full name.
    expect(read('The ferryman waits.', { adHocCandidates: ['Old Ferryman Cobb'] }).participants)
      .not.toContain('Old Ferryman Cobb');
    expect(read('Old Ferryman Cobb waits.', { adHocCandidates: ['Old Ferryman Cobb'] }).participants)
      .toContain('Old Ferryman Cobb');
  });

  it('falls back to the narration parse for the scene list when no planner ran', () => {
    const { visibleEntities } = read('Maren Vosk hauls the net aboard.');
    expect(visibleEntities.map((e) => e.name)).toEqual(['Maren Vosk']);
  });

  it('sources the scene list from the cast, so a merely-named entity never appears', () => {
    const { visibleEntities } = read('Maren Vosk hauls the net aboard.', {
      sceneCast: [{ name: 'Professor Serana', stance: 'watching' }],
    });
    expect(visibleEntities.map((e) => e.name)).toEqual(['Professor Serana']);
  });

  it('adds a narrator-invented name to the scene list the cast has no row for', () => {
    const { visibleEntities, narratedNames } = read('Maren Vosk nods to Captain Halric Dune, who ties off the line.', {
      sceneCast: [{ name: 'Maren Vosk', stance: 'working' }],
    });
    expect(narratedNames).toContain('Captain Halric Dune');
    expect(visibleEntities.map((e) => e.name)).toEqual(['Maren Vosk', 'Captain Halric Dune']);
    expect(visibleEntities.find((e) => e.name === 'Captain Halric Dune')?.revealed).toBe(true);
  });

  it('drops a suppressed name the narrator reused', () => {
    const seen = read('Captain Halric Dune ties off the line.');
    expect(seen.participants).toContain('Captain Halric Dune');
    const { participants } = read('Captain Halric Dune ties off the line.', {
      exclusions: { suppressed: ['Captain Halric Dune'] },
    });
    expect(participants).not.toContain('Captain Halric Dune');
  });
});

describe('selectVisitorAdditions', () => {
  const here = loc('l1', 'The Jetty', { parentId: 'l0' });
  const sibling = loc('l2', 'The Net Shed', { parentId: 'l0' }); // Maren belongs here (see MAREN.locations)
  const locations = [loc('l0', 'Sedge Landing'), here, sibling];

  const visitors = (prose: string, discovered: Parameters<typeof selectVisitorAdditions>[0]['discovered'] = []) =>
    selectVisitorAdditions({
      prose,
      entities: [MAREN, SERANA],
      allEntities: [MAREN, SERANA],
      location: here,
      locations,
      presentIds: [],
      discovered,
      turnId: 't1',
    });

  it('walks a reachable neighbor over on a full-name hit', () => {
    const added = visitors('Maren Vosk steps onto the boards.');
    expect(added.map((d) => d.entity.name)).toEqual(['Maren Vosk']);
    expect(added[0]).toMatchObject({ locationId: 'l1', sourceTurnId: 't1' });
  });

  it('refuses a partial name, so a loose match cannot teleport someone in', () => {
    expect(visitors('Maren steps onto the boards.')).toEqual([]);
  });

  it('never adds someone already anchored here', () => {
    const already = [{ entity: MAREN, locationId: 'l1', sourceTurnId: 't0' }];
    expect(visitors('Maren Vosk steps onto the boards.', already)).toEqual([]);
  });
});

describe('splitParticipants', () => {
  it('sends known entities to diaries and unknown names to discovery', () => {
    const { diary, discoverEntity } = splitParticipants(
      ['Maren Vosk', 'Halric Dune'], [MAREN, SERANA], [],
    );
    expect(diary).toEqual([{ name: 'Maren Vosk', entity: MAREN }]);
    expect(discoverEntity).toEqual([{ name: 'Halric Dune' }]);
  });

  it('discovers nobody the player deleted', () => {
    const { discoverEntity } = splitParticipants(['Halric Dune'], [MAREN], ['Halric Dune']);
    expect(discoverEntity).toEqual([]);
  });
});

describe('presentSceneEntities', () => {
  it('keeps this turn and the rolling window, and only entities that exist', () => {
    expect(presentSceneEntities([MAREN, SERANA], ['Maren Vosk'], ['Professor Serana', 'Nobody At All']))
      .toEqual([MAREN, SERANA]);
    expect(presentSceneEntities([MAREN, SERANA], [], [])).toEqual([]);
  });
});
