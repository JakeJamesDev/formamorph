import { describe, expect, it } from 'vitest';
import { PROMPT_TEXT_DEFAULTS } from '@/components/game/GamePrompts';
import { buildStyledValues } from './sectionStyle';
import { parsePromptTemplate, renderPromptTemplate, renderPromptTemplateRuns } from './promptTemplate';
import { PROMPT_TEXT_KEYS, BUILTIN_PRESETS, activeValues, addPreset, presetStoreCodec } from './promptPresets';
import { splitToken } from './promptVariables';
import { SAMPLE_PREVIEW_VALUES, derivedPreviewValues } from './previewValuePool';
import { runsTile } from './requestAnatomy';
import { buildNarrationPrompt } from './turnPipeline/narrationPrompt';
import { personaContextValues } from './personaContext';
import { buildSharedPreset, serializeSharedJson, serializeSharedCode, parseSharedJson, parseSharedCode } from './promptPresetShare';

describe('built-in Header adoption', () => {
  it('stores standalone headings in placements and preserves actual Persona affix content', () => {
    for (const key of PROMPT_TEXT_KEYS) {
      expect(PROMPT_TEXT_DEFAULTS[key], key).not.toMatch(/^## .+\n<[A-Z][^>]+>$/m);
      for (const seg of parsePromptTemplate(PROMPT_TEXT_DEFAULTS[key])) {
        if (seg.type !== 'variable') continue;
        const parts = splitToken(seg.token)!;
        expect(parts.pre, key).not.toMatch(/^## /m);
        expect(parts.post, key).not.toMatch(/^## /m);
      }
    }
    for (const key of ['thinkingPrompt', 'directorPrompt'] as const) {
      const persona = parsePromptTemplate(PROMPT_TEXT_DEFAULTS[key]).find(seg => seg.type === 'variable' && splitToken(seg.token)?.base === '<PERSONA>');
      expect(persona && persona.type === 'variable' && splitToken(persona.token)).toMatchObject({ header: 'Player Character', pre: '', post: 'In the Cast, this is Player Character.' });
    }
    expect(PROMPT_TEXT_DEFAULTS.choicesUserPrompt).toContain('header="The scene just told to me, the player character"');
    expect(PROMPT_TEXT_DEFAULTS.statUpdatesUserPrompt).toContain('Narration: <NARRATION>');
  });

  for (const style of ['markdown', 'labels', 'xml'] as const) {
    it(`${style}: copies, stores and shares every native Header without rewriting legacy custom text`, () => {
      const builtins = Object.fromEntries(BUILTIN_PRESETS.map(p => [p.id, buildStyledValues(PROMPT_TEXT_DEFAULTS, p.style)]));
      const values = buildStyledValues(PROMPT_TEXT_DEFAULTS, style);
      const store = addPreset({ activeId: 'default', presets: [] }, 'copy', 'Copy', values, style);
      const restored = presetStoreCodec.parse(presetStoreCodec.serialize(store));
      expect(activeValues(restored, builtins)).toEqual(values);
      const custom = '## Ordinary\n<NOTES|pre="\n## Affix\n">\n<parent><PERSONA|name.xml|header="player character"></parent>';
      for (const systemPrompt of [values.systemPrompt, custom]) {
        const snapshot = { ...values, systemPrompt };
        const shared = buildSharedPreset({ name: 'Copy', style, values: snapshot }, '2.19.0');
        for (const imported of [parseSharedJson(serializeSharedJson(shared), '2.19.0'), parseSharedCode(serializeSharedCode(shared), '2.19.0')]) {
          expect(imported.ok).toBe(true);
          expect(imported.preset!.values).toEqual(snapshot);
        }
      }
      const nested = renderPromptTemplate('<parent><PERSONA|name.xml|header="player character"></parent>', { '<PERSONA|name.xml>': 'Wren' });
      const xml = new DOMParser().parseFromString(nested, 'application/xml');
      expect(xml.querySelector('parsererror')).toBeNull();
      expect(xml.querySelector('parent > player_character')?.textContent?.trim()).toBe('Wren');
    });

    it(`${style}: agrees with real narration assembly, keeping prose and heading ownership`, () => {
      const settings = { paragraphLimit: 'none' as const, maxTokens: 400, markdownOutput: true, sectionStyle: style,
        limitActiveCharacters: false, activeCharacterLimit: 4, language: 'English' };
      const template = buildStyledValues(PROMPT_TEXT_DEFAULTS, style).systemPrompt;
      const ctx = { ...SAMPLE_PREVIEW_VALUES, ...derivedPreviewValues(settings),
        ...personaContextValues({ source: 'library', entity: { id: 'wren', name: 'Wren', pronouns: 'they/them' } }),
        '<DICTIONARY>': 'After: Foreground lore.', '<DICTIONARY|before>': 'Before: Background lore.' };
      const gameplay = buildNarrationPrompt({ ...settings, template, ctx, action: 'look', history: [],
        dictionary: [{ id: 'before', name: 'Before', key: [], constant: true, position: 'before', value: 'Background lore.' },
          { id: 'after', name: 'After', key: [], constant: true, value: 'Foreground lore.' }],
        actionVec: null, semanticLore: false, embedVectors: new Map(), resolvePH: text => text });
      expect(gameplay.prompt).toBe(renderPromptTemplate(template, ctx).trimEnd());
      expect(runsTile(gameplay.prompt, gameplay.runs)).toBe(true);
      expect(gameplay.prompt).toContain('Write in second person, present tense');
      const header = style === 'xml' ? '<game_world>' : style === 'labels' ? 'GAME WORLD:' : '## Game World';
      expect(gameplay.prompt.split(header)).toHaveLength(2);
      const worldRun = gameplay.runs.find(run => run.chip === '<WORLD DESCRIPTION>')!;
      expect(gameplay.prompt.slice(worldRun.start, worldRun.end)).toContain(header);
      if (style === 'xml') {
        const xml = new DOMParser().parseFromString(`<root>${gameplay.prompt}</root>`, 'application/xml');
        expect(xml.querySelector('parsererror')).toBeNull();
        expect(xml.querySelector('root > guidelines')).not.toBeNull();
        expect(xml.querySelector('root > game_world')).not.toBeNull();
        expect(xml.querySelector('root > traits')).not.toBeNull();
        expect(xml.querySelector('root > player_character')).not.toBeNull();
        expect(xml.querySelector('root > output')).not.toBeNull();
      }
    });

    it.each(PROMPT_TEXT_KEYS)(`${style}: renders %s and omits each empty adopted placement`, key => {
      const template = buildStyledValues(PROMPT_TEXT_DEFAULTS, style)[key];
      const ctx = { ...SAMPLE_PREVIEW_VALUES, ...derivedPreviewValues({ paragraphLimit: 'none', maxTokens: 400,
        markdownOutput: true, sectionStyle: style, limitActiveCharacters: false, activeCharacterLimit: 4, language: 'English' }) };
      const runs = renderPromptTemplateRuns(template, ctx, { source: 'system-template' });
      expect(runs.content).toBe(renderPromptTemplate(template, ctx));
      expect(runsTile(runs.content, runs.runs)).toBe(true);
      for (const seg of parsePromptTemplate(template)) {
        if (seg.type !== 'variable') continue;
        const parts = splitToken(seg.token)!;
        if (!parts.header) continue;
        const populated = renderPromptTemplate(seg.token, { [parts.key]: 'Body line one\nBody line two' });
        expect(populated).toContain('Body line one\nBody line two');
        expect(runs.content.split(populated.split('\n')[0]), `${key}: ${parts.header}`).toHaveLength(2);
        for (const value of ['', ' \n\t', 'N/A']) {
          expect(renderPromptTemplate(seg.token, { [parts.key]: value })).toBe('');
          const empty = renderPromptTemplateRuns(template, { ...ctx, [parts.key]: value }, { source: 'system-template' });
          expect(runsTile(empty.content, empty.runs)).toBe(true);
          expect(empty.runs.filter(run => run.chip === parts.key).every(run => run.start === run.end)).toBe(true);
        }
        if (style === 'xml') {
          const xml = new DOMParser().parseFromString(populated, 'application/xml');
          expect(xml.querySelector('parsererror')).toBeNull();
        }
      }
    });
  }

  it('styles native headings and closes authored XML peers before conditional sections', () => {
    const canonical = { ...PROMPT_TEXT_DEFAULTS, systemPrompt:
      '## Guidelines\nKeep the scene moving.\n\n<NOTES|header="player notes">\n\n<PERSONA|name|header="player character">\n\n## Output\nStory only.' };
    const ctx = { '<NOTES>': 'Remember the ferry.', '<PERSONA|name>': 'Wren', '<PERSONA|name.markdown>': 'Wren', '<PERSONA|name.xml>': 'Wren' };
    for (const [style, heading] of [['labels', 'PLAYER NOTES:'], ['markdown', '## Player Notes'], ['xml', '<player_notes>']] as const) {
      const template = buildStyledValues(canonical, style).systemPrompt;
      const rendered = renderPromptTemplate(template, ctx);
      expect(rendered).toContain(`${heading}\nRemember the ferry.`);
      expect(template).toContain('header="player notes"');
      if (style === 'xml') {
        for (const persona of ['Wren', 'N/A']) {
          const output = renderPromptTemplate(template, { ...ctx, '<PERSONA|name.xml>': persona });
          const xml = new DOMParser().parseFromString(`<root>${output}</root>`, 'application/xml');
          expect(xml.querySelector('parsererror')).toBeNull();
          expect(Array.from(xml.documentElement.children, node => node.tagName)).toEqual(
            persona === 'Wren' ? ['guidelines', 'player_notes', 'player_character', 'output'] : ['guidelines', 'player_notes', 'output']);
        }
      }
    }
  });
});
