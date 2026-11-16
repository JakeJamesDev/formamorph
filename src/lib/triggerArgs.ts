/**
 * The trigger args: what the thing that fired a script's run passes it beside the run's subject, which the
 * sandbox's `args` global reads. A run that nothing fires reads an empty object.
 */
import type { ItemInstanceWhere, ItemScriptTiming } from '@/types';

/** Who caused an item event or a trait switch: the Inventory pass, the player, a script's write, or a rule. */
export type TriggerCause = 'story' | 'player' | 'script' | 'rule';

/** A buy, on both sides of it. `price` is in the Currency's base unit; both are null for a buy the story didn't price. */
export interface TriggerPurchase {
  price: number | null;
  currency: string | null;
}

/** The side fields of one item event. A field the event doesn't record is absent. */
export interface ItemEventArgs {
  quantity: number;
  by?: TriggerCause;
  /** Where the instance came from; null when it is new. */
  from?: ItemInstanceWhere | null;
  /** Where the instance went; null when it is destroyed. */
  to?: ItemInstanceWhere | null;
  purchase?: TriggerPurchase | null;
  /** The id of the Item Instance a use acted on. */
  target?: string | null;
}

export type ItemArgsField = keyof ItemEventArgs;

/** The `args` fields each item timing reads, in the order `args` lists them. */
export const ITEM_ARGS_FIELDS: Readonly<Record<ItemScriptTiming, readonly ItemArgsField[]>> = {
  gained: ['by', 'from', 'purchase', 'quantity'],
  lost: ['by', 'to', 'purchase', 'quantity'],
  equipped: ['by', 'quantity'],
  unequipped: ['by', 'quantity'],
  used: ['by', 'quantity', 'target'],
};

/** Who switched a trait: the player's toggle, a script's write, or a rule (Q12). */
export type SwitchCause = Exclude<TriggerCause, 'story'>;

/** What a When a Trait Switches run passes. */
export type SwitchEventArgs = { by: SwitchCause };

/** The switch an editor run reads: the player's toggle, as the sample trait switches on. */
export const SAMPLE_SWITCH_ARGS: SwitchEventArgs = { by: 'player' };

/** The fixed item event an editor run reads (Q11): one instance at the persona, from and to nowhere, no buy, used on nothing. */
export const SAMPLE_ITEM_ARGS: ItemEventArgs = { quantity: 1, by: 'story', from: null, to: null, purchase: null, target: null };

/** `args` as `timing` reads it: the fields outside the timing's list dropped. */
export const itemArgsAt = (timing: ItemScriptTiming, args: ItemEventArgs): Partial<ItemEventArgs> =>
  Object.fromEntries(ITEM_ARGS_FIELDS[timing].flatMap((field) => (field in args ? [[field, args[field]]] : [])));
