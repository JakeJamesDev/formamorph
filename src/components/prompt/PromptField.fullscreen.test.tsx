import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from './PromptField';
import { promptVocabulary } from '@/lib/chipVocabulary';

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const show = () => render(
  <PromptField
    value="some prose"
    onChange={() => {}}
    vocabulary={promptVocabulary([])}
    markdown
    label="World Description"
    ariaLabel="World Description"
  />,
);

describe('PromptField full screen', () => {
  it('holds the space it left behind so the panel underneath does not scroll', async () => {
    const user = userEvent.setup();
    const { container } = show();
    expect(container.querySelector('[aria-hidden][style*="height"]')).toBeNull();

    await user.click(screen.getByLabelText('Edit full screen'));

    // The body goes into the overlay, so the panel it came from is one editor shorter and the browser
    // clamps its scroll to the new bottom — the page jumps on the way in and back again on the way out.
    // A spacer of the same height keeps the panel the size it was.
    expect(container.querySelector('[aria-hidden]')).not.toBeNull();
  });

  it('returns focus to the field toolbar after closing, not to whatever the host trap picks', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByLabelText('Edit full screen'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // The button that opened the window was destroyed when the body moved into the overlay, so the
    // remembered element is gone. Without a fallback, focus lands on nothing and the host dialog's trap
    // yanks it to its first control — which can be far up a scrolled panel, dragging the scroll with it.
    await user.click(screen.getByLabelText('Exit full screen'));
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Edit full screen')));
  });

  it('moves its body into the window rather than leaving a second copy behind', async () => {
    const user = userEvent.setup();
    show();
    expect(screen.getAllByText('World Description')).toHaveLength(1);

    await user.click(screen.getByLabelText('Edit full screen'));
    // One caption, inside the overlay: the field's own label row travels with it, which is why the window
    // adds no heading of its own.
    const overlay = screen.getByRole('dialog');
    const captions = screen.getAllByText('World Description')
      .filter(element => element.tagName === 'LABEL');
    expect(captions).toHaveLength(1);
    expect(overlay).toContainElement(captions[0]);
  });
});
