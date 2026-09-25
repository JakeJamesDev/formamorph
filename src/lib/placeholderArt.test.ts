import { describe, it, expect } from 'vitest';
import type { Placeholder } from '@/types';
import { encodePlaceholderToken } from './placeholders';
import { phValues } from '@/test/placeholderValues';
import { generateMorphArt, morphLetter, MORPH_HUES, type LetterMask, type MorphArt } from './placeholderArt';

const W = 200, H = 300;
const CX = 100, CY = 190, OUTER = 45, INNER = 31;
const MOUTH = (40 * Math.PI) / 180;

/** A synthetic letter: no font, just the pixels a test chooses. */
function maskOf(inkAt: (x: number, y: number) => boolean): LetterMask {
  const bits = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) bits[y * W + x] = inkAt(x, y) ? 1 : 0;
  return { width: W, height: H, ink: (x, y) => x >= 0 && y >= 0 && x < W && y < H && bits[y * W + x] === 1 };
}

const ringAt = (x: number, y: number) => {
  const d = Math.hypot(x - CX, y - CY);
  return d >= INNER && d <= OUTER;
};
const mouthAt = (x: number, y: number) => Math.abs(Math.atan2(y - CY, x - CX)) < MOUTH;
const O_MASK = maskOf(ringAt);
const C_MASK = maskOf((x, y) => ringAt(x, y) && !mouthAt(x, y));
// A solid block over the app font's W, the widest glyph: the least open space a card gets.
const WIDE_MASK = maskOf((x, y) => x >= 38 && x <= 161 && y >= 153 && y <= 236);
const EMPTY_MASK = maskOf(() => false);

// The counter and the mouth: empty pixels inside the letter's convex hull, worked out from the shape itself.
const O_GAP = (x: number, y: number) => Math.hypot(x - CX, y - CY) < INNER;
const C_GAP = (x: number, y: number) =>
  !C_MASK.ink(x, y) && Math.hypot(x - CX, y - CY) < OUTER && x < CX + OUTER * Math.cos(MOUTH);

const art = (idSeed: string, nameSeed: string, mask: LetterMask = O_MASK, letter = 'O'): MorphArt =>
  generateMorphArt({ idSeed, nameSeed, letter, readMask: () => mask });

const NAMES = Array.from({ length: 60 }, (_, i) => `Entity ${i}`);

