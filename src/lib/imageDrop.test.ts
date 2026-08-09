import { describe, it, expect } from 'vitest';
import { imageFilesFrom, imageUrlFrom, imageDropPayload, canDropImage } from './imageDrop';

const file = (name: string, type: string) => new File(['x'], name, { type });

/** A DataTransfer stand-in: jsdom has no constructor for one, and a drop only ever reads these three. */
const dt = (opts: { files?: File[]; data?: Record<string, string>; types?: string[] }) => ({
  files: (opts.files ?? []) as unknown as FileList,
  types: opts.types ?? [...(opts.files?.length ? ['Files'] : []), ...Object.keys(opts.data ?? {})],
  getData: (t: string) => opts.data?.[t] ?? '',
}) as unknown as DataTransfer;

describe('imageFilesFrom', () => {
  it('keeps images in drop order', () => {
    const files = [file('a.png', 'image/png'), file('b.webp', 'image/webp')];
    expect(imageFilesFrom(dt({ files })).map((f) => f.name)).toEqual(['a.png', 'b.webp']);
  });

  it('drops non-images rather than failing the whole gesture', () => {
    const files = [file('notes.txt', 'text/plain'), file('a.png', 'image/png')];
    expect(imageFilesFrom(dt({ files })).map((f) => f.name)).toEqual(['a.png']);
  });

  it('is empty for a drag carrying no files', () => {
    expect(imageFilesFrom(dt({}))).toEqual([]);
  });
});

describe('imageUrlFrom', () => {
  it('reads the link a browser image drag sets', () => {
    expect(imageUrlFrom(dt({ data: { 'text/uri-list': 'https://files.example/a.png' } })))
      .toBe('https://files.example/a.png');
  });

  it('skips the comment lines a uri-list may lead with', () => {
    const data = { 'text/uri-list': '# some comment\nhttps://files.example/a.png' };
    expect(imageUrlFrom(dt({ data }))).toBe('https://files.example/a.png');
  });

  it('falls back to text/plain for a URL dragged from the address bar', () => {
    expect(imageUrlFrom(dt({ data: { 'text/plain': 'https://files.example/a.png' } })))
      .toBe('https://files.example/a.png');
  });

  it('refuses a non-http payload — dragged prose is not a picture', () => {
    expect(imageUrlFrom(dt({ data: { 'text/plain': 'just some words' } }))).toBeNull();
    expect(imageUrlFrom(dt({ data: { 'text/plain': 'file:///c:/a.png' } }))).toBeNull();
  });

  it('is null for an empty drag', () => {
    expect(imageUrlFrom(dt({}))).toBeNull();
  });
});

describe('imageDropPayload', () => {
  it('prefers the files a browser drag carries alongside its link', () => {
    const payload = imageDropPayload(dt({
      files: [file('a.png', 'image/png')],
      data: { 'text/uri-list': 'https://files.example/a.png' },
    }));
    expect(payload).toEqual({ kind: 'files', files: [expect.objectContaining({ name: 'a.png' })] });
  });

  it('takes the link when there are no files', () => {
    expect(imageDropPayload(dt({ data: { 'text/uri-list': 'https://files.example/a.png' } })))
      .toEqual({ kind: 'url', url: 'https://files.example/a.png' });
  });

  it('is null when the drag carries nothing usable', () => {
    expect(imageDropPayload(dt({ files: [file('notes.txt', 'text/plain')] }))).toBeNull();
    expect(imageDropPayload(null)).toBeNull();
  });
});

describe('canDropImage', () => {
  it('lights up for files and for links', () => {
    expect(canDropImage(dt({ types: ['Files'] }))).toBe(true);
    expect(canDropImage(dt({ types: ['text/uri-list'] }))).toBe(true);
  });

  it('stays dark for a drag of something else entirely', () => {
    expect(canDropImage(dt({ types: ['application/x-formamorph-chip'] }))).toBe(false);
    expect(canDropImage(null)).toBe(false);
  });
});
