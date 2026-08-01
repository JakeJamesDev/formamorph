import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { UnreadDot } from './UnreadDot';
import { UNREAD_KINDS, UNREAD_MARK_STYLES } from '@/lib/unreadSeverity';

afterEach(cleanup);

describe('the unread mark', () => {
  it('says what it means, since it is a shape with no text in it', () => {
    render(<UnreadDot label="New replies" kind="feedback" />);

    expect(screen.getByLabelText('New replies')).toBeTruthy();
  });

  it('does not shrink out of a tight row', () => {
    // It lives beside a truncating title, which will take every pixel it is allowed to.
    render(<UnreadDot label="Unread" kind="urgent" />);

    expect(screen.getByLabelText('Unread').className).toContain('shrink-0');
  });
});

describe('what it is colored by', () => {
  it('takes its color from the kind, not from being unread', () => {
    // The whole point of the change: a suspension notice and a reply on a suggestion are both unread,
    // and only one of them should look alarming.
    render(<UnreadDot label="Unread" kind="urgent" />);
    expect(screen.getByLabelText('Unread').className).toContain('bg-destructive');

    cleanup();

    render(<UnreadDot label="New replies" kind="feedback" />);
    expect(screen.getByLabelText('New replies').className).toContain('bg-primary');
  });

  it('paints every kind the ladder knows about', () => {
    // A kind added to the ladder without a color would render an unpainted dot rather than fail.
    for (const kind of UNREAD_KINDS) {
      render(<UnreadDot label={kind} kind={kind} />);
      expect(screen.getByLabelText(kind).className).toContain(UNREAD_MARK_STYLES[kind].mark);
      cleanup();
    }
  });

  it('gives the three message severities three different colors', () => {
    const seen = new Set<string>();
    for (const kind of ['info', 'warning', 'urgent'] as const) {
      seen.add(UNREAD_MARK_STYLES[kind].mark);
    }

    expect(seen.size).toBe(3);
  });
});
