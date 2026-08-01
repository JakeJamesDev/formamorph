import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { UnreadEdge } from './UnreadEdge';

afterEach(cleanup);

describe('the unread edge', () => {
  it('says nothing to a screen reader, since the dot beside the title already did', () => {
    const { container } = render(<UnreadEdge kind="feedback" />);

    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not swallow a click meant for the row it marks', () => {
    // It covers the left edge of a row that is itself one big button. Asserted as a class rather than
    // by clicking: jsdom dispatches events straight at the target and never hit-tests, so a click test
    // here would pass just as happily with the edge swallowing every press.
    expect(render(<UnreadEdge kind="feedback" />).container.firstElementChild?.className).toContain('pointer-events-none');
  });

  it('sits above a sibling that paints over the same strip', () => {
    // On a suggestion row it overlaps the vote button, whose hover fill would otherwise hide it — and
    // would, the moment that button gained a position of its own.
    const { container } = render(<UnreadEdge kind="feedback" />);

    expect(container.firstElementChild?.className).toContain('z-10');
  });

  it('is inset from the corners, so the row needs no clipping to keep it inside them', () => {
    // `overflow-hidden` on the row would clip a wide code block in an expanded message.
    const className = render(<UnreadEdge kind="feedback" />).container.firstElementChild?.className ?? '';

    expect(className).toContain('inset-y-1');
    expect(className).toContain('rounded-full');
    expect(className).not.toContain('inset-y-0');
  });

  it('is placed rather than sized into the layout, so a row does not shift when it appears', () => {
    // A thick left border would move every unread row's contents out of line with the read ones.
    expect(render(<UnreadEdge kind="feedback" />).container.firstElementChild?.className).toContain('absolute');
  });
});
