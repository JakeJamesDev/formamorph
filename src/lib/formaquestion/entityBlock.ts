/**
 * Entity blocks: the fenced `entity` blocks a Formaquestion reply drafts entities in. `readEntityBlock` is the
 * only reader of the format.
 */

/** The fence language of an entity block. */
export const ENTITY_BLOCK_LANGUAGE = 'entity';

/** What an entity block drafts. Every other field of the entity keeps the blank entity's value. */
export interface EntityDraft {
  name: string;
  aiDescription: string;
}

/** The most sentences a valid AI Description holds. */
export const ENTITY_BLOCK_MAX_SENTENCES = 4;

/** A block's draft, or its problems with the fields read so far. */
export type EntityBlockRead =
  | { ok: true; draft: EntityDraft }
  | { ok: false; problems: string[]; partial: Partial<EntityDraft> };

/** A labeled line: one to three words, a colon, then the value. */
const LABEL_LINE = /^\s*([A-Za-z]+(?:[ \t]+[A-Za-z]+){0,2})\s*:\s*(.*)$/;
const isName = (label: string) => label.toLowerCase() === 'name';
const isAiDescription = (label: string) => label.toLowerCase().replace(/\s+/g, ' ') === 'ai description';

/** The sentences of a text: each ends at `.`, `!` or `?` (and any closing quote) before a space; a last fragment counts. */
export function sentenceCount(text: string): number {
  return text.trim().split(/(?<=[.!?]["'”’)\]]*)\s+/).filter(Boolean).length;
}

/**
 * Reads a block's text. Valid: a non-empty Name, an AI Description of one to four sentences, and no other
 * labels. Labels match in any case; the AI Description runs to the block's end, so its lines are never labels.
 */
export function readEntityBlock(text: string): EntityBlockRead {
  const problems: string[] = [];
  const lines = text.split('\n');
  let name: string | undefined;
  let aiDescription: string | undefined;
  for (let at = 0; at < lines.length; at += 1) {
    const line = lines[at];
    if (!line.trim()) continue;
    const label = LABEL_LINE.exec(line);
    if (!label) {
      problems.push(`Unlabeled line: ${line.trim()}`);
      continue;
    }
    const [, key, value] = label;
    if (isAiDescription(key)) {
      aiDescription = [value, ...lines.slice(at + 1)].join('\n').trim();
      break;
    }
    if (!isName(key)) problems.push(`Unknown label: ${key}`);
    else if (name !== undefined) problems.push('More than one Name');
    else name = value.trim();
  }
  if (!name) problems.push('No Name');
  if (!aiDescription) problems.push('No AI Description');
  else if (sentenceCount(aiDescription) > ENTITY_BLOCK_MAX_SENTENCES) problems.push(`AI Description over ${ENTITY_BLOCK_MAX_SENTENCES} sentences`);
  if (problems.length === 0 && name && aiDescription) return { ok: true, draft: { name, aiDescription } };
  return { ok: false, problems, partial: { ...(name && { name }), ...(aiDescription && { aiDescription }) } };
}

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})\s*(\S*)/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;

/** The text of the `entity` fence a streaming reply has opened and not yet closed, or null. */
export function openEntityFence(markdown: string): string | null {
  let fence: { mark: string; language: string; body: string[] } | null = null;
  for (const line of markdown.split('\n')) {
    if (!fence) {
      const open = FENCE_OPEN.exec(line);
      if (open) fence = { mark: open[1], language: open[2].toLowerCase(), body: [] };
      continue;
    }
    const close = FENCE_CLOSE.exec(line);
    if (close && close[1][0] === fence.mark[0] && close[1].length >= fence.mark.length) fence = null;
    else fence.body.push(line);
  }
  return fence?.language === ENTITY_BLOCK_LANGUAGE ? fence.body.join('\n').replace(/\n+$/, '') : null;
}

/** The rider that asks for entities in entity blocks: the full request carries it in a World Editor while Creation is on. */
export const ENTITY_RIDER = `When the player asks you to make an entity, write each entity in its own fenced entity block, in this form:

\`\`\`entity
Name: <the entity's name>
AI Description: <one to four sentences, which may run several lines>
\`\`\`

A block holds one entity. For each further entity, close the block and open a new one. Write only the Name and AI Description lines in a block. The player adds each block to the open world from your reply.`;

/** The line the next help request carries after the player adds entities from cards. */
export const entityAddNote = (names: readonly string[]): string =>
  `The player added ${names.length === 1 ? 'this entity' : 'these entities'} to the world from your entity blocks: ${names.join(', ')}.`;
