import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FooterActionOrderReference } from './FooterActionOrderReference';

describe('footer action order reference', () => {
  it('keeps creation disabled until valid input and returns focus after canceling', async () => {
    const user = userEvent.setup();
    render(<FooterActionOrderReference />);

    const opener = screen.getByRole('button', { name: 'Open Create Group Example' });
    await user.click(opener);

    const name = screen.getByRole('textbox', { name: 'Group Name' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const create = screen.getByRole('button', { name: 'Create Group' });
    expect(name).toHaveFocus();
    expect(create).toBeDisabled();

    await user.type(name, 'Lantern Keepers');
    expect(create).toBeEnabled();

    name.focus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByText('No sample group was created.')).toBeInTheDocument();
    expect(opener).toHaveFocus();

    await user.click(opener);
    expect(screen.getByRole('textbox', { name: 'Group Name' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByText('No sample group was created.')).toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('changes only the local creation sample after confirmation', async () => {
    const user = userEvent.setup();
    render(<FooterActionOrderReference />);

    const opener = screen.getByRole('button', { name: 'Open Create Group Example' });
    await user.click(opener);
    await user.type(screen.getByRole('textbox', { name: 'Group Name' }), 'Lantern Keepers');
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Create Group' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByText('Created the local group “Lantern Keepers”.')).toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('preserves destructive semantics and mutates only after confirmation', async () => {
    const user = userEvent.setup();
    render(<FooterActionOrderReference />);

    const opener = screen.getByRole('button', { name: 'Open Delete Example' });
    await user.click(opener);

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const remove = screen.getByRole('button', { name: 'Delete' });
    expect(remove).toHaveClass('bg-destructive-fill');

    await user.click(cancel);
    expect(screen.getByText('The local sample is available.')).toBeInTheDocument();
    expect(opener).toHaveFocus();

    await user.click(opener);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByText('Deleted the local sample.')).toBeInTheDocument();
    expect(opener).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Restore Local Sample' }));
    expect(screen.getByText('The local sample is available.')).toBeInTheDocument();
  });

  it('includes an established long action label for responsive layout checks', async () => {
    const user = userEvent.setup();
    render(<FooterActionOrderReference />);

    const opener = screen.getByRole('button', { name: 'Open Long Label Example' });
    await user.click(opener);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download and Embed — Works Offline' }));
    expect(screen.getByText('Embedded the images in the local example.')).toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
