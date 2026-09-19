import { describe, it, expect } from 'vitest';
import { PROMPT_TEXT_DEFAULTS } from './GamePrompts';
import { BUILTIN_PRESETS, PROMPT_TEXT_KEYS, type PromptTextKey } from '@/lib/promptPresets';
import { buildStyledValues } from '@/lib/sectionStyle';
import { parsePromptTemplate, renderPromptTemplate, serializeSegments } from '@/lib/promptTemplate';
import { decodeVariant, tokenVariant, variableForToken } from '@/lib/promptVariables';
import { personaContextValues } from '@/lib/personaContext';
import { SAMPLE_PREVIEW_VALUES } from '@/lib/previewValuePool';
import type { ResolvedPersona } from '@/lib/persona';

// The spec's default coverage table, written out: the expectation must not come from the templates it checks.
const FULL: PromptTextKey[] = [
  'systemPrompt', 'thinkingPrompt', 'directorPrompt', 'storyboardPrompt', 'characterPrompt', 'sceneTagsPrompt',
];
const NAME: PromptTextKey[] = ['choicesPrompt', 'summaryPrompt', 'milestoneSelectPrompt', 'diaryPrompt'];
const COVERED = new Set<PromptTextKey>([...FULL, ...NAME]);

const persona: ResolvedPersona = {
  source: 'library',
  entity: {
    id: 'persona-fixture',
    name: 'Persona Fixture',
    pronouns: 'they/them',
    aiDescription: 'A fixture description only the Full variant carries.',
  },
};

const PERSONA = variableForToken('<PERSONA>')!;

/** The content variant of each persona chip the template carries, read through the parser. */
function personaContents(template: string): (string | null)[] {
  return parsePromptTemplate(template).flatMap((seg) =>
    seg.type === 'variable' && variableForToken(seg.token) === PERSONA
      ? [decodeVariant(PERSONA, tokenVariant(seg.token)).content]
      : [],
  );
}

/** The template with every persona placement removed, affixes and all. */
function withoutPersona(template: string): string {
  return serializeSegments(parsePromptTemplate(template).filter(
    (seg) => !(seg.type === 'variable' && variableForToken(seg.token) === PERSONA),
  ));
}

const styles = BUILTIN_PRESETS.map((b) => ({ name: b.name, values: buildStyledValues(PROMPT_TEXT_DEFAULTS, b.style) }));

describe('the persona chip in the default prompts', () => {
  it.each(styles)('places Full and Name where the coverage table says, in the $name preset', ({ values }) => {
    for (const key of PROMPT_TEXT_KEYS) {
      const contents = personaContents(values[key]);
      if (FULL.includes(key)) expect(contents, key).toContain(null);
      else if (NAME.includes(key)) expect(contents, key).toEqual(expect.arrayContaining(['name']));
      else expect(contents, key).toEqual([]);
    }
  });

  it.each(styles)('sends the persona to the covered prompts and nowhere else, in the $name preset', ({ values }) => {
    const ctx = { ...SAMPLE_PREVIEW_VALUES, ...personaContextValues(persona) };
    for (const key of PROMPT_TEXT_KEYS) {
      const out = renderPromptTemplate(values[key], ctx);
      expect(out.includes('Persona Fixture'), key).toBe(COVERED.has(key));
      expect(out.includes('only the Full variant carries'), key).toBe(FULL.includes(key));
    }
  });

  it.each(styles)('renders every prompt unchanged with no persona set, in the $name preset', ({ values }) => {
    const ctx = { ...SAMPLE_PREVIEW_VALUES, ...personaContextValues(null) };
    for (const key of PROMPT_TEXT_KEYS) {
      expect(renderPromptTemplate(values[key], ctx), key).toBe(renderPromptTemplate(withoutPersona(values[key]), ctx));
    }
  });
});
