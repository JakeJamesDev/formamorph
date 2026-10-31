import type { DocSection } from '@/lib/docs/docsIndex';
import { languageDirective } from '@/lib/languages';
import { DOCS_LOOKUP, sectionBlock } from './docsLookup';
import { HELP_CHIP, renderHelpPrompt } from './helpChips';
import { DEFAULT_CODE_RIDER } from './helpCodeRider';
import { DEFAULT_WORLD_EDITOR_RULES, DEFAULT_WORLD_GAME_RULES } from './helpWorldRules';
import type { WorldItemKind } from './helpWorldSource';

/** The texts a help preset holds, as stored: chips in place. */
export interface HelpPromptTexts {
  /** The system prompt of the answer request. */
  readonly answer: string;
  /** The system prompt of the AI Search request. */
  readonly pick: string;
  /** The system prompt of the Intent Classifier request. */
  readonly intent: string;
  /** The system prompt of the Create request, which drafts entities in a World Editor. */
  readonly create: string;
  /** The system prompt of the answer request in lookup mode. */
  readonly lookup: string;
  /** The rider a code turn adds to the user message, sent verbatim. */
  readonly code: string;
  /** The world rules a request asked in the World Editor adds, sent verbatim. */
  readonly worldEditor: string;
  /** The world rules a request asked in the game adds, sent verbatim. */
  readonly worldGame: string;
}

export type HelpPromptKey = keyof HelpPromptTexts;

const HELP_REQUEST_KEYS = ['answer', 'pick', 'intent', 'create', 'lookup'] as const;

/** The prompts that run a request of their own, each with its option block. The others ride the answer request. */
export type HelpRequestKey = (typeof HELP_REQUEST_KEYS)[number];

/** The prompts a stored preset or a preset file may lack: each reads as its default text. */
export const HELP_OPTIONAL_PROMPT_KEYS = ['intent', 'create', 'worldEditor', 'worldGame'] as const satisfies readonly HelpPromptKey[];

/** The prompts in rail order. */
export const HELP_PROMPT_KEYS: readonly HelpPromptKey[] = [...HELP_REQUEST_KEYS, 'code', 'worldEditor', 'worldGame'];

/** True for a prompt that runs a request of its own, so it has an option block. */
export const isHelpRequestKey = (key: HelpPromptKey): key is HelpRequestKey => (HELP_REQUEST_KEYS as readonly HelpPromptKey[]).includes(key);

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
  intent: [
    'You are the desk clerk of Formamorph help. Formamorph is a text adventure app with a player guide, a World Editor and scripts. A player sends a message, and you name the one kind of help it asks for.',
    '',
    'The kinds:',
    '- Chat: talk with the assistant about anything other than Formamorph.',
    '- Help: how to use Formamorph: its screens, settings and features.',
    '- Code: writing, reading or fixing scripts and stat code.',
    '- World: the open world itself: its story, characters, places and lore.',
    '- Create: making a new character or other entity for the open world.',
    '',
    '- A short follow-up asks for the same kind as the earlier question.',
    '- When the message asks for two things, name the kind of the first one, and mark the second ask.',
    HELP_CHIP.intentFormat,
  ].join('\n'),
  create: [
    'You are the entity writer for Formamorph, a text adventure app. An author asks you to make entities for the world open in the World Editor: the characters and other beings the narrator plays.',
    '',
    HELP_CHIP.voice,
    '',
    "- Fit each entity to the world's setting and tone, as the world block and the sample entities show them.",
    "- Name each entity in the style of the world's names, with a name no entity of the world uses.",
    '- Write each AI Description the way the sample entities write theirs: who the entity is, how it looks and how it acts.',
    '- Make each entity the author asks for. When the author asks to change an earlier entity, write the changed entity in full.',
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
  worldEditor: DEFAULT_WORLD_EDITOR_RULES,
  worldGame: DEFAULT_WORLD_GAME_RULES,
};

/** The texts of a stored record, an absent optional prompt as its default; else the first prompt that is not text. */
export function readHelpPromptTexts(stored: Record<string, unknown>): { texts: HelpPromptTexts } | { bad: HelpPromptKey } {
  const optional: readonly HelpPromptKey[] = HELP_OPTIONAL_PROMPT_KEYS;
  const texts: Partial<Record<HelpPromptKey, string>> = {};
  for (const key of HELP_PROMPT_KEYS) {
    const value = stored[key] === undefined && optional.includes(key) ? DEFAULT_HELP_PROMPTS[key] : stored[key];
    if (typeof value !== 'string') return { bad: key };
    texts[key] = value;
  }
  return { texts: texts as HelpPromptTexts };
}

