import { describe, it, expect } from 'vitest';
import { entryVectorKey, selectSemanticLore, SEMANTIC_LORE_CAP, SEMANTIC_LORE_THRESHOLD } from '@/lib/semanticDictionary';
import type { DictionaryEntry, Placeholder } from '@/types';
import { describeSemantic, semanticIndexKeys, traceSemantic } from './semantic';

import { phValues } from '@/test/placeholderValues';
/** A vector key is a hash of the entry's own text, so two fixtures that read alike really do share one
 *  cache slot — every entry here gets its own body so the index can tell them apart. */
const entry = (over: Partial<DictionaryEntry> & { id: string }): DictionaryEntry => ({
  name: '', key: [], value: `lore about ${over.id}`, ...over,
});

/** A unit vector in the plane — the dot product of two of these is exactly the cosine between them, and
 *  the worker's vectors arrive L2-normalized, so this is the same arithmetic play does. */
const at = (radians: number) => new Float32Array([Math.cos(radians), Math.sin(radians)]);

/** The query every fixture scores against. */
const query = at(0);

/** A vector whose similarity to `query` is `score`. */
const scoring = (score: number) => at(Math.acos(score));

/** The index as the cache hands it over: entry vector keys to vectors. */
const index = (pairs: Array<[DictionaryEntry, number]>) =>
  new Map(pairs.map(([e, score]) => [entryVectorKey(e), scoring(score)]));

/** A single-valued Variable, which resolves to real text an author can be scored against. */
const harbor = [{ id: 'p1', name: 'Harbor', type: 'variable', values: phValues(['Sedge Landing']) }] as unknown as Placeholder[];
const CHIP = '{{ph:p1:world:x}}';

describe('traceSemantic', () => {
  it('scores every eligible entry against the threshold it is judged by', () => {
    const near = entry({ id: 'd1', name: 'Beacon' });
    const far = entry({ id: 'd2', name: 'Tides' });
    const trace = traceSemantic([near, far], [], { queryVec: query, vectors: index([[near, 0.6], [far, 0.1]]) });

    expect(trace.threshold).toBe(SEMANTIC_LORE_THRESHOLD);
    expect(trace.cap).toBe(SEMANTIC_LORE_CAP);
    expect(trace.states.get('d1')?.score).toBeCloseTo(0.6, 4);
    expect(trace.states.get('d2')?.score).toBeCloseTo(0.1, 4);
    expect(trace.eligible).toBe(2);
    expect(trace.indexed).toBe(2);
  });

  it('activates what clears the threshold and leaves what does not below it', () => {
    const over = entry({ id: 'd1' });
    const under = entry({ id: 'd2' });
    const trace = traceSemantic([over, under], [], {
      queryVec: query,
      vectors: index([[over, 0.5], [under, 0.3]]),
      threshold: 0.4,
    });

    expect(trace.states.get('d1')?.state).toBe('activates');
    expect(trace.states.get('d2')?.state).toBe('below');
    expect([...trace.activations.keys()]).toEqual(['d1']);
  });

  it('marks an entry that clears the threshold but misses the cap', () => {
    const entries = [0.9, 0.8, 0.7, 0.6].map((score, i) => ({ entry: entry({ id: `d${i}` }), score }));
    const trace = traceSemantic(entries.map((e) => e.entry), [], {
      queryVec: query,
      vectors: index(entries.map(({ entry: e, score }) => [e, score])),
      threshold: 0.4,
      cap: 3,
    });

    expect(entries.slice(0, 3).map(({ entry: e }) => trace.states.get(e.id)?.state))
      .toEqual(['activates', 'activates', 'activates']);
    // The score alone would say this one fires; only the cap explains why it doesn't.
    expect(trace.states.get('d3')?.state).toBe('capped');
    expect(trace.states.get('d3')?.score).toBeCloseTo(0.6, 4);
  });

  it('reports an entry with no cached vector as unindexed rather than scoring it', () => {
    const indexed = entry({ id: 'd1' });
    const missing = entry({ id: 'd2' });
    const trace = traceSemantic([indexed, missing], [], { queryVec: query, vectors: index([[indexed, 0.6]]) });

    expect(trace.states.get('d2')).toEqual({ state: 'unindexed' });
    expect(trace.indexed).toBe(1);
    expect(trace.eligible).toBe(2);
  });

  it('never scores an entry the semantic pass skips', () => {
    const constant = entry({ id: 'd1', constant: true });
    const off = entry({ id: 'd2', enabled: false });
    const trace = traceSemantic([constant, off], [], {
      queryVec: query,
      vectors: index([[constant, 0.9], [off, 0.9]]),
    });

    expect(trace.states.has('d1')).toBe(false);
    expect(trace.states.has('d2')).toBe(false);
    expect(trace.eligible).toBe(0);
  });

  it('scores a chipped entry against the vector play really cached for it', () => {
    // The drainer embeds the resolved dictionary, so an index built from the authored text would name a
    // vector that isn't there and the entry would read as unindexed forever.
    const chipped = entry({ id: 'd1', name: `${CHIP} Tides`, key: [`${CHIP} tide`] });
    const asPlayed = { ...chipped, name: 'Sedge Landing Tides', key: ['Sedge Landing tide'] };
    const trace = traceSemantic([chipped], harbor, {
      queryVec: query,
      vectors: index([[asPlayed, 0.6]]),
      threshold: 0.4,
    });

    expect(trace.states.get('d1')?.state).toBe('activates');
    expect(trace.indexed).toBe(1);
  });

  it('agrees with the selector the game runs — the activations are its output, not a second opinion', () => {
    const entries = [0.9, 0.8, 0.7, 0.6, 0.2].map((score, i) => ({ entry: entry({ id: `d${i}` }), score }));
    const vectors = index(entries.map(({ entry: e, score }) => [e, score]));
    const list = entries.map(({ entry: e }) => e);
    const trace = traceSemantic(list, [], { queryVec: query, vectors });

    expect([...trace.activations.keys()])
      .toEqual([...selectSemanticLore(list, query, vectors).keys()]);
  });
});

