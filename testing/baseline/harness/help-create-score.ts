/** The Create probe's scores: entity blocks read by the app's own parser (Q61), and the refusal's checks. */
import type { ResponseSchema } from '@/lib/aiRequest/responseSchema';
import { ENTITY_BLOCK_LANGUAGE, readEntityBlock, type EntityDraft } from '@/lib/formaquestion/entityBlock';

/** A closed fence of a reply: its language, lowercased, and its text. */
export interface Fence { language: string; body: string }

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})\s*(\S*)/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;

/** The closed fences of a reply, in order. A fence the reply leaves open is not one. */
export function closedFences(markdown: string): Fence[] {
  const fences: Fence[] = [];
  let open: { mark: string; language: string; body: string[] } | null = null;
  for (const line of markdown.split('\n')) {
    if (!open) {
      const start = FENCE_OPEN.exec(line);
      if (start) open = { mark: start[1], language: start[2].toLowerCase(), body: [] };
      continue;
    }
    const close = FENCE_CLOSE.exec(line);
    if (close && close[1][0] === open.mark[0] && close[1].length >= open.mark.length) {
      fences.push({ language: open.language, body: open.body.join('\n') });
      open = null;
    } else open.body.push(line);
  }
  return fences;
}

export interface CreateScore {
  /** The reply's entity blocks. */
  blocks: number;
  /** The blocks the parser reads as valid. */
  valid: number;
  /** Each invalid block's problems, one string per block. */
  problems: string[];
  /** The valid blocks' drafts, in order. */
  drafts: EntityDraft[];
  /** Fences of another language that hold a Name line: a draft the card never shows. */
  strays: number;
  /** The reply has as many entity blocks as the ask wants. */
  countMatch: boolean;
  /** Per valid draft: its name is one the world already uses, trimmed and in any case. */
  duplicates: boolean[];
}

/** Scores a reply's entity blocks against the number the ask wants and the names the world already uses. */
export function scoreCreateReply(answer: string, wanted: number, taken: readonly string[] = []): CreateScore {
  const fences = closedFences(answer);
  const blocks = fences.filter((fence) => fence.language === ENTITY_BLOCK_LANGUAGE);
  const reads = blocks.map((fence) => readEntityBlock(fence.body));
  const takenKeys = new Set(taken.map((name) => name.trim().toLowerCase()));
  return {
    duplicates: reads.flatMap((read) => (read.ok ? [takenKeys.has(read.draft.name.trim().toLowerCase())] : [])),
    blocks: blocks.length,
    valid: reads.filter((read) => read.ok).length,
    problems: reads.flatMap((read) => (read.ok ? [] : [read.problems.join('; ')])),
    drafts: reads.flatMap((read) => (read.ok ? [read.draft] : [])),
    strays: fences.filter((fence) => fence.language !== ENTITY_BLOCK_LANGUAGE && /^\s*name\s*:/im.test(fence.body)).length,
    countMatch: blocks.length === wanted,
  };
}

/** The strict-schema control's reply: an `entities` list of names and AI descriptions. */
export const CREATE_SCHEMA: ResponseSchema = {
  name: 'create_entities',
  schema: {
    type: 'object',
    properties: {
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, aiDescription: { type: 'string' } },
          required: ['name', 'aiDescription'],
          additionalProperties: false,
        },
      },
    },
    required: ['entities'],
    additionalProperties: false,
  },
};

/**
 * A schema reply as the entity blocks it stands for, so the control is scored by the same parser. A reply that
 * is not the schema's JSON stands for no block.
 */
export function schemaAsBlocks(content: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
  } catch {
    return '';
  }
  const entities = (parsed as { entities?: unknown })?.entities;
  if (!Array.isArray(entities)) return '';
  return entities.map((entity: unknown) => {
    const { name, aiDescription } = (entity ?? {}) as { name?: unknown; aiDescription?: unknown };
    return `\`\`\`${ENTITY_BLOCK_LANGUAGE}\nName: ${typeof name === 'string' ? name : ''}\nAI Description: ${typeof aiDescription === 'string' ? aiDescription : ''}\n\`\`\``;
  }).join('\n\n');
}

export interface RefusalScore {
  /** The reply says something. */
  replied: boolean;
  /** No entity block, and no stray draft fence. */
  noBlock: boolean;
  /** The reply names the World Editor. */
  namesEditor: boolean;
  /** All three. */
  pass: boolean;
}

/** Scores an off-editor reply: it should say no in words, name the World Editor, and draft nothing. */
export function scoreRefusal(answer: string): RefusalScore {
  const { blocks, strays } = scoreCreateReply(answer, 0);
  const replied = answer.trim().length > 0;
  const noBlock = blocks === 0 && strays === 0;
  const namesEditor = /world\s+editor/i.test(answer);
  return { replied, noBlock, namesEditor, pass: replied && noBlock && namesEditor };
}

/** A judge's grade of one draft's fit to the world, and its reason. */
export interface FitGrade { fit: boolean; why: string }

/** A fit grade's reply: "Fit: yes" or "Fit: no", then a reason. Anything else is no grade. */
export function readFitGrade(content: string): FitGrade | null {
  const fit = /^\s*\**fit\**\s*:\s*\**\s*(yes|no)\b/im.exec(content);
  if (!fit) return null;
  const why = /^\s*\**why\**\s*:\s*\**\s*(.+)$/im.exec(content)?.[1]?.trim() ?? '';
  return { fit: fit[1].toLowerCase() === 'yes', why };
}
