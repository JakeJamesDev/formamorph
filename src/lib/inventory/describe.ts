/**
 * The runtime item description: a background request that describes an item the Inventory pass made, from
 * the narration of the turn that made it (Q148). The pass's own reply never carries one. Pure.
 */
import type { TransportRequest } from '@/lib/aiRequest/requestTransport';
import { stripReasoning } from '@/lib/aiResponse';
import { parseTurnContent } from '@/lib/turnDigest';
import { escapeRegExp } from '@/lib/utils';
import type { ChatMessage, RuntimeItem } from '@/types';
import { itemNameKey } from './pass';

/** The longest description kept. */
export const ITEM_DESCRIPTION_CAP = 200;
const ITEM_DESCRIPTION_MAX_TOKENS = 80;

/** One runtime item with no description, and the turn whose narration first named it. */
export interface DescribeItemTarget {
  runtimeItemId: string;
  name: string;
  turnId: string;
  narration: string;
}

const ITEM_DESCRIPTION_SYSTEM = `You describe one item from an interactive story. Reply with one short sentence that says what the item is and what it looks like, from what the passage shows. Write only that sentence.`;

/** The request for one item. It runs as the Inventory pass's type, so it follows that prompt's endpoint and pinned samplers. */
export function describeItemRequest(target: DescribeItemTarget): TransportRequest {
  return {
    type: 'inventory',
    systemPrompt: ITEM_DESCRIPTION_SYSTEM,
    messages: [{ role: 'user', content: `## Passage\n${target.narration.trim()}\n\n## Item\n${target.name}` }],
    maxTokens: ITEM_DESCRIPTION_MAX_TOKENS,
    silent: true,
    attachTurnId: target.turnId,
  };
}

const NO_DESCRIPTION = /^(none|n\/a|unknown|null)\.?$/i;

/** The reply's first line without reasoning, labels, quotes or markup, capped. Empty when the reply holds none. */
export function cleanItemDescription(reply: string, name: string): string {
  const line = stripReasoning(reply).split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const text = line
    .replace(/^[-*>\s]+/, '')
    .replace(/\*\*|__/g, '')
    .replace(new RegExp(`^(description|${escapeRegExp(name.trim())})\\s*:\\s*`, 'i'), '')
    .replace(/^["'“]+|["'”]+$/g, '')
    .trim();
  return NO_DESCRIPTION.test(text) ? '' : text.slice(0, ITEM_DESCRIPTION_CAP).trim();
}

/** The runtime items with `description` set on `id`, unless it already has one: the first description wins (Q144). */
export function withItemDescription(items: readonly RuntimeItem[], id: string, description: string): readonly RuntimeItem[] {
  return items.some((item) => item.id === id && !item.description?.trim())
    ? items.map((item) => (item.id === id ? { ...item, description } : item)) : items;
}

/** Every runtime item with no description, with the oldest stored turn whose Inventory pass could have made it. */
export function dueItemDescriptions(history: readonly ChatMessage[], runtimeItems: readonly RuntimeItem[]): DescribeItemTarget[] {
  const undescribed = runtimeItems.filter((item) => !item.description?.trim());
  if (!undescribed.length) return [];
  const firstTurn = new Map<string, { turnId: string; narration: string }>();
  for (const message of history) {
    if (message.role !== 'assistant') continue;
    const turn = parseTurnContent(message.content);
    if (!turn?.turnId || !turn.narration?.trim()) continue;
    // Only a gain, or a take from this place the pass reads as one, makes a runtime item.
    for (const op of (turn.inventoryOps ?? []).filter((o) => o.op === 'gain' || o.op === 'transfer')) {
      const key = itemNameKey(op.item);
      if (!firstTurn.has(key)) firstTurn.set(key, { turnId: turn.turnId, narration: turn.narration });
    }
  }
  return undescribed.flatMap((item) => {
    const turn = firstTurn.get(itemNameKey(item.name));
    return turn ? [{ runtimeItemId: item.id, name: item.name, ...turn }] : [];
  });
}
