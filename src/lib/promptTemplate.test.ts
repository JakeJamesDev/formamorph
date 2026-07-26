import { describe, it, expect } from 'vitest';
import { parsePromptTemplate, serializeSegments, renderPromptTemplate } from './promptTemplate';
import {
  defaultNowLinePrompt,
  defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt,
  defaultLocationChangePrompt, defaultThinkingPrompt, defaultSummaryPrompt,
  defaultDirectorPrompt, defaultCharacterPrompt, defaultStoryboardPrompt, defaultDiaryPrompt,
} from '@/components/game/GamePrompts';

describe('renderPromptTemplate', () => {
  it('replaces every occurrence of a token, not just the first', () => {
    const out = renderPromptTemplate('<NOTES> ... <NOTES>', { '<NOTES>': 'X' });
    expect(out).toBe('X ... X');
  });

  it('substitutes multiple distinct tokens', () => {
    const out = renderPromptTemplate('A <WORLD DESCRIPTION> B <NOTES>', {
      '<WORLD DESCRIPTION>': 'world',
      '<NOTES>': 'notes',
    });
    expect(out).toBe('A world B notes');
  });

  it('leaves a token untouched when no value is provided', () => {
    expect(renderPromptTemplate('keep <NOTES>', {})).toBe('keep <NOTES>');
  });

  it('ignores unknown angle-bracket text', () => {
    expect(renderPromptTemplate('<NOT A VAR>', { '<NOT A VAR>': 'x' })).toBe('<NOT A VAR>');
  });

  it('substitutes the aux user-message value-tokens, and leaves them intact without a value', () => {
    expect(
      renderPromptTemplate('Player action: <PLAYER ACTION>\nNarration: <NARRATION>', {
        '<PLAYER ACTION>': 'wave',
        '<NARRATION>': 'You wave.',
      }),
    ).toBe('Player action: wave\nNarration: You wave.');
    expect(renderPromptTemplate('a <NARRATION> b', {})).toBe('a <NARRATION> b');
  });
});

describe('parsePromptTemplate', () => {
  it('splits text and known variables in order', () => {
    expect(parsePromptTemplate('Hi <NOTES>!')).toEqual([
      { type: 'text', value: 'Hi ' },
      { type: 'variable', token: '<NOTES>' },
      { type: 'text', value: '!' },
    ]);
  });

  it('keeps unknown <...> as literal text', () => {
    expect(parsePromptTemplate('a <UNKNOWN> b')).toEqual([{ type: 'text', value: 'a <UNKNOWN> b' }]);
  });

  it('handles empty input', () => {
    expect(parsePromptTemplate('')).toEqual([]);
  });
});

describe('parse ∘ serialize round-trip', () => {
  const prompts: [string, string][] = [
    ['narration', defaultSystemPrompt],
    ['choices', defaultChoicesPrompt],
    ['statUpdates', defaultStatUpdatesPrompt],
    ['locationChange', defaultLocationChangePrompt],
    ['thinking', defaultThinkingPrompt],
    ['summary', defaultSummaryPrompt],
    ['director', defaultDirectorPrompt],
    ['character', defaultCharacterPrompt],
    ['storyboard', defaultStoryboardPrompt],
    ['diary', defaultDiaryPrompt],
  ];
  it.each(prompts)('is byte-identical for the %s default prompt', (_name, prompt) => {
    expect(serializeSegments(parsePromptTemplate(prompt))).toBe(prompt);
  });

  it('round-trips text with repeated tokens and newlines', () => {
    const src = 'line1\n<NOTES>\n\nline2 <WORLD DESCRIPTION> tail\n<NOTES>';
    expect(serializeSegments(parsePromptTemplate(src))).toBe(src);
  });

  it('round-trips a summary-variant token', () => {
    const src = 'Loc: <LOCATION|summary> done';
    expect(serializeSegments(parsePromptTemplate(src))).toBe(src);
  });

  it('parses a multi-axis (dotted) variant token without the prefix masking it', () => {
    const src = 'Stats: <STATS DESCRIPTION|descriptions.markdown> end';
    expect(parsePromptTemplate(src)).toEqual([
      { type: 'text', value: 'Stats: ' },
      { type: 'variable', token: '<STATS DESCRIPTION|descriptions.markdown>' },
      { type: 'text', value: ' end' },
    ]);
    expect(serializeSegments(parsePromptTemplate(src))).toBe(src);
    // The bare markdown-format and the plain content forms also round-trip.
    for (const t of ['<STATS DESCRIPTION|markdown>', '<STATS DESCRIPTION|numbers.markdown>', '<STATS DESCRIPTION>']) {
      expect(serializeSegments(parsePromptTemplate(`x ${t} y`))).toBe(`x ${t} y`);
    }
  });
});

