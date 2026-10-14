// Why an owner can't link a Blueprint again. The trait and stat Link menus show it on each refused row.

/** What an owner already holds that blocks a link to one original. `name` is the item named in the text. */
export type HeldReason =
  /** The owner links this original. */
  | { kind: 'links'; name: string }
  /** The owner owns a stat under the original's id, as Detach leaves it. */
  | { kind: 'owns'; name: string }
  /** The owner links `group`, and the original `name` sits inside it. */
  | { kind: 'group'; name: string; group: string }
  /** The owner links `name`, and the original `group` holds it. */
  | { kind: 'inside'; name: string; group: string };

/** The reason as one line. With `subject` the line names the owner: "Bram already links Trust". */
export function heldReasonText(reason: HeldReason, subject?: string): string {
  const lead = subject ? `${subject} already` : 'Already';
  switch (reason.kind) {
    case 'links': return `${lead} links ${reason.name}`;
    case 'owns': return `${lead} owns ${reason.name}`;
    case 'group': return `${lead} links ${reason.group}, which holds ${reason.name}`;
    case 'inside': return `${lead} links ${reason.name}, which ${reason.group} holds`;
  }
}
