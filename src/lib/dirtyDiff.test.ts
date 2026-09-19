import { describe, it, expect } from 'vitest';
import { dirtyDiff } from './dirtyDiff';

describe('dirtyDiff', () => {
  it('names the deepest differing path and both values', () => {
    const saved = { worldOverview: { name: 'Fen', openings: [{ id: 'a', text: 'Hi' }] }, stats: [] };
    const live = { worldOverview: { name: 'Fen', openings: [{ id: 'b', text: 'Hi' }] }, stats: [] };
    expect(dirtyDiff(saved, live)).toEqual([
      { path: 'worldOverview.openings[0].id', saved: '"a"', live: '"b"' },
    ]);
  });

  it('reports nothing for differences the dirty check ignores', () => {
    const saved = { entities: [{ id: 'e', name: 'Wick' }] };
    const live = { entities: [{ name: 'Wick', aliases: [], note: '', id: 'e', gone: undefined }], traits: [] };
    expect(dirtyDiff(saved, live)).toEqual([]);
  });

  it('reports a key present on one side only', () => {
    expect(dirtyDiff({ a: { x: 1 } }, { a: { x: 1, y: false } })).toEqual([
      { path: 'a.y', saved: undefined, live: 'false' },
    ]);
  });

  it('catches a value that a JSON round trip changes', () => {
    const live = { stats: [{ id: 's', max: NaN }] };
    expect(dirtyDiff(JSON.parse(JSON.stringify(live)), live)).toEqual([
      { path: 'stats[0].max', saved: undefined, live: 'null' },
    ]);
  });

  it('stops where the container kinds differ, and shortens long values', () => {
    const diff = dirtyDiff({ thumb: { 0: 'x'.repeat(500) } }, { thumb: ['y'] });
    expect(diff).toHaveLength(1);
    expect(diff[0].path).toBe('thumb');
    expect(diff[0].saved).toMatch(/…\(508\)$/);
    expect(diff[0].live).toBe('["y"]');
  });

  it('reports nothing for two equal worlds', () => {
    expect(dirtyDiff({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toEqual([]);
  });
});
