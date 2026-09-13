import { describe, expect, it } from 'vitest';
import {
  allReferencesAnswered, CREATE_NEW, planConnections, rankCandidates, unresolvedReferences,
  type ReferenceCandidate,
} from '@/lib/worldReferences';
import type { Dictionary, Entity, GameLocation, Placeholder } from '@/types';

const ph = (id: string, name: string, values: string[]): Placeholder => ({
  id, name, values: values.map((text, index) => ({ id: `${id}-v${index}`, text })),
});

const candidate = (id: string, name: string, values: string[] = []): ReferenceCandidate => ({ id, name, values });

const loc = (id: string, name: string): GameLocation => ({ id, name });

/** A library dictionary whose one entry uses a shared placeholder the world may or may not have. */
const bookExpecting = (shared: Placeholder[]): Dictionary => ({
  id: 'src-book',
  name: 'Court Terms',
  enabled: true,
  entries: [{ id: 'e1', name: 'Throne', key: ['throne'], value: 'The seat of power.' }],
  sharedPlaceholders: shared,
});

describe('rankCandidates', () => {
  it('suggests the one candidate sharing the name and lists it first', () => {
    const ranked = rankCandidates('Capital', [
      candidate('a', 'Weather'),
      candidate('b', 'Capital'),
      candidate('c', 'Royal Seat'),
    ]);
    expect(ranked.suggested).toBe('b');
    expect(ranked.ambiguous).toBe(false);
    expect(ranked.candidates.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });

  it('matches a name across case and surrounding space', () => {
    expect(rankCandidates(' capital ', [candidate('b', 'Capital')]).suggested).toBe('b');
  });

  it('suggests nothing and reports the tie when two candidates share the name', () => {
    const ranked = rankCandidates('Capital', [
      candidate('a', 'Weather'),
      candidate('b', 'Capital'),
      candidate('c', 'Capital'),
    ]);
    expect(ranked.suggested).toBeNull();
    expect(ranked.ambiguous).toBe(true);
    // The tied candidates lead, so the author chooses between them without hunting the list.
    expect(ranked.candidates.map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('suggests nothing when no candidate shares the name', () => {
    const ranked = rankCandidates('Capital', [candidate('a', 'Weather')]);
    expect(ranked.suggested).toBeNull();
    expect(ranked.ambiguous).toBe(false);
    expect(ranked.candidates.map((c) => c.id)).toEqual(['a']);
  });
});

describe('unresolvedReferences', () => {
  it('asks about nothing when the world already holds the placeholder the content expects', () => {
    const shared = ph('src-cap', 'Capital', ['Aldreth']);
    const world = { placeholders: [{ ...shared, id: 'world-cap' }], locations: [] };
    expect(unresolvedReferences(bookExpecting([shared]), world)).toEqual([]);
  });

  it('raises one row with the single clear match preselected and the world values previewed', () => {
    const shared = ph('src-cap', 'Capital', ['Aldreth']);
    const world = { placeholders: [ph('world-cap', 'Capital', ['Sedge'])], locations: [] };

    const rows = unresolvedReferences(bookExpecting([shared]), world);

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('placeholder');
    expect(rows[0].key).toBe('src-cap');
    expect(rows[0].name).toBe('Capital');
    expect(rows[0].expects).toEqual(['Aldreth']);
    expect(rows[0].suggested).toBe('world-cap');
    expect(rows[0].candidates.find((c) => c.id === 'world-cap')?.values).toEqual(['Sedge']);
  });

  it('preselects nothing when two world placeholders carry the reference name', () => {
    const shared = ph('src-cap', 'Capital', ['Aldreth']);
    const world = {
      placeholders: [ph('w1', 'Capital', ['Sedge']), ph('w2', 'Capital', ['Harrow'])],
      locations: [],
    };

    const [row] = unresolvedReferences(bookExpecting([shared]), world);

    expect(row.suggested).toBeNull();
    expect(row.ambiguous).toBe(true);
    expect(allReferencesAnswered([row], {})).toBe(false);
    expect(allReferencesAnswered([row], { 'src-cap': 'w2' })).toBe(true);
  });

  it('skips a reference the stored connections already settle', () => {
    const shared = ph('src-cap', 'Capital', ['Aldreth']);
    const world = { placeholders: [ph('world-cap', 'Capital', ['Sedge'])], locations: [] };
    const stored = { 'src-cap': 'world-cap' };
    expect(unresolvedReferences(bookExpecting([shared]), world, stored)).toEqual([]);
  });

  it('asks again once the connected world placeholder is gone', () => {
    const shared = ph('src-cap', 'Capital', ['Aldreth']);
    const world = { placeholders: [ph('other', 'Weather', ['Rain'])], locations: [] };
    const stored = { 'src-cap': 'deleted-placeholder' };
    expect(unresolvedReferences(bookExpecting([shared]), world, stored).map((r) => r.key)).toEqual(['src-cap']);
  });

  it('asks again even where another world placeholder would match the reference exactly', () => {
    const shared = ph('src-cap', 'Capital', ['Aldreth']);
    // A perfect match by name and values, which the adopt pass would take without a word. The author
    // answered this reference once, so a different placeholder replacing it is theirs to confirm.
    const world = { placeholders: [{ ...shared, id: 'w-twin' }], locations: [] };
    const stored = { 'src-cap': 'deleted-placeholder' };

    const rows = unresolvedReferences(bookExpecting([shared]), world, stored);

    expect(rows.map((r) => r.key)).toEqual(['src-cap']);
    expect(rows[0].suggested).toBe('w-twin');
  });

  it('raises a location row offering the world locations', () => {
    const entity: Entity = {
      id: 'src-entity',
      name: 'Marla',
      locationRefs: [{ id: 'src-inn', name: 'The Inn' }],
    };
    const world = { placeholders: [], locations: [loc('w-inn', 'The Inn'), loc('w-road', 'The Road')] };

    const [row] = unresolvedReferences(entity, world);

    expect(row.kind).toBe('location');
    expect(row.key).toBe('src-inn');
    expect(row.suggested).toBe('w-inn');
    expect(row.candidates.map((c) => c.id)).toEqual(['w-inn', 'w-road']);
  });

  it('leaves a location reference the world already holds by id alone', () => {
    const entity: Entity = { id: 'e', name: 'Marla', locationRefs: [{ id: 'w-inn', name: 'The Inn' }] };
    const world = { placeholders: [], locations: [loc('w-inn', 'The Inn')] };
    expect(unresolvedReferences(entity, world)).toEqual([]);
  });
});

describe('planConnections', () => {
  it('records a chosen placeholder and leaves Create New for the adopt pass to mint', () => {
    const shared = [ph('src-cap', 'Capital', ['Aldreth']), ph('src-w', 'Weather', ['Rain'])];
    const world = { placeholders: [ph('world-cap', 'Capital', ['Sedge'])], locations: [] };
    const rows = unresolvedReferences(bookExpecting(shared), world);

    const plan = planConnections(rows, { 'src-cap': 'world-cap', 'src-w': CREATE_NEW });

    expect(plan.placeholders).toEqual({ 'src-cap': 'world-cap' });
    expect(plan.newLocations).toEqual([]);
  });

  it('mints a location for Create New and connects the reference to it', () => {
    const entity: Entity = { id: 'e', name: 'Marla', locationRefs: [{ id: 'src-inn', name: 'The Inn' }] };
    const world = { placeholders: [], locations: [loc('w-road', 'The Road')] };
    const rows = unresolvedReferences(entity, world);

    const plan = planConnections(rows, { 'src-inn': CREATE_NEW });

    expect(plan.newLocations).toHaveLength(1);
    expect(plan.newLocations[0].name).toBe('The Inn');
    expect(plan.locations['src-inn']).toBe(plan.newLocations[0].id);
  });

  it('connects a location reference to the location the author picked', () => {
    const entity: Entity = { id: 'e', name: 'Marla', locationRefs: [{ id: 'src-inn', name: 'The Inn' }] };
    const world = { placeholders: [], locations: [loc('w-road', 'The Road')] };
    const rows = unresolvedReferences(entity, world);

    expect(planConnections(rows, { 'src-inn': 'w-road' })).toMatchObject({
      locations: { 'src-inn': 'w-road' },
      newLocations: [],
    });
  });
});
