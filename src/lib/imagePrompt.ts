// One-shot helper that turns a world subject's description into a booru-tag image prompt through the
// text request pipeline.

import type { AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { requestAiText } from '@/lib/aiRequest/aiText';
import { renderPromptTemplate } from './promptTemplate';

export type ImageSubjectKind = 'character' | 'location' | 'world';

// Token in the (user-editable) tag prompt that expands to the per-kind guidance below. Uses the app's
// `<ANGLE>` convention so it renders as a chip in PromptField (registered in promptVariables as SUBJECT).
export const SUBJECT_TOKEN = '<SUBJECT>';

/** Per-kind guidance substituted for `{subject}` in the tag prompt. */
export const SUBJECT_GUIDANCE: Record<ImageSubjectKind, string> = {
  character: 'a single character; include a subject-count tag (1girl, 1boy, or solo)',
  location: 'a scenery/background image; include the tag "no humans"',
  world: 'key art representing the setting',
};

/** The default, user-editable tag-prompt template. Persisted in settings and overridable in the UI. */
export const DEFAULT_TAG_PROMPT =
  `You write prompts for an anime/booru text-to-image model. Convert the description into ${SUBJECT_TOKEN}. ` +
  'Output one line of comma-separated danbooru tags describing subject, appearance, clothing, setting, ' +
  'lighting, and art style. Each tag is lowercase plain words separated by spaces (e.g. "silver hair", ' +
  '"white picket fence"). Never join words together, never use CamelCase, never use underscores, never ' +
  'write sentences. No preamble, no labels, no quotes, no negative terms.';

const composeSystem = (template: string, kind: ImageSubjectKind) =>
  renderPromptTemplate(template, { [SUBJECT_TOKEN]: SUBJECT_GUIDANCE[kind] });

/**
 * Repair an LLM's tag list into stripped danbooru form: lowercase, space-separated words per tag, comma
 * between tags. Splits CamelCase/joined tokens, turns underscores/punctuation into spaces, dedupes.
 */
export function normalizeBooruTags(raw: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(/[,\n]/)) {
    const tag = piece
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // fooBar → foo Bar
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // HTMLParser → HTML Parser
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ') // underscores/punctuation → space
      .trim();
    if (tag && !seen.has(tag)) { seen.add(tag); out.push(tag); }
  }
  return out.join(', ');
}

/**
 * Build an image prompt for `subject` through the request pipeline. Throws on a failed or empty result;
 * the caller surfaces failures (and ignores `AbortError`).
 */
export async function buildImagePrompt(
  subject: { description: string; kind: ImageSubjectKind },
  opts: { snapshot: AiSettingsSnapshot; tagPrompt?: string; signal?: AbortSignal },
): Promise<string> {
  // The subject's name is deliberately not sent: models answer with it as a tag, and no image model knows
  // a person's name. An author who wants one in the tags types it there.
  const content = await requestAiText(opts.snapshot, {
    systemPrompt: composeSystem(opts.tagPrompt || DEFAULT_TAG_PROMPT, subject.kind),
    messages: [{ role: 'user', content: `Description:\n${subject.description}` }],
    requestType: 'imageTags',
    maxTokensOverride: 200,
  }, { signal: opts.signal });
  return normalizeBooruTags(content);
}
