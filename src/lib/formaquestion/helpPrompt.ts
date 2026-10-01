import type { DocSection } from '@/lib/docs/docsIndex';

/** The fixed help prompt. The contract is positive and names no sample value a small model can copy. */
export const HELP_SYSTEM_PROMPT = [
  'You are the help writer for Formamorph, a text adventure app. A player asks how to use the app, and you answer from the guide sections in the message.',
  '',
  '- Take each fact, each step and each name from the guide sections.',
  '- When the player asks how to do a task, answer with every step of that task as a numbered list, in the order the guide gives.',
  '- Write each control name as the guide writes it, in bold.',
  '- After the steps, add one or two sentences of detail when the player needs them.',
  '- When the guide sections do not answer the question, say that the guide does not cover the question.',
].join('\n');

/** The page name as a reader says it: wiki page names join their words with hyphens. */
const pageLabel = (page: string): string => page.replace(/-/g, ' ');

/** The one user message of a help request: the docs sections, then the question, then the grounding line. */
export function helpUserMessage(question: string, sections: readonly DocSection[]): string {
  const guide = sections
    .map((section) => `<section page="${pageLabel(section.page)}">\n${section.markdown}\n</section>`)
    .join('\n\n');
  return [
    `<guide>\n${guide}\n</guide>`,
    `Question: ${question}`,
    'Answer the question from the guide sections above.',
  ].join('\n\n');
}
