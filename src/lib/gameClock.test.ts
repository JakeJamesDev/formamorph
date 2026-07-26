import { describe, it, expect } from 'vitest';
import {
  parseTimeDelta,
  hoursByPosition,
  MAX_TURN_HOURS,
  FLAT_HOURS_PER_TURN,
  dayAndHour,
  daypart,
  formatAbsolute,
  formatClock,
  parseOpeningDaypart,
  OPENING_HOURS,
  formatRelative,
  formatStamp,
  formatNow,
  buildStamper,
  flatHoursAt,
  DEFAULT_START_HOUR,
} from './gameClock';

describe('flatHoursAt', () => {
  it('charges one hour per user/assistant pair', () => {
    expect(flatHoursAt(1)).toBe(1); // first assistant message
    expect(flatHoursAt(3)).toBe(2);
    expect(flatHoursAt(9)).toBe(5);
  });

  it('places a note anchored mid-pair on the turn that just closed', () => {
    // anchorTurn is the history length at creation: 4 messages = 2 completed turns.
    expect(flatHoursAt(4)).toBe(2);
    expect(flatHoursAt(0)).toBe(0);
  });

  it('never goes negative', () => {
    expect(flatHoursAt(-5)).toBe(0);
  });
});

describe('dayAndHour', () => {
  it('opens on day 1 at the calendar start hour', () => {
    expect(dayAndHour(0)).toEqual({ day: 1, hour: DEFAULT_START_HOUR });
  });

  it('rolls to the next day once the start offset plus elapsed passes midnight', () => {
    expect(dayAndHour(15)).toEqual({ day: 1, hour: 23 });
    expect(dayAndHour(16)).toEqual({ day: 2, hour: 0 });
    expect(dayAndHour(40)).toEqual({ day: 3, hour: 0 });
  });

  it('honors a short day', () => {
    expect(dayAndHour(0, { hoursPerDay: 10, startHour: 2 })).toEqual({ day: 1, hour: 2 });
    expect(dayAndHour(8, { hoursPerDay: 10, startHour: 2 })).toEqual({ day: 2, hour: 0 });
  });

  it('wraps an out-of-range start hour instead of losing the clock', () => {
    expect(dayAndHour(0, { startHour: 26 })).toEqual({ day: 1, hour: 2 });
    expect(dayAndHour(0, { startHour: -1 })).toEqual({ day: 1, hour: 23 });
  });
});

describe('parseOpeningDaypart', () => {
  it('reads every word in the closed set', () => {
    expect(parseOpeningDaypart('dawn')).toBe(OPENING_HOURS.dawn);
    expect(parseOpeningDaypart('morning')).toBe(OPENING_HOURS.morning);
    expect(parseOpeningDaypart('midday')).toBe(OPENING_HOURS.midday);
    expect(parseOpeningDaypart('afternoon')).toBe(OPENING_HOURS.afternoon);
    expect(parseOpeningDaypart('evening')).toBe(OPENING_HOURS.evening);
    expect(parseOpeningDaypart('night')).toBe(OPENING_HOURS.night);
  });

  it('tolerates the stray prose small models append', () => {
    expect(parseOpeningDaypart('  Evening.')).toBe(OPENING_HOURS.evening);
    expect(parseOpeningDaypart('The scene takes place at night.')).toBe(OPENING_HOURS.night);
  });

  it('rejects a broad word rather than coercing it — the cloud model answers "day" unprompted', () => {
    expect(parseOpeningDaypart('day')).toBeNull();
    expect(parseOpeningDaypart('daytime')).toBeNull();
  });

  it('rejects anything else, so a garbled reply falls back to the default start hour', () => {
    expect(parseOpeningDaypart('')).toBeNull();
    expect(parseOpeningDaypart('unstated')).toBeNull();
    expect(parseOpeningDaypart('14:00')).toBeNull();
  });

  it('maps night to late evening, so an opening at night is not minutes from sunrise', () => {
    const hour = parseOpeningDaypart('night')!;
    expect(daypart(hour)).toBe('night');
    // Seeded as the opening hour, the story stays dark for a realistic stretch rather than hours.
    expect(dayAndHour(0, { startHour: hour })).toEqual({ day: 1, hour: 22 });
  });

  it('round-trips every answer back through daypart(), so the sets cannot drift apart', () => {
    for (const [word, hour] of Object.entries(OPENING_HOURS)) {
      expect(daypart(hour)).toBe(word);
    }
  });

  it('opens on day 1 whatever the answer, including the small hours', () => {
    for (const hour of Object.values(OPENING_HOURS)) {
      expect(dayAndHour(0, { startHour: hour }).day).toBe(1);
    }
  });
});

