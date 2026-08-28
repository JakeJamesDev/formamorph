import { describe, it, expect } from 'vitest';
import { parsePromptTemplate, serializeSegments, renderPromptTemplate, renderPromptTemplateRuns, resolveToken } from './promptTemplate';
import { runsTile } from './requestAnatomy';
import { joinToken } from './promptVariables';
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
  // Every piece is an ordinary chip carrying its own wording in its affixes. These assert the assembled
  // sentence still reads correctly for any combination of present/absent values.
  const render = (v: Partial<Record<string, string>>) =>
    renderPromptTemplate(defaultNowLinePrompt, {
      '<LOCATION|name>': "Sarah's Place",
      '<LOCATION|parent.name>': 'N/A',
      '<ENTITIES|inscene.name>': 'N/A',
      '<TIME>': 'N/A',
      ...v,
    });

  it('renders location, containing place, cast and time as one sentence', () => {
    expect(render({
      '<LOCATION|parent.name>': 'the Old Mill',
      '<ENTITIES|inscene.name>': 'Sarah Jones',
      '<TIME>': 'Day 2, afternoon',
    })).toBe(
      "Now you are at Sarah's Place, in the Old Mill, with Sarah Jones present;" +
        ' the scene is already underway. It is now Day 2, afternoon.',
    );
  });

  it('drops the containing place at a top-level location, leaving the sentence intact', () => {
    expect(render({ '<ENTITIES|inscene.name>': 'Sarah Jones' })).toBe(
      "Now you are at Sarah's Place, with Sarah Jones present; the scene is already underway.",
    );
  });

  it('reads as a clean sentence with every optional piece absent', () => {
    expect(render({})).toBe("Now you are at Sarah's Place; the scene is already underway.");
  });

  it('omits a notes chip — they already ride the system prompt (notes-duplication-probe)', () => {
    expect(defaultNowLinePrompt).not.toContain('<NOTES');
  });

  it('leaves no double space or dangling punctuation for any subset', () => {
    const pieces = ['<LOCATION|parent.name>', '<ENTITIES|inscene.name>', '<TIME>'] as const;
    const filled: Record<string, string> = {
      '<LOCATION|parent.name>': 'the Old Mill',
      '<ENTITIES|inscene.name>': 'Mira',
      '<TIME>': 'Day 1, dawn',
    };
    for (let mask = 0; mask < 8; mask++) {
      const vals = Object.fromEntries(pieces.map((k, i) => [k, mask & (1 << i) ? filled[k] : 'N/A']));
      const out = render(vals);
      expect(out).not.toMatch(/ {2}/);
      expect(out).not.toMatch(/\s;/);
      expect(out.startsWith("Now you are at Sarah's Place")).toBe(true);
    }
  });
});

// ── Chip affixes (docs-internal/chip-affixes-design.md) ──────────────────────────────────────────────
// Tests 1, 2 and 6 of the spec's gate are the load-bearing ones: they guard the round-trip, the
// unchanged rendering of every shipped prompt, and survival through a style downcast.

describe('affix grammar: round-trip (gate 1)', () => {
  const SHIPPED = [
    defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt, defaultLocationChangePrompt,
    defaultThinkingPrompt, defaultSummaryPrompt, defaultDirectorPrompt, defaultCharacterPrompt,
    defaultStoryboardPrompt, defaultDiaryPrompt, defaultNowLinePrompt,
  ];

  it('round-trips every shipped prompt byte-identically', () => {
    for (const p of SHIPPED) expect(serializeSegments(parsePromptTemplate(p))).toBe(p);
  });

  it('round-trips a generated corpus of tokens, affixed and bare', () => {
    const bases = ['<LOCATION>', '<ENTITIES>', '<NOTES>', '<WORLD DESCRIPTION>'];
    const variants = [null, 'name', 'summary', 'markdown', 'reachable.summary.markdown'];
    const affixes = ['', ' with ', ', inside ', '. It is now ', "the player's own: ", ' (', '|', '>'];
    for (const base of bases) {
      for (const variantId of variants) {
        for (const pre of affixes) {
          for (const post of affixes) {
            const token = joinToken({ base, variantId, pre, post });
            const template = `lead ${token} tail`;
            expect(serializeSegments(parsePromptTemplate(template))).toBe(template);
          }
        }
      }
    }
  });

  it('has exactly one spelling per token, so parse never rewrites', () => {
    // `pre=""` has no canonical form and must not parse at all — otherwise serialize would drop it and
    // merely opening the editor would rewrite the stored prompt.
    const template = '<LOCATION|name|pre="">';
    expect(parsePromptTemplate(template)).toEqual([{ type: 'text', value: template }]);
    expect(serializeSegments(parsePromptTemplate(template))).toBe(template);
  });
});

