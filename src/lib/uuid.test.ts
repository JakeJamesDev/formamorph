import { describe, it, expect, afterEach, vi } from 'vitest';
import { randomUUID } from './uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomUUID', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses native crypto.randomUUID when available', () => {
    const native = vi.fn(() => '11111111-1111-4111-8111-111111111111');
    vi.stubGlobal('crypto', { randomUUID: native, getRandomValues: crypto.getRandomValues.bind(crypto) });
    expect(randomUUID()).toBe('11111111-1111-4111-8111-111111111111');
    expect(native).toHaveBeenCalledOnce();
  });

  it('falls back to getRandomValues in a non-secure context (no crypto.randomUUID)', () => {
    // Simulate http://<lan-ip> where crypto.randomUUID is undefined but getRandomValues still works.
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(0xab) });
    const id = randomUUID();
    expect(id).toMatch(V4);
    // version (4) and variant (8/9/a/b) nibbles are forced regardless of the RNG bytes.
    expect(id[14]).toBe('4');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });

  it('produces distinct, well-formed ids across calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => randomUUID()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(V4);
  });
});
