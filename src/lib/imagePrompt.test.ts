import { describe, it, expect, vi } from 'vitest';
import { normalizeBooruTags, buildImagePrompt, SUBJECT_GUIDANCE, DEFAULT_TAG_PROMPT } from './imagePrompt';
import { sentBody, sseReply, sseResponse, stubStream, textSnapshot } from '@/test/aiTextFixtures';

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

describe('buildImagePrompt request', () => {
  it('sends the tag request kind with its cap and sampler pin', async () => {
    const spy = stubStream(sseReply('Silver_Hair'));
    await expect(buildImagePrompt({ description: 'd', kind: 'character' }, { snapshot: textSnapshot() })).resolves.toBe('silver hair');
    vi.unstubAllGlobals();
    expect(sentBody(spy)).toMatchObject({ max_tokens: 200, temperature: 0.3 });
  });
});

describe('buildImagePrompt user message', () => {
  const capture = async (description: string) => {
    const spy = stubStream(sseReply('a tag'));
    await buildImagePrompt({ description, kind: 'character' }, { snapshot: textSnapshot() });
    vi.unstubAllGlobals();
    return (sentBody(spy).messages as { role: string; content: string }[]).find((m) => m.role === 'user')!.content;
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
    const fetchMock = stubStream(() => sseResponse(sseReply('a tag')));
    try {
      for (const [tagPrompt, expected] of [
        [undefined, DEFAULT_TAG_PROMPT.replace('<SUBJECT>', SUBJECT_GUIDANCE[kind])],
        ['Before<SUBJECT|format=xml|header="image subject">After', `Before\n<image_subject>\n${SUBJECT_GUIDANCE[kind]}\n</image_subject>\nAfter`],
        ['<SUBJECT|format=xml>', SUBJECT_GUIDANCE[kind]],
        ['<SUBJECT|format=markdown|header="image subject">', `\n## Image Subject\n${SUBJECT_GUIDANCE[kind]}\n`],
      ]) {
        await buildImagePrompt({ description: 'A river town', kind }, { snapshot: textSnapshot(), tagPrompt });
        const request = JSON.parse(fetchMock.mock.lastCall![1].body as string) as { messages: { content: string }[] };
        expect(request.messages[0].content).toBe(expected);
      }
    } finally { vi.unstubAllGlobals(); }
  });
});