describe('affix grammar: unaffixed rendering is unchanged (gate 2)', () => {
  const values: Record<string, string> = {
    '<LOCATION>': 'FULL-LOCATION', '<LOCATION|name>': "Sarah's Place", '<ENTITIES|name>': 'Mira',
    '<NOTES>': 'my notes', '<WORLD DESCRIPTION>': 'WORLD', '<ENTITIES>': 'ENTITIES-BLOCK',
  };

  it('substitutes a bare token exactly as before', () => {
    expect(renderPromptTemplate('at <LOCATION|name>.', values)).toBe("at Sarah's Place.");
    expect(renderPromptTemplate('<WORLD DESCRIPTION>', values)).toBe('WORLD');
  });

  it('leaves an unknown token untouched', () => {
    expect(renderPromptTemplate('<LOCATION|banana>', values)).toBe('<LOCATION|banana>');
    expect(renderPromptTemplate('<LOCATION|name>', {})).toBe('<LOCATION|name>');
  });

  it('keeps N/A for an unaffixed chip — only affixed placements vanish', () => {
    expect(renderPromptTemplate('<ENTITIES|name>', { '<ENTITIES|name>': 'N/A' })).toBe('N/A');
  });
});

describe('affix rendering (gates 3-5)', () => {
  const t = (pre: string, post: string) => joinToken({ base: '<ENTITIES>', variantId: 'name', pre, post });

  it('wraps a present value in its affixes', () => {
    expect(renderPromptTemplate(`at home${t(' with ', ' present')}.`, { '<ENTITIES|name>': 'Mira' }))
      .toBe('at home with Mira present.');
  });

  it('renders nothing — value and both affixes — when the value is blank or N/A', () => {
    for (const empty of ['', '   ', 'N/A']) {
      expect(renderPromptTemplate(`at home${t(' with ', ' present')}.`, { '<ENTITIES|name>': empty }))
        .toBe('at home.');
    }
  });

  it('supports a prefix alone and a suffix alone', () => {
    const v = { '<ENTITIES|name>': 'Mira' };
    expect(renderPromptTemplate(t(', inside ', ''), v)).toBe(', inside Mira');
    expect(renderPromptTemplate(t('', ' present'), v)).toBe('Mira present');
  });

  it('applies affixes to each placement independently', () => {
    const template = `${t(' with ', ' here')} / ${t(' and ', ' there')}`;
    expect(renderPromptTemplate(template, { '<ENTITIES|name>': 'Mira' }))
      .toBe(' with Mira here /  and Mira there');
  });
});

describe('affix grammar: malformed forms stay literal (gate 7)', () => {
  const literal = (s: string) => expect(parsePromptTemplate(s)).toEqual([{ type: 'text', value: s }]);

  it('rejects unquoted, reordered, and unknown-key affixes', () => {
    literal('<LOCATION|name|pre=, inside >');
    literal('<LOCATION|post=" x "|pre=" y ">'); // wrong order
    literal('<LOCATION|name|mid=" x ">');
  });

  it('does not let a stray quote swallow the rest of the prompt', () => {
    const out = parsePromptTemplate('<LOCATION|name|pre=" a> tail');
    expect(serializeSegments(out)).toBe('<LOCATION|name|pre=" a> tail');
    expect(out.every((s) => s.type === 'text')).toBe(true);
  });
});

describe('resolveToken (shared by the renderer and the editor preview)', () => {
  const values = { '<ENTITIES|name>': 'Mira', '<LOCATION|name>': 'N/A' };
  const affixed = (base: string, variantId: string) =>
    joinToken({ base, variantId, pre: ' with ', post: ' present' });

  it('distinguishes "renders as nothing" from "no value" — the ?? vs || trap', () => {
    // An affixed chip with an absent value resolves to '' — a real result the caller must keep.
    expect(resolveToken(affixed('<LOCATION>', 'name'), values)).toBe('');
    // A token with no entry at all resolves to undefined, so the caller keeps the raw token.
    expect(resolveToken('<ENTITIES|summary>', values)).toBeUndefined();
    // Using || instead of ?? would collapse these two into the same fallback.
    expect(resolveToken(affixed('<LOCATION>', 'name'), values) ?? 'FALLBACK').toBe('');
  });

  it('returns undefined for a token of another chip family, leaving its own lookup to handle it', () => {
    expect(resolveToken('{{ph:p1:world:x}}', values)).toBeUndefined();
  });

  it('agrees with renderPromptTemplate for the same token', () => {
    const token = affixed('<ENTITIES>', 'name');
    expect(renderPromptTemplate(token, values)).toBe(resolveToken(token, values));
  });
});

