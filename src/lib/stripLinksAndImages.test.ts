import { describe, expect, it } from 'vitest';
import { stripLinksAndImages } from './stripLinksAndImages';

describe('stripLinksAndImages', () => {
  it('turns a link into its text', () => {
    expect(stripLinksAndImages('Read [the map](https://example.com/map) first.')).toBe('Read the map first.');
  });

  it('removes an image and the space it sat in', () => {
    expect(stripLinksAndImages('She waved ![a wave](https://example.com/w.png) and left.')).toBe('She waved and left.');
  });

  it('turns a link with a title into its text', () => {
    expect(stripLinksAndImages('See [the gate](https://example.com "Gate") now.')).toBe('See the gate now.');
  });

  it('keeps a URL with balanced parentheses inside one link', () => {
    expect(stripLinksAndImages('A [page](https://example.com/a_(b)) here.')).toBe('A page here.');
  });

  it('keeps the text of a link that wraps an image as nothing', () => {
    expect(stripLinksAndImages('Look: [![alt](https://example.com/i.png)](https://example.com) done.')).toBe('Look: done.');
  });

  it('handles several links and images in one passage', () => {
    const text = '[One](https://a.test) and ![x](https://b.test/i.png) and [two](https://c.test).';
    expect(stripLinksAndImages(text)).toBe('One and and two.');
  });

  it('collapses the blank lines an image on its own line leaves', () => {
    expect(stripLinksAndImages('First.\n\n![x](https://a.test/i.png)\n\nSecond.')).toBe('First.\n\nSecond.');
  });

  it('resolves reference links and images that have a definition', () => {
    const text = 'Go to [the inn][inn] and see ![sign][sign].\n\n[inn]: https://a.test/inn\n[sign]: https://a.test/s.png';
    expect(stripLinksAndImages(text)).toBe('Go to the inn and see.');
  });

  it('leaves bracketed text that has no URL or definition', () => {
    const text = 'He said [aside] and [1][2] twice. A [note](not a url) stays.';
    expect(stripLinksAndImages(text)).toBe(text);
  });

  it('leaves text without markdown links untouched, whitespace included', () => {
    const text = 'Plain  text\n\n\n\nwith spacing and https://example.com bare.';
    expect(stripLinksAndImages(text)).toBe(text);
  });

  it('is idempotent', () => {
    const once = stripLinksAndImages('A [b](https://c.test) ![d](https://e.test/f.png) g.');
    expect(stripLinksAndImages(once)).toBe(once);
  });
});
