import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { RequestStatusRow } from './RequestStatusRow';
import { stubReducedMotion } from '@/test/reducedMotion';

// Motion's frame loop runs on the real clock and stalls once a fake clock has driven it, so this file
// keeps to real timers.
describe('RequestStatusRow glyph motion', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  const wait = (ms: number) => act(() => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));
  // The compass needle's transform: "none" at rest, a rotation while it swings.
  const needle = () => (document.querySelector('[data-glyph="compass"] path') as SVGElement | null)?.style.transform ?? '';

  it('animates the glyph', async () => {
    render(<RequestStatusRow label="Generating Plan…" glyph="compass" />);
    await wait(300);
    expect(needle()).toMatch(/rotate/);
  });

  it('renders the glyph and runs no animation with reduced motion on', async () => {
    stubReducedMotion();
    render(<RequestStatusRow label="Generating Plan…" glyph="compass" />);
    expect(document.querySelector('[data-glyph="compass"] svg')).toBeTruthy();
    await wait(300);
    expect(needle()).toBe('none');
    await wait(300);
    expect(needle()).toBe('none');
  });
});
