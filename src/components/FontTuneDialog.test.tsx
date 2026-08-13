// Storage is real (in-memory): SettingsProvider reads it on mount, and the dialog commits through it.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { FontTuneButton } from './FontTuneDialog';
import type { FontChoice, NarrationFont } from '@/contexts/settingsDefaults';

/**
 * The seam is the document root's CSS variables — the same one the settings context already uses to
 * apply a font — so these drive the real dialog under the real provider and read what the page would.
 */

vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

const rootVar = (name: string) => document.documentElement.style.getPropertyValue(name);

let setFont: (f: FontChoice) => void;
let setNarrationFont: (f: NarrationFont) => void;

/** The button plus handles on both font settings, so a test can switch fonts the way Settings would.
 *  `narration` picks which selector's button renders — the same dialog, keyed by that selector's font. */
function Harness({ narration = false }: { narration?: boolean }) {
  const s = useSettings();
  setFont = s.setFontFamily;
  setNarrationFont = s.setNarrationFont;
  const font = narration && s.narrationFont !== 'global' ? s.narrationFont : s.fontFamily;
  return <FontTuneButton font={font} />;
}

const mount = (narration = false) => render(<SettingsProvider><Harness narration={narration} /></SettingsProvider>);

/** Nudge a slider by `steps` (Radix sliders move on arrow keys). */
async function nudge(user: ReturnType<typeof userEvent.setup>, name: RegExp, steps: number) {
  const sliders = screen.getAllByRole('slider');
  const labels = screen.getAllByText(name);
  const target = labels[0].closest('label')!.querySelector('[role="slider"]') as HTMLElement;
  expect(sliders).toContain(target);
  target.focus();
  for (let i = 0; i < Math.abs(steps); i++) await user.keyboard(steps > 0 ? '{ArrowRight}' : '{ArrowLeft}');
}

const openDialog = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /customize/i }));

beforeEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-italic-skew');
});

describe('shipped tunings', () => {
  it('applies the baseline weights for an untuned font', () => {
    mount();
    expect(rootVar('--fm-weight-semibold')).toBe('600');
    expect(rootVar('--fm-weight-bold')).toBe('700');
  });

  it('gives JetBrains Mono its seeded 800 with no user action', () => {
    mount();
    act(() => setFont('jetbrainsmono'));
    expect(rootVar('--fm-weight-semibold')).toBe('800');
    // Its axis tops out at 800, so bold coincides rather than running past the face.
    expect(rootVar('--fm-weight-bold')).toBe('800');
  });

  it('scales the x-height target rather than the root font size', async () => {
    const user = userEvent.setup();
    mount();
    // 0.52 default target, untuned.
    expect(document.documentElement.style.getPropertyValue('font-size-adjust')).toBe('0.52');

    await openDialog(user);
    await nudge(user, /Font Size/, 1); // 1.0 → 1.1
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(Number(document.documentElement.style.getPropertyValue('font-size-adjust'))).toBeCloseTo(0.572, 4);
    // Root font size is never touched — layout spacing must not move with the tuning.
    expect(document.documentElement.style.fontSize).toBe('');
  });
});

describe('the sample text', () => {
  it('resizes with the Font Size slider before anything is saved', async () => {
    const user = userEvent.setup();
    mount();
    await openDialog(user);
    const sample = screen.getAllByText(/lantern guttered/)[0].closest('div')!;
    expect(sample.style.fontSizeAdjust).toBe('0.52');

    await nudge(user, /Font Size/, 1); // 1.0 → 1.1
    // A number here would be unit-suffixed to `0.572px` and dropped, leaving the sample frozen.
    expect(Number(sample.style.fontSizeAdjust)).toBeCloseTo(0.572, 4);
  });
});

