import { describe, it, expect } from 'vitest';
import { worldPublishPayload, entityPublishPayload, dictionaryPublishPayload, publishTags } from './publishPayload';
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

  it('sends no thumbnail when the book has no cover', () => {
    expect(dictionaryPublishPayload(book()).thumbnail).toBeUndefined();
  });

  it('sends the cover when it has one', () => {
    expect(dictionaryPublishPayload(book({ thumbnail: 'data:image/webp;base64,AAAA' })).thumbnail)
      .toBe('data:image/webp;base64,AAAA');
  });

  it('publishes the book itself as the content', () => {
    const b = book();
    expect(dictionaryPublishPayload(b).contentData).toBe(b);
  });
});

/**
 * Tags on a listing, whatever kind it is.
 *
 * A world keeps them inside `worldOverview`, where the server already looks. A character and a book have
 * nowhere in their own shape to put them, so the payload carries them itself — and `publishTags` reads
 * that rather than digging through the content.
 */
describe('the tags a listing publishes with', () => {
  it('carries a world’s', () => {
    const payload = worldPublishPayload(world({ tags: ['gothic', 'marsh'] }));

    expect(payload.tags).toEqual(['gothic', 'marsh']);
    expect(publishTags(payload)).toEqual(['gothic', 'marsh']);
  });

  it('carries a character’s', () => {
    const payload = entityPublishPayload(entity({ tags: ['npc', 'guide'] }));

    expect(payload.tags).toEqual(['npc', 'guide']);
    expect(publishTags(payload)).toEqual(['npc', 'guide']);
  });

  it('carries a book’s', () => {
    const payload = dictionaryPublishPayload(book({ tags: ['lore'] }));

    expect(payload.tags).toEqual(['lore']);
    expect(publishTags(payload)).toEqual(['lore']);
  });

  it('is empty for anything untagged', () => {
    expect(publishTags(entityPublishPayload(entity()))).toEqual([]);
    expect(publishTags(dictionaryPublishPayload(book()))).toEqual([]);
  });

  it('never confuses a character’s image tags for listing tags', () => {
    // `imageTags` is a comma-separated booru string for the image generator; these are what the catalog
    // filters on. Publishing one as the other would tag every character with its own portrait's prompt.
    const payload = entityPublishPayload(entity({ imageTags: 'woman, cloak, reeds' }));

    expect(publishTags(payload)).toEqual([]);
  });

  it('still finds a world’s tags in the content when the payload omits them', () => {
    // A payload built by older code has no `tags` of its own; the world keeps a copy where the server
    // has always read it, so it must not come back untagged.
    const payload = worldPublishPayload(world({ tags: ['gothic'] }));
    delete payload.tags;

    expect(publishTags(payload)).toEqual(['gothic']);
  });

  it('drops anything in the list that is not a string', () => {
    const payload = entityPublishPayload(entity({ tags: ['npc', 7, null] as unknown as string[] }));

    expect(publishTags(payload)).toEqual(['npc']);
  });
});

// The whole reason an author can link an image instead of uploading it: a published world must carry the
// link, never the bytes. If anything ever resolves an image before publishing, these fail.
describe('linked images survive publishing', () => {
  it('publishes a world’s linked thumbnail as the link itself', () => {
    const payload = worldPublishPayload(world({ thumbnail: 'https://files.example/cover.png' }));

    expect(payload.thumbnail).toBe('https://files.example/cover.png');
    expect((payload.contentData as World).worldOverview.thumbnail).toBe('https://files.example/cover.png');
  });

  it('publishes an entity’s linked portrait as the link itself', () => {
    const payload = entityPublishPayload(entity({ images: ['https://files.example/mara.png'] }));

    expect(payload.thumbnail).toBe('https://files.example/mara.png');
    expect((payload.contentData as Entity).images).toEqual(['https://files.example/mara.png']);
  });

  it('leaves a world’s linked entity and location images alone in the published content', () => {
    const payload = worldPublishPayload(world({}, {
      entities: [{ id: 'e1', name: 'Mara', images: ['https://files.example/a.png'] }],
      locations: [{ id: 'l1', name: 'Fen', backgroundImage: 'https://files.example/bg.png' }],
    }));
    const content = payload.contentData as World;

    expect(content.entities[0].images).toEqual(['https://files.example/a.png']);
    expect(content.locations[0].backgroundImage).toBe('https://files.example/bg.png');
  });
});
