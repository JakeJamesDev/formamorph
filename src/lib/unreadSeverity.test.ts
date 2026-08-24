import { describe, it, expect } from 'vitest';
import { UNREAD_KINDS, UNREAD_MARK_STYLES, badgeKind, kindOfSeverity, loudest } from './unreadSeverity';

describe('the ladder', () => {
  it('puts community traffic below every admin message', () => {
    // Even an ordinary notice outranks a reply: one is the administrators talking to you.
    expect(loudest(['feedback', 'info'])).toBe('info');
    expect(loudest(['follow', 'info'])).toBe('info');
  });

  it('ranks the three message severities in the order they read', () => {
    expect(loudest(['info', 'warning'])).toBe('warning');
    expect(loudest(['warning', 'urgent'])).toBe('urgent');
    expect(loudest(['info', 'urgent'])).toBe('urgent');
  });

  it('does not care what order they arrive in', () => {
    // Whichever channel happens to answer first must not decide the color.
    expect(loudest(['urgent', 'feedback'])).toBe('urgent');
    expect(loudest(['feedback', 'urgent'])).toBe('urgent');
  });

  it('is nothing when nothing is waiting', () => {
    expect(loudest([])).toBeNull();
    expect(loudest([null, undefined])).toBeNull();
  });

  it('ignores the channels with nothing in them', () => {
    expect(loudest([null, 'feedback', undefined])).toBe('feedback');
  });

  it('separates feedback from follows, even though they look alike', () => {
    // They share a color today. The ladder still orders them, so giving follows their own color later
    // is a value change rather than a rewrite.
    expect(loudest(['follow', 'feedback'])).toBe('feedback');
  });
});

describe('a message’s severity', () => {
  it('maps the three the server can send', () => {
    expect(kindOfSeverity('urgent')).toBe('urgent');
    expect(kindOfSeverity('warning')).toBe('warning');
    expect(kindOfSeverity('info')).toBe('info');
  });

  it('treats anything else as the quietest a message can be', () => {
    // A severity this build has never heard of should not silently become the loudest thing on screen.
    expect(kindOfSeverity('catastrophe')).toBe('info');
    expect(kindOfSeverity(null)).toBe('info');
    expect(kindOfSeverity(undefined)).toBe('info');
  });
});

describe('the colors', () => {
  it('gives every kind one, so none can render unpainted', () => {
    for (const kind of UNREAD_KINDS) {
      expect(UNREAD_MARK_STYLES[kind].mark).toBeTruthy();
      expect(UNREAD_MARK_STYLES[kind].badge).toBeTruthy();
    }
  });

  it('pairs each badge color with a foreground, since a number sits on it', () => {
    for (const kind of UNREAD_KINDS) {
      expect(UNREAD_MARK_STYLES[kind].badge).toMatch(/text-/);
    }
  });

  it('keeps urgent distinct from the community color', () => {
    // The whole point of the change: a suspension notice must not look like a bug reply.
    expect(UNREAD_MARK_STYLES.urgent.mark).not.toBe(UNREAD_MARK_STYLES.feedback.mark);
  });

  it('paints a routine message the same accent as the community', () => {
    // Follows, feedback and ordinary notices are all just "something new" — a badge that turns a
    // different color over a mundane broadcast reads as an alarm it isn't.
    expect(UNREAD_MARK_STYLES.info.mark).toBe(UNREAD_MARK_STYLES.follow.mark);
    expect(UNREAD_MARK_STYLES.info.badge).toBe(UNREAD_MARK_STYLES.follow.badge);
  });
});

describe('the badge on the profile circle', () => {
  const none = { messages: 0, feedback: 0, follows: 0 };

  it('is unpainted when nothing is waiting anywhere', () => {
    expect(badgeKind(none)).toBeNull();
  });

  it('ignores a channel holding nothing, however loud it could be', () => {
    // An empty inbox must not paint the badge over somebody's bug replies.
    expect(badgeKind({ ...none, messages: 0, messageSeverity: 'urgent', feedback: 2 })).toBe('feedback');
  });

  it('takes the message severity when the inbox is the loudest thing', () => {
    expect(badgeKind({ ...none, messages: 1, messageSeverity: 'urgent', feedback: 5 })).toBe('urgent');
    expect(badgeKind({ ...none, messages: 1, messageSeverity: 'warning', follows: 3 })).toBe('warning');
  });

  it('puts an ordinary notice above a bug reply', () => {
    // The chosen order: the administrators talking to you outranks the community doing so.
    expect(badgeKind({ ...none, messages: 1, messageSeverity: 'info', feedback: 9 })).toBe('info');
  });

  it('falls to the community color when only they are waiting', () => {
    expect(badgeKind({ ...none, feedback: 1 })).toBe('feedback');
    expect(badgeKind({ ...none, follows: 1 })).toBe('follow');
  });

  it('treats a message with no severity as the quietest kind of message', () => {
    // A server that predates the severity sends none; the badge should still outrank a follow.
    expect(badgeKind({ ...none, messages: 1, messageSeverity: null, follows: 4 })).toBe('info');
  });
});

describe('a channel badged somewhere else', () => {
  const none = { messages: 0, follows: 0 };

  it('is left out rather than passed as zero', () => {
    // Feedback replies wear their own count on the Feedback button. Omitting the channel here is what
    // keeps the profile circle from claiming them.
    expect(badgeKind({ ...none, follows: 2 })).toBe('follow');
    expect(badgeKind(none)).toBeNull();
  });

  it('still colors the badge when it is passed', () => {
    // The rung is not gone, only unused by the circle — a surface that does count feedback still can.
    expect(badgeKind({ ...none, feedback: 1 })).toBe('feedback');
  });
});
