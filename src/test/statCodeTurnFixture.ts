import {
  splitOwnerTurns, type OwnerCodeTurn, type SandboxState, type StatCodeTurn,
} from '@/lib/statCodeTurn';

/** A turn as a test writes it: the board's fields beside the turn's own, each owner as one row. */
export type FlatStatCodeTurn = Omit<StatCodeTurn, 'state' | 'ownerTurns'> & Omit<SandboxState, 'owners'> & {
  owners?: readonly OwnerCodeTurn[];
};

/** `flat` as the turn module takes it. A field left out stays out. */
export function statCodeTurnOf({
  stats, enabled, owners, gateStats, ownerTraits, placeholders, places, positions, followers, resolveText, clock, memories, notes, turn, ...rest
}: FlatStatCodeTurn): StatCodeTurn {
  // A state field missing from the list above would stay on the turn; this fails to compile then.
  const onlyTurnFields: [Exclude<keyof typeof rest, keyof StatCodeTurn>] extends [never] ? true : false = true;
  void onlyTurnFields;
  const split = owners && splitOwnerTurns(owners);
  return {
    ...rest,
    state: {
      stats, enabled, clock, ownerTraits,
      ...(split ? { owners: split.owners } : {}),
      ...(gateStats ? { gateStats } : {}),
      ...(placeholders ? { placeholders } : {}),
      ...(places ? { places } : {}),
      ...(positions ? { positions } : {}),
      ...(followers ? { followers } : {}),
      ...(resolveText ? { resolveText } : {}),
      ...(memories ? { memories } : {}),
      ...(notes ? { notes } : {}),
      ...(turn ? { turn } : {}),
    },
    ...(split ? { ownerTurns: split.ownerTurns } : {}),
  };
}
