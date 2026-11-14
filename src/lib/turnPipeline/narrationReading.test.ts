import { describe, it, expect } from 'vitest';
import { readNarration, readEditedNarration, selectVisitorAdditions, splitParticipants, presentSceneEntities } from './narrationReading';
import type { Connection, Entity, EntityStart, GameLocation } from '@/types';
import { castRoutines } from '../entityKind';
import { storyMinute } from '../gameClock';
import { placeAll, positionWorld, type PositionWorld } from '../positionPlay';
import { startFollowing, startWaiting, type PositionBook } from '../positionEngine';
import { migrateEntityRoutine } from '../version';
import { withFirstRoutine, withFirstStarts, withFirstTraversable } from '@/lib/entityKind';

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

  it('counts an entity whose only mention is introducing herself, the rest pronouns', () => {
    const narration = [
      '"Thank you for the food," you say. "What\'s your name?"',
      'The gardener\'s ears perk up. She beams at you. "Oh, don\'t be silly! I\'m Lyria."',
      'She steps forward again and pats your cheek. "Come inside."',
    ].join('\n\n');
    expect(read(narration, { entities: [MAREN, SERANA, ent('e3', 'Lyria')] }).participants).toEqual(['Lyria']);
  });

  it('counts an entity the prose calls by its full Stranger Name', () => {
    const hooded = { ...SERANA, strangerName: 'a hooded woman' };
    expect(read('A hooded woman waits at the door.', { entities: [MAREN, hooded] }).participants)
      .toEqual(['Professor Serana']);
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

  const cabin = loc('l3', 'The Cabin', { parentId: 'l1' }); // a direct child of the Jetty
  const bunk = loc('l4', 'The Bunk', { parentId: 'l3' }); // two levels down
  const ferry = loc('l5', 'The Ferry Dock'); // top-level, joined to the Jetty only by a Connection
  const world = [...locations, cabin, bunk, ferry];
  const ferryRoad: Connection = { id: 'road', a: 'l1', b: 'l5', aToB: {}, bToA: {} };
  const NOON = storyMinute(4);

  /** A Unique entity starting at `place`, with an empty schedule unless `schedule` gives one. */
  const unique = (base: Entity, place: string, over: Partial<Entity> = {}, schedule: EntityStart['schedule'] = []): Entity => ({
    ...withFirstRoutine(base, (routine) => ({ ...routine, starts: [{ id: 's', place, weight: 1, schedule }], traversable: 'anywhere' })), kind: 'unique', locations: [place], ...over,
  });
  const maren = unique(MAREN, 'l2');

  interface PullOptions {
    location?: GameLocation;
    positions?: Record<string, string>;
    connections?: Connection[];
    /** Engine state set before the narration, such as a follow. */
    before?: (book: PositionBook, world: PositionWorld) => PositionBook;
  }

  /** The book before and after the pull, and the engine view it read. */
  const pull = (prose: string, cast: Entity[], over: PullOptions = {}) => {
    const location = over.location ?? here;
    const positionsWorld = positionWorld(castRoutines(cast), NOON, location.id, world, over.connections ?? [ferryRoad], () => 0);
    const placed = placeAll({ positions: {}, uniques: {}, generics: {} }, positionsWorld);
    const seated = { ...placed, positions: { ...placed.positions, ...over.positions } };
    const book = over.before ? over.before(seated, positionsWorld) : seated;
    const after = selectVisitorAdditions({
      prose: read(prose).prose, entities: cast, allEntities: cast, location, book, world: positionsWorld,
    });
    return { book, after, world: positionsWorld };
  };

  /** Who the pull brings to the player's place: every name the pull moved there. */
  const pullWith = (prose: string, cast: Entity[], over: PullOptions = {}) => {
    const location = over.location ?? here;
    const { book, after } = pull(prose, cast, over);
    return cast.filter((e) => book.positions[e.id] !== location.id && after.positions[e.id] === location.id).map((e) => e.name);
  };

  it('walks a reachable neighbor over on a full-name hit', () => {
    expect(pullWith('Maren Vosk steps onto the boards.', [maren, SERANA])).toEqual(['Maren Vosk']);
  });

  it('refuses a partial name, so a loose match cannot teleport someone in', () => {
    expect(pullWith('Maren steps onto the boards.', [maren])).toEqual([]);
  });

  it('counts a full Stranger Name as a full-name hit, and one word of it as none', () => {
    const hooded = { ...maren, strangerName: 'a hooded woman' };
    expect(pullWith('A hooded woman steps onto the boards.', [hooded])).toEqual(['Maren Vosk']);
    expect(pullWith('The woman steps onto the boards, hooded against the rain.', [hooded])).toEqual([]);
    expect(pullWith('The deckhand mutters, "a hooded woman steps onto the boards."', [hooded])).toEqual([]);
  });

  it('pulls from a child at a top-level place, which has no siblings', () => {
    const tamsin = unique(ent('e3', 'Tamsin Reed'), 'l1');
    expect(pullWith('Tamsin Reed walks in.', [tamsin], { location: loc('l0', 'Sedge Landing') })).toEqual(['Tamsin Reed']);
  });

  it('never pulls a character two levels down', () => {
    expect(pullWith('Tamsin Reed climbs up from the bunk.', [unique(ent('e3', 'Tamsin Reed'), 'l4')])).toEqual([]);
  });

  it('never pulls a name spoken only inside dialogue', () => {
    expect(pullWith('The deckhand calls, "Tamsin Reed, up here!"', [unique(ent('e3', 'Tamsin Reed'), 'l3')])).toEqual([]);
  });

  it('never pulls a Generic entity, and anchors no copy of it', () => {
    const herd: Entity = {
      ...withFirstStarts(ent('e3', 'Tamsin Reed'), [{ id: 'a', place: 'l2', weight: 1, schedule: [] }, { id: 'b', place: 'l3', weight: 1, schedule: [] }]), kind: 'generic', locations: ['l2', 'l3'],
    };
    const { book, after } = pull('Tamsin Reed comes over to the jetty.', [herd]);
    expect(after).toBe(book);
    expect(Object.values(after.generics.e3).map((p) => p.position)).toEqual(['l2', 'l3']);
  });

  describe('across links', () => {
    const tamsin = unique(ent('e3', 'Tamsin Reed'), 'l5');
    const named = 'Tamsin Reed comes over to the jetty.';
    const far = (c: Connection): Connection => ({ ...c, distance: 'far' });

    it('pulls across a Nearby Connection to a place outside the tree', () => {
      expect(pullWith(named, [tamsin])).toEqual(['Tamsin Reed']);
    });

    it('never pulls across a Far Connection', () => {
      expect(pullWith(named, [tamsin], { connections: [far(ferryRoad)] })).toEqual([]);
    });

    it('never pulls from a sibling a Far Connection sets apart', () => {
      const shedRoad: Connection = { id: 'shed', a: 'l1', b: 'l2', aToB: {}, bToA: {} };
      expect(pullWith('Maren Vosk steps onto the boards.', [maren], { connections: [far(shedRoad)] })).toEqual([]);
    });
  });

  describe.each([
    ['sibling', 'l2'],
    ['child', 'l3'],
    ['parent', 'l0'],
  ])('the routine, from a %s', (_kind, from) => {
    const named = 'Tamsin Reed comes over to the jetty.';
    const tamsin = (over: Partial<Entity>, schedule: EntityStart['schedule'] = []) => unique(ent('e3', 'Tamsin Reed'), from, over, schedule);
    const wander = (...places: string[]): EntityStart['schedule'] =>
      [{ id: 'w', time: 'allDay', action: { kind: 'wander', places: places.map((place) => ({ place, weight: 1 })), idle: 600 } }];

    it('pulls a character whose routine allows the player’s place', () => {
      expect(pullWith(named, [tamsin({})])).toEqual(['Tamsin Reed']);
    });

    it('never pulls a character whose Traversable is empty into a place outside its schedule', () => {
      expect(pullWith(named, [withFirstTraversable(tamsin({}), [])])).toEqual([]);
    });

    it("pulls into a place its row uses or its Traversable lists", () => {
      expect(pullWith(named, [withFirstTraversable(tamsin({}, wander(from, 'l1')), [])])).toEqual(['Tamsin Reed']);
      expect(pullWith(named, [withFirstTraversable(tamsin({}), ['l1'])])).toEqual(['Tamsin Reed']);
    });

    it('never pulls a character on a Strict row', () => {
      const strict: EntityStart['schedule'] = [{ id: 'shift', time: 'allDay', strict: true, action: { kind: 'stay', place: from } }];
      expect(pullWith(named, [tamsin({}, strict)])).toEqual([]);
    });

    const following = (book: PositionBook, w: PositionWorld) => startFollowing(book, w.uniques.get('e3')!, w.scene);

    it('never pulls a follower', () => {
      expect(pullWith(named, [tamsin({})], { before: following })).toEqual([]);
    });

    it('never pulls a character waiting where a follow left them', () => {
      const waiting = (book: PositionBook, w: PositionWorld) => startWaiting(following(book, w), 'e3', 'thisDaypart', NOON);
      expect(pullWith(named, [tamsin({})], { before: waiting })).toEqual([]);
    });
  });

  describe('a migrated one-place character that was Free (the window case)', () => {
    // Seen through the window: the prose names them in full, from the shed next door.
    const seen = 'Through the window, Tamsin Reed mends a net in the shed.';
    const migrated = migrateEntityRoutine({ ...ent('e3', 'Tamsin Reed'), locations: ['l2'], movement: 'free' } as Entity);

    it('is not pulled, since the player’s place is not allowed for them', () => {
      expect(pullWith(seen, [migrated])).toEqual([]);
    });

    it('is pulled once the author adds the place to Traversable', () => {
      expect(pullWith(seen, [withFirstTraversable(migrated, ['l1'])])).toEqual(['Tamsin Reed']);
      expect(pullWith(seen, [withFirstTraversable(migrated, 'anywhere')])).toEqual(['Tamsin Reed']);
    });
  });

  describe('going back', () => {
    const named = 'Tamsin Reed comes over to the jetty.';
    /** Where Tamsin stands once the player has left for the Ferry Dock, `minutes` after the pull. */
    const afterLeaving = (cast: Entity[], minutes: number) => {
      const { after, world: w } = pull(named, cast);
      expect(after.positions.e3).toBe('l1');
      const later = { ...w, scene: { ...w.scene, now: NOON + minutes, playerAt: 'l5' } };
      return placeAll(after, later).positions.e3;
    };

    it('goes back from a Stay row once the player leaves', () => {
      const stay: EntityStart['schedule'] = [{ id: 'mend', time: 'allDay', action: { kind: 'stay', place: 'l2' } }];
      expect(afterLeaving([unique(ent('e3', 'Tamsin Reed'), 'l2', {}, stay)], 1)).toBe('l2');
    });

    it('goes back from a Wander row only when its idle runs out', () => {
      const wander: EntityStart['schedule'] = [{ id: 'w', time: 'allDay', action: { kind: 'wander', places: [{ place: 'l2', weight: 1 }], idle: 120 } }];
      const tamsin = unique(ent('e3', 'Tamsin Reed'), 'l2', {}, wander);
      expect(afterLeaving([tamsin], 60)).toBe('l1');
      expect(afterLeaving([tamsin], 121)).toBe('l2');
    });

    it('goes back from a Patrol row only when its idle runs out', () => {
      const patrol: EntityStart['schedule'] = [{ id: 'p', time: 'allDay', action: { kind: 'patrol', stops: [{ place: 'l2', idle: 120 }] } }];
      const tamsin = unique(ent('e3', 'Tamsin Reed'), 'l2', {}, patrol);
      expect(afterLeaving([tamsin], 60)).toBe('l1');
      expect(afterLeaving([tamsin], 121)).toBe('l2');
    });
  });

  describe('where it stands in play', () => {
    const tamsin = unique(ent('e3', 'Tamsin Reed'), 'l3');
    const named = 'Tamsin Reed climbs up to the jetty.';

    it('reads its position over its listed locations', () => {
      expect(pullWith(named, [tamsin], { positions: { e3: 'l4' } })).toEqual([]);
    });

    it("never pulls someone whose position is already the player's place", () => {
      expect(pullWith(named, [tamsin], { positions: { e3: 'l1' } })).toEqual([]);
    });
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

describe('readEditedNarration', () => {
  const edited = (narration: string, over: Partial<Parameters<typeof readEditedNarration>[0]> = {}) =>
    readEditedNarration({ narration, priorNarration: '', entities: [MAREN, SERANA], exclusions: {}, previousScene: [], ...over });

  it('drops a name the edit removed and adds a known name it introduced', () => {
    expect(edited('Maren Vosk hauls the net aboard.').participants).toEqual(['Maren Vosk']);
    expect(edited('Professor Serana watches the harbor.').participants).toEqual(['Professor Serana']);
  });

  it('reads a name the edit introduced that no entity matches yet', () => {
    expect(edited('Captain Halric Dune ties off the line.').participants).toContain('Captain Halric Dune');
  });

  it('leaves out a known name that only the dialogue speaks', () => {
    const { participants } = edited('The deckhand mutters, "for Professor Serana\'s review, then."');
    expect(participants).not.toContain('Professor Serana');
  });

  it('leaves out a suppressed name', () => {
    const { participants } = edited('Captain Halric Dune ties off the line.', { exclusions: { suppressed: ['Captain Halric Dune'] } });
    expect(participants).not.toContain('Captain Halric Dune');
  });

  describe('scene list', () => {
    // Planner-cast members with no entity record, so only the previous list can keep them.
    const TAMSIN = { name: 'Old Tamsin', revealed: true };
    const ILSE = { name: 'Ilse Dorn', alias: 'the silver-haired woman', revealed: false };
    const scene = (narration: string, previousScene = [TAMSIN, ILSE], priorNarration = '') =>
      edited(narration, { previousScene, priorNarration }).visibleEntities;

    it('keeps a cast member the edit still names, by name and by alias', () => {
      expect(scene('Tamsin mends the sail.')).toContainEqual(TAMSIN);
      expect(scene('The silver-haired woman watches the harbor.')).toContainEqual(ILSE);
    });

    it('drops a cast member the edit no longer names', () => {
      const names = scene('The harbor lies empty.').map((se) => se.name);
      expect(names).not.toContain('Old Tamsin');
      expect(names).not.toContain('Ilse Dorn');
    });

    it('drops a cast member the edit names only inside dialogue', () => {
      expect(scene('The deckhand mutters, "Tamsin is late again."').map((se) => se.name)).not.toContain('Old Tamsin');
    });

    it('keeps an unrevealed member unrevealed until the edit writes the real name', () => {
      expect(scene('The silver-haired woman nods.')).toContainEqual(ILSE);
      expect(scene('Ilse Dorn, the silver-haired woman, nods.')).toContainEqual({ ...ILSE, revealed: true });
    });

    it('never un-reveals a member the edit names by alias only', () => {
      const known = { ...ILSE, revealed: true };
      expect(scene('The silver-haired woman nods.', [known])).toContainEqual(known);
    });

    it('adds a known entity the prose names, revealed', () => {
      expect(scene('Professor Serana watches the harbor.')).toContainEqual({ name: 'Professor Serana', revealed: true });
    });

    it('adds a name no entity matches yet, revealed', () => {
      expect(scene('Captain Halric Dune ties off the line.', [])).toContainEqual({ name: 'Captain Halric Dune', revealed: true });
    });

    it('leaves out a known name only the dialogue speaks', () => {
      const names = scene('The deckhand mutters, "for Professor Serana\'s review, then."', []).map((se) => se.name);
      expect(names).not.toContain('Professor Serana');
    });
  });
});
