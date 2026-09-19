/** The world author's answer to one compatibility offer. */
export type ReviewState = 'unreviewed' | 'approved' | 'declined';

/** A world that holds a linked copy of the component and has a listing of its own. */
export interface EligibleWorld {
  /** The world's listing id. An association names this, never the local copy. */
  listingId: string;
  name: string;
}

/** One association the component's listing already carries. */
export interface WorldAssociation {
  id: string;
  name: string;
  reviewState?: ReviewState;
}

/** One row of the component's Compatible Worlds section. */
export interface CompatibleWorldRow {
  listingId: string;
  name: string;
  /** A world here holds a linked copy right now. A row without one is an association the author has
   *  broken locally, so Publish removes it. */
  linked: boolean;
  /** Offer as add-on. Always false on a pending removal. */
  offered: boolean;
  /** The world author's answer, where they have given one. */
  reviewState?: ReviewState;
}

/**
 * Build the Compatible Worlds rows for one component.
 *
 * The linked worlds come first, in library order, each checked when the listing already offers it. An
 * association whose local link is gone follows as a pending removal: the author sees what publishing
 * takes away rather than losing it silently.
 *
 * @param eligible - The local worlds holding a linked copy that have a published counterpart
 * @param associations - What the component's listing is offered for today
 * @returns The rows to render, linked worlds first
 */
export function compatibleWorldRows(
  eligible: readonly EligibleWorld[], associations: readonly WorldAssociation[],
): CompatibleWorldRow[] {
  const offered = new Map(associations.map((row) => [row.id, row]));
  const rows: CompatibleWorldRow[] = eligible.map((world) => {
    const association = offered.get(world.listingId);
    return {
      listingId: world.listingId,
      name: world.name,
      linked: true,
      offered: Boolean(association),
      ...(association?.reviewState ? { reviewState: association.reviewState } : {}),
    };
  });

  const linked = new Set(eligible.map((world) => world.listingId));
  for (const association of associations) {
    if (linked.has(association.id)) continue;
    rows.push({
      listingId: association.id,
      name: association.name,
      linked: false,
      offered: false,
      ...(association.reviewState ? { reviewState: association.reviewState } : {}),
    });
  }

  return rows;
}

/** A published world a prompt can be offered for. `pinned` says the world's own preset pin names the prompt. */
export interface PromptWorld extends EligibleWorld {
  pinned: boolean;
}

/**
 * Build the Compatible Worlds rows for a prompt.
 *
 * A prompt has no linked copy, so the offer is the author's declaration: every published world is a row.
 * A new listing checks the worlds pinned to the preset. An update starts from what the listing offers, and
 * keeps an offer for a world this device has no copy of.
 *
 * @param worlds - The local worlds that have a listing
 * @param associations - What the listing offers today, or null for a new listing
 * @returns The rows to render, local worlds first
 */
export function promptCompatibleRows(
  worlds: readonly PromptWorld[], associations: readonly WorldAssociation[] | null,
): CompatibleWorldRow[] {
  const offered = new Map((associations ?? []).map((row) => [row.id, row]));
  const rows: CompatibleWorldRow[] = worlds.map((world) => {
    const association = offered.get(world.listingId);
    return {
      listingId: world.listingId,
      name: world.name,
      linked: true,
      offered: associations ? Boolean(association) : world.pinned,
      ...(association?.reviewState ? { reviewState: association.reviewState } : {}),
    };
  });

  const local = new Set(worlds.map((world) => world.listingId));
  for (const association of associations ?? []) {
    if (local.has(association.id)) continue;
    rows.push({
      listingId: association.id,
      name: association.name,
      linked: true,
      offered: true,
      ...(association.reviewState ? { reviewState: association.reviewState } : {}),
    });
  }

  return rows;
}

/** The world listing ids this publish offers the component for. An unlisted component offers none: it is
 *  reachable only through a world that requires it, so it can never be an add-on. */
export function offeredWorldIds(
  rows: readonly CompatibleWorldRow[], visibility: 'public' | 'unlisted' = 'public',
): string[] {
  if (visibility === 'unlisted') return [];
  return rows.filter((row) => row.linked && row.offered).map((row) => row.listingId);
}

/** Whether this publish has anything to say about compatibility. A component with no eligible world
 *  replacing a listing that is offered for none sends nothing. */
export function declaresCompatibility(rows: readonly CompatibleWorldRow[]): boolean {
  return rows.length > 0;
}