describe('formatClock', () => {
  it('opens at the calendar start hour, zero-padded', () => {
    expect(formatClock(0)).toBe('Day 1, 08:00');
  });

  it('tracks the same day boundary dayAndHour does', () => {
    expect(formatClock(15)).toBe('Day 1, 23:00');
    expect(formatClock(16)).toBe('Day 2, 00:00');
    expect(formatClock(40)).toBe('Day 3, 00:00');
  });

  it('shows the minutes a measured sub-hour delta produces', () => {
    expect(formatClock(0.25)).toBe('Day 1, 08:15');
    expect(formatClock(1.5)).toBe('Day 1, 09:30');
  });

  it('rolls the day rather than printing a 24th hour when rounding up to midnight', () => {
    // 15h59m30s past an 08:00 start rounds to the minute, and that minute is the next day's first.
    expect(formatClock(16 - 0.5 / 60)).toBe('Day 2, 00:00');
  });

  it('honors a non-24-hour day and a custom start', () => {
    expect(formatClock(0, { hoursPerDay: 10, startHour: 2 })).toBe('Day 1, 02:00');
    expect(formatClock(8, { hoursPerDay: 10, startHour: 2 })).toBe('Day 2, 00:00');
  });

  it('never runs backwards before the start of the story', () => {
    expect(formatClock(-5)).toBe('Day 1, 08:00');
  });
});

describe('daypart', () => {
  it('names the coarse time of day', () => {
    expect(daypart(2)).toBe('night');
    expect(daypart(7)).toBe('dawn');
    expect(daypart(9)).toBe('morning');
    expect(daypart(12)).toBe('midday');
    expect(daypart(15)).toBe('afternoon');
    expect(daypart(18)).toBe('evening');
    expect(daypart(23)).toBe('night');
  });

  it('divides a non-24-hour day by the same fractions', () => {
    expect(daypart(1, { hoursPerDay: 10 })).toBe('night');
    expect(daypart(5, { hoursPerDay: 10 })).toBe('midday');
    expect(daypart(9, { hoursPerDay: 10 })).toBe('night');
  });

  it('never emits a clock reading', () => {
    for (let h = 0; h < 24; h++) expect(daypart(h)).not.toMatch(/\d/);
  });
});

describe('formatAbsolute', () => {
  it('reads as a day plus a daypart', () => {
    expect(formatAbsolute(0)).toBe('Day 1, morning');
    expect(formatAbsolute(10)).toBe('Day 1, evening');
    expect(formatAbsolute(30)).toBe('Day 2, afternoon');
  });
});

describe('formatRelative', () => {
  it('distinguishes the same day from a day gap', () => {
    expect(formatRelative(10, 10)).toBe('moments ago');
    expect(formatRelative(9, 10)).toBe('earlier today');
    // 15h in is still day 1; 16h in is day 2.
    expect(formatRelative(15, 16)).toBe('yesterday');
  });

  it('counts days in words, then weeks, then months', () => {
    expect(formatRelative(0, 40)).toBe('two days ago');
    expect(formatRelative(0, 24 * 5)).toBe('five days ago');
    expect(formatRelative(0, 24 * 8)).toBe('about a week ago');
    expect(formatRelative(0, 24 * 21)).toBe('about 3 weeks ago');
    expect(formatRelative(0, 24 * 90)).toBe('about 3 months ago');
  });

  it('treats a memory from the future as the present rather than negative time', () => {
    expect(formatRelative(50, 10)).toBe('moments ago');
  });
});

describe('formatStamp / formatNow', () => {
  it('carries both readings in one bracketed label', () => {
    expect(formatStamp(0, 40)).toBe('[Day 1, morning — two days ago]');
  });

  it('states the present as a sentence', () => {
    expect(formatNow(0)).toBe('It is now Day 1, morning.');
  });
});

