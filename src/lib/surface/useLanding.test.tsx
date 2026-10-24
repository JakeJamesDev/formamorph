import { useEffect, useState } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { frames, recordScrolls } from '@/test/landing';
import { useLanding } from './useLanding';

const scrolled = recordScrolls();
afterEach(cleanup);

/** A row whose button enables after `enableAfter` frames, as one does once the data behind it loads. */
function Row({ enableAfter, onReady }: { enableAfter: number; onReady: (land: () => void) => void }) {
  const [enabled, setEnabled] = useState(false);
  const land = useLanding<string>((target) => document.querySelector<HTMLElement>(`[data-row="${target}"]`));
  useEffect(() => { onReady(() => land('row')); }, [land, onReady]);
  useEffect(() => {
    let left = enableAfter;
    let frame = 0;
    const tick = () => { if (--left <= 0) setEnabled(true); else frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enableAfter]);
  return <button type="button" data-row="row" disabled={!enabled}>Go</button>;
}

describe('a landing on a control that enables late', () => {
  it('focuses the control once it enables, and scrolls to it then', async () => {
    let land = () => {};
    render(<Row enableAfter={6} onReady={(fn) => { land = fn; }} />);

    await act(async () => { land(); });
    await frames(3);
    expect(scrolled).toHaveLength(0);
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Go' }));

    // React commits the enabled state when the act scope of the frames ends; the landing looks again after it.
    await frames(12);
    await frames(4);
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toBeEnabled();
    expect(scrolled).toEqual([button]);
    expect(document.activeElement).toBe(button);
  });

  it('lands anyway, without focus, when the control never enables', async () => {
    let land = () => {};
    render(<Row enableAfter={1000} onReady={(fn) => { land = fn; }} />);

    await act(async () => { land(); });
    await frames(40);
    const button = screen.getByRole('button', { name: 'Go' });
    expect(scrolled).toEqual([button]);
    expect(document.activeElement).not.toBe(button);
  });
});
