import { describe, it, expect, vi } from 'vitest';
import { normalizeBooruTags, buildImagePrompt, SUBJECT_GUIDANCE, DEFAULT_TAG_PROMPT } from './imagePrompt';

describe('normalizeBooruTags', () => {
  it('splits CamelCase/PascalCase joined tokens into spaced words', () => {
    expect(normalizeBooruTags('ModernSuburbanHome, BackyardPool')).toBe('modern suburban home, backyard pool');
  });

  it('handles acronym boundaries (HTMLParser → html parser)', () => {
    expect(normalizeBooruTags('HTMLParser')).toBe('html parser');
  });

  it('turns underscores into spaces', () => {
    expect(normalizeBooruTags('silver_hair, white_picket_fence')).toBe('silver hair, white picket fence');
  });

  it('lowercases and strips stray punctuation', () => {
    expect(normalizeBooruTags('Silver Hair!, (Outdoors).')).toBe('silver hair, outdoors');
  });

  it('splits on newlines as well as commas', () => {
    expect(normalizeBooruTags('1girl\nsilver hair\noutdoors')).toBe('1girl, silver hair, outdoors');
  });

  it('dedupes case-insensitively and drops empty segments', () => {
    expect(normalizeBooruTags('Outdoors, outdoors, , day,')).toBe('outdoors, day');
  });

  it('preserves count tags like 1girl', () => {
    expect(normalizeBooruTags('1girl, solo')).toBe('1girl, solo');
  });
});

describe('buildImagePrompt user message', () => {
  const capture = async (description: string) => {
    let sent = '';
    const fetchMock = vi.fn().mockImplementation((_url: string, init: { body: string }) => {
      sent = (JSON.parse(init.body) as { messages: { role: string; content: string }[] })
        .messages.find((m) => m.role === 'user')!.content;
      return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: 'a tag' } }] }) });
    });
    vi.stubGlobal('fetch', fetchMock);
    await buildImagePrompt({ description, kind: 'character' }, { endpointUrl: 'http://x', apiToken: '', modelName: 'm' });
    vi.unstubAllGlobals();
    return sent;
  };

  it('sends the description alone, never the subject name', async () => {
    // A name comes back as a tag ("dean wolfram"), which no image model knows.
    const sent = await capture('a tall man in a grey coat');
    expect(sent).toContain('a tall man in a grey coat');
    expect(sent).not.toContain('Name:');
  });
});

describe('Subject Header in the image-prompt request', () => {
  it.each(['character', 'location', 'world'] as const)('renders %s guidance through the shared Header path', async kind => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'a tag' } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      for (const [tagPrompt, expected] of [
        [undefined, DEFAULT_TAG_PROMPT.replace('<SUBJECT>', SUBJECT_GUIDANCE[kind])],
        ['Before<SUBJECT|format=xml|header="image subject">After', `Before\n\n<image_subject>\n${SUBJECT_GUIDANCE[kind]}\n</image_subject>\n\nAfter`],
        ['<SUBJECT|format=xml>', SUBJECT_GUIDANCE[kind]],
        ['<SUBJECT|format=markdown|header="image subject">', `## Image Subject\n${SUBJECT_GUIDANCE[kind]}`],
      ]) {
        await buildImagePrompt({ description: 'A river town', kind }, { endpointUrl: 'http://x', apiToken: '', modelName: 'm', tagPrompt });
        const request = JSON.parse(fetchMock.mock.lastCall![1].body as string) as { messages: { content: string }[] };
        expect(request.messages[0].content).toBe(expected);
      }
    } finally { vi.unstubAllGlobals(); }
  });
});
