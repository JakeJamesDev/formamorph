import { describe, it, expect } from 'vitest';
import { worldPublishPayload, entityPublishPayload, dictionaryPublishPayload } from './publishPayload';
import type { World, Entity, Dictionary, Placeholder } from '@/types';
import { encodePlaceholderToken } from './placeholders';

const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: 'p1' });
const def = (id: string, values: string[]): Placeholder => ({ id, name: id, values });

const world = (over = {}, rest = {}) => ({ worldOverview: { name: 'Sedge Landing', description: 'A marsh', thumbnail: 'data:1', ...over }, ...rest } as unknown as World);
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

  it('renders placeholder chips in the blurb — a listing carries no defs to resolve them later', () => {
    const payload = worldPublishPayload(
      world({ description: `A ${chip('weather')} marsh` }, { placeholders: [def('weather', ['wet', 'frozen'])] }),
    );
    expect(payload.description).toBe('A {wet|frozen} marsh');
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

  it('renders carried placeholder chips instead of publishing a raw token id', () => {
    const payload = entityPublishPayload(entity({
      playerDescription: `A knight with ${chip('eyes')} eyes`,
      placeholders: [def('eyes', ['gray'])],
    }));
    expect(payload.description).toBe('A knight with gray eyes');
  });

  it('renders chips in the aiSummary fallback too', () => {
    const payload = entityPublishPayload(entity({
      aiSummary: `knight, ${chip('mood')}`,
      placeholders: [def('mood', ['weary', 'grim'])],
    }));
    expect(payload.description).toBe('knight, {weary|grim}');
  });

  it('leaves contentData verbatim so the downloaded character keeps real chips', () => {
    const raw = `A knight with ${chip('eyes')} eyes`;
    const e = entity({ playerDescription: raw, placeholders: [def('eyes', ['gray'])] });
    expect((entityPublishPayload(e).contentData as Entity).playerDescription).toBe(raw);
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

  it('renders carried placeholder chips in the note', () => {
    const payload = dictionaryPublishPayload(book({
      description: `Lore of the ${chip('era')}`,
      placeholders: [def('era', ['First Age', 'Long Thaw'])],
    }));
    expect(payload.description).toBe('Lore of the {First Age|Long Thaw}');
  });

  it('never sends a thumbnail — a dictionary has no art', () => {
    expect(dictionaryPublishPayload(book()).thumbnail).toBeUndefined();
  });

  it('publishes the book itself as the content', () => {
    const b = book();
    expect(dictionaryPublishPayload(b).contentData).toBe(b);
  });
});
