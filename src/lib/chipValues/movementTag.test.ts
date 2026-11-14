import { describe, expect, it } from 'vitest';
import { castCourses } from '../entityKind';
import { splitToken } from '../promptVariables';
import { chipValues, sceneEntityChipValues } from './chipValues';
import { liveChipScene, type LiveSceneSources } from './liveScene';
import type { ChipScene } from './chipScene';
import type { Connection, Entity, FollowState, GameLocation, UniqueStates } from '@/types';
import { startsOf, withFirstStarts } from '@/lib/entityKind';
import { oneRoutine } from '@/test/routines';

// The inn, the smithy one Nearby link away, and the ridge one Far link away.
const inn: GameLocation = { id: 'inn', name: 'Inn', aiDescription: 'A low room.' };
const smithy: GameLocation = { id: 'smithy', name: 'Smithy', aiDescription: 'A hot forge.' };
const ridge: GameLocation = { id: 'ridge', name: 'Ridge', aiDescription: 'A cold height.' };
const connections: Connection[] = [
  { id: 'lane', a: 'inn', b: 'smithy', aToB: {}, bToA: {} },
  { id: 'climb', a: 'inn', b: 'ridge', aToB: {}, bToA: {}, distance: 'far' },
];

/** A Unique entity at `place` whose one All-day row stays there, Strict or not. */
const unique = (id: string, place: string, strict: boolean): Entity => ({
  id, name: id[0].toUpperCase() + id.slice(1), kind: 'unique', locations: [place], aiSummary: `The ${id}.`,
  routines: oneRoutine([{ id: 's1', place, weight: 1, schedule: [{ id: 'r1', time: 'allDay', action: { kind: 'stay', place }, ...(strict && { strict }) }] }]),
});

const clerk = unique('clerk', 'inn', true);
const companion = unique('companion', 'inn', false);
const guard = unique('guard', 'inn', true);
const waiter = unique('waiter', 'inn', false);
const idler = unique('idler', 'inn', false);
const crowd: Entity = { id: 'crowd', name: 'Crowd', locations: ['inn'], aiSummary: 'Drinkers.' };
const smith = unique('smith', 'smithy', true);
const helper = unique('helper', 'smithy', false);
const hermit = unique('hermit', 'ridge', true);
const cast = [clerk, companion, guard, waiter, idler, crowd, smith, helper, hermit];

const state = (follow?: FollowState) => ({ startId: 's1', lastRun: 0, ...(follow && { follow }) });
const uniques: UniqueStates = {
  clerk: state(),
  companion: state({ mode: 'following' }),
  guard: state({ mode: 'following' }),
  waiter: state({ mode: 'waiting', until: 600 }),
  idler: state(),
  smith: state(),
  helper: state({ mode: 'waiting', until: 600 }),
  hermit: state(),
};

const sources = (over: Partial<LiveSceneSources> = {}): LiveSceneSources => ({
  overview: '', stats: [], statPlacement: { groups: [], authored: [] }, traits: [], traitGroups: [],
  // Each Unique entity stands at its Start, as the engine places it.
  standings: { positions: Object.fromEntries(cast.flatMap((e) => (e.kind ? [[e.id, startsOf(e)[0].place]] : []))), generics: {} },
  resolve: (text) => text, resolveTrait: (_t, text) => text, resolveEntity: (_e, text) => text,
  persona: null, location: inn, locations: [inn, smithy, ridge], connections,
  entities: cast, allEntities: cast, participants: ['Clerk', 'Companion'], notes: '', time: null, placeholders: [],
  movement: { routines: castCourses(cast), uniques, now: 480 },
  ...over,
});

/** The scene's values, read as a prompt reads them. */
const lookup = (scene: ChipScene) => {
  const values = chipValues(scene);
  return (token: string) => values(splitToken(token)?.key ?? token) ?? '';
};

/** The movement line of `name`'s markdown block, or undefined when it has none. */
const tagOf = (block: string, name: string) => {
  const entry = block.split(/(?=^- \*\*)/m).find((part) => part.startsWith(`- **${name}**`));
  return entry?.match(/- \*\*movement:\*\* (.*)/)?.[1];
};

