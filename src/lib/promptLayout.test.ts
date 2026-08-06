import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { resolveLayout, parseSplitMode, usePromptSplitMode, MIN_PANE_WIDTH } from './promptLayout';

// Exactly wide enough for two panes at the minimum, and one pixel short of it.
const FITS = MIN_PANE_WIDTH * 2 + 12;
const SHORT = FITS - 1;

describe('resolveLayout: splitting is a full-screen affair', () => {
  it('never splits inline, however wide the field is', () => {
    // A field inline is one column of a panel with other things to show. Halving it gives two columns
    // too narrow to read and steals the width from whichever one was being used.
    expect(resolveLayout('auto', 2000, true, false)).toBe('tabs');
    expect(resolveLayout('split', 2000, true, false)).toBe('tabs'); // an explicit pin does not override
  });

  it('splits the same width once full screen', () => {
    expect(resolveLayout('auto', FITS, true, false)).toBe('tabs');
    expect(resolveLayout('auto', FITS, true, true)).toBe('split');
  });
});

describe('resolveLayout: when the split earns its width', () => {
  it('splits on auto once both panes clear the minimum', () => {
    expect(resolveLayout('auto', FITS, true, true)).toBe('split');
  });

  it('falls back to tabs one pixel short, so a shrunken window is never two slivers', () => {
    expect(resolveLayout('auto', SHORT, true, true)).toBe('tabs');
  });

  it('treats a phone-width field as tabs without asking what device it is', () => {
    expect(resolveLayout('auto', 359, true, true)).toBe('tabs');
    expect(resolveLayout('auto', 0, true, true)).toBe('tabs'); // before the first measurement lands
  });

  it('never splits a field with nothing to preview, however wide', () => {
    // A plain chip field with no preview values has only one pane to show; splitting would leave a
    // dead half. This also covers the world editor's description/readme before a playthrough exists.
    expect(resolveLayout('auto', 2000, false, true)).toBe('tabs');
    expect(resolveLayout('split', 2000, false, true)).toBe('tabs'); // an explicit pin cannot conjure a pane
  });

  it('honors an explicit pin over the measurement, in both directions', () => {
    expect(resolveLayout('tabs', FITS, true, true)).toBe('tabs');
    expect(resolveLayout('split', SHORT, true, true)).toBe('split');
  });
});

describe('parseSplitMode', () => {
  it('accepts the two pinned modes', () => {
    expect(parseSplitMode('split')).toBe('split');
    expect(parseSplitMode('tabs')).toBe('tabs');
  });

  it('reads anything else as auto', () => {
    for (const raw of [null, '', 'auto', 'nonsense', '{}']) expect(parseSplitMode(raw)).toBe('auto');
  });
});

describe('usePromptSplitMode', () => {
  beforeEach(() => localStorage.clear());

  it('starts on auto and persists a pin', () => {
    const { result } = renderHook(() => usePromptSplitMode());
    expect(result.current[0]).toBe('auto');

    act(() => result.current[1]('tabs'));
    expect(result.current[0]).toBe('tabs');
    expect(localStorage.getItem('FORMAMORPH_promptSplitMode')).toBe('tabs');

    const reread = renderHook(() => usePromptSplitMode());
    expect(reread.result.current[0]).toBe('tabs');
  });

  it('reaches every field on screen, not just the one that was toggled', () => {
    // The preference is global, so two mounted fields must not disagree about it.
    const a = renderHook(() => usePromptSplitMode());
    const b = renderHook(() => usePromptSplitMode());

    act(() => a.result.current[1]('split'));

    expect(a.result.current[0]).toBe('split');
    expect(b.result.current[0]).toBe('split');
  });

  it('goes back to auto', () => {
    const { result } = renderHook(() => usePromptSplitMode());
    act(() => result.current[1]('split'));
    act(() => result.current[1]('auto'));
    expect(result.current[0]).toBe('auto');
  });
});
