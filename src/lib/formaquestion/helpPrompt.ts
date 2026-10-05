import type { DocSection } from '@/lib/docs/docsIndex';
import { languageDirective } from '@/lib/languages';
import { DOCS_LOOKUP, sectionBlock } from './docsLookup';
import { HELP_CHIP, renderHelpPrompt } from './helpChips';
import { DEFAULT_CODE_RIDER } from './helpCodeRider';

/** The four texts a help preset holds, as stored: chips in place. */
export interface HelpPromptTexts {
  /** The system prompt of the answer request. */
  readonly answer: string;
  /** The system prompt of the AI Search request. */
  readonly pick: string;
  /** The system prompt of the answer request in lookup mode. */
  readonly lookup: string;
  /** The rider a code turn adds to the user message, sent verbatim. */
  readonly code: string;
}

export type HelpPromptKey = keyof HelpPromptTexts;

/** The prompts that run a request of their own, each with its option block. */
export type HelpRequestKey = Exclude<HelpPromptKey, 'code'>;

/** The prompts in rail order. */
export const HELP_PROMPT_KEYS: readonly HelpPromptKey[] = ['answer', 'pick', 'lookup', 'code'];

/** True for a prompt that runs a request of its own, so it has an option block. */
export const isHelpRequestKey = (key: HelpPromptKey): key is HelpRequestKey => key !== 'code';

/** The answer rules both help prompts share. */
const ANSWER_RULES = [
  '- When the player asks how to do a task, answer with every step of that task as a numbered list, in the order the guide gives.',
  '- Write each control name as the guide writes it, in bold.',
  '- After the steps, add one or two sentences of detail when the player needs them.',
  `- When the guide sections do not cover the question, write ${HELP_CHIP.marker} alone on the first line. Then answer from general knowledge in a few sentences, and name only the controls the guide names.`,
];

/**
 * The default help prompts, as the Default preset holds them. Each contract is positive and names no sample
 * value a small model can copy. The chips stand for the parts the app reads back.
 */
export const DEFAULT_HELP_PROMPTS: HelpPromptTexts = {
  answer: [
    'You are the help writer for Formamorph, a text adventure app. A player asks how to use the app, and you answer from the guide sections in the message.',
    '',
    HELP_CHIP.voice,
    '',
    '- Take each fact, each step and each name from the guide sections.',
    ...ANSWER_RULES,
  ].join('\n'),
  pick: [
    'You are the librarian of the Formamorph player guide. Formamorph is a text adventure app. A player asks a question, and you pick the guide sections that answer it.',
    '',
    'The message lists every section of the guide, one on each line: the page, then the headings down to the section.',
    '',
    '- Pick the sections whose text answers the question, the best one first.',
    `- Pick ${HELP_CHIP.pickLimit} sections at most.`,
    HELP_CHIP.replyFormat,
  ].join('\n'),
  lookup: [
    'You are the help writer for Formamorph, a text adventure app. A player asks how to use the app, and you answer from the guide.',
    '',
    HELP_CHIP.voice,
    '',
    `- The message holds the guide sections that match the words of the question. Find and read each other section the question needs with ${HELP_CHIP.lookupFunction}.`,
    '- Take each fact, each step and each name from the guide sections you read.',
    ...ANSWER_RULES,
  ].join('\n'),
  code: DEFAULT_CODE_RIDER,
};

/** The chips each prompt reads back, in palette order. */
export const HELP_PROMPT_CHIPS = {
  answer: [HELP_CHIP.marker, HELP_CHIP.voice],
  pick: [HELP_CHIP.pickLimit, HELP_CHIP.replyFormat],
  lookup: [HELP_CHIP.marker, HELP_CHIP.lookupFunction, HELP_CHIP.voice],
  code: [],
} as const satisfies Record<HelpPromptKey, readonly string[]>;

/** The default help prompt as the request carries it with no Voice. */
export const HELP_SYSTEM_PROMPT = renderHelpPrompt(DEFAULT_HELP_PROMPTS.answer);

/** The default pick prompt as the request carries it. */
export const HELP_PICK_SYSTEM_PROMPT = renderHelpPrompt(DEFAULT_HELP_PROMPTS.pick);

/** The default lookup prompt as the request carries it with no Voice. */
export const HELP_LOOKUP_SYSTEM_PROMPT = renderHelpPrompt(DEFAULT_HELP_PROMPTS.lookup);

/** The help prompt for the AI Language: the fixed prompt, plus the language directive for answers when it is not English. */
export function helpSystemPrompt(language: string, prompt = HELP_SYSTEM_PROMPT): string {
  const directive = languageDirective('answers', language);
  if (!directive) return prompt;
  return `${prompt}\n\n${directive} Keep each control name exactly as the guide writes it, in bold, so the player finds it on the screen.`;
}

/** The page name as a reader says it: wiki page names join their words with hyphens. */
const pageLabel = (page: string): string => page.replace(/-/g, ' ');

/** The line that tells the model which screen the player asks from. "Here" and "this" in the question mean it. */
export function screenLine(where: string): string {
  return `The player asks from this screen: ${where}. The words "here" and "this" in the question mean it. The first guide section explains it.`;
}

/** The one user message of a help request: the docs sections, then the question, then the grounding line. */
export function helpUserMessage(question: string, sections: readonly DocSection[], where?: string): string {
  const guide = sections
    .map((section) => `<section page="${pageLabel(section.page)}">\n${section.markdown}\n</section>`)
    .join('\n\n');
  return [
    `<guide>\n${guide}\n</guide>`,
    ...(where ? [screenLine(where)] : []),
    `Question: ${question}`,
    'Answer the question from the guide sections above.',
  ].join('\n\n');
}

/**
 * The one user message of a lookup request: the sections the search found when it found one, then the
 * question and the grounding line.
 */
export function helpLookupUserMessage(question: string, sections: readonly DocSection[], where?: string): string {
  return [
    ...(sections.length > 0 ? [`<guide>\n${sections.map(sectionBlock).join('\n\n')}\n</guide>`] : []),
    ...(where ? [screenLine(where)] : []),
    `Question: ${question}`,
    `Read the guide sections the question needs with ${DOCS_LOOKUP.name}, then answer the question from the guide sections.`,
  ].join('\n\n');
}