describe('generateMorphArt', () => {
  it('gives the same art for the same seeds', () => {
    expect(art('3f1c0a52-8d7e-4b1a-9c55-0e6f2a7d9b14', 'Slime Knight'))
      .toEqual(art('3f1c0a52-8d7e-4b1a-9c55-0e6f2a7d9b14', 'Slime Knight'));
  });

  it('changes only the hue when only the id changes', () => {
    const a = art('id-a', 'Slime Knight');
    const other = ['id-b', 'id-c', 'id-d', 'id-e', 'id-f'].map((id) => art(id, 'Slime Knight'))
      .find((b) => b.hue !== a.hue);
    expect(other).toBeDefined();
    const b = other as MorphArt;
    expect(b.palette).not.toEqual(a.palette);
    expect({ letter: b.letter, clusters: b.clusters }).toEqual({ letter: a.letter, clusters: a.clusters });
  });

  it('never moves the hue with the name', () => {
    const hues = new Set(NAMES.map((name) => art('one-listing', name, EMPTY_MASK).hue));
    expect(hues.size).toBe(1);
  });

  it('spreads random ids evenly across all 8 hues', () => {
    const counts = new Map<number, number>();
    for (let i = 0; i < 8000; i++) {
      const hue = generateMorphArt({ idSeed: crypto.randomUUID(), nameSeed: 'Slime', letter: 'S', readMask: () => EMPTY_MASK }).hue;
      counts.set(hue, (counts.get(hue) ?? 0) + 1);
    }
    expect([...counts.keys()].sort((a, b) => a - b)).toEqual([...MORPH_HUES].sort((a, b) => a - b));
    for (const n of counts.values()) {
      expect(n).toBeGreaterThanOrEqual(800);
      expect(n).toBeLessThanOrEqual(1200);
    }
  });

  it('tilts both ways across names that start alike', () => {
    // Names in a world often share a prefix.
    const names = ['Slime', 'Slime Girl', 'Slime Knight', 'Goo'].flatMap((prefix) =>
      Array.from({ length: 50 }, (_, i) => `${prefix} ${i + 1}`));
    const tilts = names.map((name) => art('id', name, EMPTY_MASK).letter.tilt);
    const left = tilts.filter((t) => t < 0).length;
    expect(left / names.length).toBeGreaterThanOrEqual(0.4);
    expect((names.length - left) / names.length).toBeGreaterThanOrEqual(0.4);
    for (const t of tilts) {
      expect(Math.abs(t)).toBeGreaterThanOrEqual(4);
      expect(Math.abs(t)).toBeLessThanOrEqual(9);
    }
  });

  it.each([
    ['an O', O_MASK, O_GAP],
    ['a C', C_MASK, C_GAP],
  ])('keeps every drop out of the gaps of %s', (_label, mask, gapAt) => {
    let drops = 0;
    for (const name of NAMES) {
      for (const drop of art('id', name, mask).letter.drops) {
        drops++;
        let covered = 0;
        for (let y = Math.floor(drop.y - drop.r); y <= Math.ceil(drop.y + drop.r); y++) {
          for (let x = Math.floor(drop.x - drop.r); x <= Math.ceil(drop.x + drop.r); x++) {
            if (Math.hypot(x - drop.x, y - drop.y) <= drop.r && gapAt(x, y)) covered++;
          }
        }
        expect(covered, `${name}: drop at ${drop.x},${drop.y} r ${drop.r.toFixed(1)}`).toBeLessThanOrEqual(4);
      }
    }
    expect(drops).toBeGreaterThan(NAMES.length);
  });

  it.each([
    ['an O', O_MASK],
    ['a C', C_MASK],
    ['a wide letter', WIDE_MASK],
  ])('keeps every cluster inside the frame and clear of %s', (_label, mask) => {
    const clearOf = (x: number, y: number) => {
      for (let j = Math.floor(y - 16); j <= Math.ceil(y + 16); j++) {
        for (let i = Math.floor(x - 16); i <= Math.ceil(x + 16); i++) {
          if (mask.ink(i, j) && Math.hypot(i - x, j - y) < 16) return false;
        }
      }
      return true;
    };
    let clusters = 0;
    for (const name of NAMES) {
      const { letter, clusters: placed } = art('id', name, mask);
      clusters += placed.length;
      for (const cluster of placed) {
        for (const [x, y] of cluster.lumps.flatMap((lump) => lump.points)) {
          expect(x).toBeGreaterThanOrEqual(8);
          expect(x).toBeLessThanOrEqual(192);
          expect(y).toBeGreaterThanOrEqual(96);
          expect(y).toBeLessThanOrEqual(292);
          expect(clearOf(x, y), `${name}: ${x.toFixed(1)},${y.toFixed(1)} is within 16 px of ink`).toBe(true);
          for (const drop of letter.drops) expect(Math.hypot(drop.x - x, drop.y - y) - drop.r).toBeGreaterThanOrEqual(16);
        }
      }
    }
    // Not vacuous: even the widest letter leaves room for most of its clusters.
    expect(clusters).toBeGreaterThanOrEqual(2 * NAMES.length);
  });
});

describe('morphLetter', () => {
  it('takes the first letter or number, uppercased', () => {
    expect(morphLetter('slime')).toBe('S');
    expect(morphLetter('  "élan" ')).toBe('É');
    expect(morphLetter('7th Son')).toBe('7');
    expect(morphLetter('...the end')).toBe('T');
  });

  it('falls back to a question mark', () => {
    expect(morphLetter('')).toBe('?');
    expect(morphLetter('*** !!')).toBe('?');
  });

  it('keeps one letter when uppercasing makes two', () => {
    expect(morphLetter('ßeta')).toBe('S');
  });

  it('reads the name after its chips resolve', () => {
    const king: Placeholder = { id: 'king', name: 'king', values: phValues(['Aldric']) };
    const token = encodePlaceholderToken({ id: 'king', mode: 'world', placementId: 'p1' });
    expect(morphLetter(`${token} the Bold`, [king])).toBe('A');
    expect(morphLetter('{{user}}')).toBe('P');
  });
});
