import { describe, expect, it } from 'vitest';
import { renderPromptTemplate, renderPromptTemplateRuns, parsePromptTemplate, serializeSegments } from './promptTemplate';
import { joinToken, splitToken } from './promptVariables';
import { promptVocabulary } from './chipVocabulary';
import { runsTile } from './requestAnatomy';
import { personaContextValues } from './personaContext';
import { buildNarrationPrompt } from './turnPipeline/narrationPrompt';
import { buildSharedPreset, serializeSharedJson, serializeSharedCode, parseSharedJson, parseSharedCode } from './promptPresetShare';
import { PROMPT_TEXT_DEFAULTS } from '@/components/game/GamePrompts';
import { buildStyledValues } from './sectionStyle';

describe('authored prompt headers', () => {
  it('preserves ordinary separators and adds section spacing for Header', () => {
    const values = { '<PERSONA>': 'Mira', '<LOCATION>': 'Dock', '<NOTES>': 'Find map' };
    expect(renderPromptTemplate('<PERSONA>\n\n<LOCATION>\n\n<NOTES>', values)).toBe('Mira\n\nDock\n\nFind map');
    expect(renderPromptTemplate('<PERSONA|header="player">\n<LOCATION|header="place">\n<NOTES|header="notes">', values))
      .toBe('PLAYER:\nMira\n\nPLACE:\nDock\n\nNOTES:\nFind map');
  });
  it('round-trips raw heading text and renders a Markdown section', () => {
    const token = '<PERSONA|markdown|pre="Meet "|post="."|header="player character">';
    expect(serializeSegments(parsePromptTemplate(token))).toBe(token);
    expect(parsePromptTemplate(token)).toEqual([{ type: 'variable', token }]);
    expect(splitToken(token)).toMatchObject({ header: 'player character', key: '<PERSONA|markdown>' });
    expect(joinToken(splitToken(token)!)).toBe(token);
    expect(renderPromptTemplate(`Before${token}After`, { '<PERSONA|markdown>': 'Mira' }))
      .toBe('Before\n\n## Player Character\nMeet Mira.\n\nAfter');
  });

  it.each([
    ['player character', 'Player Character'], ['PLAYER CHARACTER', 'Player Character'],
    ['notes for the player', 'Notes for the Player'], ['NPC notes', 'NPC Notes'], ['iPhone status', 'iPhone Status'],
  ])('formats %s without rewriting its raw Header', (header, title) => {
    const token = joinToken({ base: '<PERSONA>', variantId: 'markdown', header });
    expect(renderPromptTemplate(token, { '<PERSONA|markdown>': 'Mira' })).toBe(`## ${title}\nMira`);
    expect(splitToken(token)?.header).toBe(header);
  });

  it.each([
    [null, 'PLAYER CHARACTER:\nMeet Mira.'],
    ['markdown', '## Player Character\nMeet Mira.'],
    ['xml', '<player_character>\nMeet Mira.\n</player_character>'],
  ])('keeps literal affixes inside the %s section', (variantId, expected) => {
    const token = joinToken({ base: '<PERSONA>', variantId, header: 'player character', pre: 'Meet ', post: '.' });
    expect(renderPromptTemplate(token, { [splitToken(token)!.key]: 'Mira' })).toBe(expected);
  });

  it.each(['', ' ', '\n\t', 'N/A'])('omits all generated content for the exact empty contract: %j', value => {
    const token = '<PERSONA|xml|pre="Meet "|post="."|header="player character">';
    const template = `Before\n${token}\nAfter`;
    const values = { '<PERSONA|xml>': value };
    expect(renderPromptTemplate(template, values)).toBe('Before\n\nAfter');
    const runs = renderPromptTemplateRuns(template, values, { source: 'system-template' });
    expect(runsTile(runs.content, runs.runs)).toBe(true);
    expect(runs.runs.find(run => run.chip === '<PERSONA|xml>')).toMatchObject({ start: 7, end: 7 });
    expect(renderPromptTemplate(token, values)).toBe('');
  });

  it('keeps unresolved and unheaded tokens and exact sentinel semantics intact', () => {
    const token = '<PERSONA|header="player">';
    expect(renderPromptTemplate(`Before${token}After`, {})).toBe(`Before${token}After`);
    expect(renderPromptTemplate(token, { '<PERSONA>': ' N/A ' })).toBe('PLAYER:\n N/A ');
    expect(renderPromptTemplate('<PERSONA>', { '<PERSONA>': 'N/A' })).toBe('N/A');
    expect(renderPromptTemplate('<PERSONA|header="  ">', { '<PERSONA>': 'N/A' })).toBe('N/A');
    const legacy = '## Old\n<PERSONA|pre="( "|post=" )">\n<UNKNOWN>';
    expect(serializeSegments(parsePromptTemplate(legacy))).toBe(legacy);
    expect(renderPromptTemplate(legacy, { '<PERSONA>': 'Mira' })).toBe('## Old\n( Mira )\n<UNKNOWN>');
  });

  it.each([
    ['Before$After', 'Before\n\nPLAYER:\nMira\n\nAfter'],
    ['$After', 'PLAYER:\nMira\n\nAfter'],
    ['Before$', 'Before\n\nPLAYER:\nMira'],
    ['$', 'PLAYER:\nMira'],
    ['Before\n$\nAfter', 'Before\n\nPLAYER:\nMira\n\nAfter'],
    ['Before\n\n$\n\nAfter', 'Before\n\nPLAYER:\nMira\n\nAfter'],
    ['Before\n\n\n$\n\n\nAfter', 'Before\n\nPLAYER:\nMira\n\nAfter'],
    ['$$', 'PLAYER:\nMira\n\nPLAYER:\nMira'],
    ['$\n$', 'PLAYER:\nMira\n\nPLAYER:\nMira'],
    ['Before\r\n\r\n$\r\n\r\nAfter', 'Before\r\n\r\nPLAYER:\nMira\r\n\r\nAfter'],
  ])('reuses authored spacing in %j', (template, expected) => {
    const input = template.replaceAll('$', '<PERSONA|header="player">');
    const values = { '<PERSONA>': 'Mira' };
    expect(renderPromptTemplate(input, values)).toBe(expected);
    const rendered = renderPromptTemplateRuns(input, values, { source: 'system-template' });
    expect(rendered.content).toBe(expected);
    expect(runsTile(expected, rendered.runs)).toBe(true);
  });

  it('omitted neighbors add no spacing and extra affix newlines remain literal', () => {
    const token = '<PERSONA|post="\n\n\n"|header="player">';
    const empty = '<LOCATION|header="place">';
    expect(renderPromptTemplate(`${empty}${token}${empty}After`, { '<PERSONA>': 'Mira', '<LOCATION>': '' }))
      .toBe('PLAYER:\nMira\n\n\nAfter');
    expect(renderPromptTemplate(`Before${empty}After`, { '<LOCATION>': '' })).toBe('BeforeAfter');
  });

  it.each(['\n', '\r\n'])('removes empty headed chip gaps with %j line endings', newline => {
    const chips = ['<NOTES|header="notes">', '<PERSONA|header="player">', '<LOCATION|header="place">'];
    for (const separator of [newline, newline.repeat(3)]) {
      const template = ['Intro', ...chips, 'End'].join(separator);
      const values = { '<NOTES>': '', '<PERSONA>': 'N/A', '<LOCATION>': '' };
      const expected = `Intro${newline.repeat(2)}End`;
      expect(renderPromptTemplate(template, values)).toBe(expected);
      const runs = renderPromptTemplateRuns(template, values, { source: 'system-template' });
      expect(runs.content).toBe(expected);
      expect(runsTile(expected, runs.runs)).toBe(true);
      expect(runs.runs.filter(run => run.chip)).toHaveLength(3);
      expect(renderPromptTemplate(separator + chips.join(separator) + separator, values)).toBe('');
    }
  });

  it('gives consecutive sections one blank line and preserves body and inline whitespace', () => {
    const template = '\n<NOTES|header="notes">\n<PERSONA|header="player">\n<LOCATION|header="place">\n';
    const values = { '<NOTES>': 'First\n\n\nSecond', '<PERSONA>': '', '<LOCATION>': 'Here' };
    expect(renderPromptTemplate(template, values)).toBe('NOTES:\nFirst\n\n\nSecond\n\nPLACE:\nHere');
    expect(renderPromptTemplate(template, { ...values, '<PERSONA>': 'Mira' }))
      .toBe('NOTES:\nFirst\n\n\nSecond\n\nPLAYER:\nMira\n\nPLACE:\nHere');
    expect(renderPromptTemplate('Before  <PERSONA|header="player">  after\n\n\nEnd', values)).toBe('Before    after\n\n\nEnd');
    expect(renderPromptTemplate('Before\n\n\n<PERSONA>\n\n\nAfter', values)).toBe('Before\n\n\n\n\n\nAfter');
    expect(renderPromptTemplate(template, {})).toBe(template);
    expect(renderPromptTemplate('Before\n\n\n<PERSONA|header="player">After', values)).toBe('Before\n\nAfter');
    expect(renderPromptTemplate('Before\n\n\n<PERSONA|header="player">After', { ...values, '<PERSONA>': 'Mira' }))
      .toBe('Before\n\nPLAYER:\nMira\n\nAfter');
  });

  it.each(['He said "go" | <now> & \\ later', '123 supplies', 'XML data', '!!!', 'café status', '旅行 🧭'])(
    'round-trips %j and produces safe paired XML inside authored parents', header => {
    const token = joinToken({ base: '<PERSONA>', variantId: 'name.xml', header, pre: 'Meet ', post: '.' });
    expect(splitToken(token)?.header).toBe(header);
    expect(parsePromptTemplate(token)).toEqual([{ type: 'variable', token }]);
    const rendered = renderPromptTemplate(`<parent>Before${token}After</parent>`, { '<PERSONA|name.xml>': 'Mira' });
    const xml = new DOMParser().parseFromString(rendered, 'application/xml');
    expect(xml.querySelector('parsererror')).toBeNull();
    expect(xml.documentElement.tagName).toBe('parent');
    expect(xml.documentElement.children).toHaveLength(1);
    expect(xml.documentElement.firstElementChild?.textContent).toBe('\nMeet Mira.\n');
    expect(xml.documentElement.firstElementChild?.tagName).toMatch(/^[a-z_][a-z0-9_]*$/);
    expect(renderPromptTemplate(`<parent>Before${token}After</parent>`, { '<PERSONA|name.xml>': '' }))
      .toBe('<parent>BeforeAfter</parent>');
  });

  it('escapes Markdown markup while preserving plain Header input', () => {
    const token = joinToken({ base: '<PERSONA>', variantId: 'markdown', header: '<script> *hello* & [link](url)' });
    const out = renderPromptTemplate(token, { '<PERSONA|markdown>': 'Mira' });
    expect(out).toBe('## \\<Script\\> \\*Hello\\* &amp; \\[Link\\](Url)\nMira');
    expect(splitToken(token)?.header).toBe('<script> *hello* & [link](url)');
  });

  it('uses the same headed Name output in preview, gameplay and request anatomy', () => {
    const ctx = personaContextValues({ source: 'library', entity: { id: 'mira', name: 'Mira', pronouns: 'she/her', aiDescription: 'A cartographer.' } });
    const template = 'Before<PERSONA|name.xml|header="player character">After';
    const expected = 'Before\n\n<player_character>\nMira (she/her)\n</player_character>\n\nAfter';
    const rendered = buildNarrationPrompt({ template, ctx, action: 'look', history: [], dictionary: [],
      actionVec: null, semanticLore: false, embedVectors: new Map(), language: 'English', paragraphLimit: 'none',
      maxTokens: 512, markdownOutput: true, sectionStyle: 'markdown', resolvePH: text => text });
    expect(renderPromptTemplate(template, ctx)).toBe(expected);
    expect(rendered.prompt).toBe(expected);
    expect(runsTile(rendered.prompt, rendered.runs)).toBe(true);
    const owned = rendered.runs.find(run => run.chip === '<PERSONA|name.xml>')!;
    expect(rendered.prompt.slice(owned.start, owned.end)).toBe('\n\n<player_character>\nMira (she/her)\n</player_character>\n\n');
  });

  it('exports and imports editable Header data through production JSON and share codes', () => {
    const token = joinToken({ base: '<ENTITIES>', variantId: 'reachable.name.xml', header: 'NPC "friends" & foes', pre: 'Meet ', post: '.' });
    const shared = buildSharedPreset({ name: 'Headers', style: 'markdown', values: { ...PROMPT_TEXT_DEFAULTS, systemPrompt: token } }, '2.19.0');
    for (const parsed of [parseSharedJson(serializeSharedJson(shared), '2.19.0'), parseSharedCode(serializeSharedCode(shared), '2.19.0')]) {
      expect(parsed.ok).toBe(true);
      expect(parsed.preset?.values.systemPrompt).toBe(token);
      expect(splitToken(parsed.preset!.values.systemPrompt)).toMatchObject({ header: 'NPC "friends" & foes', variantId: 'reachable.name.xml', pre: 'Meet ', post: '.' });
    }
  });

  it('keeps Header placement data through preset style conversion', () => {
    const systemPrompt = '<PERSONA|markdown|pre="Meet "|post="."|header="NPC notes">';
    for (const style of ['labels', 'xml'] as const) {
      const converted = buildStyledValues({ ...PROMPT_TEXT_DEFAULTS, systemPrompt }, style).systemPrompt;
      expect(splitToken(converted)).toMatchObject({ header: 'NPC notes', pre: 'Meet ', post: '.', variantId: style === 'xml' ? 'xml' : null });
    }
  });

  it('preserves Header, affixes and remembered Format across every vocabulary edit', () => {
    const vocab = promptVocabulary([]);
    for (const base of ['<STATS DESCRIPTION>', '<TRAITS DESCRIPTION>', '<PERSONA>', '<LOCATION>', '<ENTITIES>']) {
      let token = vocab.setHeader!(base, 'NPC notes');
      token = vocab.setAffixes(token, 'Lead ', ' tail');
      for (const format of ['xml', 'markdown', null, 'xml']) {
        token = vocab.setAxis(token, 'format', format);
        expect(splitToken(token)).toMatchObject({ header: 'NPC notes', pre: 'Lead ', post: ' tail' });
      }
      if (['<PERSONA>', '<LOCATION>', '<ENTITIES>'].includes(base)) {
        token = vocab.setAxis(token, 'content', 'name');
        expect(vocab.axes(token).find(axis => axis.id === 'format')?.readOnly).not.toBe(true);
      }
      token = vocab.setHeader!(token, '');
      expect(vocab.selection(token).format).toBe('xml');
      expect(vocab.affixes(token)).toEqual({ pre: 'Lead ', post: ' tail' });
      expect(vocab.header!(token)).toBe('');
    }
    expect(vocab.header!('<NOTES>')).toBe('');
    expect(vocab.setHeader!('<NOTES>', 'notes')).toBe('<NOTES|header="notes">');
  });
});
