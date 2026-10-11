import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';

// Rendered through MarkdownRenderer, so the check covers Streamdown calling our modal, not the modal alone.
function renderLink(onAncestor: () => void) {
  render(
    <div onClick={onAncestor} onPointerDown={onAncestor} onKeyDown={onAncestor}>
      <MarkdownRenderer text="See [the site](https://example.com/page)." />
    </div>,
  );
  const link = screen.getByRole('button', { name: 'the site' });
  link.focus();
  fireEvent.click(link);
  return link;
}

describe('ExternalLinkDialog', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens our alert for a markdown link, not Streamdown\'s own modal', async () => {
    renderLink(() => {});
    expect(await screen.findByRole('alertdialog', { name: 'Open External Link?' })).toBeTruthy();
    expect(screen.getByText('https://example.com/page')).toBeTruthy();
    expect(document.querySelector('[data-streamdown="link-safety-modal"]')).toBeNull();
  });

  it('keeps presses in the dialog away from the link\'s ancestors', async () => {
    const onAncestor = vi.fn();
    renderLink(onAncestor);
    await screen.findByRole('alertdialog');
    onAncestor.mockClear();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.pointerDown(cancel);
    fireEvent.keyDown(cancel, { key: 'Tab' });
    fireEvent.click(cancel);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onAncestor).not.toHaveBeenCalled();
  });

  it('returns focus to the link when it closes', async () => {
    const link = renderLink(() => {});
    await screen.findByRole('alertdialog');
    expect(document.activeElement).not.toBe(link);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(document.activeElement).toBe(link);
  });

  it('opens the URL on Open Link and closes', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderLink(() => {});
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: 'Open Link' }));
    expect(open).toHaveBeenCalledWith('https://example.com/page', '_blank', 'noreferrer');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});
