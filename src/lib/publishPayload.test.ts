import { describe, it, expect } from 'vitest';
import { worldPublishPayload, entityPublishPayload, dictionaryPublishPayload, modelPublishPayload, promptPublishPayload, promptPublishBlock, publishTags } from './publishPayload';
import { buildSharedPreset } from './promptPresetShare';
import type { PromptPreset, PromptValues } from './promptPresets';
import type { World, Entity, Dictionary, Placeholder, VrmLicense } from '@/types';
import { encodePlaceholderToken } from './placeholders';

import { phValues } from '@/test/placeholderValues';
const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: 'p1' });
const def = (id: string, values: string[]): Placeholder => ({ id, name: id, values: phValues(values) });

const world = (over = {}, rest = {}) => ({ worldOverview: { name: 'Sedge Landing', description: 'A marsh', thumbnail: 'data:1', ...over }, ...rest } as unknown as World);
const entity = (over = {}) => ({ id: 'e1', name: 'Mara', ...over } as Entity);
const book = (over = {}) => ({ id: 'd1', name: 'Lore', entries: [], ...over } as Dictionary);

it('publishes library creator credits without mutating world content', async () => {
  const e = entity();
  const d = book();
  expect((await entityPublishPayload(e, { author: 'River Quill' })).contentData).toMatchObject({ author: 'River Quill' });
  expect(dictionaryPublishPayload(d, { author: 'River Quill' }).contentData).toMatchObject({ author: 'River Quill' });
  expect(e).not.toHaveProperty('author');
  expect(d).not.toHaveProperty('author');
});

describe('worldPublishPayload', () => {
  it('publishes the overview fields', async () => {
    expect(worldPublishPayload(world())).toMatchObject({
      kind: 'world', name: 'Sedge Landing', description: 'A marsh', thumbnail: 'data:1',
    });
  });

  it('defaults tags into the content, since the server reads a listing’s tags from there', async () => {
    const payload = worldPublishPayload(world());
    expect((payload.contentData as World).worldOverview.tags).toEqual([]);
  });

  it('keeps authored tags', async () => {
    const payload = worldPublishPayload(world({ tags: ['grim', 'wet'] }));
    expect((payload.contentData as World).worldOverview.tags).toEqual(['grim', 'wet']);
  });

  it('does not mutate the caller’s world — it is the live library copy', async () => {
    const w = world();
    worldPublishPayload(w);
    expect(w.worldOverview.tags).toBeUndefined();
  });

  it('renders placeholder chips in the blurb — a listing carries no defs to resolve them later', async () => {
    const payload = worldPublishPayload(
      world({ description: `A ${chip('weather')} marsh` }, { placeholders: [def('weather', ['wet', 'frozen'])] }),
    );
    expect(payload.description).toBe('A {wet|frozen} marsh');
  });

  it('names an untitled world rather than publishing a blank', async () => {
    expect(worldPublishPayload(world({ name: '' })).name).toBe('Untitled World');
  });
});

