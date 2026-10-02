// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { jsonParts, runJsonFileOp } from './jsonFileOps';
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

  it('serializes in parts to the same compact text', async () => {
    const blob = runJsonFileOp({ op: 'serialize', value: content, splitDepth: 2 }) as Blob;
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob);
    });
    expect(text).toBe(JSON.stringify(content));
  });

  it('parses text', () => {
    expect(runJsonFileOp({ op: 'parse', text: '{"a":[1]}' })).toEqual({ a: [1] });
  });
});

describe('jsonParts', () => {
  const tricky = {
    name: 'Café 🐸 "quoted"',
    skip: undefined,
    fn: () => 1,
    when: new Date(0),
    list: [1, undefined, () => 1, { deep: [null, true] }],
    // eslint-disable-next-line no-sparse-arrays
    sparse: [1, , 3],
    empty: { inner: [] },
  };

  it.each([0, 1, 2, 3, 10])('joins to JSON.stringify at depth %i', (depth) => {
    expect(jsonParts(tricky, depth).join('')).toBe(JSON.stringify(tricky));
  });

  it('writes each record below the split depth as its own part', () => {
    const records = [{ id: 'a', data: 'x'.repeat(50) }, { id: 'b', data: 'y'.repeat(50) }];
    const parts = jsonParts({ data: { worlds: records } }, 3);
    expect(parts).toContain(JSON.stringify(records[0]));
    expect(parts).toContain(JSON.stringify(records[1]));
    expect(Math.max(...parts.map((p) => p.length))).toBe(JSON.stringify(records[0]).length);
  });
});
