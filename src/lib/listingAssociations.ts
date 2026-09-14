/**
 * A component listing's world associations, as a reader of that listing sees them.
 *
 * The publishing side of the same relationship is `compatibleWorlds`, which is built from the author's
 * local links. This one is built from what the server answered, so it is the only view a player who
 * never linked the component has.
 */

import type { ReviewState, WorldAssociation } from '@/lib/compatibleWorlds';

/** One world a component is offered for, with the world author's answer. */
export interface AssociationRow {
  /** The world listing's id. Opening the row addresses this. */
  id: string;
  name: string;
  reviewState: ReviewState;
}

/** The offers split by the world author's answer. */
export interface AssociationGroups {
  approved: AssociationRow[];
  community: AssociationRow[];
  /** Offers the world author turned away, for the component's author and for staff. Empty for everybody
   *  else, whatever the server sent. */
  declined: AssociationRow[];
}

/** What each group means to the reader. */
export const ASSOCIATION_NOTES = {
  approved: 'The world author recommends this content for these worlds.',
  community: 'This content is offered for these worlds. Their authors have not reviewed it.',
  declined: 'The author of each world below turned this offer away.',
} as const;

/** The label a declined row carries, per the spec's wording. */
export const NOT_RECOMMENDED = 'Not recommended by the world author';

/**
 * Split one listing's associations into the groups its details section draws.
 *
 * An offer with no answer reads as community, which is what the server means by leaving the state off.
 * An offer naming no world is dropped: the row exists to open that world, and one that cannot be opened
 * is a dead entry rather than information.
 *
 * A declined offer is dropped here unless the reader is owed it. The server already withholds one from
 * everybody but the component's author and staff; dropping it again means a server that over-sends still
 * cannot show a player a world its author turned away.
 *
 * @param associations - What the listing read answered with, or undefined against a server without the field
 * @param includeDeclined - The reader is the component's author or staff
 * @returns The three groups, each in the order the server gave them
 */
export function associationGroups(
  associations: readonly WorldAssociation[] | undefined, includeDeclined = false,
): AssociationGroups {
  const rows: AssociationRow[] = (associations ?? [])
    .filter((association) => Boolean(association?.id))
    .map((association) => ({
      id: association.id,
      name: association.name || 'Untitled',
      reviewState: association.reviewState ?? 'unreviewed',
    }));

  return {
    approved: rows.filter((row) => row.reviewState === 'approved'),
    community: rows.filter((row) => row.reviewState === 'unreviewed'),
    declined: includeDeclined ? rows.filter((row) => row.reviewState === 'declined') : [],
  };
}

/** Whether this listing has anything to say about the worlds it fits. */
export function hasAssociations(groups: AssociationGroups): boolean {
  return groups.approved.length > 0 || groups.community.length > 0 || groups.declined.length > 0;
}
