import { describe, expect, it } from 'vitest';
import { promptVocabulary } from './chipVocabulary';
import { ALL_PROMPT_VARIABLES, splitToken, variableAxes, variableVariantIds } from './promptVariables';
import { renderPromptTemplate, renderPromptTemplateRuns, parsePromptTemplate, serializeSegments } from './promptTemplate';
import { runsTile } from './requestAnatomy';
import { buildNarrationPrompt } from './turnPipeline/narrationPrompt';
import { buildSharedPreset, serializeSharedJson, serializeSharedCode, parseSharedJson, parseSharedCode } from './promptPresetShare';
import { PROMPT_TEXT_DEFAULTS } from '@/components/game/GamePrompts';

const vocab = promptVocabulary(ALL_PROMPT_VARIABLES);
const raw = ALL_PROMPT_VARIABLES.filter(v => !variableAxes(v).some(axis => axis.id === 'format'));

describe('Header-only formatting', () => {
  it.each(ALL_PROMPT_VARIABLES)('offers Header for $label through the shared vocabulary', variable => {
    expect(vocab.header!(variable.token)).toBe('');
    const token = vocab.setHeader!(variable.token, 'player notes');
    expect(vocab.header!(token)).toBe('player notes');
    expect(vocab.axes(token).find(axis => axis.id === 'format')).toBeDefined();
  });

  it.each(raw)('preserves the exact $label body and existing variant choices', variable => {
    for (const variant of [null, ...variableVariantIds(variable)]) {
      const base = variant ? `${variable.token.slice(0, -1)}|${variant}>` : variable.token;
      const body = 'First line\n<b>Keep this</b> &amp; **that**\n\nLast line';
      expect(vocab.axes(base).some(axis => axis.id === 'format')).toBe(false);
      let token = vocab.setHeader!(base, 'player notes');
      expect(vocab.selection(token).format).toBeNull();
      for (const [format, expected] of [
        [null, `PLAYER NOTES:\n${body}`],
        ['markdown', `## Player Notes\n${body}`],
        ['xml', `<player_notes>\n${body}\n</player_notes>`],
      ] as const) {
        token = vocab.setAxis(token, 'format', format);
        expect(splitToken(token)?.key).toBe(base);
        expect(serializeSegments(parsePromptTemplate(token))).toBe(token);
        expect(renderPromptTemplate(token, { [base]: body })).toBe(expected);
        const runs = renderPromptTemplateRuns(token, { [base]: body }, { source: 'system-template' });
        expect(runs.content).toBe(expected);
        expect(runsTile(runs.content, runs.runs)).toBe(true);
        expect(runs.runs[0].chip).toBe(base);
      }
      expect(renderPromptTemplate(token, {})).toBe(token);
      for (const empty of ['', ' \n', 'N/A']) expect(renderPromptTemplate(token, { [base]: empty })).toBe('');
      token = vocab.setHeader!(token, ' \t');
      expect(vocab.axes(token).some(axis => axis.id === 'format')).toBe(false);
      expect(renderPromptTemplate(token, { [base]: body })).toBe(body);
      token = vocab.setHeader!(token, 'player notes');
      expect(vocab.selection(token).format).toBe('xml');
      const xml = new DOMParser().parseFromString(renderPromptTemplate(token, { [base]: body }), 'application/xml');
      expect(xml.querySelector('parsererror')).toBeNull();
      expect(variableVariantIds(variable)).not.toContain('xml');
    }
  });

  it('retains hidden Format through variant edits, affixes, JSON and share codes regardless of preset style', () => {
    let token = vocab.setHeader!('<DICTIONARY>', 'NPC notes');
    token = vocab.setAxis(token, 'format', 'xml');
    token = vocab.setHeader!(token, '');
    token = vocab.setAxis(token, 'variant', 'before');
    expect(vocab.selection(token)).toMatchObject({ variant: 'before', format: 'xml' });
    for (const style of ['markdown', 'xml', 'labels'] as const) {
      const unheaded = buildSharedPreset({ name: 'Origin', style, values: { ...PROMPT_TEXT_DEFAULTS, systemPrompt: '<WORLD DESCRIPTION>' } }, '2.19.0');
      const imported = parseSharedCode(serializeSharedCode(unheaded), '2.19.0').preset!;
      expect(imported.style).toBe(style);
      expect(imported.values.systemPrompt).toBe('<WORLD DESCRIPTION>');
      expect(vocab.selection(vocab.setHeader!(imported.values.systemPrompt, 'world')).format).toBeNull();
      const shared = buildSharedPreset({ name: 'Headers', style, values: { ...PROMPT_TEXT_DEFAULTS, systemPrompt: token } }, '2.19.0');
      for (const result of [parseSharedJson(serializeSharedJson(shared), '2.19.0'), parseSharedCode(serializeSharedCode(shared), '2.19.0')]) {
        expect(result.ok).toBe(true);
        const restored = result.preset!.values.systemPrompt;
        expect(restored).toBe(token);
        expect(vocab.axes(restored).some(axis => axis.id === 'format')).toBe(false);
        expect(vocab.selection(vocab.setHeader!(restored, 'NPC notes')).format).toBe('xml');
      }
    }
    let notes = vocab.setAxis(vocab.setHeader!('<NOTES>', 'notes'), 'format', 'xml');
    notes = vocab.setHeader!(notes, '');
    notes = vocab.setAffixes(notes, 'Read ', '.');
    notes = vocab.setHeader!(notes, 'notes');
    expect(renderPromptTemplate(notes, { '<NOTES>': 'line one\nline two' })).toBe('<notes>\nRead line one\nline two.\n</notes>');
  });

  it('agrees with gameplay assembly and owns the complete section in request anatomy', () => {
    const token = vocab.setAxis(vocab.setHeader!('<NOTES>', 'notes'), 'format', 'xml');
    const template = `Before${token}After`;
    const ctx = { '<NOTES>': 'Keep <b>this</b>\n\nAnd this.' };
    const rendered = buildNarrationPrompt({ template, ctx, action: 'look', history: [], dictionary: [],
      actionVec: null, semanticLore: false, embedVectors: new Map(), language: 'English', paragraphLimit: 'none',
      maxTokens: 512, markdownOutput: true, sectionStyle: 'markdown', resolvePH: text => text });
    expect(rendered.prompt).toBe('Before\n\n<notes>\nKeep <b>this</b>\n\nAnd this.\n</notes>\n\nAfter');
    expect(renderPromptTemplate(template, ctx)).toBe(rendered.prompt);
    expect(runsTile(rendered.prompt, rendered.runs)).toBe(true);
  });
});