describe('buildStamper', () => {
  it('maps message positions to stamps through the flat clock', () => {
    const stamp = buildStamper({ nowHours: 40 });
    expect(stamp(1)).toBe('[Day 1, morning — two days ago]');
    expect(stamp(79)).toBe('[Day 3, night — moments ago]'); // 40h elapsed + the 08:00 start = day 3, 00:00
  });

  it('takes a caller-supplied hour resolver, so a measured clock swaps in unchanged', () => {
    // Phase 2 shape: hours come from stored per-turn deltas, not the position.
    const hours = new Map([[1, 0], [3, 72]]);
    const stamp = buildStamper({ nowHours: 72, hoursAt: (p) => hours.get(p) ?? 0 });
    expect(stamp(1)).toBe('[Day 1, morning — three days ago]');
    expect(stamp(3)).toBe('[Day 4, morning — moments ago]');
  });
});

describe('parseTimeDelta', () => {
  it('reads the units the prompt asks for', () => {
    expect(parseTimeDelta('15m')).toBeCloseTo(0.25);
    expect(parseTimeDelta('2h')).toBe(2);
    expect(parseTimeDelta('3d')).toBe(72);
    expect(parseTimeDelta('2w')).toBe(336);
  });

  it('accepts spelled-out units and surrounding prose', () => {
    expect(parseTimeDelta('about 3 days')).toBe(72);
    expect(parseTimeDelta('45 minutes passed')).toBeCloseTo(0.75);
    expect(parseTimeDelta('  6 hrs  ')).toBe(6);
  });

  it('treats a bare number as hours, the unit the game counts in', () => {
    expect(parseTimeDelta('4')).toBe(4);
  });

  it('keeps a legitimate zero — a single line of dialogue costs nothing', () => {
    expect(parseTimeDelta('0')).toBe(0);
    expect(parseTimeDelta('0m')).toBe(0);
  });

  it('rejects nonsense and out-of-range values so callers fall back rather than lurch', () => {
    expect(parseTimeDelta('')).toBeNull();
    expect(parseTimeDelta('some time passed')).toBeNull();
    expect(parseTimeDelta('-2h')).toBeNull();
    expect(parseTimeDelta('500 weeks')).toBeNull(); // past MAX_TURN_HOURS
    expect(parseTimeDelta(`${MAX_TURN_HOURS}h`)).toBe(MAX_TURN_HOURS); // the boundary itself is allowed
  });
});

describe('hoursByPosition', () => {
  const turns = [
    { index: 1, timeDelta: 0.5 },
    { index: 3, timeDelta: 8 },
    { index: 5, timeDelta: 0.25 },
  ];

  it('accumulates the measured deltas across turns', () => {
    const at = hoursByPosition(turns);
    expect(at(1)).toBe(0.5);
    expect(at(3)).toBe(8.5);
    expect(at(5)).toBe(8.75);
  });

  it('charges the flat hour for a turn with no measurement, staying monotonic', () => {
    const at = hoursByPosition([{ index: 1, timeDelta: 2 }, { index: 3 }, { index: 5, timeDelta: 1 }]);
    expect(at(3)).toBe(2 + FLAT_HOURS_PER_TURN);
    expect(at(5)).toBe(3 + FLAT_HOURS_PER_TURN);
  });

  it('places a position between turns on the turn that just closed', () => {
    const at = hoursByPosition(turns);
    expect(at(4)).toBe(8.5); // a note anchored after turn 2
    expect(at(0)).toBe(0); // before anything happened
  });

  it('is order-independent, so an unsorted history still accumulates chronologically', () => {
    expect(hoursByPosition([...turns].reverse())(5)).toBe(8.75);
  });
});

describe('parseTimeDelta — spelled-out counts', () => {
  it('reads a count written in words', () => {
    expect(parseTimeDelta('five minutes')).toBeCloseTo(5 / 60);
    expect(parseTimeDelta('Three days')).toBe(72);
    expect(parseTimeDelta('an hour')).toBe(1);
  });

  it('ignores a bare word with no unit — prose is not a measurement', () => {
    expect(parseTimeDelta('a while')).toBeNull();
    expect(parseTimeDelta('one')).toBeNull();
  });
});
