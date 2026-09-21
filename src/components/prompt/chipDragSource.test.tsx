import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CHIP_DRAG_MIME, startPaletteChipDrag, startPlacedChipDrag, type ChipDragKey,
} from './chipDragSource';

interface TestTransfer {
  effectAllowed: string;
  setData: ReturnType<typeof vi.fn>;
  setDragImage: ReturnType<typeof vi.fn>;
}

function transfer(): TestTransfer {
  return { effectAllowed: 'none', setData: vi.fn(), setDragImage: vi.fn() };
}

describe('shared chip drag sources', () => {
  it('starts a palette copy with the shared payload and chip ghost', async () => {
    const dataTransfer = transfer();
    render(
      <button type="button" draggable data-chip onDragStart={(event) => startPaletteChipDrag(event, 'town')}>
        Town
      </button>,
    );

    fireEvent.dragStart(screen.getByRole('button', { name: 'Town' }), { dataTransfer });

    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(dataTransfer.setData).toHaveBeenCalledWith(CHIP_DRAG_MIME, 'town');
    expect(dataTransfer.setDragImage).toHaveBeenCalledWith(expect.any(HTMLElement), 0, 0);
    expect(document.querySelector('[data-chip-drag-ghost]')).toHaveTextContent('Town');
    await waitFor(() => expect(document.querySelector('[data-chip-drag-ghost]')).not.toBeInTheDocument());
  });

  it('parks a placed node and starts a move with the exact token', async () => {
    const dataTransfer = transfer();
    const dragKey: ChipDragKey = { current: null };
    render(
      <button
        type="button"
        draggable
        onDragStart={(event) => startPlacedChipDrag(event, dragKey, 'node-1', '{{ph:town|p:one}}')}
      >
        <span data-chip>Town</span>
      </button>,
    );

    fireEvent.dragStart(screen.getByRole('button', { name: 'Town' }), { dataTransfer });

    expect(dragKey.current).toBe('node-1');
    expect(dataTransfer.effectAllowed).toBe('move');
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', '{{ph:town|p:one}}');
    expect(dataTransfer.setDragImage).toHaveBeenCalledWith(expect.any(HTMLElement), 0, 0);
    expect(document.querySelector('[data-chip-drag-ghost]')).toHaveTextContent('Town');
    await waitFor(() => expect(document.querySelector('[data-chip-drag-ghost]')).not.toBeInTheDocument());
  });
});
