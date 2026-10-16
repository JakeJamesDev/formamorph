import { describe, it, expect } from 'vitest';
import { chipValues } from './chipValues';
import { sampleChipScene } from './sampleScene';
import { splitRunLines, textOf, type TextOrigin } from '../markedText';
import { resolveToken, resolveTokenRuns } from '../promptTemplate';
import { joinToken, variableAxes, variableForToken } from '../promptVariables';
import { layerValues, withMarked } from '../promptValues';

const values = chipValues(sampleChipScene());

/** Each stretch of `token`'s render that `origin` lights, trimmed. */
function lit(token: string, origin: TextOrigin): string[] {
  const rendered = resolveTokenRuns(token, values)!;
  const spans: string[] = [];
  let open = false;
  for (const run of rendered.runs) {
    const on = run.origins.includes(origin);
    if (on && open) spans[spans.length - 1] += run.text;
    else if (on) spans.push(run.text);
    open = on;
  }
  return spans.map((span) => span.trim()).filter(Boolean);
}

const WREN_DESCRIPTION = 'The lamp-keeper, gray-haired and unhurried, who has watched this shore longer than anyone will admit. Carries a hooked pole she uses for everything but its purpose.';
const GULL_DESCRIPTION = 'Too fat to be wild, waiting on the post as if owed something.';
const PATIENCE_MEANING = 'How long she waits on a stranger before she speaks.';

describe('origin report: the Entities chip over the sample scene', () => {
  it('reports runs that spell the value the prompt reads', () => {
    const rendered = resolveTokenRuns('<ENTITIES>', values)!;
    expect(rendered.reported).toBe(true);
    expect(textOf(rendered.runs)).toBe(resolveToken('<ENTITIES>', values));
  });

  it('marks each line with the control that produced it', () => {
    expect(lit('<ENTITIES>', 'content')).toEqual([`description: ${WREN_DESCRIPTION}`, `description: ${GULL_DESCRIPTION}`]);
    expect(lit('<ENTITIES>', 'traits')).toEqual([
      'traits:\n    Night Watch: Keeps the lamp lit through the dark hours, whatever the weather.',
    ]);
    expect(lit('<ENTITIES>', 'stats')).toEqual([`stats:\n    Patience: 70/100 (Measured) — ${PATIENCE_MEANING}`]);
  });

  it('marks the span of each Stat Detail piece inside the stat line', () => {
    expect(lit('<ENTITIES>', 'range')).toEqual(['70/100']);
    expect(lit('<ENTITIES>', 'descriptor')).toEqual(['(Measured)']);
    expect(lit('<ENTITIES>', 'meaning')).toEqual([PATIENCE_MEANING]);
  });

  it('marks the blocks of the entities that pass each Only With pick', () => {
    // Wren owns a stat and a trait; the gull owns neither.
    for (const origin of ['ownsStats', 'ownsTraits'] as const) {
      const [block, ...rest] = lit('<ENTITIES>', origin);
      expect(rest).toEqual([]);
      expect(block.startsWith('Wren\n')).toBe(true);
      expect(block).toContain(PATIENCE_MEANING);
      expect(block).not.toContain('a gull');
    }
  });

  it.each([
    ['Markdown', 'markdown', ['70/100'], ['(Measured)'], [PATIENCE_MEANING], `- **description:** ${WREN_DESCRIPTION}`],
    ['XML', 'xml', ['<value>70/100</value>'], ['<status>Measured</status>'], [`<meaning>${PATIENCE_MEANING}</meaning>`],
      `<description>${WREN_DESCRIPTION}</description>`],
  ] as const)('marks the same pieces in %s', (_name, format, range, descriptor, meaning, content) => {
    const token = joinToken({ base: '<ENTITIES>', variantId: format });
    expect(lit(token, 'range')).toEqual(range);
    expect(lit(token, 'descriptor')).toEqual(descriptor);
    expect(lit(token, 'meaning')).toEqual(meaning);
    expect(lit(token, 'content')[0]).toBe(content);
    expect(lit(token, 'traits')[0]).toContain('Night Watch');
    expect(lit(token, 'stats')[0]).toContain('Patience');
  });

  it('keeps an XML piece on a line of its own', () => {
    const lines = splitRunLines(resolveTokenRuns('<ENTITIES|xml>', values)!.runs);
    const rangeLines = lines.filter((line) => line.some((run) => run.origins.includes('range') && run.text.trim()));
    expect(rangeLines.map((line) => textOf(line).trim())).toEqual(['<value>70/100</value>']);
    // The line break and indent before the tag stay unmarked.
    const marked = resolveTokenRuns('<ENTITIES|xml>', values)!.runs.filter((run) => run.origins.includes('range'));
    expect(marked.map((run) => run.text)).toEqual(['<value>70/100</value>']);
  });

  it('marks the placeholder a filter leaves as Only With\'s', () => {
    const owningNothing = chipValues({ ...sampleChipScene(), ownedStats: {}, ownedTraits: {}, playedStats: [] });
    for (const token of ['<ENTITIES|withstats>', '<ENTITIES|withtraits.name>', '<PERSONA|withstats>']) {
      const runs = resolveTokenRuns(token, owningNothing)!.runs;
      expect(runs, token).toEqual([{ text: 'N/A', origins: ['ownsStats', 'ownsTraits'] }]);
    }
    // With no filter on, an empty roster is no control's doing.
    const nobody = chipValues({ ...sampleChipScene(), presentIds: [] });
    expect(resolveTokenRuns('<ENTITIES>', nobody)!.runs).toEqual([{ text: 'N/A', origins: [] }]);
  });

  it('marks the names as Content under Name, and each name by what it owns', () => {
    expect(lit('<ENTITIES|name>', 'content')).toEqual(['Wren', 'a gull']);
    expect(lit('<ENTITIES|name>', 'ownsStats')).toEqual(['Wren']);
  });

  it('marks the one-line traits field under Summary', () => {
    expect(lit('<ENTITIES|summary>', 'traits')).toEqual(['traits: Night Watch']);
    expect(lit('<ENTITIES|summary>', 'content')).toEqual(['summary: The unhurried lamp-keeper.', 'summary: Fat, waiting, owed something.']);
  });

  it('marks nothing a control switched off', () => {
    const token = joinToken({ base: '<ENTITIES>', variantId: 'notraits.nodescriptor' });
    expect(lit(token, 'traits')).toEqual([]);
    expect(lit(token, 'descriptor')).toEqual([]);
    expect(lit(token, 'meaning')).toEqual([PATIENCE_MEANING]);
  });
});