describe('the narration pane', () => {
  it('runs on the app font’s tunings while the selector says Use Global', async () => {
    const user = userEvent.setup();
    mount();
    await openDialog(user);
    await nudge(user, /Bold Weight/, 2);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // One tuning job covers both selectors: the pane carries the same numbers the app does.
    expect(rootVar('--narration-fm-weight-semibold')).toBe('650');
    expect(rootVar('--fm-weight-semibold')).toBe('650');
  });

  it('carries its own font’s tunings when it uses a different font', async () => {
    const user = userEvent.setup();
    mount(true);
    act(() => setNarrationFont('jetbrainsmono'));

    // The app font is untuned; the narration pane picks up JetBrains Mono's shipped 800.
    expect(rootVar('--fm-weight-semibold')).toBe('600');
    expect(rootVar('--narration-fm-weight-semibold')).toBe('800');

    await openDialog(user);
    await nudge(user, /Line Height/, 2);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // The pane's own line-height multiplier moves; the app's stays at the untuned identity.
    expect(rootVar('--narration-fm-line-height')).toBe('1.1');
    expect(rootVar('--fm-line-height')).toBe('1');
  });
});

describe('save and cancel', () => {
  it('leaves the app untouched while sliders move, and applies on Save', async () => {
    const user = userEvent.setup();
    mount();
    await openDialog(user);
    await nudge(user, /Bold Weight/, 2); // 600 → 650

    expect(rootVar('--fm-weight-semibold')).toBe('600'); // still untouched mid-drag

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(rootVar('--fm-weight-semibold')).toBe('650');
    expect(rootVar('--fm-weight-bold')).toBe('750');
  });

  it('discards the draft on Cancel', async () => {
    const user = userEvent.setup();
    mount();
    await openDialog(user);
    await nudge(user, /Bold Weight/, 2);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(rootVar('--fm-weight-semibold')).toBe('600');
  });

  it('applies letter spacing and line height as their own variables', async () => {
    const user = userEvent.setup();
    mount();
    await openDialog(user);
    await nudge(user, /Letter Spacing/, 2); // 0 → 0.01em
    await nudge(user, /Line Height/, 2); // 1 → 1.1
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(rootVar('--fm-letter-spacing')).toBe('0.01em');
    expect(rootVar('--fm-line-height')).toBe('1.1');
  });

  it('flags the root only while italic skew is above zero', async () => {
    const user = userEvent.setup();
    mount();
    expect(document.documentElement.hasAttribute('data-italic-skew')).toBe(false);

    await openDialog(user);
    await nudge(user, /Italic Slant/, 4); // 0 → 2°
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(rootVar('--fm-italic-skew')).toBe('2deg');
    expect(document.documentElement.hasAttribute('data-italic-skew')).toBe(true);
  });
});

describe('per-font storage', () => {
  it('swaps to the other font’s tunings when the font changes', async () => {
    const user = userEvent.setup();
    mount();
    await openDialog(user);
    await nudge(user, /Bold Weight/, 2);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(rootVar('--fm-weight-semibold')).toBe('650');

    act(() => setFont('inter'));
    expect(rootVar('--fm-weight-semibold')).toBe('600'); // inter is untuned

    act(() => setFont('system'));
    expect(rootVar('--fm-weight-semibold')).toBe('650'); // back to the tuned font
  });

  it('survives a provider remount', async () => {
    const user = userEvent.setup();
    mount();
    await openDialog(user);
    await nudge(user, /Bold Weight/, 2);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    cleanup();
    document.documentElement.removeAttribute('style');
    mount();
    expect(rootVar('--fm-weight-semibold')).toBe('650');
  });

  it('falls back to defaults on an unreadable stored value', () => {
    localStorage.setItem('FORMAMORPH_fontTunings', 'not json at all');
    mount();
    expect(rootVar('--fm-weight-semibold')).toBe('600');
  });
});

describe('reset', () => {
  it('returns the font to its shipped tuning, not a blank slate', async () => {
    const user = userEvent.setup();
    mount();
    act(() => setFont('jetbrainsmono'));
    await openDialog(user);
    await nudge(user, /Bold Weight/, -4); // 800 → 700
    await user.click(screen.getByRole('button', { name: /reset to defaults/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(rootVar('--fm-weight-semibold')).toBe('800');
  });
});