describe('the Movement tag on the Entities chip', () => {
  const values = lookup(liveChipScene(sources()));

  it('tags each Unique entity at the player place: following, waiting, Strict; following wins over Strict', () => {
    const here = values('<ENTITIES|markdown>');
    expect(tagOf(here, 'Companion')).toBe('following the player');
    expect(tagOf(here, 'Guard')).toBe('following the player');
    expect(tagOf(here, 'Waiter')).toBe('waiting here');
    expect(tagOf(here, 'Clerk')).toBe('stays here');
  });

  it('leaves a Generic entity and a Unique entity with no state untagged', () => {
    const here = values('<ENTITIES|markdown>');
    expect(here).toContain('- **Crowd**');
    expect(tagOf(here, 'Crowd')).toBeUndefined();
    expect(here).toContain('- **Idler**');
    expect(tagOf(here, 'Idler')).toBeUndefined();
  });

  it('tags a Strict Unique entity one Nearby link away "stays there", and nothing else there', () => {
    const nearby = values('<ENTITIES|reachable.markdown>');
    expect(tagOf(nearby, 'Smith')).toBe('stays there');
    expect(nearby).toContain('- **Helper**');
    expect(tagOf(nearby, 'Helper')).toBeUndefined();
  });

  it('lets following win over Strict in a Nearby place too', () => {
    const scene = liveChipScene(sources({ movement: { routines: castCourses(cast), uniques: { ...uniques, smith: state({ mode: 'following' }) }, now: 480 } }));
    expect(tagOf(lookup(scene)('<ENTITIES|reachable.markdown>'), 'Smith')).toBeUndefined();
  });

  it('leaves a Strict Unique entity across a Far link out of every scope', () => {
    for (const scope of ['', 'sublocations', 'reachable', 'known', 'inscene']) {
      expect(values(`<ENTITIES|${[scope, 'markdown'].filter(Boolean).join('.')}>`)).not.toContain('Hermit');
    }
  });

  it('writes the tag as a field in every format, and in parentheses in the Name content', () => {
    expect(values('<ENTITIES|summary>')).toContain('Clerk\n  summary: The clerk.\n  movement: stays here\n');
    expect(values('<ENTITIES|xml>')).toContain('  <movement>following the player</movement>\n</entity>');
    expect(values('<ENTITIES|name>')).toBe(
      'Clerk (stays here), Companion (following the player), Guard (following the player), Waiter (waiting here), Idler, Crowd',
    );
    expect(values('<ENTITIES|inscene.name>')).toBe('Clerk (stays here), Companion (following the player)');
  });

  it('puts the tag after a stranger label in the Name content', () => {
    const labeled = lookup(liveChipScene(sources({ strangerLabels: { clerk: 'a woman at the desk', idler: 'a man by the fire' } })));
    expect(labeled('<ENTITIES|name>')).toContain('Clerk (a woman at the desk; stays here), ');
    expect(labeled('<ENTITIES|name>')).toContain('Idler (a man by the fire), ');
  });

  it('tags the scene roster the Choices prompt reads', () => {
    const scene = liveChipScene(sources());
    const choices = sceneEntityChipValues(scene, ['clerk', 'idler']);
    expect(choices(splitToken('<ENTITIES|summary.notraits.nostats.markdown>')!.key)).toBe(
      '- **Clerk**\n  - **summary:** The clerk.\n  - **movement:** stays here\n- **Idler**\n  - **summary:** The idler.\n',
    );
  });

  it('reads the turn box follow states over the live ones', () => {
    const scene = liveChipScene(sources(), null, { uniques: { ...uniques, idler: state({ mode: 'following' }), companion: state() } });
    const here = lookup(scene)('<ENTITIES|markdown>');
    expect(tagOf(here, 'Idler')).toBe('following the player');
    expect(tagOf(here, 'Companion')).toBeUndefined();
  });

  it('drops the tag when the row in force is not Strict', () => {
    const offShift: Entity = {
      ...withFirstStarts(clerk, [{ id: 's1', place: 'inn', weight: 1, schedule: [{ id: 'r1', time: { start: 540, end: 1020 }, strict: true, action: { kind: 'stay', place: 'inn' } }] }]),
    };
    const roster = [offShift, ...cast.slice(1)];
    const read = (now: number) => tagOf(lookup(liveChipScene(sources({
      entities: roster, allEntities: roster, movement: { routines: castCourses(roster), uniques, now },
    })))('<ENTITIES|markdown>'), 'Clerk');
    expect(read(600)).toBe('stays here');
    expect(read(480)).toBeUndefined();
  });

  describe('switched off', () => {
    const scopes = ['', 'sublocations', 'reachable', 'known', 'inscene'];
    const contents = ['', 'summary', 'name'];
    const formats = ['', 'markdown', 'xml'];
    const tokens = scopes.flatMap((scope) => contents.flatMap((content) => formats.map((format) => [scope, content, format].filter(Boolean))));
    const spell = (ids: string[]) => (ids.length ? `<ENTITIES|${ids.join('.')}>` : '<ENTITIES>');
    const untagged = lookup(liveChipScene(sources({ movement: undefined })));
    const strip = (text: string) => text
      .replace(/^ {2}(?:- \*\*movement:\*\* |movement: |<movement>).*\n/gm, '')
      .replace(/; (?:following the player|waiting here|stays here|stays there)\)/g, ')')
      .replace(/ \((?:following the player|waiting here|stays here|stays there)\)/g, '');

    it('renders every scope, content and format byte for byte as a scene with no movement', () => {
      for (const ids of tokens) expect(values(spell([...ids, 'nomovement']))).toBe(untagged(spell(ids)));
    });

    it('changes nothing but the tags', () => {
      let tagged = 0;
      for (const ids of tokens) {
        const on = values(spell(ids));
        if (on !== untagged(spell(ids))) tagged++;
        expect(strip(on)).toBe(values(spell([...ids, 'nomovement'])));
      }
      expect(tagged).toBeGreaterThan(20);
    });
  });
});