describe('semanticIndexKeys', () => {
  it('names the vector of every entry the pass could score, and nothing else', () => {
    const scored = entry({ id: 'd1', key: ['tide'] });
    const constant = entry({ id: 'd2', constant: true });
    const off = entry({ id: 'd3', enabled: false });

    expect(semanticIndexKeys([scored, constant, off], [])).toEqual([entryVectorKey(scored)]);
  });

  it('names the key play cached, resolving the chips in a name and its keywords first', () => {
    const chipped = entry({ id: 'd1', name: `${CHIP} Tides`, key: [`${CHIP} tide`] });
    // What the drainer embedded: the resolved dictionary, whose value it leaves alone.
    const asPlayed = { ...chipped, name: 'Sedge Landing Tides', key: ['Sedge Landing tide'] };

    expect(semanticIndexKeys([chipped], harbor)).toEqual([entryVectorKey(asPlayed)]);
  });
});

describe('describeSemantic', () => {
  it('states a firing as its score against the threshold, never as a bare yes', () => {
    const line = describeSemantic({ state: 'activates', score: 0.4231 }, 0.39, 3);
    expect(line).toContain('0.42');
    expect(line).toContain('0.39');
  });

  it('states a below-threshold score too, so a miss is a number and not a silence', () => {
    const line = describeSemantic({ state: 'below', score: 0.2 }, 0.39, 3);
    expect(line).toContain('0.20');
    expect(line).toContain('0.39');
  });

  it('says the cap is what stopped a score that cleared the threshold', () => {
    const line = describeSemantic({ state: 'capped', score: 0.41 }, 0.39, 3);
    expect(line).toContain('0.41');
    expect(line).toMatch(/closest 3/);
  });

  it('says an unembedded entry cannot fire on meaning, with no score to show', () => {
    expect(describeSemantic({ state: 'unindexed' }, 0.39, 3)).toMatch(/not embedded/i);
  });
});
