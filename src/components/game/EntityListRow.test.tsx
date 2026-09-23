import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { EntityListRow } from './EntityListRow';

/**
 * The entity list row renders from its label alone. In Play shows it inside the World Editor, where no
 * game is running and no game state exists to read.
 */

afterEach(cleanup);

describe('EntityListRow outside a running game', () => {
  it('shows the name and opens on click', () => {
    const onClick = vi.fn();
    render(<EntityListRow label="Sedge" onClick={onClick} />);
    fireEvent.click(screen.getByText('Sedge'));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Remove Sedge' })).toBeNull();
  });

  it('offers removal without opening the row', () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    render(<EntityListRow label="Stranger" onClick={onClick} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Stranger' }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });
});
