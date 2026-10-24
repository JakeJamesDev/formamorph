import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { stubReducedMotion } from '@/test/reducedMotion';
import { waitReal } from '@/test/motionWait';
import { StatusGlyph, ThinkingGlyph } from './StatusGlyph';
import { Split } from './icons/split';

// Real timers only; see waitReal.
const styleOf = (selector: string) => [...document.querySelectorAll<SVGElement>(selector)].map((el) => el.style);

describe('our glyphs', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('walks the split dot out the left branch, then the right, on consecutive loops', async () => {
    render(<Split animate loop />);
    // The dot rides the branch's own path, so the path it is on is the branch the player sees it take.
    const route = () => (document.querySelector('circle') as SVGElement).style.offsetPath;
    await waitReal(250);
    expect(route()).toContain('L3 3');
    await waitReal(1250);
    expect(route()).toContain('L21 3');
    await waitReal(1300);
    expect(route()).toContain('L3 3');
  });

  it('moves the quill, the masks and the thought cloud', async () => {
    render(<><StatusGlyph glyph="quill" /><StatusGlyph glyph="masks" /><ThinkingGlyph /></>);
    await waitReal(300);
    const [quill, back, front] = styleOf('svg g');
    expect(quill.transform).toMatch(/translate/);
    expect(back.transform).toMatch(/rotate/);
    expect(front.transform).toMatch(/rotate/);
    expect(styleOf('svg circle').some((s) => s.opacity === '1')).toBe(true);
  });

  it('holds the four glyphs still with reduced motion on, the thought cloud fully lit', async () => {
    stubReducedMotion();
    render(<><StatusGlyph glyph="quill" /><StatusGlyph glyph="masks" /><StatusGlyph glyph="split" /><ThinkingGlyph /></>);
    await waitReal(600);
    const [quill, back, front] = styleOf('svg g');
    for (const part of [quill, back, front]) expect(part.transform).toBe('none');
    const [ink] = styleOf('svg:nth-of-type(1) > path');
    expect(ink.opacity).toBe('0');
    const svgs = document.querySelectorAll('svg');
    const walker = svgs[2].querySelector('circle') as SVGElement;
    expect(walker.style.opacity).toBe('0');
    expect(walker.getAttribute('data-branch')).toBe('left');
    const cloudParts = [...svgs[3].querySelectorAll<SVGElement>('path, circle')];
    expect(cloudParts).toHaveLength(6);
    for (const part of cloudParts) expect(part.style.opacity).toBe('1');
  });
});
