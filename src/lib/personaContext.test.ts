import { describe, it, expect } from 'vitest';
import { buildPersonaContext, personaContextValues } from './personaContext';
import { renderEntityRoster } from './locationContext';
import { renderPromptTemplate } from './promptTemplate';
import { variableForToken, variableVariantIds, withVariant } from './promptVariables';
import { NONE_PLACEHOLDER } from './promptFallbacks';
import type { Entity } from '@/types';

const persona: Entity = {
  id: 'p1',
  name: 'Traveler',
  aliases: ['the Wanderer'],
  pronouns: 'they/them',
  aiDescription: 'A road-worn traveler with a patched coat and a quiet way of listening.',
  aiSummary: 'A road-worn, quiet traveler.',
  // A persona never renders its locations: it is the player, not someone at a place.
  locations: ['loc1'],
};

describe('buildPersonaContext', () => {
  it('renders Full as one entity block from the shared entity builder, in each format', () => {
    for (const format of ['simple', 'markdown', 'xml'] as const) {
      expect(buildPersonaContext(persona, { format })).toBe(renderEntityRoster([persona.id], [persona], { format }));
    }
    const md = buildPersonaContext(persona, { format: 'markdown' });
    expect(md).toContain('- **Traveler**');
    expect(md).toContain('**also known as:** the Wanderer');
    expect(md).toContain('**pronouns:** they/them');
    expect(md).toContain('A road-worn traveler with a patched coat');
  });

  it('renders Summary with the short summary in place of the full description', () => {
    const out = buildPersonaContext(persona, { preferSummary: true, format: 'markdown' });
    expect(out).toContain('A road-worn, quiet traveler.');
    expect(out).not.toContain('patched coat');
  });

  it('renders Name as the name and pronouns only, whatever the format', () => {
    for (const format of ['simple', 'markdown', 'xml'] as const) {
      expect(buildPersonaContext(persona, { nameOnly: true, format })).toBe('Traveler (they/them)');
    }
  });

  it('renders Name as the bare name when the persona has no pronouns', () => {
    expect(buildPersonaContext({ ...persona, pronouns: '  ' }, { nameOnly: true })).toBe('Traveler');
  });

  it('renders the empty placeholder with no persona, in every variant', () => {
    expect(buildPersonaContext(null)).toBe(NONE_PLACEHOLDER);
    expect(buildPersonaContext(null, { nameOnly: true })).toBe(NONE_PLACEHOLDER);
    expect(buildPersonaContext(null, { preferSummary: true, format: 'xml' })).toBe(NONE_PLACEHOLDER);
  });
});

describe('personaContextValues', () => {
  const variable = variableForToken('<PERSONA>')!;
  const every = ['<PERSONA>', ...variableVariantIds(variable).map((id) => withVariant('<PERSONA>', id))];

  it('holds a value for every token the chip can produce', () => {
    const values = personaContextValues(persona);
    expect(Object.keys(values).sort()).toEqual([...every].sort());
    expect(values['<PERSONA|name.xml>']).toBe('Traveler (they/them)');
    expect(values['<PERSONA|summary.markdown>']).toBe(buildPersonaContext(persona, { preferSummary: true, format: 'markdown' }));
  });

  it('renders an affixed placement as nothing at all with no persona, header included', () => {
    const template = 'Before\n<PERSONA|markdown|pre="\n## Player Character\n"|post="\n">\nAfter';
    expect(renderPromptTemplate(template, personaContextValues(null))).toBe('Before\n\nAfter');
    expect(renderPromptTemplate(template, personaContextValues(persona))).toBe(
      `Before\n\n## Player Character\n${buildPersonaContext(persona, { format: 'markdown' })}\n\nAfter`,
    );
  });

  it('renders the placeholder under a placement with no affixes, like any other context chip', () => {
    expect(renderPromptTemplate('<PERSONA|name>', personaContextValues(null))).toBe(NONE_PLACEHOLDER);
  });
});
