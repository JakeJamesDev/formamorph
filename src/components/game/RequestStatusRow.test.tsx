import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { RequestStatusRow } from './RequestStatusRow';
import { BackgroundPassStatus } from './BackgroundPassStatus';

describe('RequestStatusRow timer', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const timer = () => document.querySelector('[data-slot="status-timer"]');
  const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

  it('shows no timer before 3 s and whole seconds after', () => {
    render(<RequestStatusRow label="Generating Narration…" startedAt={Date.now()} />);
    advance(2000);
    expect(timer()).toBeNull();
    advance(1500);
    expect(timer()?.textContent).toBe('3s');
    advance(9000);
    expect(timer()?.textContent).toBe('12s');
  });

  it('keeps counting when the request label changes within one turn', () => {
    const startedAt = Date.now();
    const { rerender } = render(<RequestStatusRow label="Generating Plan…" startedAt={startedAt} />);
    advance(5000);
    rerender(<RequestStatusRow label="Generating Narration…" startedAt={startedAt} />);
    expect(timer()?.textContent).toBe('5s');
    advance(2000);
    rerender(<RequestStatusRow label="Generating Choices…" startedAt={startedAt} />);
    expect(timer()?.textContent).toBe('7s');
  });

  it('resets when the next turn starts', () => {
    const { rerender } = render(<RequestStatusRow label="Generating Narration…" startedAt={Date.now()} />);
    advance(8000);
    expect(timer()?.textContent).toBe('8s');
    rerender(<RequestStatusRow label="Generating Plan…" startedAt={Date.now()} />);
    expect(timer()).toBeNull();
    advance(3000);
    expect(timer()?.textContent).toBe('3s');
  });

  it('shows no timer on a row without a start', () => {
    render(<RequestStatusRow label="Calling roll_dice…" />);
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
    const { unmount } = render(<RequestStatusRow label="Generating Narration…" startedAt={Date.now()} />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('RequestStatusRow', () => {
  it('shows the label as text beside the bar', () => {
    render(<RequestStatusRow label="Generating Narration…" />);
    expect(screen.getByText('Generating Narration…')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('keeps the glyph slot out of the accessibility tree', () => {
    const { container } = render(<RequestStatusRow label="Summarizing turn…" glyph={<svg data-testid="glyph" />} />);
    const slot = container.querySelector('[data-slot="status-glyph"]');
    expect(slot?.getAttribute('aria-hidden')).toBe('true');
    expect(slot?.contains(screen.getByTestId('glyph'))).toBe(true);
  });
});
