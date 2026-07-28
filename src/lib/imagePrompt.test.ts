import { describe, it, expect, vi } from 'vitest';
import { normalizeBooruTags, buildImagePrompt } from './imagePrompt';

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
