import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { RequestStatusRow } from './RequestStatusRow';
import { BackgroundPassStatus } from './BackgroundPassStatus';

describe('RequestStatusRow glyph', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
  // The entering glyph; an outgoing one may still fade out beside it.
  const shownGlyph = () => [...document.querySelectorAll('[data-glyph]')].at(-1)?.getAttribute('data-glyph');

  it.each([
    ['Generating Plan…', 'compass'],
    ['Generating Narration…', 'quill'],
    ['Generating Cast…', 'masks'],
    ['Generating Choices…', 'split'],
    ['Calling roll_dice…', 'hammer'],
  ] as const)('shows %s with its glyph beside it', (label, glyph) => {
    render(<RequestStatusRow label={label} glyph={glyph} />);
    const slot = document.querySelector('[data-slot="status-glyph"]');
    expect(slot?.nextElementSibling?.textContent).toBe(label);
    expect(shownGlyph()).toBe(glyph);
    expect(slot?.querySelector('svg')).toBeTruthy();
  });

  it('changes the label at once and the glyph only after the old one has shown 300 ms', () => {
    const { rerender } = render(<RequestStatusRow label="Generating Plan…" glyph="compass" />);
    advance(100);
    rerender(<RequestStatusRow label="Generating Stat Updates…" glyph="chartColumnIncreasing" />);
    expect(screen.getByText('Generating Stat Updates…')).toBeTruthy();
    expect(shownGlyph()).toBe('compass');
    advance(199);
    expect(shownGlyph()).toBe('compass');
    advance(1);
    expect(shownGlyph()).toBe('chartColumnIncreasing');
  });

  it('swaps at once when the old glyph has already shown 300 ms', () => {
    const { rerender } = render(<RequestStatusRow label="Generating Plan…" glyph="compass" />);
    advance(400);
    rerender(<RequestStatusRow label="Generating Location…" glyph="mapPin" />);
    expect(shownGlyph()).toBe('mapPin');
  });

  it.each([
    ['digest', 'Summarizing turn…', 'bookOpen'],
    ['milestone', 'Selecting memories…', 'bookOpen'],
    ['diary', 'Writing diary…', 'bookOpen'],
    ['discover', 'Describing character…', 'masks'],
  ] as const)('shows the %s pass as %s with its glyph beside it', (kind, label, glyph) => {
    render(<BackgroundPassStatus running={new Set([kind])} />);
    const slot = document.querySelector('[data-slot="status-glyph"]');
    expect(slot?.nextElementSibling?.textContent).toBe(label);
    expect(shownGlyph()).toBe(glyph);
  });

  it('skips a glyph that was replaced before it could show', () => {
    const { rerender } = render(<RequestStatusRow label="Generating Plan…" glyph="compass" />);
    rerender(<RequestStatusRow label="Generating Location…" glyph="mapPin" />);
    advance(100);
    rerender(<RequestStatusRow label="Generating Clock…" glyph="hourglass" />);
    advance(200);
    expect(shownGlyph()).toBe('hourglass');
    expect(document.querySelector('[data-glyph="mapPin"]')).toBeNull();
  });
});

describe('RequestStatusRow timer', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const timer = () => document.querySelector('[data-slot="status-timer"]');
  const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

  it('shows no timer before 3 s and whole seconds after', () => {
    render(<RequestStatusRow label="Generating Narration…" glyph="sparkles" startedAt={Date.now()} />);
    advance(2000);
    expect(timer()).toBeNull();
    advance(1500);
    expect(timer()?.textContent).toBe('3s');
    advance(9000);
    expect(timer()?.textContent).toBe('12s');
  });

  it('keeps counting when the request label changes within one turn', () => {
    const startedAt = Date.now();
    const { rerender } = render(<RequestStatusRow label="Generating Plan…" glyph="sparkles" startedAt={startedAt} />);
    advance(5000);
    rerender(<RequestStatusRow label="Generating Narration…" glyph="sparkles" startedAt={startedAt} />);
    expect(timer()?.textContent).toBe('5s');
    advance(2000);
    rerender(<RequestStatusRow label="Generating Choices…" glyph="sparkles" startedAt={startedAt} />);
    expect(timer()?.textContent).toBe('7s');
  });

  it('resets when the next turn starts', () => {
    const { rerender } = render(<RequestStatusRow label="Generating Narration…" glyph="sparkles" startedAt={Date.now()} />);
    advance(8000);
    expect(timer()?.textContent).toBe('8s');
    rerender(<RequestStatusRow label="Generating Plan…" glyph="sparkles" startedAt={Date.now()} />);
    expect(timer()).toBeNull();
    advance(3000);
    expect(timer()?.textContent).toBe('3s');
  });

  it('shows no timer on a row without a start', () => {
    render(<RequestStatusRow label="Calling roll_dice…" glyph="hammer" />);
    advance(10000);
    expect(timer()).toBeNull();
  });

  it('shows no timer on the background pass row', () => {
    render(<BackgroundPassStatus running={new Set(['digest'] as const)} />);
    advance(10000);
    expect(screen.getByText('Summarizing turn…')).toBeTruthy();
    expect(timer()).toBeNull();
  });

  it('stops ticking on unmount', () => {
    const { unmount } = render(<RequestStatusRow label="Generating Narration…" glyph="sparkles" startedAt={Date.now()} />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('RequestStatusRow', () => {
  it('shows the label as text beside the bar', () => {
    render(<RequestStatusRow label="Generating Narration…" glyph="sparkles" />);
    expect(screen.getByText('Generating Narration…')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('keeps the glyph slot out of the accessibility tree', () => {
    const { container } = render(<RequestStatusRow label="Summarizing turn…" glyph="bookOpen" />);
    const slot = container.querySelector('[data-slot="status-glyph"]');
    expect(slot?.getAttribute('aria-hidden')).toBe('true');
    expect(slot?.querySelector('svg')).toBeTruthy();
  });
});