describe('origin report: the Persona and Stats chips', () => {
  it("marks the persona's pieces as a cast member's", () => {
    expect(lit('<PERSONA>', 'range')).toEqual(['55/100']);
    expect(lit('<PERSONA>', 'descriptor')).toEqual(['(Steady)']);
    expect(lit('<PERSONA>', 'traits')[0]).toContain('False Map');
    expect(lit('<PERSONA|name>', 'content')).toEqual(['Traveler (they/them)']);
  });

  it("marks the Stats chip's pieces in its lines", () => {
    const token = joinToken({ base: '<STATS DESCRIPTION>', variantId: 'numbers.descriptions.meaning' });
    expect(resolveTokenRuns(token, values)!.reported).toBe(true);
    expect(lit(token, 'range')).toHaveLength(3);
    for (const text of lit(token, 'range')) expect(text).toMatch(/^\d+\/\d+$|^\d+%$/);
    expect(lit(token, 'stats')).toEqual([]);
  });
});

describe('origin report: placement and honesty', () => {
  it('marks the Header frame, the Prepend and the Append', () => {
    const token = joinToken({ base: '<LOCATION>', header: 'Salt Dock', pre: 'At ', post: '.' });
    const runs = resolveTokenRuns(token, { '<LOCATION>': 'The Landing' })!.runs;
    const of = (origin: TextOrigin) => runs.filter((run) => run.origins.includes(origin)).map((run) => run.text);
    expect(of('header')).toEqual(['\nSALT DOCK:\n', '\n']);
    expect(of('prepend')).toEqual(['At ']);
    expect(of('append')).toEqual(['.']);
  });

  it('reports nothing for a chip whose renderer reports no origins', () => {
    expect(resolveTokenRuns('<LOCATION>', values)!.reported).toBe(false);
  });

  it('drops the report once a layer above replaces the value', () => {
    const layered = layerValues(values, { '<ENTITIES>': 'Someone else.' });
    expect(resolveTokenRuns('<ENTITIES>', layered)).toEqual({ runs: [{ text: 'Someone else.', origins: [] }], reported: false });
  });

  it('drops a report that does not spell the value', () => {
    const lookup = withMarked((key) => (key === '<NOTES>' ? 'the ferryman' : undefined), () => [{ text: 'a stranger', origins: ['content'] }]);
    expect(resolveTokenRuns('<NOTES>', lookup)!.reported).toBe(false);
  });

  it('slices the report to the value a Header trims', () => {
    const lookup = withMarked(
      (key) => (key === '<NOTES>' ? '\nthe ferryman\n' : undefined),
      () => [{ text: '\nthe ', origins: [] }, { text: 'ferryman\n', origins: ['content'] }],
    );
    const runs = resolveTokenRuns(joinToken({ base: '<NOTES>', header: 'Notes' }), lookup)!.runs;
    expect(runs.filter((run) => run.origins.includes('content')).map((run) => run.text)).toEqual(['ferryman']);
  });

  it('reports every Entities, Persona and Stats spelling the sample can render', () => {
    for (const base of ['<ENTITIES>', '<PERSONA>', '<STATS DESCRIPTION>']) {
      const axes = variableAxes(variableForToken(base)!);
      let ids: string[][] = [[]];
      for (const axis of axes) ids = ids.flatMap((picked) => axis.options.map((opt) => (opt.id ? [...picked, opt.id] : picked)));
      for (const picked of ids) {
        const token = joinToken({ base, variantId: picked.join('.') || undefined });
        const rendered = resolveTokenRuns(token, values);
        if (!rendered) continue;
        expect(rendered.reported, token).toBe(true);
      }
    }
  });
});