describe('renderPromptTemplateRuns', () => {
  const labels = { source: 'system-template' as const };
  const slice = (t: { content: string; runs: { start: number; end: number }[] }) =>
    t.runs.map((r) => t.content.slice(r.start, r.end));

  it('renders byte-identically to renderPromptTemplate', () => {
    const values = {
      '<WORLD DESCRIPTION>': 'A drowned delta town.',
      '<NOTES>': 'Keep the tide rising.',
      '<STATS DESCRIPTION>': 'Health 8/10',
    };
    for (const template of [
      defaultSystemPrompt,
      defaultChoicesPrompt,
      defaultStatUpdatesPrompt,
      'A <WORLD DESCRIPTION> B <NOTES> C',
      'no chips at all',
      '<WORLD DESCRIPTION>',
      'trailing <UNKNOWN CHIP>',
    ]) {
      expect(renderPromptTemplateRuns(template, values, labels).content).toBe(
        renderPromptTemplate(template, values),
      );
    }
  });

  it('splits authored template prose from the value a chip injected, and names the chip that did it', () => {
    const tiled = renderPromptTemplateRuns('Before <WORLD DESCRIPTION> after.', { '<WORLD DESCRIPTION>': 'DELTA' }, labels);
    expect(slice(tiled)).toEqual(['Before ', 'DELTA', ' after.']);
    expect(tiled.runs.map((r) => r.chip)).toEqual([undefined, '<WORLD DESCRIPTION>', undefined]);
    // Every run still names the editor it came out of, chips included, so a click knows where to go.
    expect(tiled.runs.every((r) => r.source === 'system-template')).toBe(true);
  });

  it('identifies a chip by its variant, so two modes of one variable are two different chips', () => {
    const tiled = renderPromptTemplateRuns(
      '<STATS DESCRIPTION|numbers> then <STATS DESCRIPTION>',
      { '<STATS DESCRIPTION|numbers>': '8/10', '<STATS DESCRIPTION>': 'Hale' },
      labels,
    );
    expect(tiled.runs.map((r) => r.chip)).toEqual(['<STATS DESCRIPTION|numbers>', undefined, '<STATS DESCRIPTION>']);
  });

  it('identifies an affixed placement by the chip itself, so the wording it carries is not a new chip', () => {
    const token = joinToken({ base: '<NOTES>', pre: 'Remember: ', post: '.' });
    const tiled = renderPromptTemplateRuns(token, { '<NOTES>': 'tide' }, labels);
    expect(tiled.runs.map((r) => r.chip)).toEqual(['<NOTES>']);
  });

  it('counts an unresolved token as authored text, since that is what the model reads', () => {
    const tiled = renderPromptTemplateRuns('keep <NOTES>', {}, labels);
    expect(tiled.content).toBe('keep <NOTES>');
    expect(tiled.runs).toHaveLength(1);
    expect(tiled.runs[0].source).toBe('system-template');
  });

  it('tiles the rendered content exactly, for every default prompt', () => {
    const values = { '<WORLD DESCRIPTION>': 'W', '<NOTES>': 'N', '<ENTITIES>': 'E', '<LOCATION>': 'L' };
    for (const template of [
      defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt, defaultLocationChangePrompt,
      defaultThinkingPrompt, defaultSummaryPrompt, defaultDirectorPrompt, defaultCharacterPrompt,
      defaultStoryboardPrompt, defaultDiaryPrompt,
    ]) {
      const tiled = renderPromptTemplateRuns(template, values, labels);
      expect(runsTile(tiled.content, tiled.runs)).toBe(true);
    }
  });

  it('carries an affixed chip whole into its context run, wrapper included', () => {
    const token = joinToken({ base: '<NOTES>', pre: 'Remember: ', post: '.' });
    const tiled = renderPromptTemplateRuns(`x ${token} y`, { '<NOTES>': 'tide' }, labels);
    expect(slice(tiled)).toEqual(['x ', 'Remember: tide.', ' y']);
  });

  it('labels the user template and the typed action apart', () => {
    const tiled = renderPromptTemplateRuns(
      'My action this turn: <PLAYER ACTION>',
      { '<PLAYER ACTION>': 'I wade toward the skiff.' },
      { source: 'user-template', tokens: { '<PLAYER ACTION>': 'action' } },
    );
    expect(slice(tiled)).toEqual(['My action this turn: ', 'I wade toward the skiff.']);
    expect(tiled.runs[0].chip).toBeUndefined();
    expect(tiled.runs[1].chip).toBe('<PLAYER ACTION>');
    // The few chips holding what another pass wrote keep a name for it, on top of their own token.
    expect(tiled.runs[1].contextLabel).toBe('action');
  });
});