/** The chips each prompt reads back, in palette order. */
export const HELP_PROMPT_CHIPS = {
  answer: [HELP_CHIP.marker, HELP_CHIP.voice],
  pick: [HELP_CHIP.pickLimit, HELP_CHIP.replyFormat],
  intent: [HELP_CHIP.intentFormat],
  create: [HELP_CHIP.voice],
  lookup: [HELP_CHIP.marker, HELP_CHIP.lookupFunction, HELP_CHIP.voice],
  code: [],
  worldEditor: [],
  worldGame: [],
} as const satisfies Record<HelpPromptKey, readonly string[]>;

/** The default help prompt as the request carries it with no Voice. */
export const HELP_SYSTEM_PROMPT = renderHelpPrompt(DEFAULT_HELP_PROMPTS.answer);

/** The default pick prompt as the request carries it. */
export const HELP_PICK_SYSTEM_PROMPT = renderHelpPrompt(DEFAULT_HELP_PROMPTS.pick);

/** The default lookup prompt as the request carries it with no Voice. */
export const HELP_LOOKUP_SYSTEM_PROMPT = renderHelpPrompt(DEFAULT_HELP_PROMPTS.lookup);

/** The directive's sentence that keeps world names in a request that reads the world. */
export const worldNamesLine = (language: string): string =>
  `Names from the world are proper names: write each one exactly as the world spells it, in its own language, inside every ${language.trim()} sentence too.`;

/**
 * The help prompt for the AI Language: the fixed prompt, plus the language directive for answers when it is not
 * English. The directive keeps the guide's control names unless `guide` is off, and world names when the
 * request reads the world.
 */
export function helpSystemPrompt(language: string, prompt = HELP_SYSTEM_PROMPT, { world = false, guide = true }: { world?: boolean; guide?: boolean } = {}): string {
  const directive = languageDirective('answers', language);
  if (!directive) return prompt;
  const controls = guide ? ' Keep each control name exactly as the guide writes it, in bold, so the player finds it on the screen.' : '';
  const names = world ? ` ${worldNamesLine(language)}` : '';
  return `${prompt}\n\n${directive}${controls}${names}`;
}

/** The page name as a reader says it: wiki page names join their words with hyphens. */
const pageLabel = (page: string): string => page.replace(/-/g, ' ');

/** The line that tells the model which screen the player asks from. "Here" and "this" in the question mean it. */
export function screenLine(where: string): string {
  return `The player asks from this screen: ${where}. The words "here" and "this" in the question mean it. The first guide section explains it.`;
}

/** A world section as the world block holds it: its item's kind and its text, heading included. */
export interface WorldBlockSection {
  kind: WorldItemKind;
  markdown: string;
}

/** The world block, or none when the request reads no world. A search that missed still sends it empty. */
function worldBlock(world: readonly WorldBlockSection[] | undefined): string[] {
  if (!world) return [];
  return [`<world>\n${world.map(({ kind, markdown }) => `<section kind="${kind}">\n${markdown}\n</section>`).join('\n\n')}\n</world>`];
}

/** The story block of a game request, or none. A story with no turns yet still sends it empty. */
const storyBlock = (story: string | undefined): string[] => (story === undefined ? [] : [`<story>\n${story}\n</story>`]);

/** Where an answer's facts come from: the guide when the request carries it, and the world when it reads one. */
const groundsOf = (world: readonly WorldBlockSection[] | undefined, guide = true) => (!guide ? 'world sections' : world ? 'guide and world sections' : 'guide sections');

/**
 * The one user message of a help request: the docs sections unless `guide` is off, the world sections when the
 * request reads a world, then the question, then the grounding line.
 */
export function helpUserMessage(question: string, sections: readonly DocSection[], where?: string, world?: readonly WorldBlockSection[], story?: string, guide = true): string {
  const guideText = sections
    .map((section) => `<section page="${pageLabel(section.page)}">\n${section.markdown}\n</section>`)
    .join('\n\n');
  return [
    ...(guide ? [`<guide>\n${guideText}\n</guide>`] : []),
    ...worldBlock(world),
    ...storyBlock(story),
    ...(where ? [screenLine(where)] : []),
    `Question: ${question}`,
    `Answer the question from the ${groundsOf(world, guide)} above.`,
  ].join('\n\n');
}

/**
 * The one user message of a lookup request: the sections the search found when it found one, then the
 * world sections when the request reads a world, then the question and the grounding line.
 */
export function helpLookupUserMessage(question: string, sections: readonly DocSection[], where?: string, world?: readonly WorldBlockSection[], story?: string): string {
  return [
    ...(sections.length > 0 ? [`<guide>\n${sections.map(sectionBlock).join('\n\n')}\n</guide>`] : []),
    ...worldBlock(world),
    ...storyBlock(story),
    ...(where ? [screenLine(where)] : []),
    `Question: ${question}`,
    `Read the guide sections the question needs with ${DOCS_LOOKUP.name}, then answer the question from the ${groundsOf(world)}.`,
  ].join('\n\n');
}
