import { describe, it, expect } from 'vitest';
import { restyle, buildStyledValues } from './sectionStyle';
import { PROMPT_TEXT_KEYS, type PromptValues } from './promptPresets';
import { defaultSystemPrompt, defaultDiscoverEntityPrompt } from '@/components/game/GamePrompts';
import { parsePromptTemplate, renderPromptTemplate } from './promptTemplate';
import { joinToken, splitToken } from './promptVariables';

describe('restyle', () => {
  it('is identity for the markdown style', () => {
    const text = '## Game World\n<WORLD DESCRIPTION>\n\n## Rules\n- do a thing';
    expect(restyle(text, 'markdown')).toBe(text);
  });

  it('downcasts markdown headers to UPPERCASE labels', () => {
    expect(restyle('## Game World', 'labels')).toBe('GAME WORLD:');
    expect(restyle('## Formatting (Markdown)', 'labels')).toBe('FORMATTING (MARKDOWN):');
  });

  it('only touches header lines — bullets, chips, template colons, and prose are untouched', () => {
    const src = [
      '## Player Stats',
      '<STATS DESCRIPTION|descriptions>',
      '',
      'Scene: something visible', // director template line, not a header
      'Hunger: -10', // stat-value example, not a header
      '- Output one change per line as "StatName: number".',
      'Narration: <NARRATION>',
    ].join('\n');
    expect(restyle(src, 'labels')).toBe([
      'PLAYER STATS:',
      '<STATS DESCRIPTION|descriptions>',
      '',
      'Scene: something visible',
      'Hunger: -10',
      '- Output one change per line as "StatName: number".',
      'Narration: <NARRATION>',
    ].join('\n'));
  });

  it('wraps each section in slugified xml tags, leaving preamble outside', () => {
    const src = 'intro prose\n\n## Game World\n<WORLD DESCRIPTION>\n\n## Formatting (Markdown)\n- do a thing';
    expect(restyle(src, 'xml')).toBe(
      'intro prose\n\n<game_world>\n<WORLD DESCRIPTION>\n\n</game_world>\n<formatting_markdown>\n- do a thing\n</formatting_markdown>',
    );
  });

  it('closes deeper sections when a same-or-higher-level header opens, and all at EOF', () => {
    const src = '## A\na body\n### B\nb body\n## C\nc body';
    expect(restyle(src, 'xml')).toBe(
      '<a>\na body\n<b>\nb body\n</b>\n</a>\n<c>\nc body\n</c>',
    );
  });

  it('leaves a pure-prose prompt (no headers) unchanged in both styles', () => {
    expect(restyle(defaultDiscoverEntityPrompt, 'labels')).toBe(defaultDiscoverEntityPrompt);
    expect(restyle(defaultDiscoverEntityPrompt, 'markdown')).toBe(defaultDiscoverEntityPrompt);
  });

  it('is idempotent on already-labels text (no # lines to touch)', () => {
    const labels = restyle(defaultSystemPrompt, 'labels');
    expect(restyle(labels, 'labels')).toBe(labels);
  });
});

describe('buildStyledValues', () => {
  const canonical: PromptValues = Object.fromEntries(
    PROMPT_TEXT_KEYS.map((k) => [k, `## ${k}\nbody for ${k}`]),
  ) as PromptValues;

  it('restyles every key', () => {
    const labels = buildStyledValues(canonical, 'labels');
    for (const k of PROMPT_TEXT_KEYS) expect(labels[k]).toContain(`${k.toUpperCase()}:`);
  });

  it('preserves every chip when restyling headers, and every affix that holds no heading', () => {
    const tokensOf = (s: string) =>
      parsePromptTemplate(s).flatMap((seg) => (seg.type === 'variable' ? [seg.token] : []));
    const before = tokensOf(defaultSystemPrompt);
    const after = tokensOf(restyle(defaultSystemPrompt, 'labels'));
    expect(after.map((t) => splitToken(t)?.key)).toEqual(before.map((t) => splitToken(t)?.key));
    const headed = /^#{1,6}\s/m;
    before.forEach((token, i) => {
      if (!headed.test(token)) expect(after[i]).toBe(token);
    });
  });

  it('labels style strips the chip format axis (markdown → plain); markdown keeps it', () => {
    const canonical: PromptValues = Object.fromEntries(
      PROMPT_TEXT_KEYS.map((k) => [k, '## Player Stats\n<STATS DESCRIPTION|descriptions.markdown>']),
    ) as PromptValues;
    const labels = buildStyledValues(canonical, 'labels');
    const markdown = buildStyledValues(canonical, 'markdown');
    expect(labels.systemPrompt).toBe('PLAYER STATS:\n<STATS DESCRIPTION|descriptions>');
    expect(markdown.systemPrompt).toBe('## Player Stats\n<STATS DESCRIPTION|descriptions.markdown>');
  });

  it('xml style sets the chip format axis to xml (markdown → xml)', () => {
    const canonical: PromptValues = Object.fromEntries(
      PROMPT_TEXT_KEYS.map((k) => [k, '## Player Stats\n<STATS DESCRIPTION|descriptions.markdown>']),
    ) as PromptValues;
    expect(buildStyledValues(canonical, 'xml').systemPrompt).toBe(
      '<player_stats>\n<STATS DESCRIPTION|descriptions.xml>\n</player_stats>',
    );
  });

  it('labels style strips a bare markdown-format stat token to the plain base', () => {
    const canonical: PromptValues = Object.fromEntries(
      PROMPT_TEXT_KEYS.map((k) => [k, '<STATS DESCRIPTION|markdown>']),
    ) as PromptValues;
    expect(buildStyledValues(canonical, 'labels').systemPrompt).toBe('<STATS DESCRIPTION>');
  });
});