describe('entityPublishPayload', () => {
  it('uses the player-facing description — what a human browsing wants to read', async () => {
    const payload = (await entityPublishPayload(entity({
      playerDescription: 'A knight', aiSummary: 'knight, weary', aiDescription: 'You are a knight who…',
    })));
    expect(payload).toMatchObject({ kind: 'entity', name: 'Mara', description: 'A knight' });
  });

  it('falls back to the short AI summary when there is no player description', async () => {
    expect((await entityPublishPayload(entity({ aiSummary: 'knight, weary' }))).description).toBe('knight, weary');
  });

  it('publishes the Persona mark and pronouns in the listing content', async () => {
    const payload = (await entityPublishPayload(entity({ persona: true, pronouns: 'they/them' })));
    expect(payload.contentData).toMatchObject({ persona: true, pronouns: 'they/them' });
  });

  it('never publishes aiDescription — it is long and full of prompt scaffolding', async () => {
    const payload = (await entityPublishPayload(entity({ aiDescription: 'You are a knight who…' })));
    expect(payload.description).toBe('');
  });

  it('renders carried placeholder chips instead of publishing a raw token id', async () => {
    const payload = (await entityPublishPayload(entity({
      playerDescription: `A knight with ${chip('eyes')} eyes`,
      placeholders: [def('eyes', ['gray'])],
    })));
    expect(payload.description).toBe('A knight with gray eyes');
  });

  it('renders chips in the aiSummary fallback too', async () => {
    const payload = (await entityPublishPayload(entity({
      aiSummary: `knight, ${chip('mood')}`,
      placeholders: [def('mood', ['weary', 'grim'])],
    })));
    expect(payload.description).toBe('knight, {weary|grim}');
  });

  it('leaves contentData verbatim so the downloaded character keeps real chips', async () => {
    const raw = `A knight with ${chip('eyes')} eyes`;
    const e = entity({ playerDescription: raw, placeholders: [def('eyes', ['gray'])] });
    expect(((await entityPublishPayload(e)).contentData as Entity).playerDescription).toBe(raw);
  });

  it('sends the portrait when there is one', async () => {
    expect((await entityPublishPayload(entity({ image: 'data:portrait' }))).thumbnail).toBe('data:portrait');
  });

  it('sends slot 0 as the listing art, its Visibility rule ignored', async () => {
    const images = [{ data: 'data:slot0', requires: [{ all: [{ kind: 'trait' as const, id: 'knight' }] }] }, { data: 'data:slot1' }];
    expect((await entityPublishPayload(entity({ images }))).thumbnail).toBe('data:slot0');
  });

  it('omits the thumbnail when there is no portrait, so the server supplies stand-in art', async () => {
    expect((await entityPublishPayload(entity())).thumbnail).toBeUndefined();
  });

  it('publishes the character itself as the content', async () => {
    const e = entity({ image: 'data:portrait' });
    expect((await entityPublishPayload(e)).contentData).toBe(e);
  });
});

