import { describe, it, expect } from 'vitest';
import { worldPublishPayload, entityPublishPayload, dictionaryPublishPayload } from './publishPayload';
import type { World, Entity, Dictionary } from '@/types';

const world = (over = {}) => ({ worldOverview: { name: 'Sedge Landing', description: 'A marsh', thumbnail: 'data:1', ...over } } as unknown as World);
const entity = (over = {}) => ({ id: 'e1', name: 'Mara', ...over } as Entity);
const book = (over = {}) => ({ id: 'd1', name: 'Lore', entries: [], ...over } as Dictionary);

describe('worldPublishPayload', () => {
  it('publishes the overview fields', () => {
    expect(worldPublishPayload(world())).toMatchObject({
      kind: 'world', name: 'Sedge Landing', description: 'A marsh', thumbnail: 'data:1',
    });
  });

  it('defaults tags into the content, since the server reads a listing’s tags from there', () => {
    const payload = worldPublishPayload(world());
    expect((payload.contentData as World).worldOverview.tags).toEqual([]);
  });

  it('keeps authored tags', () => {
    const payload = worldPublishPayload(world({ tags: ['grim', 'wet'] }));
    expect((payload.contentData as World).worldOverview.tags).toEqual(['grim', 'wet']);
  });

  it('does not mutate the caller’s world — it is the live library copy', () => {
    const w = world();
    worldPublishPayload(w);
    expect(w.worldOverview.tags).toBeUndefined();
  });

  it('names an untitled world rather than publishing a blank', () => {
    expect(worldPublishPayload(world({ name: '' })).name).toBe('Untitled World');
  });
});

describe('entityPublishPayload', () => {
  it('uses the player-facing description — what a human browsing wants to read', () => {
    const payload = entityPublishPayload(entity({
      playerDescription: 'A knight', aiSummary: 'knight, weary', aiDescription: 'You are a knight who…',
    }));
    expect(payload).toMatchObject({ kind: 'entity', name: 'Mara', description: 'A knight' });
  });

  it('falls back to the short AI summary when there is no player description', () => {
    expect(entityPublishPayload(entity({ aiSummary: 'knight, weary' })).description).toBe('knight, weary');
  });

  it('never publishes aiDescription — it is long and full of prompt scaffolding', () => {
    const payload = entityPublishPayload(entity({ aiDescription: 'You are a knight who…' }));
    expect(payload.description).toBe('');
  });

  it('sends the portrait when there is one', () => {
    expect(entityPublishPayload(entity({ image: 'data:portrait' })).thumbnail).toBe('data:portrait');
  });

  it('omits the thumbnail when there is no portrait, so the server supplies stand-in art', () => {
    expect(entityPublishPayload(entity()).thumbnail).toBeUndefined();
  });

  it('publishes the character itself as the content', () => {
    const e = entity({ image: 'data:portrait' });
    expect(entityPublishPayload(e).contentData).toBe(e);
  });
});

describe('dictionaryPublishPayload', () => {
  it('publishes the book with its note', () => {
    expect(dictionaryPublishPayload(book({ description: 'Marsh lore' }))).toMatchObject({
      kind: 'dictionary', name: 'Lore', description: 'Marsh lore',
    });
  });

  it('sends an empty description when the book has no note', () => {
    expect(dictionaryPublishPayload(book()).description).toBe('');
  });

  it('never sends a thumbnail — a dictionary has no art', () => {
    expect(dictionaryPublishPayload(book()).thumbnail).toBeUndefined();
  });

  it('publishes the book itself as the content', () => {
    const b = book();
    expect(dictionaryPublishPayload(b).contentData).toBe(b);
  });
});
