import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConnectionInspector } from './ConnectionInspector';
import { applyCanvasIntent, type CanvasIntent } from '@/lib/locationCanvas';
import type { Connection } from '@/types';

const NAMES: Record<string, string> = { cave: 'Cave', ledge: 'Ledge' };
const oneWay: Connection = { id: 'c1', a: 'cave', b: 'ledge', aToB: { hint: 'up the rope' } };

/** Renders the panel for `connection` and returns what each edit does to the world's list. */
function renderInspector(connection: Connection) {
  const onIntent = vi.fn<(intent: CanvasIntent) => void>();
  render(
    <ConnectionInspector
      connection={connection}
      focus={null}
      nameOf={(id) => NAMES[id]}
      placeholders={[]}
      onIntent={onIntent}
      onClose={() => {}}
    />,
  );
  const lastResult = () => applyCanvasIntent([connection], onIntent.mock.calls.at(-1)![0]);
  return { onIntent, lastResult };
}

describe('ConnectionInspector', () => {
  it('shows the Connection widget: Travel, Distance and the hint boxes', () => {
    renderInspector({ ...oneWay, bToA: {} });
    expect(screen.getByText('Travel')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Travel between Cave and Ledge' })).toBeInTheDocument();
    expect(screen.getByText('Distance')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Distance between Cave and Ledge' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More info' })).toBeInTheDocument();
    expect(screen.getByLabelText('Travel Hint to Ledge')).toBeInTheDocument();
    expect(screen.getByLabelText('Travel Hint to Cave')).toBeInTheDocument();
  });

  it('names both ends on each Travel choice and reads it from the first end', () => {
    renderInspector(oneWay);
    expect(screen.getByRole('radio', { name: 'Travel one way, Cave to Ledge' })).toHaveAttribute('data-state', 'on');
    expect(screen.getByRole('radio', { name: 'Travel both ways between Cave and Ledge' })).toHaveAttribute('data-state', 'off');
  });

  it('flips the travel and sets the distance through an update intent', () => {
    const { lastResult } = renderInspector(oneWay);
    fireEvent.click(screen.getByRole('radio', { name: 'Travel one way, Ledge to Cave' }));
    expect(lastResult()).toEqual([{ id: 'c1', a: 'cave', b: 'ledge', bToA: { hint: 'up the rope' } }]);
    fireEvent.click(screen.getByRole('radio', { name: 'Far' }));
    expect(lastResult()).toEqual([{ ...oneWay, distance: 'far' }]);
  });

  it('makes a one-way pair two-way, copying its hint to the new leg', () => {
    const { lastResult } = renderInspector(oneWay);
    fireEvent.click(screen.getByRole('radio', { name: 'Travel both ways between Cave and Ledge' }));
    expect(lastResult()).toEqual([{ ...oneWay, bToA: { hint: 'up the rope' } }]);
  });

  it('turns a two-way Far pair one-way from the first end, then back to Nearby', () => {
    const twoWayFar: Connection = { ...oneWay, bToA: { hint: 'down the rope' }, distance: 'far' };
    const { lastResult } = renderInspector(twoWayFar);
    fireEvent.click(screen.getByRole('radio', { name: 'Travel one way, Cave to Ledge' }));
    expect(lastResult()).toEqual([{ ...oneWay, distance: 'far' }]);
    fireEvent.click(screen.getByRole('radio', { name: 'Nearby' }));
    expect(lastResult()).toEqual([{ ...oneWay, bToA: { hint: 'down the rope' } }]);
  });

  it('changes nothing when the active Travel or Distance choice is clicked again', () => {
    const { onIntent } = renderInspector(oneWay);
    fireEvent.click(screen.getByRole('radio', { name: 'Travel one way, Cave to Ledge' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Nearby' }));
    expect(onIntent).not.toHaveBeenCalled();
  });
});
