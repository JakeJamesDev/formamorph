import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pencil, Trash2 } from 'lucide-react';
import { TurnCard } from './TurnCard';
import type { BubbleAction } from '@/lib/bubbleActions';

const actions: BubbleAction[] = [
  { key: 'edit', label: 'Edit', icon: Pencil, section: 'content', run: vi.fn() },
  { key: 'delete', label: 'Delete', icon: Trash2, section: 'destructive', menuOnly: true, run: vi.fn() },
];

/** One turn surface: body, action row, and right-click menu. */
describe('TurnCard', () => {
  it('renders the body above an action row with the turn number, row actions, and More', () => {
    render(<TurnCard actions={actions} turnNumber={4}><p>The marsh is quiet.</p></TurnCard>);
    expect(screen.getByText('The marsh is quiet.')).toBeInTheDocument();
    const row = screen.getByTestId('bubble-actions');
    expect(row.textContent).toContain('Turn 4');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('hides the row when the action list is empty', () => {
    render(<TurnCard actions={[]} turnNumber={2}><p>body</p></TurnCard>);
    expect(screen.queryByTestId('bubble-actions')).toBeNull();
  });

  it('keeps the row closed and the menu empty while the turn is live, then opens the row by growing it', () => {
    const view = render(<TurnCard actions={actions} turnNumber={2} live><p>body</p></TurnCard>);
    const row = screen.getByTestId('turn-actions');
    expect(row.dataset.open).toBe('false');
    expect(row.getAttribute('aria-hidden')).toBe('true');
    expect(row.style.gridTemplateRows).toBe('0fr');
    fireEvent.contextMenu(screen.getByText('body'));
    expect(screen.queryByRole('menu')).toBeNull();
    view.rerender(<TurnCard actions={actions} turnNumber={2}><p>body</p></TurnCard>);
    expect(row.dataset.open).toBe('true');
    expect(row.style.gridTemplateRows).toBe('1fr');
    expect(row.style.transition).toContain('grid-template-rows');
  });

  it('opens its menu with every action on right-click', () => {
    render(<TurnCard actions={actions} turnNumber={2}><p>body</p></TurnCard>);
    fireEvent.contextMenu(screen.getByText('body'));
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
  });
});