describe('token variants', () => {
  it('recognizes the multi-word value-tokens as chips', () => {
    expect(parsePromptTemplate('<PLAYER ACTION> then <NARRATION>')).toEqual([
      { type: 'variable', token: '<PLAYER ACTION>' },
      { type: 'text', value: ' then ' },
      { type: 'variable', token: '<NARRATION>' },
    ]);
  });

  it('parses base, summary, and scoped tokens as distinct variables', () => {
    expect(parsePromptTemplate('<LOCATION> / <LOCATION|summary> / <LOCATION|reachable>')).toEqual([
      { type: 'variable', token: '<LOCATION>' },
      { type: 'text', value: ' / ' },
      { type: 'variable', token: '<LOCATION|summary>' },
      { type: 'text', value: ' / ' },
      { type: 'variable', token: '<LOCATION|reachable>' },
    ]);
  });

  it('substitutes each variant independently', () => {
    const out = renderPromptTemplate('<LOCATION> | <LOCATION|summary> | <LOCATION|reachable>', {
      '<LOCATION>': 'full',
      '<LOCATION|summary>': 'short',
      '<LOCATION|reachable>': 'a\nb',
    });
    expect(out).toBe('full | short | a\nb');
  });

  it('round-trips a scoped-variant token', () => {
    const src = 'Reachable:\n<LOCATION|reachable>\nend';
    expect(serializeSegments(parsePromptTemplate(src))).toBe(src);
  });

  it('does not treat an unknown variant as a chip', () => {
    expect(parsePromptTemplate('<LOCATION|bogus>')).toEqual([{ type: 'text', value: '<LOCATION|bogus>' }]);
  });
});

// The compat contract for imported presets (a preset from a different app version may reference chips this
// build doesn't know): every such token must survive as LITERAL text — never a chip, never dropped, never a
// crash — through parse (editor/preview), serialize (round-trip), and render (runtime substitution).
describe('cross-version import compat (Slice 4)', () => {
  const FOREIGN = '<FUTURE CHIP>';                 // a base this build has never heard of
  const FOREIGN_VARIANT = '<WORLD DESCRIPTION|future.mode>'; // known base, a variant added in a later version

  it('parse leaves a foreign chip (unknown base or unknown variant) as literal text', () => {
    expect(parsePromptTemplate(`before ${FOREIGN} after`)).toEqual([{ type: 'text', value: `before ${FOREIGN} after` }]);
    expect(parsePromptTemplate(FOREIGN_VARIANT)).toEqual([{ type: 'text', value: FOREIGN_VARIANT }]);
  });

  it('a mixed prompt keeps known chips as chips and foreign ones as text', () => {
    expect(parsePromptTemplate(`<NOTES> ${FOREIGN} <WORLD DESCRIPTION>`)).toEqual([
      { type: 'variable', token: '<NOTES>' },
      { type: 'text', value: ` ${FOREIGN} ` },
      { type: 'variable', token: '<WORLD DESCRIPTION>' },
    ]);
  });

  it('serialize round-trips a foreign chip byte-for-byte (import never mangles it)', () => {
    const src = `A ${FOREIGN} B ${FOREIGN_VARIANT} C`;
    expect(serializeSegments(parsePromptTemplate(src))).toBe(src);
  });

  it('render substitutes known chips and leaves foreign ones raw', () => {
    const out = renderPromptTemplate(`<NOTES> | ${FOREIGN} | ${FOREIGN_VARIANT}`, { '<NOTES>': 'kept' });
    expect(out).toBe(`kept | ${FOREIGN} | ${FOREIGN_VARIANT}`);
  });
});

describe('the default now-line template', () => {
  // The line used to be string-concatenated in GameViewer. These assert the template reproduces that
  // output byte-for-byte, including the way each optional clause carries its own leading space.
  const render = (v: Partial<Record<string, string>>) =>
    renderPromptTemplate(defaultNowLinePrompt, {
      '<LOCATION|name>': "Sarah's Place",
      '<SCENE CAST>': '',
      '<SCENE NOTES>': '',
      '<SCENE TIME>': '',
      ...v,
    });

  it('renders location, cast and time as one sentence', () => {
    expect(
      render({
        '<SCENE CAST>': ' with Sarah Jones present',
        '<SCENE TIME>': ' It is now Day 2, afternoon.',
      }),
    ).toBe(
      "Now you are at Sarah's Place with Sarah Jones present; the scene is already underway." +
        ' It is now Day 2, afternoon.',
    );
  });

  it('omits the notes clause — they already ride the system prompt (notes-duplication-probe)', () => {
    expect(defaultNowLinePrompt).not.toContain('<SCENE NOTES>');
    // Supplying a value changes nothing while the chip is absent; adding the chip back is what re-enables it.
    expect(render({ '<SCENE NOTES>': ' notes text' })).not.toContain('notes text');
  });

  it('reads as a clean sentence with every optional piece absent', () => {
    expect(render({})).toBe("Now you are at Sarah's Place; the scene is already underway.");
  });

  it('leaves no double space or dangling punctuation for any subset', () => {
    const pieces = ['<SCENE CAST>', '<SCENE TIME>'] as const;
    const filled: Record<string, string> = {
      '<SCENE CAST>': ' with Mira present',
      '<SCENE TIME>': ' It is now Day 1, dawn.',
    };
    for (let mask = 0; mask < 4; mask++) {
      const vals = Object.fromEntries(pieces.map((p, i) => [p, mask & (1 << i) ? filled[p] : '']));
      const out = render(vals);
      expect(out).not.toMatch(/ {2}/);
      expect(out).not.toMatch(/\s;/);
      expect(out.startsWith("Now you are at Sarah's Place")).toBe(true);
    }
  });
});
