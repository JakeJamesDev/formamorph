// Ticket 22's lookup request, frozen as the in-batch control for a change to lookup mode: the contents list,
// the best search hit only, and the fetched text inside the one 12,000-character docs budget. The prompt text
// is frozen; the search, the lookup executor and the budget constants are the app's live ones.
import { buildAiRequestSpec, type AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { streamAiToolLoop } from '@/lib/aiRequest/toolLoop';
import { stripReasoningLive } from '@/lib/aiResponse';
import type { DocsIndex } from '@/lib/docs/docsIndex';
import { createDocsLookup, DOCS_LOOKUP, DOCS_LOOKUP_CALL_LIMIT, sectionBlock } from '@/lib/formaquestion/docsLookup';
import { GENERAL_KNOWLEDGE_MARKER, isGeneralKnowledge, readMarker } from '@/lib/formaquestion/generalKnowledge';
import { HELP_DOCS_CHAR_BUDGET, HELP_SECTION_LIMIT, helpSections, type HelpEvent } from '@/lib/formaquestion/helpSession';
import { DEFAULT_HELP_OPTIONS } from '@/lib/formaquestion/helpPresets';

const SYSTEM_PROMPT = [
  'You are the help writer for Formamorph, a text adventure app. A player asks how to use the app, and you answer from the guide.',
  '',
  `- The message holds the contents list of the guide, and the guide sections that match the words of the question. Read each other section the question needs with ${DOCS_LOOKUP.name}.`,
  '- Take each fact, each step and each name from the guide sections you read.',
  '- When the player asks how to do a task, answer with every step of that task as a numbered list, in the order the guide gives.',
  '- Write each control name as the guide writes it, in bold.',
  '- After the steps, add one or two sentences of detail when the player needs them.',
  `- When the guide sections do not cover the question, write ${GENERAL_KNOWLEDGE_MARKER} alone on the first line. Then answer from general knowledge in a few sentences, and name only the controls the guide names.`,
].join('\n');

const LOOKUP = {
  ...DOCS_LOOKUP,
  callLimit: DOCS_LOOKUP_CALL_LIMIT,
  description: 'Returns the text of guide sections. Pass `sections` to read sections from the contents list, or pass `search` to find sections by words.',
};

/** Each page name, then one indented `#section` line per section, with the later parts of a split section left out. */
function contents(index: DocsIndex): string {
  const isLaterPart = (id: string) => {
    const base = id.replace(/-part-\d+$/, '');
    return base !== id && index.get([base]).some((section) => section.id === id);
  };
  return index.contents()
    .map(({ page, sections }) => [page, ...sections.map((section) => section.id).filter((id) => id !== page && !isLaterPart(id)).map((id) => ` ${id.slice(page.length)}`)].join('\n'))
    .join('\n');
}

/** One question in ticket 22's lookup mode, with no history, surface or language. Yields the done event only. */
export async function* askHelpContentsLookup({ question, snapshot, index, fetchImpl }: {
  question: string;
  snapshot: AiSettingsSnapshot;
  index: DocsIndex;
  fetchImpl: typeof fetch;
}): AsyncGenerator<HelpEvent, void, void> {
  const inPrompt = helpSections(index, question).slice(0, 1);
  const lookup = createDocsLookup(index, {
    budget: HELP_DOCS_CHAR_BUDGET - inPrompt.reduce((size, section) => size + section.markdown.length, 0),
    searchLimit: HELP_SECTION_LIMIT,
    held: inPrompt,
  });
  const user = [
    `<contents>\n${contents(index)}\n</contents>`,
    ...(inPrompt.length > 0 ? [`<guide>\n${inPrompt.map(sectionBlock).join('\n\n')}\n</guide>`] : []),
    `Question: ${question}`,
    `Read the guide sections the question needs with ${DOCS_LOOKUP.name}, then answer the question from the guide sections.`,
  ].join('\n\n');
  const spec = buildAiRequestSpec(snapshot, {
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: user }],
    requestType: 'help',
    maxTokensOverride: DEFAULT_HELP_OPTIONS.answer.maxTokens,
    tools: [LOOKUP],
  });
  for await (const event of streamAiToolLoop(spec, { fetchImpl, execute: lookup.execute })) {
    if (event.type !== 'done') continue;
    const sources = [...lookup.fetched(), ...inPrompt];
    const answer = readMarker(stripReasoningLive(event.result.content), { final: true });
    const flagged = isGeneralKnowledge(answer.marked, sources.length);
    yield { type: 'done', text: answer.text, sources, stopped: false, flagged, nearest: [], reasoning: '' };
  }
}
