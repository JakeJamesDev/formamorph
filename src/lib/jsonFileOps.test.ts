import { describe, it, expect } from 'vitest';
import { runJsonFileOp } from './jsonFileOps';
import { measurePublishBytes } from './publishLimits';

describe('runJsonFileOp', () => {
  // Multi-byte characters and a data URL: the content a real world carries, and where a character count
  // and a byte count part ways.
  const content = { name: 'Café 🐸', thumbnail: 'data:image/webp;base64,AAAA', nested: { list: [1, 2] } };

  it('measures the compact byte count the publish limit is checked against', () => {
    expect(runJsonFileOp({ op: 'measure', value: content })).toBe(measurePublishBytes(content));
  });

  it('serializes to a Blob with the requested spacing and type', async () => {
    const blob = runJsonFileOp({ op: 'serialize', value: { a: 1 }, space: 2, mime: 'text/plain' }) as Blob;
    expect(blob.type).toBe('text/plain');
    // jsdom's Blob has no `.text()`.
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob);
    });
    expect(text).toBe('{\n  "a": 1\n}');
  });

  it('parses text', () => {
    expect(runJsonFileOp({ op: 'parse', text: '{"a":[1]}' })).toEqual({ a: [1] });
  });
});
