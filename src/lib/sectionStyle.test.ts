import { describe, it, expect } from 'vitest';
import { restyle, buildStyledValues } from './sectionStyle';
import { PROMPT_TEXT_KEYS, type PromptValues } from './promptPresets';
import { defaultSystemPrompt, defaultDiscoverEntityPrompt } from '@/components/game/GamePrompts';
import { parsePromptTemplate } from './promptTemplate';

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

  it('preserves every chip token when restyling headers (restyle is headers-only)', () => {
    const tokensOf = (s: string) =>
      parsePromptTemplate(s).flatMap((seg) => (seg.type === 'variable' ? [seg.token] : []));
    expect(tokensOf(restyle(defaultSystemPrompt, 'labels'))).toEqual(tokensOf(defaultSystemPrompt));
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
