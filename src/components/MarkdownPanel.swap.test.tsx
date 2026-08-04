import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownPanel } from '@/components/MarkdownPanel';

// Streamdown memoizes rendered nodes on their SOURCE POSITION, not their text — so when a panel's
// markdown is replaced in place, any node whose replacement occupies the same span keeps the old
// render. Narration is keyed by content for this reason; these guard the shared static panel.
describe('MarkdownPanel — replacing the text in place', () => {
  it('repaints a same-span heading instead of keeping the old one', () => {
    // "### v2.9.1" and "### v2.9.2" occupy identical source spans — the exact collision the update
    // dialog hits when a re-check swaps in a changelog with a newer release on top.
    const { rerender } = render(<MarkdownPanel text={'### v2.9.1\n\n**Fixed**\n- Old fix line here'} />);
    expect(screen.getByText('v2.9.1')).toBeInTheDocument();

    rerender(<MarkdownPanel text={'### v2.9.2\n\n**Added**\n- A brand new feature'} />);
    expect(screen.getByText('v2.9.2')).toBeInTheDocument();
    expect(screen.queryByText('v2.9.1')).toBeNull();
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.queryByText('Fixed')).toBeNull();
  });
});