describe('chip affixes survive a style downcast (gate 6)', () => {
  // A downcast rebuilds every format-bearing token from its parts. Before affixes were carried through,
  // this silently deleted the user's connective wording — no error, no undo.
  const affixed = joinToken({ base: '<ENTITIES>', variantId: 'name', pre: ' with ', post: ' present' });
  const template = `Now you are at <LOCATION|name>${affixed}; the scene is underway.`;

  const values = (text: string): PromptValues =>
    Object.fromEntries(PROMPT_TEXT_KEYS.map((k) => [k, text])) as PromptValues;

  it('keeps both affixes through labels and xml', () => {
    for (const style of ['labels', 'xml'] as const) {
      const out = buildStyledValues(values(template), style).systemPrompt;
      expect(out).toContain('pre=" with "');
      expect(out).toContain('post=" present"');
    }
  });

  it('survives a markdown → labels → xml → markdown cycle with the affixes intact', () => {
    let text = template;
    for (const style of ['labels', 'xml', 'markdown'] as const) {
      text = buildStyledValues(values(text), style).systemPrompt;
    }
    const tokens = parsePromptTemplate(text).filter((s) => s.type === 'variable');
    const entities = tokens.find((s) => s.type === 'variable' && s.token.startsWith('<ENTITIES'));
    expect(entities && entities.type === 'variable' && splitToken(entities.token)).toMatchObject({
      pre: ' with ', post: ' present',
    });
  });

  it('restyles a heading that rides in an affix, so the placement keeps its own section', () => {
    const headed = '## Traits\n<TRAITS DESCRIPTION|markdown>\n<PERSONA|markdown|pre="\n## Player Character\n"|post="\n">\n## Notes\n<NOTES>';
    const persona = { name: 'Traveler', entity: '- **Traveler**\n' };
    const render = (text: string, value: string) =>
      renderPromptTemplate(text, { '<TRAITS DESCRIPTION>': 'T', '<TRAITS DESCRIPTION|xml>': 'T', '<NOTES>': 'N', '<PERSONA>': value, '<PERSONA|xml>': value });

    const labels = buildStyledValues(values(headed), 'labels').systemPrompt;
    expect(render(labels, persona.entity)).toBe(`TRAITS:\nT\n\nPLAYER CHARACTER:\n${persona.entity}\n\nNOTES:\nN`);

    // The affix opens and closes its own tag; the chip line itself is never read as a header line.
    const xml = buildStyledValues(values(headed), 'xml').systemPrompt;
    expect(render(xml, persona.entity)).toBe(
      `<traits>\nT\n\n<player_character>\n${persona.entity}\n</player_character>\n\n</traits>\n<notes>\nN\n</notes>`,
    );
  });

  it('renders a headed affix placement as nothing when empty, in every style', () => {
    const bare = '## Traits\n<TRAITS DESCRIPTION|markdown>\n\n## Notes\n<NOTES>';
    const headed = '## Traits\n<TRAITS DESCRIPTION|markdown>\n<PERSONA|markdown|pre="\n## Player Character\n"|post="\n">\n## Notes\n<NOTES>';
    const empty = {
      '<TRAITS DESCRIPTION>': 'T', '<TRAITS DESCRIPTION|xml>': 'T', '<TRAITS DESCRIPTION|markdown>': 'T', '<NOTES>': 'N',
      '<PERSONA>': '', '<PERSONA|xml>': '', '<PERSONA|markdown>': '',
    };
    for (const style of ['markdown', 'labels', 'xml'] as const) {
      expect(renderPromptTemplate(buildStyledValues(values(headed), style).systemPrompt, empty))
        .toBe(renderPromptTemplate(buildStyledValues(values(bare), style).systemPrompt, empty));
    }
  });

  it('still changes the format axis while preserving the affixes', () => {
    const out = buildStyledValues(values(affixed), 'xml').systemPrompt;
    const parts = splitToken(out)!;
    expect(parts.variantId).toContain('xml');
    expect(parts.pre).toBe(' with ');
  });
});
