import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';

import { CanvasControlButton, CanvasControls } from './CanvasControls';
import { TooltipProvider } from '@/components/ui/tooltip';

const show = (extra?: React.ReactNode) =>
  render(
    <TooltipProvider>
      <ReactFlowProvider>
        <CanvasControls>{extra}</CanvasControls>
      </ReactFlowProvider>
    </TooltipProvider>,
  );

describe('the canvas zoom controls', () => {
  it('names each button, so the tip is what a reader is told too', () => {
    show();

    for (const name of ['Zoom In', 'Zoom Out', 'Fit View']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('raises the app’s own tip rather than the browser’s', async () => {
    // The whole reason these are our buttons: xyflow's take their `title` and their `aria-label` from
    // one string, so its own controls cannot keep the name and drop the browser tip.
    show();
    const zoomIn = screen.getByRole('button', { name: 'Zoom In' });
    expect(zoomIn).not.toHaveAttribute('title');

    await userEvent.hover(zoomIn);

    expect(await screen.findByText('Zoom In', { selector: 'div' })).toBeVisible();
  });

  it('keeps xyflow’s own button styling, so the panel still reads as one control', () => {
    show();

    for (const name of ['Zoom In', 'Zoom Out', 'Fit View']) {
      expect(screen.getByRole('button', { name })).toHaveClass('react-flow__controls-button');
    }
  });

  it('hangs a caller’s own control off the end of the same panel', () => {
    const onClick = vi.fn();
    show(
      <CanvasControlButton tip="Edit Full Screen" onClick={onClick}>
        <span aria-hidden>x</span>
      </CanvasControlButton>,
    );

    const extra = screen.getByRole('button', { name: 'Edit Full Screen' });
    expect(extra).toHaveClass('react-flow__controls-button');
    expect(extra.parentElement).toBe(screen.getByRole('button', { name: 'Fit View' }).parentElement);
  });
});
