import { describe, expect, it } from 'vitest';
import { serializeTurnContent } from '@/lib/turnDigest';
import type { ChatMessage, InventoryPassOp, RuntimeItem } from '@/types';
import {
  cleanItemDescription, describeItemRequest, dueItemDescriptions, ITEM_DESCRIPTION_CAP, withItemDescription,
} from './describe';

const op = (kind: InventoryPassOp['op'], item: string): InventoryPassOp => ({ op: kind, item, quantity: 1, owner: '', to: 'you', state: '' });
const turn = (turnId: string, narration: string, inventoryOps?: InventoryPassOp[]): ChatMessage => ({
  role: 'assistant',
  content: serializeTurnContent({ narration, choices: [], stat_changes: [], turnId, ...(inventoryOps && { inventoryOps }) }),
});
const stone: RuntimeItem = { id: 'r1', name: 'Odd Stone' };

describe('dueItemDescriptions', () => {
  it('pairs each undescribed runtime item with the oldest turn whose Inventory pass could make it', () => {
    const history = [
      turn('t0', 'You drop a stone you never had.', [op('lose', 'Odd Stone')]),
      turn('t1', 'You pick up a pebble.', [op('transfer', ' odd STONE ')]),
      turn('t2', 'Again.', [op('gain', 'Odd Stone')]),
    ];
    expect(dueItemDescriptions(history, [stone])).toEqual([
      { runtimeItemId: 'r1', name: 'Odd Stone', turnId: 't1', narration: 'You pick up a pebble.' },
    ]);
  });

  it('skips a described item, an item no turn names, and a turn with blank narration', () => {
    const history = [turn('t1', '  ', [op('gain', 'Odd Stone')]), turn('t2', 'A coin.', [op('gain', 'Coin')])];
    expect(dueItemDescriptions(history, [stone, { id: 'r2', name: 'Coin', description: 'A coin.' }, { id: 'r3', name: 'Rope' }]))
      .toEqual([]);
  });

  it('counts a whitespace description as none', () => {
    expect(dueItemDescriptions([turn('t1', 'A pebble.', [op('gain', 'Odd Stone')])], [{ ...stone, description: ' ' }]))
      .toHaveLength(1);
  });
});

describe('cleanItemDescription', () => {
  it('keeps the first line without labels, markup or quotes', () => {
    expect(cleanItemDescription('\n**Odd Stone:** "A smooth black pebble."\nMore text.', 'Odd Stone')).toBe('A smooth black pebble.');
    expect(cleanItemDescription('- Description: A pebble.', 'Odd Stone')).toBe('A pebble.');
  });

  it('drops a reasoning block before the sentence', () => {
    expect(cleanItemDescription('<think>It is a stone.\nMaybe black.</think>\nA smooth black pebble.', 'Odd Stone'))
      .toBe('A smooth black pebble.');
  });

  it('reads a refusal or an empty reply as no description', () => {
    expect(cleanItemDescription('None.', 'Odd Stone')).toBe('');
    expect(cleanItemDescription('   ', 'Odd Stone')).toBe('');
  });

  it('caps the length', () => {
    expect(cleanItemDescription('x'.repeat(ITEM_DESCRIPTION_CAP + 40), 'Odd Stone')).toHaveLength(ITEM_DESCRIPTION_CAP);
  });
});

describe('withItemDescription', () => {
  it('sets the description on an item that has none and keeps the first one after (Q144)', () => {
    const once = withItemDescription([stone, { id: 'r2', name: 'Rope' }], 'r1', 'A pebble.');
    expect(once).toEqual([{ ...stone, description: 'A pebble.' }, { id: 'r2', name: 'Rope' }]);
    expect(withItemDescription(once, 'r1', 'A rock.')).toBe(once);
  });

  it('changes nothing for an id the save no longer lists', () => {
    const items = [stone];
    expect(withItemDescription(items, 'gone', 'A pebble.')).toBe(items);
  });
});

describe('describeItemRequest', () => {
  it('sends the turn\'s narration and the item name as an Inventory request on that turn', () => {
    const request = describeItemRequest({ runtimeItemId: 'r1', name: 'Odd Stone', turnId: 't1', narration: ' A pebble. ' });
    expect(request).toMatchObject({ type: 'inventory', silent: true, attachTurnId: 't1' });
    expect(request.messages[0].content).toBe('## Passage\nA pebble.\n\n## Item\nOdd Stone');
  });
});
