import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { ReasoningBody } from '@/components/game/ReasoningBlock';
import { readerComponents } from './readerLinks';
import type { SnippetBlock } from './CodeSnippet';

const FENCE = '```javascript before\nreturn stats.hp - 1;\n```';

/** Renders text the way the help window does, with a probe in the toolbar that shows each block it is given. */
function renderReader(text: string) {
  const seen: SnippetBlock[] = [];
  const probe = (block: SnippetBlock) => {
    seen.push(block);
    return <span data-testid="probe">{block.meta ?? 'none'}</span>;
  };
  const view = render(<MarkdownRenderer text={text} components={readerComponents(() => {}, probe)} />);
  return { ...view, seen };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // The stub is an own property; removing it restores jsdom's clipboard.
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('help code blocks', () => {
  it('hands the toolbar the fence meta, language and text', () => {
    const { seen } = renderReader(FENCE);
    expect(screen.getByTestId('probe')).toHaveTextContent('before');
    expect(seen.at(-1)).toEqual({ code: 'return stats.hp - 1;', language: 'javascript', meta: 'before' });
  });

  it('gives an untagged fence no meta', () => {
    const { seen } = renderReader('```javascript\nreturn 1;\n```');
    expect(seen.at(-1)?.meta).toBeUndefined();
  });

  it('copies the block text and confirms it', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const success = vi.spyOn(toast, 'success');
    renderReader(FENCE);
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledExactlyOnceWith('return stats.hp - 1;');
    await waitFor(() => expect(success).toHaveBeenCalledWith('Copied'));
  });

  it('keeps one toolbar per block', () => {
    renderReader(`${FENCE}\n\nThen:\n\n\`\`\`javascript after\nreturn 2;\n\`\`\``);
    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(2);
    expect(screen.getAllByTestId('probe').map((probe) => probe.textContent)).toEqual(['before', 'after']);
  });

  it('leaves inline code bare', () => {
    renderReader('Use `return 1;` here.');
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
  });

  it('keeps the highlighter on the block', async () => {
    const { container } = renderReader(FENCE);
    const block = container.querySelector('[data-streamdown="code-block"]');
    expect(block).not.toBeNull();
    // Before Shiki loads, the plain body paints every token `inherit`; the themed body paints the keyword.
    await waitFor(() => expect(block!.querySelector('span[style*="--code-keyword"]')).toHaveTextContent('return'));
  });

  it('renders a fence that is still open while the answer streams', () => {
    const { container } = render(
      <MarkdownRenderer text={'Put this in the box:\n\n```javascript before\nreturn stats'} animate components={readerComponents(() => {})} />,
    );
    const block = container.querySelector('[data-streamdown="code-block"]');
    expect(block).not.toBeNull();
    expect(within(container).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('leaves every other markdown surface bare', () => {
    const { container } = render(<MarkdownRenderer text={FENCE} />);
    expect(container.querySelector('[data-streamdown="code-block"]')).not.toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    cleanup();
    render(<ReasoningBody text={FENCE} />);
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
  });
});