describe('dictionaryPublishPayload', () => {
  it('publishes the book with its note', async () => {
    expect(dictionaryPublishPayload(book({ description: 'Marsh lore' }))).toMatchObject({
      kind: 'dictionary', name: 'Lore', description: 'Marsh lore',
    });
  });

  it('sends an empty description when the book has no note', async () => {
    expect(dictionaryPublishPayload(book()).description).toBe('');
  });

  it('renders carried placeholder chips in the note', async () => {
    const payload = dictionaryPublishPayload(book({
      description: `Lore of the ${chip('era')}`,
      placeholders: [def('era', ['First Age', 'Long Thaw'])],
    }));
    expect(payload.description).toBe('Lore of the {First Age|Long Thaw}');
  });

  it('sends no thumbnail when the book has no cover', async () => {
    expect(dictionaryPublishPayload(book()).thumbnail).toBeUndefined();
  });

  it('sends the cover when it has one', async () => {
    expect(dictionaryPublishPayload(book({ thumbnail: 'data:image/webp;base64,AAAA' })).thumbnail)
      .toBe('data:image/webp;base64,AAAA');
  });

  it('publishes the book itself as the content', async () => {
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
  it('carries a world’s', async () => {
    const payload = worldPublishPayload(world({ tags: ['gothic', 'marsh'] }));

    expect(payload.tags).toEqual(['gothic', 'marsh']);
    expect(publishTags(payload)).toEqual(['gothic', 'marsh']);
  });

  it('carries a character’s', async () => {
    const payload = (await entityPublishPayload(entity({ tags: ['npc', 'guide'] })));

    expect(payload.tags).toEqual(['npc', 'guide']);
    expect(publishTags(payload)).toEqual(['npc', 'guide']);
  });

  it('carries a book’s', async () => {
    const payload = dictionaryPublishPayload(book({ tags: ['lore'] }));

    expect(payload.tags).toEqual(['lore']);
    expect(publishTags(payload)).toEqual(['lore']);
  });

  it('is empty for anything untagged', async () => {
    expect(publishTags((await entityPublishPayload(entity())))).toEqual([]);
    expect(publishTags(dictionaryPublishPayload(book()))).toEqual([]);
  });

  it('never confuses a character’s image tags for listing tags', async () => {
    // `imageTags` is a comma-separated booru string for the image generator; these are what the catalog
    // filters on. Publishing one as the other would tag every character with its own portrait's prompt.
    const payload = (await entityPublishPayload(entity({ imageTags: 'woman, cloak, reeds' })));

    expect(publishTags(payload)).toEqual([]);
  });

  it('still finds a world’s tags in the content when the payload omits them', async () => {
    // A payload built by older code has no `tags` of its own; the world keeps a copy where the server
    // has always read it, so it must not come back untagged.
    const payload = worldPublishPayload(world({ tags: ['gothic'] }));
    delete payload.tags;

    expect(publishTags(payload)).toEqual(['gothic']);
  });

  it('drops anything in the list that is not a string', async () => {
    const payload = (await entityPublishPayload(entity({ tags: ['npc', 7, null] as unknown as string[] })));

    expect(publishTags(payload)).toEqual(['npc']);
  });
});

// The whole reason an author can link an image instead of uploading it: a published world must carry the
// link, never the bytes. If anything ever resolves an image before publishing, these fail.
describe('linked images survive publishing', () => {
  it('publishes a world’s linked thumbnail as the link itself', async () => {
    const payload = worldPublishPayload(world({ thumbnail: 'https://files.example/cover.png' }));

    expect(payload.thumbnail).toBe('https://files.example/cover.png');
    expect((payload.contentData as World).worldOverview.thumbnail).toBe('https://files.example/cover.png');
  });

  it('publishes an entity’s linked portrait as the link itself', async () => {
    const payload = (await entityPublishPayload(entity({ images: ['https://files.example/mara.png'] })));

    expect(payload.thumbnail).toBe('https://files.example/mara.png');
    expect((payload.contentData as Entity).images).toEqual(['https://files.example/mara.png']);
  });

  it('leaves a world’s linked entity and location images alone in the published content', async () => {
    const payload = worldPublishPayload(world({}, {
      entities: [{ id: 'e1', name: 'Mara', images: ['https://files.example/a.png'] }],
      locations: [{ id: 'l1', name: 'Fen', images: [{ data: 'https://files.example/bg.png', requires: [{ all: [{ kind: 'trait', id: 't' }] }] }] }],
    }));
    const content = payload.contentData as World;

    expect(content.entities[0].images).toEqual(['https://files.example/a.png']);
    expect(content.locations[0].images).toEqual([{ data: 'https://files.example/bg.png', requires: [{ all: [{ kind: 'trait', id: 't' }] }] }]);
  });
});

describe('modelPublishPayload', () => {
  const license = (over: Partial<VrmLicense> = {}): VrmLicense => ({
    metaVersion: '1',
    avatarPermission: 'everyone',
    allowRedistribution: true,
    modification: 'allowModificationRedistribution',
    commercialUse: 'corporation',
    ...over,
  });

  const model = (over = {}) => ({
    name: 'sedge_export_final',
    vrm: 'data:model/vnd.vrm;base64,AAAA',
    license: license(),
    hash: 'abc123',
    ...over,
  });

  it('prefers the file’s own title over the library name', async () => {
    // The library name often comes from a filename an export tool chose; the title is what the author wrote.
    expect(modelPublishPayload(model({ license: license({ title: 'Sedge' }) })).name).toBe('Sedge');
  });

  it('falls back to the library name when the file carries no title', async () => {
    expect(modelPublishPayload(model()).name).toBe('sedge_export_final');
  });

  it('ignores a title that is only whitespace', async () => {
    expect(modelPublishPayload(model({ license: license({ title: '   ' }) })).name).toBe('sedge_export_final');
  });

  it('names the listing rather than leaving it blank when nothing else has a name', async () => {
    expect(modelPublishPayload(model({ name: '', license: license() })).name).toBe('Untitled Avatar');
  });

  it('credits the file’s authors in the description', async () => {
    expect(modelPublishPayload(model({ license: license({ authors: ['Alice'] }) })).description)
      .toBe('By Alice.');
  });

  it('lists two authors and three', async () => {
    expect(modelPublishPayload(model({ license: license({ authors: ['Alice', 'Bob'] }) })).description)
      .toBe('By Alice and Bob.');
    expect(modelPublishPayload(model({ license: license({ authors: ['Alice', 'Bob', 'Carol'] }) })).description)
      .toBe('By Alice, Bob, and Carol.');
  });

  it('writes no description when the file credits nobody', async () => {
    expect(modelPublishPayload(model()).description).toBe('');
    expect(modelPublishPayload(model({ license: license({ authors: [] }) })).description).toBe('');
  });

  it('carries the model’s picture when it has one', async () => {
    expect(modelPublishPayload(model({ thumbnail: 'data:image/webp;base64,BBBB' })).thumbnail)
      .toBe('data:image/webp;base64,BBBB');
  });

  it('leaves the thumbnail absent when the model has none, so the server fills its own', async () => {
    expect(modelPublishPayload(model()).thumbnail).toBeUndefined();
  });

  it('publishes the file, its license, and its hash as the content', async () => {
    const payload = modelPublishPayload(model({ license: license({ title: 'Sedge' }) }));
    expect(payload.kind).toBe('model');
    expect(payload.contentData).toEqual({
      vrm: 'data:model/vnd.vrm;base64,AAAA',
      license: license({ title: 'Sedge' }),
      hash: 'abc123',
    });
  });

  it('publishes no tags: an Avatar listing has no field to write them in', async () => {
    const payload = modelPublishPayload(model());
    expect(payload.tags).toEqual([]);
    expect(publishTags(payload)).toEqual([]);
  });
});

describe('promptPublishPayload', () => {
  const OVERVIEW = { author: 'Ann', description: 'For **small** models', tags: ['noir', 'slow burn'], models: ['Cydonia-24B'] };
  /** A stored user preset the way the store holds it: tuning, local routing, and a community link. */
  const stored: PromptPreset = {
    id: 'p1',
    name: 'Terse Narrator',
    style: 'markdown',
    values: { systemPrompt: 'Be terse.' } as PromptValues,
    samplers: { narration: { temperature: { custom: true, value: 0.7 } } },
    reasoning: { narration: { enabled: false, level: 'global' } },
    maxOutput: { summary: { custom: true, value: 300 } },
    verbatim: { narration: 5 },
    promptEndpoints: { narration: 'zzz-endpoint-canary' },
    overview: OVERVIEW,
    sourceId: 'zzz-listing-canary',
    sourceUpdatedAt: '2026-09-01T00:00:00.000Z',
    dirty: true,
  };
  const shared = (over: Partial<PromptPreset> = {}) => buildSharedPreset({ ...stored, style: 'markdown', ...over }, '2.0.3');

  it('maps the Overview to the listing description, tags, and models', async () => {
    expect(promptPublishPayload(shared())).toMatchObject({
      kind: 'prompt',
      name: 'Terse Narrator',
      description: 'For **small** models',
      tags: ['noir', 'slow burn'],
      models: ['Cydonia-24B'],
    });
  });

  it('publishes the share artifact as the content, tuning included', async () => {
    const payload = promptPublishPayload(shared());
    expect(payload.contentData).toMatchObject({
      kind: 'formamorph-prompt-preset',
      appVersion: '2.0.3',
      values: { systemPrompt: 'Be terse.' },
      samplers: stored.samplers,
      reasoning: stored.reasoning,
      maxOutput: stored.maxOutput,
      verbatim: stored.verbatim,
      overview: OVERVIEW,
    });
    expect(payload.thumbnail).toBeUndefined();
  });

  it('carries neither the endpoint routing nor the community link', async () => {
    const text = JSON.stringify(promptPublishPayload(shared()));
    expect(text).not.toContain('zzz-endpoint-canary');
    expect(text).not.toContain('zzz-listing-canary');
    for (const key of ['promptEndpoints', 'sourceId', 'sourceUpdatedAt', 'dirty']) expect(text).not.toContain(`"${key}"`);
  });

  it('publishes a preset with no Overview with empty listing fields', async () => {
    expect(promptPublishPayload(shared({ overview: undefined }))).toMatchObject({ description: '', tags: [], models: [] });
  });

  it('blocks publish until Models names one model', async () => {
    expect(promptPublishBlock(OVERVIEW)).toBeNull();
    expect(promptPublishBlock({ ...OVERVIEW, models: [] })).toBe('models');
    expect(promptPublishBlock(undefined)).toBe('models');
  });
});
