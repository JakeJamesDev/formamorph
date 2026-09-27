import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { playerBubbleActions } from '@/lib/bubbleActions';
import { NarrationTurnReference } from './NarrationTurnReference';

const renderReference = () => render(<TooltipProvider><NarrationTurnReference /></TooltipProvider>);
const latest = () => screen.getByRole('region', { name: 'Latest Page' });
const past = () => screen.getByRole('region', { name: 'Past Page' });

describe('narration turn reference', () => {
  it('runs a production row action on the latest card', async () => {
    const user = userEvent.setup();
    renderReference();

    await user.click(within(latest()).getByRole('button', { name: 'Re-generate Narration' }));

    expect(screen.getByRole('status')).toHaveTextContent('Last action: Re-generate Narration');
    expect(within(latest()).queryByRole('button', { name: 'Rewind to Here' })).toBeNull();
  });

  it('gives the past card Rewind to Here and no re-generate action', () => {
    renderReference();

    expect(within(past()).getByRole('button', { name: 'Rewind to Here' })).toBeInTheDocument();
    expect(within(past()).queryByRole('button', { name: 'Re-generate Narration' })).toBeNull();
    expect(within(past()).queryByRole('button', { name: 'Re-generate Choices' })).toBeNull();
  });

  it('shows a plate only where the turn has an image, and deletes the image in view', async () => {
    const user = userEvent.setup();
    renderReference();

    expect(within(past()).queryByRole('img', { name: 'Scene illustration' })).toBeNull();
    expect(within(latest()).getByText('2/2')).toBeInTheDocument();

    await user.click(within(latest()).getByRole('button', { name: 'Delete this image' }));
    expect(screen.getByRole('status')).toHaveTextContent('Images: 1');

    await user.click(screen.getByRole('button', { name: 'Restore Images' }));
    expect(within(latest()).getByText('2/2')).toBeInTheDocument();
  });

  it('stages a choice on click and appends one with Ctrl', async () => {
    const user = userEvent.setup();
    renderReference();
    const first = within(latest()).getByRole('button', { name: /Ask her why/ });
    const third = within(latest()).getByRole('button', { name: /Look past her/ });

    await user.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard('{Control>}');
    await user.click(third);
    await user.keyboard('{/Control}');
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(third).toHaveAttribute('aria-pressed', 'true');

    await user.click(third);
    expect(first).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens the action line menu with the player actions and not the card menu', async () => {
    const user = userEvent.setup();
    renderReference();
    const line = within(latest()).getByTestId('action-line');

    fireEvent.contextMenu(line, { button: 2, clientX: 10, clientY: 10 });
    const labels = within(screen.getByRole('menu')).getAllByRole('menuitem').map((item) => item.textContent);
    const playerLabels = playerBubbleActions({ live: false, busy: false }, { edit: () => {}, copy: () => {} }).map((a) => a.label);
    expect(labels).toEqual(playerLabels);
    expect(labels).not.toContain('Re-generate Narration');

    await user.click(screen.getByRole('menuitem', { name: 'Copy Text' }));
    expect(screen.getByRole('status')).toHaveTextContent('Last action: Copy Text');
  });

  it('enables Re-generate Stats on the latest turn and disables it on the past turn', async () => {
    const user = userEvent.setup();
    renderReference();
    const regenerate = within(latest()).getByRole('button', { name: 'Re-generate Stats' });

    expect(regenerate).toBeEnabled();
    expect(within(past()).getByRole('button', { name: 'Re-generate Stats' })).toBeDisabled();

    await user.click(regenerate);
    expect(screen.getByRole('status')).toHaveTextContent('Last action: Re-generate Stats');
    const edit = within(latest()).getByRole('button', { name: 'Edit Stats' });
    await user.click(edit);
    expect(edit).toHaveAttribute('aria-pressed', 'true');
  });

  it.each(['Edit Stats', 'Re-generate Stats'])('shows the %s tooltip', async (name) => {
    const user = userEvent.setup();
    renderReference();

    await user.hover(within(latest()).getByRole('button', { name }));
    expect(await screen.findByText(name)).toBeVisible();
  });

  it('disables the past rows and marks the choice taken', () => {
    renderReference();
    const rows = within(within(past()).getByTestId('choice-rows')).getAllByRole('button');

    expect(rows.map((row) => row.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    for (const row of rows) expect(row).toBeDisabled();
  });
});
