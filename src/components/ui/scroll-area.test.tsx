import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScrollArea } from './scroll-area';

/** The overview ruler: ticks drawn inside the scroll bar's own track, one per mark. */
describe('ScrollArea marks', () => {
  const marks = [
    { fraction: 0, label: 'first hit' },
    { fraction: 0.5, current: true, label: 'second hit' },
    { fraction: 1, label: 'third hit' },
  ];

  const renderRuler = (onMarkSelect?: (index: number) => void) =>
    render(
      <ScrollArea type="always" marks={marks} onMarkSelect={onMarkSelect}>
        <p>content</p>
      </ScrollArea>,
    );

  it('draws one tick per mark, positioned by its fraction', () => {
    const { container } = renderRuler();
    const ticks = [...container.querySelectorAll('[data-scroll-mark]')] as HTMLElement[];
    expect(ticks).toHaveLength(3);
    // A tick's offset is its fraction of the track, less its own height so the last one stays inside.
    expect(ticks.map((t) => t.style.top)).toEqual([
      'calc(0 * (100% - 3px))',
      'calc(0.5 * (100% - 3px))',
      'calc(1 * (100% - 3px))',
    ]);
  });

  it('marks the current tick apart from the rest', () => {
    const { container } = renderRuler();
    const ticks = [...container.querySelectorAll('[data-scroll-mark]')] as HTMLElement[];
    expect(ticks.map((t) => t.hasAttribute('data-current'))).toEqual([false, true, false]);
  });

  it('names each tick so it can be reached by its label', () => {
    renderRuler();
    expect(screen.getByRole('button', { name: 'second hit' })).toBeTruthy();
  });

  it('reports which tick was clicked', async () => {
    const onMarkSelect = vi.fn();
    renderRuler(onMarkSelect);
    await userEvent.click(screen.getByRole('button', { name: 'third hit' }));
    expect(onMarkSelect).toHaveBeenCalledWith(2);
  });

  it('draws no ruler without marks', () => {
    const { container } = render(
      <ScrollArea type="always"><p>content</p></ScrollArea>,
    );
    expect(container.querySelectorAll('[data-scroll-mark]')).toHaveLength(0);
  });
});
