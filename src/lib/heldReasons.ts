// Why a bearer can't link a Blueprint again. The trait and stat Link menus show it on each refused row.

/** What a bearer already holds that blocks a link to one original. `name` is the item named in the text. */
export type HeldReason =
  /** The bearer links this original. */
  | { kind: 'links'; name: string }
  /** The bearer owns a stat under the original's id, as Detach leaves it. */
  | { kind: 'owns'; name: string }
  /** The bearer links `group`, and the original `name` sits inside it. */
  | { kind: 'group'; name: string; group: string }
  /** The bearer links `name`, and the original `group` holds it. */
  | { kind: 'inside'; name: string; group: string }
  /** The bearer's traits are the player's, and the player already holds the original. */
  | { kind: 'player'; name: string };

/** The reason as one line. With `subject` the line names the bearer: "Bram already links Trust". */
export function heldReasonText(reason: HeldReason, subject?: string): string {
  const lead = subject ? `${subject} already` : 'Already';
  switch (reason.kind) {
    case 'links': return `${lead} links ${reason.name}`;
    case 'owns': return `${lead} owns ${reason.name}`;
    case 'group': return `${lead} links ${reason.group}, which holds ${reason.name}`;
    case 'inside': return `${lead} links ${reason.name}, which ${reason.group} holds`;
    case 'player': return `${lead} holds ${reason.name} as a player trait`;
  }
}
