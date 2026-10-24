import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { RequestStatusRow } from './RequestStatusRow';
import { stubReducedMotion } from '@/test/reducedMotion';
import { waitReal } from '@/test/motionWait';

// Real timers only; see waitReal.
describe('RequestStatusRow glyph motion', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  // The compass needle's transform: "none" at rest, a rotation while it swings.
  const needle = () => (document.querySelector('[data-glyph="compass"] path') as SVGElement | null)?.style.transform ?? '';

  it('animates the glyph', async () => {
    render(<RequestStatusRow label="Generating Plan…" glyph="compass" />);
    await waitReal(300);
    expect(needle()).toMatch(/rotate/);
  });

  it('renders the glyph and runs no animation with reduced motion on', async () => {
    stubReducedMotion();
    render(<RequestStatusRow label="Generating Plan…" glyph="compass" />);
    expect(document.querySelector('[data-glyph="compass"] svg')).toBeTruthy();
    await waitReal(300);
    expect(needle()).toBe('none');
    await waitReal(300);
    expect(needle()).toBe('none');
  });
});
